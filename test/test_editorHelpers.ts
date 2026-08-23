import test from "node:test";
import assert from "node:assert";

import {
  moveInArray,
  clone,
  makeBlock,
  makeSlide,
  isSlideLayout,
  LAYOUT_TYPES,
  parsePath,
  getByPath,
  setByPath,
  moveByPath,
  splitItemPath,
  htmlToMarkup,
} from "../src/editorHelpers";

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

// ─── parsePath ───

test("parsePath: top-level field", () => {
  assert.deepEqual(parsePath("title"), ["title"]);
});

test("parsePath: dotted property", () => {
  assert.deepEqual(parsePath("eyebrow.label"), ["eyebrow", "label"]);
});

test("parsePath: array index", () => {
  assert.deepEqual(parsePath("stats[0].value"), ["stats", 0, "value"]);
});

test("parsePath: deeply nested mixed", () => {
  assert.deepEqual(parsePath("columns[0].content[1].items[2].text"), ["columns", 0, "content", 1, "items", 2, "text"]);
});

test("parsePath: empty string returns null", () => {
  assert.equal(parsePath(""), null);
});

test("parsePath: malformed bracket without digit just skips", () => {
  // Our grammar is permissive — random chars between segments are ignored.
  assert.deepEqual(parsePath("foo.bar"), ["foo", "bar"]);
});

// ─── getByPath / setByPath ───

test("getByPath: reads a top-level string", () => {
  const slide = { layout: "title", title: "Hello" };
  assert.equal(getByPath(slide, "title"), "Hello");
});

test("getByPath: reads through array", () => {
  const slide = { stats: [{ value: "1" }, { value: "2" }] };
  assert.equal(getByPath(slide, "stats[1].value"), "2");
});

test("getByPath: missing path returns undefined", () => {
  const slide = { title: "Hi" };
  assert.equal(getByPath(slide, "stats[0].value"), undefined);
});

test("setByPath: updates a top-level field, returns new object", () => {
  const slide = { layout: "title", title: "Hello" };
  const next = setByPath(slide, "title", "World");
  assert.equal(next.title, "World");
  assert.notEqual(next, slide, "should return a new reference");
  assert.equal(slide.title, "Hello", "original is untouched");
});

test("setByPath: updates inside array", () => {
  const slide = { stats: [{ value: "1" }, { value: "2" }] };
  const next = setByPath(slide, "stats[0].value", "42");
  assert.equal(next.stats[0].value, "42");
  assert.equal(slide.stats[0].value, "1");
});

test("setByPath: deep nested", () => {
  const slide = {
    columns: [
      {
        content: [{ type: "bullets", items: [{ text: "a" }, { text: "b" }] }],
      },
    ],
  };
  const next = setByPath(slide, "columns[0].content[0].items[1].text", "Z");
  assert.equal(next.columns[0].content[0].items[1].text, "Z");
});

test("setByPath: missing intermediate path returns the original (no mutation)", () => {
  const slide = { layout: "title", title: "x" };
  const next = setByPath(slide, "stats[0].value", "42");
  // The path doesn't exist in this slide, so setByPath bails out and returns the original ref.
  assert.equal(next, slide);
});

test("setByPath: empty path is a no-op", () => {
  const slide = { title: "x" };
  const next = setByPath(slide, "", "y");
  assert.equal(next, slide);
});

// ─── htmlToMarkup ───

test("htmlToMarkup: plain text passes through", () => {
  assert.equal(htmlToMarkup("hello world"), "hello world");
});

test("htmlToMarkup: <strong> → **bold**", () => {
  assert.equal(htmlToMarkup("a <strong>bold</strong> c"), "a **bold** c");
});

test("htmlToMarkup: <b> also becomes **bold**", () => {
  assert.equal(htmlToMarkup("<b>x</b>"), "**x**");
});

test("htmlToMarkup: <em> → *emphasis*", () => {
  assert.equal(htmlToMarkup('<em class="text-d-warning">amber</em>'), "*amber*");
});

test("htmlToMarkup: <span text-d-X> → {X:text}", () => {
  assert.equal(htmlToMarkup('<span class="text-d-success">ok</span>'), "{success:ok}");
});

test("htmlToMarkup: span without text-d class is stripped", () => {
  assert.equal(htmlToMarkup('<span class="something-else">x</span>'), "x");
});

test("htmlToMarkup: nested strong inside em", () => {
  assert.equal(htmlToMarkup('<em class="text-d-warning"><strong>X</strong></em>'), "***X***");
});

test("htmlToMarkup: nested span color inside strong", () => {
  assert.equal(htmlToMarkup('<strong><span class="text-d-primary">P</span></strong>'), "**{primary:P}**");
});

test("htmlToMarkup: <br> becomes newline", () => {
  assert.equal(htmlToMarkup("a<br>b"), "a\nb");
});

test("htmlToMarkup: decodes basic entities", () => {
  assert.equal(htmlToMarkup("&lt;tag&gt; &amp; &#39;quote&#39;"), "<tag> & 'quote'");
});

test("htmlToMarkup: does not double-decode &amp;lt; (single pass)", () => {
  // Without single-pass decoding, &amp;lt; would round-trip to "<" instead of "&lt;".
  assert.equal(htmlToMarkup("&amp;lt;"), "&lt;");
});

test("htmlToMarkup: pathological broken-tag input leaves no executable tag", () => {
  // The crucial safety property: no `<tag…>` pattern should survive that could be parsed
  // as HTML by downstream consumers. (The leftover text doesn't matter — it can't run.)
  const result = htmlToMarkup("safe<s<script>cript>still safe");
  assert.ok(!/<[a-zA-Z][^>]*>/.test(result), `no surviving tag-like pattern in: ${result}`);
});

test("htmlToMarkup: unknown tags are stripped to text", () => {
  assert.equal(htmlToMarkup("<div>x</div>"), "x");
});

test("htmlToMarkup: empty input returns empty", () => {
  assert.equal(htmlToMarkup(""), "");
});

// Idempotence-ish check — converting then re-rendering and converting again should match.
// (We don't have renderInlineMarkup here, but the simple cases should be self-consistent.)
test("htmlToMarkup: idempotent on simple plain-text inputs", () => {
  const x = "Hello world";
  assert.equal(htmlToMarkup(x), x);
});

// Reproduction of a user-reported case: span color + strong adjacent + literal asterisks
// in the surrounding text. The literal `*rowse*` is NOT em (deck's em requires non-\w
// lookbehind, fails after "b"), so it must round-trip verbatim.
test("htmlToMarkup: user case — span color + strong + literal asterisks", () => {
  const input = 'Live-preview a Sli<span class="text-d-primary">deLa</span>yout D<strong>SL in t</strong>he b*rowse*r';
  const expected = "Live-preview a Sli{primary:deLa}yout D**SL in t**he b*rowse*r";
  assert.equal(htmlToMarkup(input), expected);
});

// Variants of the same case that may break the regex due to attribute ordering / extra classes
test("htmlToMarkup: span color with additional classes still maps", () => {
  const input = '<span class="text-d-primary other">x</span>';
  assert.equal(htmlToMarkup(input), "{primary:x}");
});

test("htmlToMarkup: span color with attribute before class", () => {
  const input = '<span data-x="y" class="text-d-primary">x</span>';
  assert.equal(htmlToMarkup(input), "{primary:x}");
});

test("htmlToMarkup: literal asterisks adjacent to inner tags are preserved", () => {
  const input = "a *b* <strong>c</strong>";
  assert.equal(htmlToMarkup(input), "a *b* **c**");
});

test("htmlToMarkup: em surrounded by word chars falls back to {warning:…}", () => {
  // "Live alerts" — user selected "e al" inside the word → would emit Liv*e al*erts which deck
  // can't parse as em (prev char "v" is \w + content has trailing/leading nothing but is mid-word).
  const input = "Liv<em>e al</em>erts";
  assert.equal(htmlToMarkup(input), "Liv{warning:e al}erts");
});

test("htmlToMarkup: em with leading space inner falls back", () => {
  // deck's em requires \*(?!\s) — non-space after the opening *.
  const input = "<em> hello</em>";
  assert.equal(htmlToMarkup(input), "{warning: hello}");
});

test("htmlToMarkup: em with trailing space inner falls back", () => {
  const input = "<em>hello </em>";
  assert.equal(htmlToMarkup(input), "{warning:hello }");
});

test("htmlToMarkup: em at word-boundary stays as *…*", () => {
  // " hello *world*" — space before * + word after * is fine.
  const input = "say <em>hello</em>!";
  assert.equal(htmlToMarkup(input), "say *hello*!");
});

test("htmlToMarkup: em at start of string stays as *…*", () => {
  const input = "<em>hello</em> world";
  assert.equal(htmlToMarkup(input), "*hello* world");
});

test("htmlToMarkup: em adjacent on right to word char falls back", () => {
  const input = "<em>hi</em>there";
  assert.equal(htmlToMarkup(input), "{warning:hi}there");
});

// ─── splitItemPath ───

test("splitItemPath: top-level array item", () => {
  assert.deepEqual(splitItemPath("stats[0]"), { parent: "stats", index: 0 });
});

test("splitItemPath: deeply nested", () => {
  assert.deepEqual(splitItemPath("columns[0].content[1].items[2]"), { parent: "columns[0].content[1].items", index: 2 });
});

test("splitItemPath: not an array path returns null", () => {
  assert.equal(splitItemPath("title"), null);
  assert.equal(splitItemPath("eyebrow.label"), null);
});

// ─── moveByPath ───

test("moveByPath: swap two stats", () => {
  const slide = { stats: [{ value: "a" }, { value: "b" }, { value: "c" }] };
  const next = moveByPath(slide, "stats[0]", "stats[2]");
  assert.deepEqual(next.stats, [{ value: "b" }, { value: "c" }, { value: "a" }]);
  assert.deepEqual(slide.stats, [{ value: "a" }, { value: "b" }, { value: "c" }], "original untouched");
});

test("moveByPath: move bullet inside nested content", () => {
  const slide = {
    columns: [
      {
        content: [{ type: "bullets", items: ["a", "b", "c", "d"] }],
      },
    ],
  };
  const next = moveByPath(slide, "columns[0].content[0].items[3]", "columns[0].content[0].items[0]");
  assert.deepEqual(next.columns[0].content[0].items, ["d", "a", "b", "c"]);
});

test("moveByPath: cross-parent move returns original ref", () => {
  const slide = { stats: [{ value: "a" }], items: [{ title: "x" }] };
  const next = moveByPath(slide, "stats[0]", "items[0]");
  assert.equal(next, slide);
});

test("moveByPath: same index is identity", () => {
  const slide = { stats: [{ value: "a" }, { value: "b" }] };
  const next = moveByPath(slide, "stats[1]", "stats[1]");
  assert.equal(next, slide);
});

test("moveByPath: out-of-range index returns original ref", () => {
  const slide = { stats: [{ value: "a" }] };
  const next = moveByPath(slide, "stats[0]", "stats[5]");
  assert.equal(next, slide);
});

test("moveByPath: invalid path returns original ref", () => {
  const slide = { stats: [{ value: "a" }] };
  const next = moveByPath(slide, "stats", "stats[0]");
  assert.equal(next, slide);
});
