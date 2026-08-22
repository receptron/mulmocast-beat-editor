import test from "node:test";
import assert from "node:assert";
import { beatToHtml } from "mulmocast/browser";

import { BEAT_TYPES, makeBeat, beatType, beatImage, withImageField, withNestedField, readString, moveItem } from "../src/beatHelpers";

// ─── makeBeat ───

// The editor offers a type only if beatToHtml renders it, and a new beat has to preview
// immediately — an empty one that shows nothing reads as a broken editor.
test("makeBeat: every offered type produces a beat that renders", () => {
  BEAT_TYPES.forEach((type) => {
    const fragment = beatToHtml(makeBeat(type) as never, { idPrefix: "b" });
    assert.ok(fragment, `${type} must render`);
    assert.ok(fragment.html.length > 0, `${type} must produce markup`);
  });
});

test("makeBeat: the offered types are exactly what beatToHtml supports", () => {
  assert.deepStrictEqual([...BEAT_TYPES].sort(), ["chart", "html_tailwind", "image", "markdown", "mermaid", "movie", "slide", "textSlide"]);
});

// image and movie start with an empty url, so those two are the exception: they render
// nothing until the user types one. Everything else must be immediately visible.
test("makeBeat: media beats start empty and the rest start with content", () => {
  assert.strictEqual(readString(makeBeat("image"), "url", "source"), "");
  assert.strictEqual(readString(makeBeat("movie"), "url", "source"), "");
  assert.match(readString(makeBeat("markdown"), "markdown"), /Heading/);
});

// ─── reading ───

test("beatType: reads the type, and names what is wrong rather than throwing", () => {
  assert.strictEqual(beatType(makeBeat("chart")), "chart");
  assert.strictEqual(beatType({}), "(no image)");
  assert.strictEqual(beatType({ image: {} }), "(no type)");
  assert.strictEqual(beatType({ image: "not an object" }), "(no image)");
  assert.strictEqual(beatType({ image: { type: 7 } }), "(no type)");
});

test("beatImage: a malformed beat reads as empty, not as a crash", () => {
  assert.deepStrictEqual(beatImage({}), {});
  assert.deepStrictEqual(beatImage({ image: null }), {});
  assert.deepStrictEqual(beatImage({ image: "x" }), {});
  assert.deepStrictEqual(beatImage({ image: { type: "chart" } }), { type: "chart" });
});

test("readString: returns '' for anything that is not a string", () => {
  const beat = { image: { title: "T", n: 7, nested: { url: "u" } } };
  assert.strictEqual(readString(beat, "title"), "T");
  assert.strictEqual(readString(beat, "n"), "", "a number is not a string");
  assert.strictEqual(readString(beat, "missing"), "");
  assert.strictEqual(readString(beat, "url", "nested"), "u");
  assert.strictEqual(readString(beat, "url", "absent"), "");
  assert.strictEqual(readString({}, "title"), "");
});

// ─── writing ───

// Vue's reactivity is watching these objects, and an editor that mutates in place produces
// a preview that updates sometimes.
test("withImageField: returns a new beat and mutates nothing", () => {
  const beat = { text: "keep", image: { type: "chart", title: "Old" } };
  const next = withImageField(beat, "title", "New");
  assert.strictEqual(next.text, "keep", "other fields survive");
  assert.strictEqual(readString(next, "title"), "New");
  assert.strictEqual(readString(beat, "title"), "Old", "the original is untouched");
  assert.notStrictEqual(next.image, beat.image, "image is a new object");
});

test("withNestedField: reaches into slide / source / code without losing siblings", () => {
  const beat = { image: { type: "slide", slide: { layout: "title", title: "Old", subtitle: "Sub" } } };
  const next = withNestedField(beat, "slide", "title", "New");
  assert.strictEqual(readString(next, "title", "slide"), "New");
  assert.strictEqual(readString(next, "subtitle", "slide"), "Sub", "siblings survive");
  assert.strictEqual(readString(next, "layout", "slide"), "title");
  assert.strictEqual(readString(beat, "title", "slide"), "Old", "the original is untouched");
});

test("withNestedField: creates the parent when it is missing or malformed", () => {
  assert.strictEqual(readString(withNestedField({ image: { type: "image" } }, "source", "url", "u"), "url", "source"), "u");
  assert.strictEqual(readString(withNestedField({ image: { type: "image", source: "bad" } }, "source", "url", "u"), "url", "source"), "u");
  assert.strictEqual(readString(withNestedField({}, "source", "url", "u"), "url", "source"), "u");
});

// ─── reordering ───

test("moveItem: moves without mutating", () => {
  const items = ["a", "b", "c"];
  assert.deepStrictEqual(moveItem(items, 0, 2), ["b", "c", "a"]);
  assert.deepStrictEqual(moveItem(items, 2, 0), ["c", "a", "b"]);
  assert.deepStrictEqual(items, ["a", "b", "c"], "the input is untouched");
});

// The buttons at the ends of the list ask for these, so they must be a no-op rather than
// a way to lose a beat.
test("moveItem: an out-of-range move keeps every item", () => {
  const items = ["a", "b", "c"];
  [
    [0, -1],
    [2, 3],
    [-1, 0],
    [3, 0],
    [1, 1],
  ].forEach(([from, to]) => {
    assert.deepStrictEqual(moveItem(items, from, to), items, `${from} -> ${to} must be a no-op`);
  });
});
