// Installs a document on the global, which `withEditingAffordances` parses into. Imported first
// for the ordering its own docstring explains.
import "./support/domGlobals";

import test from "node:test";
import assert from "node:assert";

import { applyInlineEdit, applyItemMove, isInlineEditable, sameItemList, withEditingAffordances } from "../src/inlineEdit";
import { beatImage, isRecord, makeBeat, type EditableBeat } from "../src/beatHelpers";

/** What the renderer marked editable on this slide — the only paths an edit may write. */
const offered = new Set(["title", "subtitle"]);

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
  const next = applyInlineEdit(slideBeat(), "title", "<strong>After</strong>", offered);
  assert.ok(next);
  assert.equal((beatImage(next).slide as Record<string, unknown>).title, "**After**");
});

test("applyInlineEdit: leaves every other field alone", () => {
  const next = applyInlineEdit(slideBeat(), "title", "After", offered);
  const slide = beatImage(next as EditableBeat).slide as Record<string, unknown>;
  assert.equal(slide.subtitle, "Sub");
  assert.equal(slide.layout, "title");
});

test("applyInlineEdit: does not mutate the beat it was given", () => {
  // Checking one field would pass while the call quietly rewrote another, so compare the whole beat.
  const beat = slideBeat();
  const before = JSON.stringify(beat);
  applyInlineEdit(beat, "title", "After", offered);
  assert.equal(JSON.stringify(beat), before);
});

test("applyInlineEdit: null rather than a blanked field when the edit cannot land", () => {
  // Each of these would be a silent data loss if it returned a beat with the field cleared.
  assert.equal(applyInlineEdit(slideBeat(), "", "x", offered), null, "empty path");
  assert.equal(applyInlineEdit(slideBeat(), "nope.deeper", "x", offered), null, "nested path that does not exist");
  // Codex round 1: a single-segment path has no parent for setByPath to give up on, so `nope`
  // was ADDED to the slide.
  assert.equal(applyInlineEdit(slideBeat(), "nope", "x", offered), null, "top-level path that does not exist");
  assert.equal(applyInlineEdit(slideBeat(), "bullets[0]", "x", offered), null, "index into a field this layout lacks");
  assert.equal(applyInlineEdit(makeBeat("markdown"), "title", "x", offered), null, "not a slide beat");
});

test("applyInlineEdit: an unchanged value is a no-op, not an emit", () => {
  // Blur fires whether or not anything was typed. Emitting on every blur would push an identical
  // beat through the parent and rebuild the fragment for nothing.
  assert.equal(applyInlineEdit(slideBeat(), "title", "Before", offered), null);
});

test("applyInlineEdit: an empty field is still editable", () => {
  // An empty string is a value the renderer still offers a marker for, so clearing a subtitle
  // must not make it uneditable from then on.
  const beat: EditableBeat = { text: "", image: { type: "slide", slide: { layout: "title", title: "T", subtitle: "" } } };
  const next = applyInlineEdit(beat, "subtitle", "now filled", offered);
  assert.equal((beatImage(next as EditableBeat).slide as Record<string, unknown>).subtitle, "now filled");
});

test("applyInlineEdit: a path that exists but was never offered is refused", () => {
  // Codex round 2. `layout` exists on every slide, so "the path exists" let prose be written
  // into it — measured, it took `"**x**"` and broke the slide. Only what the renderer marked
  // editable may be written, which fails closed for a path nobody rendered.
  assert.equal(applyInlineEdit(slideBeat(), "layout", "<b>x</b>", offered), null, "structural field");
  assert.equal((beatImage(slideBeat()).slide as Record<string, unknown>).layout, "title");
  assert.equal(applyInlineEdit(slideBeat(), "title", "After", new Set()), null, "nothing offered");
});

// ─── reordering a list item ───

/** What the renderer marked reorderable — the only paths a move may name. */
const offeredItems = new Set(["items[0]", "items[1]", "items[2]"]);

const gridBeat = (): EditableBeat => ({
  text: "",
  image: {
    type: "slide",
    slide: { layout: "grid", title: "T", items: [{ title: "one" }, { title: "two" }, { title: "three" }] },
  },
});

const titlesOf = (beat: EditableBeat | null): unknown[] => {
  const slide = beat === null ? {} : beatImage(beat)["slide"];
  const items = isRecord(slide) ? slide["items"] : [];
  if (!Array.isArray(items)) return [];
  return items.map((item: unknown) => (isRecord(item) ? item["title"] : item));
};

test("applyItemMove: moves the item and leaves the rest in order", () => {
  assert.deepStrictEqual(titlesOf(applyItemMove(gridBeat(), "items[2]", "items[0]", offeredItems)), ["three", "one", "two"]);
  assert.deepStrictEqual(titlesOf(applyItemMove(gridBeat(), "items[0]", "items[1]", offeredItems)), ["two", "one", "three"]);
});

test("applyItemMove: does not mutate the beat it was given", () => {
  const beat = gridBeat();
  applyItemMove(beat, "items[0]", "items[2]", offeredItems);
  assert.deepStrictEqual(titlesOf(beat), ["one", "two", "three"]);
});

test("applyItemMove: null rather than a reordered slide when the move cannot land", () => {
  const beat = gridBeat();
  // Neither end may be a path the render did not offer — the permit list is the whole guard.
  assert.equal(applyItemMove(beat, "items[0]", "items[9]", offeredItems), null);
  assert.equal(applyItemMove(beat, "items[9]", "items[0]", offeredItems), null);
  // Same array only: deck's data has no move that crosses one.
  assert.equal(applyItemMove(beat, "items[0]", "stats[0]", new Set(["items[0]", "stats[0]"])), null);
  // Dropping an item on itself is not a move.
  assert.equal(applyItemMove(beat, "items[1]", "items[1]", offeredItems), null);
  // And a beat with no slide has nothing to reorder.
  assert.equal(applyItemMove({ text: "", image: { type: "image" } }, "items[0]", "items[1]", offeredItems), null);
});

test("applyItemMove: a path that is valid in the data but was never offered is refused", () => {
  // The other refusals are all reachable through `moveByPath`'s own checks, so they cannot see
  // whether the permit list is consulted at all — measured: deleting the guard left them green.
  // Here every index exists and the arrays match; the offer is the only thing saying no.
  const beat = gridBeat();
  const narrow = new Set(["items[0]", "items[1]"]);
  assert.equal(applyItemMove(beat, "items[0]", "items[2]", narrow), null, "the destination was not offered");
  assert.equal(applyItemMove(beat, "items[2]", "items[0]", narrow), null, "the source was not offered");
  // …and with the same paths offered, the very same move lands.
  assert.deepStrictEqual(titlesOf(applyItemMove(beat, "items[0]", "items[2]", offeredItems)), ["two", "three", "one"]);
});

test("applyItemMove: an index the offer names but the array does not is refused", () => {
  // The permit list comes from the render, so this is only reachable if the two disagree — which
  // is exactly the case that must not write a hole into the array.
  const shortBeat: EditableBeat = { text: "", image: { type: "slide", slide: { layout: "grid", title: "T", items: [{ title: "only" }] } } };
  assert.equal(applyItemMove(shortBeat, "items[0]", "items[2]", offeredItems), null);
  assert.deepStrictEqual(titlesOf(shortBeat), ["only"]);
});

test("sameItemList: the same array at a different index, and nothing else", () => {
  assert.equal(sameItemList("items[0]", "items[2]"), true);
  assert.equal(sameItemList("left.content[0].items[0]", "left.content[0].items[1]"), true);
  assert.equal(sameItemList("items[0]", "items[0]"), false);
  assert.equal(sameItemList("items[0]", "stats[0]"), false);
  assert.equal(sameItemList("items[0]", "title"), false);
  assert.equal(sameItemList("left.content[0].items[0]", "left.content[1].items[0]"), false);
});

test("withEditingAffordances: marks a list item draggable and offers its path", () => {
  const surface = withEditingAffordances('<ul><li data-mulmo-item-path="items[0]">one</li><li data-mulmo-item-path="items[1]">two</li></ul>');
  assert.deepStrictEqual([...surface.items], ["items[0]", "items[1]"]);
  assert.equal((surface.html.match(/draggable="true"/g) ?? []).length, 2);
  // The two permit lists stay separate: a text path is not a thing you can drag.
  assert.deepStrictEqual([...surface.paths], []);
});

test("withEditingAffordances: an item path a user typed as prose is not turned into a handle", () => {
  // The pass parses rather than rewriting the string, so text that merely looks like the
  // attribute stays text — the same reason the text markers are done this way.
  const surface = withEditingAffordances('<p data-mulmo-path="title">data-mulmo-item-path="items[0]"</p>');
  assert.deepStrictEqual([...surface.items], []);
  assert.ok(!surface.html.includes('draggable="true"'));
});
