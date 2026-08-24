import test from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { renderInlineMarkup } from "@mulmocast/deck";

import { htmlToMarkup } from "../src/editorHelpers";
import { BOLD, EMPHASIS, colorFormat, toggleFormat, clearFormat } from "../src/inlineFormat";

/**
 * What the editor stores must render back to what the user was looking at.
 *
 * Every other formatting test applies ONE format to a freshly rendered leaf and asserts the
 * markup. That cannot see the failure users hit, which is the loop: the value goes back through
 * deck's renderer, gets edited again, and drifts. deck's `renderInlineMarkup` is a chain of
 * regexes with no nesting, so a value the editor can produce but deck cannot parse turns its
 * own delimiters into visible text — and the next edit formats THOSE (issue #64).
 */

const PLAIN_MARKUP = /\*\*|\*|\{[a-z]+:|\}/g;

// One document for the whole sweep. A JSDOM per edit is what a thousands-of-edits sweep cannot
// afford — measured, it OOMs the runner at ~4 GB before finishing.
const dom = new JSDOM('<!doctype html><body><p data-mulmo-path="quote" contenteditable="true"></p><p id="offscreen"></p></body>');
const { document, getSelection } = dom.window;
Object.assign(globalThis, { Node: dom.window.Node, NodeFilter: dom.window.NodeFilter });
const editable = document.querySelector<HTMLElement>("[data-mulmo-path]");
const offscreen = document.querySelector<HTMLElement>("#offscreen");
const liveSelection = getSelection();
if (!editable || !offscreen || !liveSelection) throw new Error("setup");

/** The text deck puts on screen for a stored value. */
const visibleText = (markup: string): string => {
  offscreen.innerHTML = renderInlineMarkup(markup);
  return offscreen.textContent;
};

type Leaf = { root: HTMLElement; selection: Selection; document: Document };

/** The editable leaf, reset to hold `value` as deck would render it. */
const leafFor = (value: string): Leaf => {
  liveSelection.removeAllRanges();
  editable.innerHTML = renderInlineMarkup(value);
  return { root: editable, selection: liveSelection, document };
};

/** A range over characters `from`..`to` of `root`'s text, crossing elements as needed. */
const rangeOverCharacters = ({ root, document }: Leaf, from: number, to: number): Range | null => {
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const range = document.createRange();
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = (node.nodeValue ?? "").length;
    if (!started && seen + length >= from) {
      range.setStart(node, from - seen);
      started = true;
    }
    if (started && seen + length >= to) {
      range.setEnd(node, to - seen);
      return range;
    }
    seen += length;
  }
  return null;
};

/** Select characters `from`..`to` of the leaf's text. */
const selectChars = (leaf: Leaf, from: number, to: number): boolean => {
  const range = rangeOverCharacters(leaf, from, to);
  if (!range) return false;
  leaf.selection.removeAllRanges();
  leaf.selection.addRange(range);
  return true;
};

const OPERATIONS = [
  { name: "bold", apply: (selection: Selection) => toggleFormat(selection, BOLD) },
  { name: "emphasis", apply: (selection: Selection) => toggleFormat(selection, EMPHASIS) },
  { name: "primary", apply: (selection: Selection) => toggleFormat(selection, colorFormat("primary")) },
  { name: "warning", apply: (selection: Selection) => toggleFormat(selection, colorFormat("warning")) },
  { name: "clear", apply: (selection: Selection) => clearFormat(selection) },
] as const;

type Operation = { name: string; apply: (selection: Selection) => boolean };

/** The colours the random cycle reaches for, beyond the two the exhaustive sweep already uses. */
const CYCLE_OPERATIONS: readonly Operation[] = [
  ...OPERATIONS,
  { name: "accent", apply: (selection: Selection) => toggleFormat(selection, colorFormat("accent")) },
  { name: "danger", apply: (selection: Selection) => toggleFormat(selection, colorFormat("danger")) },
];

/** Short values, swept exhaustively — every operation over every range is O(n²) in the text. */
const EXHAUSTIVE_VALUES = ["alpha beta", "**alpha** beta", "{primary:alpha} beta", "*alpha* beta", "**{primary:alpha}** beta"];

/** Longer and more varied values, edited in random sequences rather than exhaustively. */
const CYCLE_VALUES = [
  ...EXHAUSTIVE_VALUES,
  "{warning:a} {primary:b} {accent:c}",
  'say "hello" to me',
  "デザインとは 見た目 のことではない",
  "a & b < c > d",
  "one **two** *three* {danger:four} five",
  "{primary:**bold and colour**} tail",
  "*a* *b* *c*",
  "x",
];

const TRIALS_PER_VALUE = 40;
const EDITS_PER_TRIAL = 8;

type Edit = { operation: number; from: number; to: number };

/** One edit: render the value, select, format, and read the value back the way a commit does. */
const editOnce = (value: string, { operation, from, to }: Edit, table: readonly Operation[] = OPERATIONS): { value: string; onScreen: string } | null => {
  const leaf = leafFor(value);
  if (!selectChars(leaf, from, to)) return null;
  table[operation].apply(leaf.selection);
  return { value: htmlToMarkup(leaf.root.innerHTML), onScreen: leaf.root.textContent };
};

// ─── the starting values have to be fair ───

test("every value the sweeps start from is one deck can already render", () => {
  // A start whose own text still carries a delimiter would make the sweeps measure deck's
  // inability to parse it rather than anything the editor did. Literal `*` and `{` typed into a
  // beat are a separate, known gap: nothing escapes them on the way into the value.
  const unstable = CYCLE_VALUES.filter((value) => /[*{}]/.test(visibleText(value)));
  assert.deepStrictEqual(unstable, []);
});

// ─── every single operation, over every range ───

/** Every (operation, from, to) the toolbar could be asked for on this value. */
const everyEdit = (value: string, table: readonly Operation[]): Edit[] => {
  const length = visibleText(value).length;
  const edits: Edit[] = [];
  table.forEach((_operation, operation) => {
    for (let from = 0; from < length; from++) {
      for (let to = from + 1; to <= length; to++) edits.push({ operation, from, to });
    }
  });
  return edits;
};

const label = (start: string, { operation, from, to }: Edit, table: readonly Operation[]): string => `${start} | ${table[operation].name}(${from},${to})`;

test("a single format on any range stores a value that renders back to what was on screen", () => {
  const damaged: string[] = [];
  let checked = 0;
  EXHAUSTIVE_VALUES.forEach((start) => {
    everyEdit(start, OPERATIONS).forEach((edit) => {
      const result = editOnce(start, edit);
      if (!result) return;
      checked++;
      const reloaded = visibleText(result.value);
      if (reloaded === result.onScreen) return;
      damaged.push(
        `${label(start, edit, OPERATIONS)} → 画面 ${JSON.stringify(result.onScreen)} / 値 ${JSON.stringify(result.value)} / 再表示 ${JSON.stringify(reloaded)}`,
      );
    });
  });
  // The count is the point: a zero here is only worth what the sweep covers.
  assert.ok(checked >= 1000, `the sweep must actually run: ${checked}`);
  assert.deepStrictEqual(damaged.slice(0, 8), [], `${damaged.length} of ${checked} single edits do not survive a reload`);
});

// ─── the same operation twice ───

test("applying a format and undoing it returns the value it started from", () => {
  const drifted: string[] = [];
  EXHAUSTIVE_VALUES.forEach((start) => {
    const undoable = everyEdit(start, OPERATIONS).filter(({ operation }) => OPERATIONS[operation].name !== "clear");
    undoable.forEach((edit) => {
      const once = editOnce(start, edit);
      const twice = once && editOnce(once.value, edit);
      if (!twice || visibleText(twice.value) === visibleText(start)) return;
      drifted.push(`${label(start, edit, OPERATIONS)} ×2 → ${JSON.stringify(twice.value)}`);
    });
  });
  assert.deepStrictEqual(drifted.slice(0, 8), [], `${drifted.length} toggles do not come back`);
});

// ─── editing an already-edited value, over and over ───

/** Deterministic: a seeded generator, so a failure names a plan that can be replayed. */
const sequence = (seed: number) => {
  let state = seed;
  return (bound: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return bound === 0 ? 0 : state % bound;
  };
};

const randomPlan = (next: (bound: number) => number, length: number): Edit[] =>
  Array.from({ length: EDITS_PER_TRIAL }, () => {
    const a = next(length);
    const b = next(length);
    return { operation: next(CYCLE_OPERATIONS.length), from: Math.min(a, b), to: Math.max(a, b) };
  });

/** The value after each edit of the plan, starting with the one it began from. */
const runPlan = (start: string, plan: Edit[]): string[] => {
  const values = [start];
  plan.forEach((edit) => {
    const result = editOnce(values[values.length - 1], edit, CYCLE_OPERATIONS);
    if (result) values.push(result.value);
  });
  return values;
};

test("stacking edits on one leaf never changes the text and never grows without bound", () => {
  const next = sequence(12345);
  const broken: string[] = [];
  let runs = 0;
  CYCLE_VALUES.forEach((start) => {
    const expected = visibleText(start);
    for (let trial = 0; trial < TRIALS_PER_VALUE; trial++) {
      const plan = randomPlan(next, expected.length);
      const values = runPlan(start, plan);
      runs++;
      const replay = plan.map((edit) => label("", edit, CYCLE_OPERATIONS).slice(3)).join(" → ");
      if (values.some((value) => visibleText(value) !== expected)) broken.push(`テキストが変化 [${replay}] ${JSON.stringify(values)}`);
      const last = values[values.length - 1];
      if (last.replace(PLAIN_MARKUP, "").length !== expected.length) broken.push(`文字数が変化 [${replay}] ${JSON.stringify(last)}`);
    }
  });
  assert.equal(runs, CYCLE_VALUES.length * TRIALS_PER_VALUE);
  assert.deepStrictEqual(broken.slice(0, 6), [], `${broken.length} of ${runs} edit sequences corrupt the leaf`);
});

// ─── the property the whole thing rests on ───

test("deck cannot parse a value with nested same-kind markup, so the editor must not write one", () => {
  // Not a wish: this is what deck does today, and it is why the editor flattens.
  assert.equal(visibleText("{warning:a{primary:b}c}"), "a{primary:bc}");
  assert.equal(visibleText("{warning:{primary:b}}"), "{primary:b}");
  assert.equal(visibleText("****x****"), "**x**");
  // …and the forms it CAN read, which is what the editor is allowed to produce.
  assert.equal(visibleText("{warning:a}{primary:b}{warning:c}"), "abc");
  assert.equal(visibleText("{primary:**a**}"), "a");
  assert.equal(visibleText("**{primary:a}**"), "a");
  assert.equal(visibleText("*al*{primary:pha}"), "alpha");
});
