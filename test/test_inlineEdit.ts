import test from "node:test";
import assert from "node:assert";

import { applyInlineEdit, isInlineEditable } from "../src/inlineEdit";
import { beatImage, makeBeat, type EditableBeat } from "../src/beatHelpers";

const slideBeat = (): EditableBeat => ({
  text: "",
  image: { type: "slide", slide: { layout: "title", title: "Before", subtitle: "Sub" } },
});

test("isInlineEditable: only a slide beat carries the path attributes", () => {
  assert.equal(isInlineEditable(slideBeat()), true);
  // The other seven types render no data-mulmo-path at all, measured against beatToHtml.
  ["textSlide", "markdown", "chart", "mermaid", "image", "movie", "html_tailwind"].forEach((type) => {
    assert.equal(isInlineEditable(makeBeat(type as never)), false, `${type} should not be inline editable`);
  });
});

test("isInlineEditable: a slide beat whose slide is missing or not an object is not editable", () => {
  assert.equal(isInlineEditable({ text: "", image: { type: "slide" } }), false);
  assert.equal(isInlineEditable({ text: "", image: { type: "slide", slide: "oops" } }), false);
  assert.equal(isInlineEditable({ text: "" }), false);
});

test("applyInlineEdit: writes the markup form into the slide", () => {
  const next = applyInlineEdit(slideBeat(), "title", "<strong>After</strong>");
  assert.ok(next);
  assert.equal((beatImage(next).slide as Record<string, unknown>).title, "**After**");
});

test("applyInlineEdit: leaves every other field alone", () => {
  const next = applyInlineEdit(slideBeat(), "title", "After");
  const slide = beatImage(next as EditableBeat).slide as Record<string, unknown>;
  assert.equal(slide.subtitle, "Sub");
  assert.equal(slide.layout, "title");
});

test("applyInlineEdit: does not mutate the beat it was given", () => {
  const beat = slideBeat();
  applyInlineEdit(beat, "title", "After");
  assert.equal((beatImage(beat).slide as Record<string, unknown>).title, "Before");
});

test("applyInlineEdit: null rather than a blanked field when the edit cannot land", () => {
  // Each of these would be a silent data loss if it returned a beat with the field cleared.
  assert.equal(applyInlineEdit(slideBeat(), "", "x"), null, "empty path");
  assert.equal(applyInlineEdit(slideBeat(), "nope.deeper", "x"), null, "nested path that does not exist");
  // Codex round 1: a single-segment path has no parent for setByPath to give up on, so `nope`
  // was ADDED to the slide and `layout` could be overwritten with prose.
  assert.equal(applyInlineEdit(slideBeat(), "nope", "x"), null, "top-level path that does not exist");
  assert.equal(applyInlineEdit(slideBeat(), "bullets[0]", "x"), null, "index into a field this layout lacks");
  assert.equal(applyInlineEdit(makeBeat("markdown"), "title", "x"), null, "not a slide beat");
});

test("applyInlineEdit: an unchanged value is a no-op, not an emit", () => {
  // Blur fires whether or not anything was typed. Emitting on every blur would push an identical
  // beat through the parent and rebuild the fragment for nothing.
  assert.equal(applyInlineEdit(slideBeat(), "title", "Before"), null);
});

test("applyInlineEdit: an empty field is still editable", () => {
  // The guard rejects a path whose value is `undefined`, and an empty string is not undefined —
  // otherwise clearing a subtitle would make it uneditable from then on.
  const beat: EditableBeat = { text: "", image: { type: "slide", slide: { layout: "title", title: "T", subtitle: "" } } };
  const next = applyInlineEdit(beat, "subtitle", "now filled");
  assert.equal((beatImage(next as EditableBeat).slide as Record<string, unknown>).subtitle, "now filled");
});
