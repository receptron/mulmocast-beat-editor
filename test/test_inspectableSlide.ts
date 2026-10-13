import test from "node:test";
import assert from "node:assert";
import type { SlideLayout } from "@mulmocast/deck";

import { inspectableSlide } from "../src/inspectableSlide";
import { LAYOUT_TYPES, isSlideLayout, makeSlide } from "../src/editorHelpers";

const slideOf = (value: Record<string, unknown>): SlideLayout => {
  assert.ok(isSlideLayout(value), JSON.stringify(value));
  return value;
};

test("inspectableSlide: a well-formed slide comes back unchanged", () => {
  LAYOUT_TYPES.forEach((layout) => {
    const slide = makeSlide(layout);
    assert.deepStrictEqual(inspectableSlide(slide), slide, layout);
  });
});

test("inspectableSlide: a required panel that is missing or not an object takes the skeleton's", () => {
  const skeleton = makeSlide("comparison");
  [undefined, null, "x", 3].forEach((left) => {
    const slide = slideOf({ layout: "comparison", title: "T", right: { title: "R" }, ...(left === undefined ? {} : { left }) });
    const repaired = inspectableSlide(slide);
    assert.ok(repaired.layout === "comparison" && skeleton.layout === "comparison");
    assert.deepStrictEqual(repaired.left, skeleton.left, JSON.stringify(left));
    assert.deepStrictEqual(repaired.right, { title: "R" }, "a good panel is kept");
  });
});

test("inspectableSlide: an optional panel the author left out stays out", () => {
  const repaired = inspectableSlide(slideOf({ layout: "split", right: { title: "R" } }));
  assert.ok(repaired.layout === "split");
  assert.equal("left" in repaired, false);
  assert.deepStrictEqual(repaired.right, { title: "R" });
});

test("inspectableSlide: a list keeps its length and position, with non-object items replaced", () => {
  const skeleton = makeSlide("columns");
  assert.ok(skeleton.layout === "columns");
  const repaired = inspectableSlide(slideOf({ layout: "columns", title: "T", columns: [{ title: "A" }, null, "x", { title: "D" }] }));
  assert.ok(repaired.layout === "columns");
  assert.deepStrictEqual(repaired.columns, [{ title: "A" }, skeleton.columns[0], skeleton.columns[0], { title: "D" }]);
});

test("inspectableSlide: lists of non-objects, and fields the skeleton does not have, are left alone", () => {
  const slide = slideOf({ layout: "table", title: "T", headers: ["a", null], rows: [[null]], extra: { anything: 1 } });
  assert.deepStrictEqual(inspectableSlide(slide), slide);
});

test("inspectableSlide: the input is not mutated", () => {
  const slide = slideOf({ layout: "comparison", title: "T", left: null, right: { title: "R" } });
  const before = JSON.stringify(slide);
  inspectableSlide(slide);
  assert.equal(JSON.stringify(slide), before);
});
