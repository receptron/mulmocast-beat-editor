import test from "node:test";
import assert from "node:assert";

import { moveInArray, clone, makeBlock, makeSlide, isSlideLayout, LAYOUT_TYPES } from "../src/editorHelpers";

// ─── em fallback to {warning:…} when deck's em regex wouldn't parse ───

// ─── moveInArray ───

test("moveInArray: shift right", () => {
  assert.deepEqual(moveInArray([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]);
});

test("moveInArray: shift left", () => {
  assert.deepEqual(moveInArray([1, 2, 3, 4], 3, -1), [1, 2, 4, 3]);
});

test("moveInArray: clamp at edges", () => {
  assert.deepEqual(moveInArray([1, 2, 3], 0, -5), [1, 2, 3]); // already at start
  assert.deepEqual(moveInArray([1, 2, 3], 2, 5), [1, 2, 3]); // already at end
});

test("moveInArray: zero delta is identity", () => {
  const a = [1, 2, 3];
  assert.equal(moveInArray(a, 1, 0), a);
});

// ─── clone ───

test("clone: deep-copies nested structures", () => {
  const a = { x: [{ y: 1 }] };
  const b = clone(a);
  b.x[0].y = 2;
  assert.equal(a.x[0].y, 1);
  assert.equal(b.x[0].y, 2);
});

// ─── makeSlide / makeBlock skeletons ───

test("makeSlide: title", () => {
  assert.deepEqual(makeSlide("title"), { layout: "title", title: "New title" });
});

test("makeSlide: comparison has left+right", () => {
  const s = makeSlide("comparison");
  assert.equal(s.layout, "comparison");
  if (s.layout !== "comparison") throw new Error("guard");
  assert.ok(s.left.title);
  assert.ok(s.right.title);
});

test("makeBlock: text", () => {
  assert.deepEqual(makeBlock("text"), { type: "text", value: "New text" });
});

test("makeBlock: bullets has one item", () => {
  const b = makeBlock("bullets");
  if (b.type !== "bullets") throw new Error("guard");
  assert.equal(b.items.length, 1);
});

test("makeBlock: tag", () => {
  assert.deepEqual(makeBlock("tag"), { type: "tag", text: "TAG" });
});

// ─── isSlideLayout ───
// The beat editor reads `image.slide` out of a Record<string, unknown>, so this decides
// whether the Inspector gets to render. Both directions matter: a false negative hides a
// slide the deck can draw, a false positive hands the Inspector something it cannot.

test("isSlideLayout: every layout makeSlide produces is accepted", () => {
  LAYOUT_TYPES.forEach((layout) => {
    assert.equal(isSlideLayout(makeSlide(layout)), true, layout);
  });
});

test("isSlideLayout: extra fields do not disqualify a slide", () => {
  assert.equal(isSlideLayout({ layout: "title", title: "T", somethingElse: 1 }), true);
});

test("isSlideLayout: a value with no layout is rejected", () => {
  assert.equal(isSlideLayout({ title: "T" }), false);
});

test("isSlideLayout: an unknown layout name is rejected", () => {
  assert.equal(isSlideLayout({ layout: "carousel" }), false);
});

test("isSlideLayout: a non-string layout is rejected", () => {
  [{ layout: 1 }, { layout: null }, { layout: ["title"] }, { layout: { layout: "title" } }].forEach((value) => {
    assert.equal(isSlideLayout(value), false, JSON.stringify(value));
  });
});

test("isSlideLayout: non-objects are rejected", () => {
  [undefined, null, "title", 7, true, () => "title"].forEach((value) => {
    assert.equal(isSlideLayout(value), false, String(value));
  });
});

test("isSlideLayout: an array is rejected even when it carries a layout", () => {
  const withLayout: unknown[] & { layout?: string } = [];
  withLayout.layout = "title";
  assert.equal(isSlideLayout(withLayout), false);
});
