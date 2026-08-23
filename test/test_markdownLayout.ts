import test from "node:test";
import assert from "node:assert";

import {
  isMarkdownLayout,
  mainKindOf,
  slotsOf,
  slotText,
  writeSlot,
  setSlot,
  setFrame,
  switchMain,
  toLayout,
  isLosslessToString,
  MAIN_KINDS,
  SLOT_COUNT,
} from "../src/editors/markdownLayout";

// ─── isMarkdownLayout ───
// Decides whether the editor shows the slot form or the string form, so both directions
// matter: a false negative hides slots the author wrote, a false positive shows empty slots
// for a beat that has none.

test("isMarkdownLayout: each main identifies the layout form", () => {
  MAIN_KINDS.forEach((kind) => {
    assert.equal(isMarkdownLayout({ [kind]: "x" }), true, kind);
  });
});

test("isMarkdownLayout: a frame alone is not a layout", () => {
  assert.equal(isMarkdownLayout({ header: "h" }), false);
});

test("isMarkdownLayout: the string forms are not layouts", () => {
  ["# Heading", ["# Heading", "body"], "", undefined, null, 7].forEach((value) => {
    assert.equal(isMarkdownLayout(value), false, JSON.stringify(value));
  });
});

// ─── slots ───

test("slotText: an array joins the way the renderer joins it", () => {
  assert.equal(slotText(["a", "b"]), "a\nb");
});

test("slotText: a missing or malformed slot reads as empty", () => {
  [undefined, null, 7, {}, [1, 2]].forEach((value) => assert.equal(slotText(value), "", JSON.stringify(value)));
});

test("writeSlot: an authored array stays an array", () => {
  assert.deepEqual(writeSlot(["a"], "x\ny"), ["x", "y"]);
});

test("writeSlot: an authored string stays a string", () => {
  assert.equal(writeSlot("a", "x\ny"), "x\ny");
});

test("writeSlot: a slot that did not exist is written as a string", () => {
  assert.equal(writeSlot(undefined, "x"), "x");
});

test("slotsOf: content is one slot, and it is the value itself", () => {
  assert.deepEqual(slotsOf({ content: ["a", "b"] }), [["a", "b"]]);
});

test("slotsOf: a main is padded to the count it declares", () => {
  assert.equal(slotsOf({ "2x2": ["a"] }).length, SLOT_COUNT["2x2"]);
  assert.deepEqual(slotsOf({ "row-2": ["a", "b"] }), ["a", "b"]);
});

test("mainKindOf: a layout with several mains resolves in MAIN_KINDS order", () => {
  assert.equal(mainKindOf({ "2x2": [], content: "c" }), "content");
});

// ─── setSlot / setFrame ───

test("setSlot: writes one slot and leaves the others as authored", () => {
  const next = setSlot({ "row-2": ["left", ["r1", "r2"]] }, 0, "new");
  assert.deepEqual(next, { "row-2": ["new", ["r1", "r2"]] });
});

test("setSlot: content stays a bare value, not a one-element array", () => {
  assert.deepEqual(setSlot({ content: "old" }, 0, "new"), { content: "new" });
});

test("setSlot: a malformed sibling slot is repaired rather than carried through", () => {
  // A slot the schema does not allow can only have come from hand-edited JSON. Writing one
  // slot must not leave the others in a shape the renderer will not draw.
  assert.deepEqual(setSlot({ "row-2": ["a", 7] }, 0, "new"), { "row-2": ["new", ""] });
  assert.deepEqual(setSlot({ "2x2": [["ok"], null, {}, undefined] }, 3, "d"), { "2x2": [["ok"], "", "", "d"] });
});

test("setSlot: the frame is untouched", () => {
  const next = setSlot({ header: "h", "sidebar-left": ["s"], content: "c" }, 0, "c2");
  assert.deepEqual(next, { header: "h", "sidebar-left": ["s"], content: "c2" });
});

test("setFrame: empty text removes the optional field rather than storing an empty one", () => {
  assert.deepEqual(setFrame({ header: "h", content: "c" }, "header", ""), { content: "c" });
});

test("setFrame: an authored array frame stays an array", () => {
  assert.deepEqual(setFrame({ header: ["a"], content: "c" }, "header", "x\ny"), { header: ["x", "y"], content: "c" });
});

// ─── switchMain ───

test("switchMain: widening pads with empty slots and keeps the text", () => {
  assert.deepEqual(switchMain({ content: "c" }, "2x2"), { "2x2": ["c", "", "", ""] });
});

test("switchMain: narrowing to content joins what there was, rather than dropping it", () => {
  assert.deepEqual(switchMain({ "row-2": ["left", "right"] }, "content"), { content: "left\n\nright" });
});

test("switchMain: empty slots do not leave blank runs behind", () => {
  assert.deepEqual(switchMain({ "2x2": ["a", "", "", "b"] }, "content"), { content: "a\n\nb" });
});

test("switchMain: the frame survives the switch", () => {
  assert.deepEqual(switchMain({ header: "h", content: "c" }, "row-2"), { header: "h", "row-2": ["c", ""] });
});

test("switchMain: only one main is ever present afterwards", () => {
  MAIN_KINDS.forEach((kind) => {
    const next = switchMain({ "row-2": ["a", "b"] }, kind);
    assert.deepEqual(
      MAIN_KINDS.filter((candidate) => candidate in next),
      [kind],
      kind,
    );
  });
});

// ─── conversions ───

test("toLayout: a string becomes the content slot", () => {
  assert.deepEqual(toLayout("# Heading"), { content: "# Heading" });
});

test("toLayout: an array of lines stays an array", () => {
  assert.deepEqual(toLayout(["a", "b"]), { content: ["a", "b"] });
});

test("isLosslessToString: a bare content is, anything with more is not", () => {
  assert.equal(isLosslessToString({ content: "c" }), true);
  assert.equal(isLosslessToString({ header: "h", content: "c" }), false);
  assert.equal(isLosslessToString({ "row-2": ["a", "b"] }), false);
  assert.equal(isLosslessToString({ content: "c", style: "x" }), false);
});
