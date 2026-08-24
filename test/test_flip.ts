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

const listOf = (paths: string[]): { root: HTMLElement; window: JSDOM["window"] } => {
  const dom = new JSDOM(`<!doctype html><body><div id="root">${paths.map(rowMarkup).join("")}</div></body>`);
  const root = dom.window.document.querySelector<HTMLElement>("#root");
  if (!root) throw new Error("setup");
  return { root, window: dom.window };
};

/** jsdom has no layout, so every rect is zero. Stand in for one, keyed by the path. */
const stubRects = (root: HTMLElement, top: (path: string) => number): void => {
  root.querySelectorAll<HTMLElement>("[data-mulmo-item-path]").forEach((element) => {
    const path = element.getAttribute("data-mulmo-item-path") ?? "";
    element.getBoundingClientRect = () => ({ top: top(path), left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top(path), toJSON: () => ({}) });
  });
};

/**
 * A path is a POSITION, so the markup after a reorder carries the same paths in the same order —
 * only the content behind them moved. The rows are therefore identical before and after; what
 * differs is which old rectangle each one is matched to.
 */
const rowsOf = (count: number) => Array.from({ length: count }, (_unused, index) => `items[${index}]`);

const flipOver = (count: number, fromPath: string, toPath: string) => {
  const rows = rowsOf(count);
  const top = (path: string) => rows.indexOf(path) * 100;
  const first = listOf(rows);
  stubRects(first.root, top);
  const before = captureItemRects(first.root);
  const after = listOf(rows);
  stubRects(after.root, top);
  const played = playItemFlip(after.root, before, fromPath, toPath);
  const styles = [...after.root.querySelectorAll<HTMLElement>("[data-mulmo-item-path]")].map((element) => element.style.transition);
  return { played, styles, before };
};

test("playItemFlip puts every item that changed place back where it was, and no others", () => {
  // Rotating three items moves all three: [A,B,C] dropped 2→0 is [C,A,B].
  const rotation = flipOver(3, "items[2]", "items[0]");
  assert.equal(rotation.before.size, 3);
  assert.equal(rotation.played, 3);
  assert.deepStrictEqual(rotation.styles, ["transform 180ms ease", "transform 180ms ease", "transform 180ms ease"]);

  // Swapping the first two of four leaves the last two alone.
  const swap = flipOver(4, "items[0]", "items[1]");
  assert.equal(swap.played, 2);
  assert.deepStrictEqual(swap.styles, ["transform 180ms ease", "transform 180ms ease", "", ""]);
});

test("playItemFlip does nothing when it has no rectangles to match against", () => {
  const { root } = listOf(["items[0]", "items[1]"]);
  assert.equal(playItemFlip(root, new Map(), "items[0]", "items[1]"), 0);
  assert.equal(playItemFlip(null, new Map(), "items[0]", "items[1]"), 0);
});

test("captureItemRects ignores an element with no path and answers empty for no root", () => {
  const dom = new JSDOM('<!doctype html><body><div id="root"><div data-mulmo-item-path="">x</div><div>y</div></div></body>');
  assert.equal(captureItemRects(dom.window.document.querySelector("#root")).size, 0);
  assert.equal(captureItemRects(null).size, 0);
});
