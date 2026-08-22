import test from "node:test";
import assert from "node:assert";
import { beatToHtml } from "mulmocast/browser";

import {
  BEAT_TYPES,
  makeBeat,
  beatType,
  beatImage,
  withImageField,
  withNestedField,
  readString,
  moveItem,
  selectionAfterMove,
  selectionAfterRemove,
  draftOwnsBeat,
  chartDataKey,
} from "../src/beatHelpers";

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

// ─── selectionAfterRemove / selectionAfterMove ───
//
// The rule both must obey is one property: the user keeps editing the beat they had
// selected. Rather than pin the arithmetic, run the real array operation over every
// (length, selected, from, to) in range and assert the beat is the same object afterwards.

const RANGE = [0, 1, 2, 3, 4, 5];
const listOf = (n: number) => Array.from({ length: n }, (_, i) => `beat-${i}`);

test("selectionAfterRemove: the selected beat stays selected, for every removal", () => {
  let checked = 0;
  RANGE.filter((n) => n >= 2).forEach((length) => {
    const items = listOf(length);
    items.forEach((_, selected) => {
      items.forEach((__, removed) => {
        const next = items.slice();
        next.splice(removed, 1);
        const landed = selectionAfterRemove(selected, removed, next.length);
        assert.ok(landed >= 0 && landed < next.length, `${length}/${selected}/${removed}: ${landed} out of range`);
        if (removed !== selected) {
          assert.strictEqual(next[landed], items[selected], `removing ${removed} with ${selected} selected`);
        }
        checked += 1;
      });
    });
  });
  assert.strictEqual(checked, 4 + 9 + 16 + 25, "the sweep must cover every (length, selected, removed)");
});

// Deleting the only beat, and deleting the selected last one: both must stay in range.
test("selectionAfterRemove: an emptied or shortened list stays in range", () => {
  assert.strictEqual(selectionAfterRemove(0, 0, 0), 0);
  assert.strictEqual(selectionAfterRemove(2, 2, 2), 1);
  assert.strictEqual(selectionAfterRemove(0, 1, 1), 0);
});

test("selectionAfterMove: the selected beat stays selected, for every move", () => {
  let checked = 0;
  RANGE.filter((n) => n >= 2).forEach((length) => {
    const items = listOf(length);
    items.forEach((_, selected) => {
      items.forEach((__, from) => {
        items.forEach((___, to) => {
          const next = moveItem(items, from, to);
          const landed = selectionAfterMove(selected, from, to, length);
          assert.strictEqual(next[landed], items[selected], `${length}: move ${from}->${to} with ${selected} selected`);
          checked += 1;
        });
      });
    });
  });
  assert.strictEqual(checked, 8 + 27 + 64 + 125, "the sweep must cover every (length, selected, from, to)");
});

// The end-of-list buttons pass these; moveItem no-ops, so the selection must not drift.
test("selectionAfterMove: an out-of-range move leaves the selection alone", () => {
  [
    [0, -1],
    [2, 3],
    [-1, 0],
    [3, 0],
  ].forEach(([from, to]) => {
    RANGE.slice(0, 3).forEach((selected) => {
      assert.strictEqual(selectionAfterMove(selected, from, to, 3), selected, `${from} -> ${to}`);
    });
  });
});

// ─── chartDataKey / draftOwnsBeat ───
//
// The chart textarea holds text while the beat holds parsed JSON. The draft owns the beat
// exactly while the two agree; anything else means the editor was pointed at another beat
// and the half-typed text must not be written into it.
//
// Three review rounds reported the same bug in three shapes, each a pair of chartData
// states that produced one key. So the property under test is not "these two pairs differ"
// but "every state produces its own key" — a state added later has to be added here too,
// but a collision cannot slip in silently.

const chartBeat = (image: Record<string, unknown>) => ({ text: "", image: { type: "chart", ...image } });

test("chartDataKey: every chartData state gets its own key", () => {
  const states: [string, Record<string, unknown>][] = [
    ["absent", {}],
    ["undefined", { chartData: undefined }],
    ["null", { chartData: null }],
    ["empty object", { chartData: {} }],
    ["empty array", { chartData: [] }],
    ["the string 'null'", { chartData: "null" }],
    ["the string 'absent'", { chartData: "absent" }],
    ["the string 'undefined'", { chartData: "undefined" }],
    ["a real config", { chartData: { type: "bar" } }],
    ["a different config", { chartData: { type: "line" } }],
    ["zero", { chartData: 0 }],
    ["false", { chartData: false }],
  ];
  const keys = states.map(([, image]) => chartDataKey(chartBeat(image)));
  const collisions = states.flatMap(([a], i) => states.slice(i + 1).map(([b], j) => (keys[i] === keys[i + j + 1] ? `${a} === ${b}` : ""))).filter(Boolean);
  assert.deepStrictEqual(collisions, [], "each state must produce its own key");
  assert.strictEqual(keys.length, 12, "a state added to chartDataKey must be added here");
});

test("chartDataKey: a beat with no image has no chartData", () => {
  assert.strictEqual(chartDataKey({}), "absent");
  assert.strictEqual(chartDataKey({ text: "", image: "not an object" }), "absent");
});

test("draftOwnsBeat: a draft owns the beat whose chartData it parses to", () => {
  const data = { type: "bar", data: { labels: ["A"] } };
  assert.strictEqual(draftOwnsBeat(JSON.stringify(data), chartBeat({ chartData: data })), true);
  assert.strictEqual(draftOwnsBeat(JSON.stringify(data, null, 2), chartBeat({ chartData: data })), true, "whitespace is not content");
});

test("draftOwnsBeat: a half-typed draft owns nothing", () => {
  ["", "{", '{"type":', "not json", "{'type':'bar'}"].forEach((draft) => {
    assert.strictEqual(draftOwnsBeat(draft, chartBeat({ chartData: { type: "bar" } })), false, JSON.stringify(draft));
  });
});

// The whole point: no draft may own a beat that does not literally hold the parsed value.
test("draftOwnsBeat: absent, undefined, null and empty are all distinct owners", () => {
  assert.strictEqual(draftOwnsBeat("null", chartBeat({ chartData: null })), true);
  assert.strictEqual(draftOwnsBeat("null", chartBeat({})), false, "a null draft does not own an absent chartData");
  assert.strictEqual(draftOwnsBeat("null", chartBeat({ chartData: undefined })), false);
  assert.strictEqual(draftOwnsBeat("{}", chartBeat({})), false, "empty is not absent");
  assert.strictEqual(draftOwnsBeat("{}", chartBeat({ chartData: {} })), true);
  assert.strictEqual(draftOwnsBeat('{"type":"bar"}', chartBeat({ chartData: { type: "line" } })), false);
});
