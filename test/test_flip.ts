import test from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";

import { captureItemRects, indexBeforeMove, pathBeforeMove, playItemFlip } from "../src/flip";

// ─── the permutation, which is the whole of the matching ───

/** Move `from` to `to` the way `moveByPath` does, so the expectation is not hand-derived. */
const moved = <T>(items: T[], from: number, to: number): T[] => {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

test("indexBeforeMove names, for every move of every size, where each item came from", () => {
  let checked = 0;
  for (let length = 2; length <= 7; length++) {
    const before = Array.from({ length }, (_unused, index) => index);
    for (let from = 0; from < length; from++) {
      for (let to = 0; to < length; to++) {
        const after = moved(before, from, to);
        after.forEach((original, index) => {
          checked++;
          assert.equal(indexBeforeMove(index, from, to), original, `length ${length}, ${from}→${to}, index ${index}`);
        });
      }
    }
  }
  assert.ok(checked >= 500, `the sweep must actually run: ${checked}`);
});

test("pathBeforeMove keeps the array and rewrites only the index", () => {
  assert.equal(pathBeforeMove("items[2]", "items[0]", "items[2]"), "items[0]");
  assert.equal(pathBeforeMove("items[0]", "items[0]", "items[2]"), "items[1]");
  assert.equal(pathBeforeMove("left.content[0].items[1]", "left.content[0].items[1]", "left.content[0].items[0]"), "left.content[0].items[0]");
});

test("pathBeforeMove refuses a path from another array, which must not borrow a rectangle", () => {
  assert.equal(pathBeforeMove("stats[0]", "items[0]", "items[2]"), null);
  assert.equal(pathBeforeMove("items[0]", "items[0]", "stats[2]"), null);
  assert.equal(pathBeforeMove("title", "items[0]", "items[2]"), null);
});

// ─── the play, driven against a document ───

const rowMarkup = (path: string): string => `<div data-mulmo-item-path="${path}">${path}</div>`;

const listOf = (paths: string[]): HTMLElement => {
  const dom = new JSDOM(`<!doctype html><body><div id="root">${paths.map(rowMarkup).join("")}</div></body>`);
  const root = dom.window.document.querySelector<HTMLElement>("#root");
  if (!root) throw new Error("setup");
  return root;
};

type Placement = { left: number; top: number };

/** jsdom has no layout, so every rect is zero. Stand in for one, keyed by the path. */
const stubRects = (root: HTMLElement, place: (path: string) => Placement): void => {
  root.getBoundingClientRect = () => rectAt({ left: 0, top: 0 });
  root.querySelectorAll<HTMLElement>("[data-mulmo-item-path]").forEach((element) => {
    const at = place(element.getAttribute("data-mulmo-item-path") ?? "");
    element.getBoundingClientRect = () => rectAt(at);
  });
};

const rectAt = ({ left, top }: Placement): DOMRect => ({ top, left, right: left, bottom: top, width: 0, height: 0, x: left, y: top, toJSON: () => ({}) });

/**
 * What was written to `style.transform`, in order.
 *
 * The play clears the transform in the same synchronous call, so reading the property afterwards
 * cannot see the invert — and the invert is the whole of FLIP. Measured before this spy existed:
 * flipping the sign, and deleting the write outright, both left every test green.
 */
const recordTransforms = (root: HTMLElement): Map<string, string[]> => {
  const written = new Map<string, string[]>();
  root.querySelectorAll<HTMLElement>("[data-mulmo-item-path]").forEach((element) => {
    const path = element.getAttribute("data-mulmo-item-path") ?? "";
    const log: string[] = [];
    written.set(path, log);
    let held = "";
    Object.defineProperty(element.style, "transform", {
      configurable: true,
      get: () => held,
      set: (value: string) => {
        held = value;
        log.push(value);
      },
    });
  });
  return written;
};

/** A path is a POSITION, so the same paths are on screen in the same order after a reorder. */
const rowsOf = (count: number) => Array.from({ length: count }, (_unused, index) => `items[${index}]`);

const GAP = 100;

const flipOver = (count: number, fromPath: string, toPath: string, axis: "vertical" | "horizontal" = "vertical") => {
  const rows = rowsOf(count);
  const place = (path: string): Placement => {
    const offset = rows.indexOf(path) * GAP;
    return axis === "vertical" ? { left: 0, top: offset } : { left: offset, top: 0 };
  };
  const first = listOf(rows);
  stubRects(first, place);
  const before = captureItemRects(first);
  const after = listOf(rows);
  stubRects(after, place);
  const written = recordTransforms(after);
  const moves = playItemFlip(after, before, fromPath, toPath);
  const transitions = [...after.querySelectorAll<HTMLElement>("[data-mulmo-item-path]")].map((element) => element.style.transition);
  return { moves, written, transitions, before };
};

test("playItemFlip inverts each item by exactly the distance it travelled", () => {
  // [A,B,C] with the last dropped first is [C,A,B]: C rises two slots, A and B each fall one.
  const rotation = flipOver(3, "items[2]", "items[0]");
  assert.equal(rotation.before.size, 3);
  assert.deepStrictEqual(
    rotation.moves.map(({ dx, dy }) => ({ dx, dy })),
    [
      { dx: 0, dy: 2 * GAP },
      { dx: 0, dy: -GAP },
      { dx: 0, dy: -GAP },
    ],
  );
  // Written, then released — the invert must reach the element, not merely be computed.
  assert.deepStrictEqual(rotation.written.get("items[0]"), [`translate(0px, ${2 * GAP}px)`, ""]);
  assert.deepStrictEqual(rotation.written.get("items[1]"), [`translate(0px, ${-GAP}px)`, ""]);
  assert.deepStrictEqual(rotation.transitions, ["transform 180ms ease", "transform 180ms ease", "transform 180ms ease"]);
});

test("playItemFlip inverts along the horizontal axis too, which deck's row layouts need", () => {
  // `columns`, `stats` and `timeline` lay their items out in a flex ROW.
  const swap = flipOver(4, "items[0]", "items[1]", "horizontal");
  assert.deepStrictEqual(
    swap.moves.map(({ dx, dy }) => ({ dx, dy })),
    [
      { dx: GAP, dy: 0 },
      { dx: -GAP, dy: 0 },
    ],
  );
  assert.deepStrictEqual(swap.written.get("items[0]"), [`translate(${GAP}px, 0px)`, ""]);
});

test("playItemFlip leaves the items that did not move entirely alone", () => {
  // Swapping the first two of four must not touch the last two.
  const swap = flipOver(4, "items[0]", "items[1]");
  assert.equal(swap.moves.length, 2);
  assert.deepStrictEqual(swap.transitions, ["transform 180ms ease", "transform 180ms ease", "", ""]);
  assert.deepStrictEqual(swap.written.get("items[2]"), []);
  assert.deepStrictEqual(swap.written.get("items[3]"), []);
});

test("playItemFlip suppresses the stagger animation that would otherwise outrank the transform", () => {
  // Deck emits `.mulmo-stagger [data-mulmo-item-path] { animation: … both }`, and an animation's
  // own value beats inline style for as long as it applies — with `both`, forever.
  const rotation = flipOver(3, "items[2]", "items[0]");
  const animations = [...rotation.moves].map(({ element }) => element.style.animation);
  assert.deepStrictEqual(animations, ["none", "none", "none"]);
});

test("playItemFlip does nothing when it has no rectangles to match against", () => {
  const root = listOf(["items[0]", "items[1]"]);
  assert.deepStrictEqual(playItemFlip(root, new Map(), "items[0]", "items[1]"), []);
  assert.deepStrictEqual(playItemFlip(null, new Map(), "items[0]", "items[1]"), []);
});

test("captureItemRects measures from the host, so a scroll between the two reads is not a move", () => {
  const rows = rowsOf(2);
  const root = listOf(rows);
  stubRects(root, (path) => ({ left: 0, top: rows.indexOf(path) * GAP }));
  const before = captureItemRects(root);
  // The whole host has scrolled 500px up; nothing moved relative to it.
  root.getBoundingClientRect = () => rectAt({ left: 0, top: -500 });
  root.querySelectorAll<HTMLElement>("[data-mulmo-item-path]").forEach((element) => {
    const at = { left: 0, top: rows.indexOf(element.getAttribute("data-mulmo-item-path") ?? "") * GAP - 500 };
    element.getBoundingClientRect = () => rectAt(at);
  });
  assert.deepStrictEqual(
    playItemFlip(root, before, "items[0]", "items[1]").map(({ dy }) => dy),
    [GAP, -GAP],
    "only the swap, not the scroll",
  );
});

test("captureItemRects can be scoped to one array, so an unrelated marker is not measured", () => {
  const dom = new JSDOM(
    '<!doctype html><body><div id="root"><div data-mulmo-item-path="items[0]">a</div><div data-mulmo-item-path="stats[0]">b</div></div></body>',
  );
  const root = dom.window.document.querySelector<HTMLElement>("#root");
  if (!root) throw new Error("setup");
  stubRects(root, () => ({ left: 0, top: 0 }));
  assert.deepStrictEqual([...captureItemRects(root).keys()], ["items[0]", "stats[0]"]);
  assert.deepStrictEqual([...captureItemRects(root, "items").keys()], ["items[0]"]);
});

test("captureItemRects ignores an element with no path and answers empty for no root", () => {
  const dom = new JSDOM('<!doctype html><body><div id="root"><div data-mulmo-item-path="">x</div><div>y</div></div></body>');
  const root = dom.window.document.querySelector<HTMLElement>("#root");
  if (!root) throw new Error("setup");
  stubRects(root, () => ({ left: 0, top: 0 }));
  assert.equal(captureItemRects(root).size, 0);
  assert.equal(captureItemRects(null).size, 0);
});
