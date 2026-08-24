import test from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";

import { BOLD, EMPHASIS, colorFormat, toggleFormat, clearFormat, tidyEditable, editableRootOf, formattableSelection } from "../src/inlineFormat";
import { htmlToMarkup } from "../src/editorHelpers";

/** Select `text` inside `root`, the way a user's drag would leave the selection. */
const select = (document: Document, root: HTMLElement, selection: Selection, text: string): void => {
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const index = (node.nodeValue ?? "").indexOf(text);
    if (index < 0) continue;
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + text.length);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }
  throw new Error(`"${text}" is not in ${root.innerHTML}`);
};

/** An editable leaf holding `html`, with `text` selected inside it. */
const selecting = (html: string, text: string) => {
  const dom = new JSDOM(`<!doctype html><body><p data-mulmo-path="title" contenteditable="true">${html}</p></body>`);
  const { document, Node, NodeFilter, getSelection } = dom.window;
  Object.assign(globalThis, { Node, NodeFilter });
  const root = document.querySelector<HTMLElement>("[data-mulmo-path]");
  if (!root) throw new Error("no editable root");
  const selection = getSelection();
  if (!selection) throw new Error("no selection");
  if (text) select(document, root, selection, text);
  return { root, selection, html: () => root.innerHTML, markup: () => htmlToMarkup(root.innerHTML) };
};

test("bold wraps the selection, and the existing commit reads it as deck markup", () => {
  const it = selecting("hello world", "hello");
  assert.equal(toggleFormat(it.selection, BOLD), true);
  assert.equal(it.html(), "<strong>hello</strong> world");
  assert.equal(it.markup(), "**hello** world");
});

test("bold again on the same selection removes it", () => {
  // The toggle is what makes one button enough. Without it the only way back is Clear,
  // which also drops any colour the text had.
  const it = selecting("hello world", "hello");
  toggleFormat(it.selection, BOLD);
  assert.equal(toggleFormat(it.selection, BOLD), true, "the second press must act");
  assert.equal(it.html(), "hello world");
  assert.equal(it.markup(), "hello world");
});

test("toggling off a PART of a formatted run splits it, rather than clearing the whole run", () => {
  // Codex round 1. Unwrapping the enclosing element whenever both endpoints are inside it is
  // too broad: un-bolding `ol` inside `bold` removed the bold from all of it.
  [
    { pick: "ol", want: "**b**ol**d**" },
    { pick: "b", want: "b**old**" },
    { pick: "d", want: "**bol**d" },
    { pick: "bold", want: "bold" },
  ].forEach(({ pick, want }) => {
    const it = selecting("<strong>bold</strong>", pick);
    assert.equal(toggleFormat(it.selection, BOLD), true, pick);
    assert.equal(it.markup(), want, `un-bolding "${pick}"`);
  });
});

test("toggling off one format keeps the others it sits inside", () => {
  const inColour = selecting('<span class="text-d-primary"><strong>bold</strong></span>', "ol");
  toggleFormat(inColour.selection, BOLD);
  assert.equal(inColour.markup(), "{primary:**b**ol**d**}", "the colour survives losing the bold");

  const inBold = selecting('<strong><span class="text-d-primary">bold</span></strong>', "ol");
  toggleFormat(inBold.selection, colorFormat("primary"));
  assert.equal(inBold.markup(), "**{primary:b}ol{primary:d}**", "and the bold survives losing the colour");
});

test("removing an OUTER format puts the inner ones back around the run", () => {
  // Reaching the colour means lifting past the bold first. Without putting it back, "ol" would
  // come out unbolded — a format the user never touched, silently dropped.
  const it = selecting('<span class="text-d-primary"><strong>bold</strong></span>', "ol");
  toggleFormat(it.selection, colorFormat("primary"));
  assert.equal(it.markup(), "{primary:**b**}**ol**{primary:**d**}");
});

test("removal stops at the format it was asked for", () => {
  // Without stopping, the lift keeps going and splits every ancestor above the match too.
  const it = selecting('<em class="text-d-warning not-italic font-bold"><span class="text-d-primary"><strong>bold</strong></span></em>', "ol");
  toggleFormat(it.selection, colorFormat("primary"));
  assert.equal(it.markup(), "*{primary:**b**}**ol**{primary:**d**}*", "the emphasis still wraps the whole run");
});

test("clear inside a colour takes only what was selected", () => {
  const it = selecting('<span class="text-d-primary"><strong>bold</strong></span>', "ol");
  clearFormat(it.selection);
  assert.equal(it.markup(), "{primary:**b**}ol{primary:**d**}");
});

test("emphasis carries the classes deck renders it with", () => {
  const it = selecting("warn me", "warn");
  toggleFormat(it.selection, EMPHASIS);
  assert.match(it.html(), /class="text-d-warning not-italic font-bold"/);
  assert.equal(it.markup(), "*warn* me");
});

test("each accent colour round-trips to its deck form", () => {
  (["primary", "accent", "success", "warning", "danger", "info", "highlight"] as const).forEach((color) => {
    const it = selecting("pick me", "pick");
    toggleFormat(it.selection, colorFormat(color));
    assert.equal(it.markup(), `{${color}:pick} me`, color);
  });
});

test("bold inside a colour nests, and deck reads it back", () => {
  // Bold applied after a colour lands INSIDE the span, so the markup nests the other way
  // round from what the buttons' order suggests. Measured against the renderer, both forms
  // come back the same: `{success:**both**}` and `**{success:both}**` each produce a
  // `<span class="text-d-success">` around a `<strong>` or the reverse.
  const it = selecting("both here", "both");
  toggleFormat(it.selection, colorFormat("success"));
  toggleFormat(it.selection, BOLD);
  assert.equal(it.markup(), "{success:**both**} here");
});

test("clear takes the formatting off and leaves the text", () => {
  // The obvious implementation — delete the range and insert plain text — leaves the
  // insertion point INSIDE the wrapper. Measured: it returned true and changed nothing.
  const it = selecting('<strong>bold</strong> and <span class="text-d-primary">blue</span>', "bold");
  assert.equal(clearFormat(it.selection), true);
  assert.equal(it.markup(), "bold and {primary:blue}", "only the selected run is cleared");
});

test("clear on part of a formatted run splits it", () => {
  [
    { pick: "b", want: "b**old**" },
    { pick: "d", want: "**bol**d" },
    { pick: "ol", want: "**b**ol**d**" },
  ].forEach(({ pick, want }) => {
    const it = selecting("<strong>bold</strong>", pick);
    assert.equal(clearFormat(it.selection), true, pick);
    assert.equal(it.markup(), want, `clearing "${pick}"`);
  });
});

test("clear removes every layer, not just the innermost", () => {
  const it = selecting('<span class="text-d-primary"><strong>deep</strong></span>', "deep");
  clearFormat(it.selection);
  assert.equal(it.markup(), "deep");
});

test("a selection that crosses an element boundary still wraps", () => {
  // `Range.surroundContents` throws for this; the fallback extracts and re-inserts.
  const it = selecting("<em>a</em>b", "b");
  assert.equal(toggleFormat(it.selection, BOLD), true);
  assert.match(it.html(), /<strong>b<\/strong>/);
});

test("tidyEditable removes the debris that would convert badly", () => {
  const dom = new JSDOM(
    '<!doctype html><body><p data-mulmo-path="t"><strong></strong><strong><strong>x</strong></strong><strong>a</strong><strong>b</strong></p></body>',
  );
  Object.assign(globalThis, { Node: dom.window.Node, NodeFilter: dom.window.NodeFilter });
  const root = dom.window.document.querySelector<HTMLElement>("[data-mulmo-path]");
  if (!root) throw new Error("no root");
  tidyEditable(root);
  assert.equal(root.innerHTML, "<strong>xab</strong>");
  // Without the tidy this converts to `********x****a****b**`.
  assert.equal(htmlToMarkup(root.innerHTML), "**xab**");
});

test("nothing happens without a usable selection", () => {
  const it = selecting("hello", "");
  assert.equal(toggleFormat(it.selection, BOLD), false, "no selection");
  assert.equal(clearFormat(it.selection), false);
  assert.equal(formattableSelection(null), null);
});

test("a selection outside an editable leaf is refused", () => {
  const dom = new JSDOM("<!doctype html><body><p>not editable</p></body>");
  Object.assign(globalThis, { Node: dom.window.Node, NodeFilter: dom.window.NodeFilter });
  const p = dom.window.document.querySelector("p");
  const selection = dom.window.getSelection();
  const range = dom.window.document.createRange();
  if (!p?.firstChild || !selection) throw new Error("setup");
  range.setStart(p.firstChild, 0);
  range.setEnd(p.firstChild, 3);
  selection.addRange(range);
  assert.equal(toggleFormat(selection, BOLD), false);
  assert.equal(editableRootOf(p.firstChild), null);
});

test("a selection inside a leaf that is not being edited is refused", () => {
  // The markers exist on every rendered slide beat; only the one with the caret may be formatted.
  const dom = new JSDOM('<!doctype html><body><p data-mulmo-path="title">read only</p></body>');
  Object.assign(globalThis, { Node: dom.window.Node, NodeFilter: dom.window.NodeFilter });
  const p = dom.window.document.querySelector("p");
  const selection = dom.window.getSelection();
  const range = dom.window.document.createRange();
  if (!p?.firstChild || !selection) throw new Error("setup");
  range.setStart(p.firstChild, 0);
  range.setEnd(p.firstChild, 4);
  selection.addRange(range);
  assert.equal(toggleFormat(selection, BOLD), false, "no contenteditable, no formatting");
});

/**
 * The shapes where `tidyEditable`'s cost is its own algorithm rather than jsdom's DOM.
 *
 * Deep same-kind nesting is deliberately absent: at depth 400 jsdom spends 714 of 719ms inside
 * `insertBefore`/`removeChild`, while Chromium unwraps 2000 levels in 31ms. Budgeting that here
 * would measure jsdom.
 */
const TIDY_SHAPES: [string, string][] = [
  ["adjacent siblings", "<strong>a</strong>".repeat(2000)],
  ["empty wrappers", "<strong></strong>".repeat(4000)],
  ["alternating colours", '<span class="text-d-primary">a</span><span class="text-d-danger">b</span>'.repeat(1000)],
  ["nested and adjacent", "<em><em>a</em></em><em>b</em>".repeat(600)],
];

test("tidyEditable is not super-linear on the shapes a paste can produce", () => {
  // Re-querying the whole subtree after every change is what this catches. Measured: with the
  // search-and-restart version, "adjacent siblings" alone took 4382ms and "nested and adjacent"
  // 3291ms, against 33ms and 26ms for the single-pass one. 2000 bold runs in a title is not a
  // thing a person types, and it is a thing a paste can carry.
  const dom = new JSDOM("<!doctype html><body></body>");
  Object.assign(globalThis, { Node: dom.window.Node, NodeFilter: dom.window.NodeFilter });

  const started = performance.now();
  TIDY_SHAPES.forEach(([, html]) => {
    const holder = dom.window.document.createElement("p");
    holder.setAttribute("data-mulmo-path", "t");
    holder.innerHTML = html;
    tidyEditable(holder);
  });
  const elapsed = performance.now() - started;

  assert.ok(elapsed < 500, `tidyEditable took ${Math.round(elapsed)}ms over ${TIDY_SHAPES.length} shapes (healthy is under 100ms); the quadratic pass is back`);
});
