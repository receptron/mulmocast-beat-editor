import "./support/domGlobals";

import test from "node:test";
import assert from "node:assert";

import { beatImage, isRecord, type EditableBeat } from "../src/beatHelpers";
import {
  childOfItem,
  clearSelection,
  dragItemAndAbandon,
  dragItemOnto,
  dragOverAccepted,
  dragStartFrom,
  dropOn,
  graftItemMarker,
  itemPaths,
  withItemLayout,
  mountBeatView,
  mountBeatViewReactive,
  selectTextIn,
  settle,
} from "./support/beatViewHarness";

/**
 * Reordering a list item by dragging it, driven through a mounted BeatView.
 *
 * Deck marks a reorderable item with `data-mulmo-item-path`, whose index is its POSITION — so
 * after a move the same paths are on screen in the same order and only the content behind them
 * has changed. That is what makes the emitted beat, rather than the markup, the thing to assert.
 */

const gridBeat = (): EditableBeat => ({
  text: "",
  image: {
    type: "slide",
    slide: { layout: "grid", title: "T", items: [{ title: "one" }, { title: "two" }, { title: "three" }] },
  },
});

const titlesOf = (beat: unknown): unknown[] => {
  const slide = isRecord(beat) ? beatImage(beat)["slide"] : {};
  const items = isRecord(slide) ? slide["items"] : [];
  if (!Array.isArray(items)) return [];
  return items.map((item: unknown) => (isRecord(item) ? item["title"] : item));
};

test("the render marks each list item draggable", async () => {
  const view = await mountBeatView(gridBeat(), { editable: true });
  assert.deepStrictEqual(itemPaths(view), ["items[0]", "items[1]", "items[2]"]);
  const handles = view.host.querySelectorAll('[data-mulmo-item-path][draggable="true"]');
  assert.equal(handles.length, 3);
  view.unmount();
});

test("a beat that is not editable offers no drag handles at all", async () => {
  const view = await mountBeatView(gridBeat(), { editable: false });
  assert.equal(view.host.querySelectorAll('[draggable="true"]').length, 0);
  // The paths are still in the markup — it is the affordance that is withheld, and with it the
  // permit list, so a synthesised drop has nothing to name.
  dragItemOnto(view, "items[2]", "items[0]");
  assert.deepStrictEqual(view.emitted, []);
  view.unmount();
});

test("dropping an item on another emits the beat with the list reordered", async () => {
  const view = await mountBeatView(gridBeat(), { editable: true });
  dragItemOnto(view, "items[2]", "items[0]");
  assert.equal(view.emitted.length, 1);
  assert.deepStrictEqual(titlesOf(view.emitted[0]), ["three", "one", "two"]);
  view.unmount();
});

test("the beat the view was given is not mutated by the drop", async () => {
  const beat = gridBeat();
  const view = await mountBeatView(beat, { editable: true });
  dragItemOnto(view, "items[0]", "items[2]");
  assert.deepStrictEqual(titlesOf(beat), ["one", "two", "three"]);
  view.unmount();
});

test("dropping an item on itself emits nothing", async () => {
  const view = await mountBeatView(gridBeat(), { editable: true });
  dragItemOnto(view, "items[1]", "items[1]");
  assert.deepStrictEqual(view.emitted, []);
  view.unmount();
});

test("a drop with no drag in flight emits nothing", async () => {
  const view = await mountBeatView(gridBeat(), { editable: true });
  dropOn(view, "items[0]");
  assert.deepStrictEqual(view.emitted, []);
  view.unmount();
});

test("letting go without dropping leaves nothing for a later drop to move", async () => {
  const view = await mountBeatView(gridBeat(), { editable: true });
  dragItemAndAbandon(view, "items[2]");
  dropOn(view, "items[0]");
  assert.deepStrictEqual(view.emitted, [], "dragend must clear the drag, or a stray drop reorders the list");
  // A fresh drag still works — the clear is not a latch.
  dragItemOnto(view, "items[2]", "items[0]");
  assert.equal(view.emitted.length, 1);
  view.unmount();
});

test("dragover is accepted only over another item of the same list", async () => {
  const view = await mountBeatView(gridBeat(), { editable: true });
  assert.equal(dragOverAccepted(view, "items[0]", "items[2]"), true);
  assert.equal(dragOverAccepted(view, "items[1]", "items[1]"), false, "an item is not a target for itself");
  view.unmount();
});

test("the reordered list is what the next render shows, once the host applies the update", async () => {
  const view = await mountBeatViewReactive(gridBeat(), { hostApplies: true });
  dragItemOnto(view, "items[2]", "items[0]");
  await settle();
  const shown = [...view.host.querySelectorAll("[data-mulmo-item-path]")].map((element) => element.textContent.trim());
  assert.ok(shown[0].includes("three"), `the dropped item should now be first, got ${JSON.stringify(shown)}`);
  view.unmount();
});

// ─── what may start a drag ───

test("a natively-draggable child does not become the drag source", async () => {
  // `<img>` and `<a href>` are draggable by default and win over a draggable="true" ancestor.
  // Deck puts an image block inside a card, so dragging the picture out to copy it elsewhere
  // reordered the list instead — measured in both Chromium and Firefox.
  const view = await mountBeatView(gridBeat(), { editable: true });
  const picture = childOfItem(view, "items[0]", "img");
  assert.equal(dragStartFrom(view, picture, "items[1]"), false, "the image's own drag must not be ours");
  view.unmount();
});

test("a drag that begins on a text selection is a selection, not a reorder", async () => {
  // Firefox and WebKit start an item drag from a selection gesture; the refused drop then
  // splices the transfer payload into the slide text, which the blur commits.
  const view = await mountBeatView(gridBeat(), { editable: true });
  selectTextIn(view, "items[0]");
  dragItemOnto(view, "items[0]", "items[1]");
  assert.deepStrictEqual(view.emitted, [], "a selection drag must reorder nothing");
  clearSelection();
  // …and with nothing selected the same gesture works.
  dragItemOnto(view, "items[0]", "items[1]");
  assert.equal(view.emitted.length, 1);
  view.unmount();
});

test("an item path the render never offered can neither start nor receive a drag", async () => {
  // The permit list is the only guard here: `items[2]` exists in the data, so `moveByPath` would
  // accept it. Measured before this test existed: deleting BOTH of BeatView's checks left the
  // whole suite green, because applyItemMove's own copy was the only one under test.
  const beat = gridBeat();
  const view = await mountBeatView(beat, { editable: true });
  const grafted = graftItemMarker(view, "items[9]");
  assert.equal(dragStartFrom(view, grafted, "items[1]"), false, "a grafted marker must not start a drag");
  assert.equal(dragOverAccepted(view, "items[0]", "items[1]"), true, "a real pair still works");
  view.unmount();
});

test("a list with one entry is not offered as draggable at all", async () => {
  // A move needs a different index in the same array, so a length-1 list has no valid target.
  // Offering it gives a drag ghost and a no-drop cursor for a reorder that cannot complete.
  const single: EditableBeat = {
    text: "",
    image: { type: "slide", slide: { layout: "grid", title: "T", items: [{ title: "only" }] } },
  };
  const view = await mountBeatView(single, { editable: true });
  assert.deepStrictEqual(itemPaths(view), ["items[0]"], "the marker is still in the markup");
  assert.equal(view.host.querySelectorAll('[draggable="true"]').length, 0, "but nothing is draggable");
  view.unmount();
});

// ─── nested item paths ───

/** Deck nests markers: a `columns[0]` card contains `columns[0].content[0].items[0]` bullets. */
const nestedBeat = (): EditableBeat => ({
  text: "",
  image: {
    type: "slide",
    slide: {
      layout: "columns",
      title: "T",
      columns: [
        { title: "A", content: [{ type: "bullets", items: ["a1", "a2"] }] },
        { title: "B", content: [{ type: "bullets", items: ["b1", "b2"] }] },
      ],
    },
  },
});

test("dropping a card over its bullets targets the card, not the bullet", async () => {
  // `closest()` takes the INNERMOST marker, which is the bullet — a different array from the one
  // being dragged, so the drop was refused. Measured in Chromium against real deck markup: the
  // bullets cover most of a 900×77 card, leaving only the padding strip usable.
  const view = await mountBeatView(nestedBeat(), { editable: true });
  assert.ok(itemPaths(view).includes("columns[0].content[0].items[0]"), "the fixture must nest");
  dragItemOnto(view, "columns[1]", "columns[0].content[0].items[0]");
  assert.equal(view.emitted.length, 1, "the drop must resolve outward to columns[0]");
  const columns = beatImage(view.emitted[0] as EditableBeat)["slide"];
  const titles = isRecord(columns) && Array.isArray(columns["columns"]) ? columns["columns"].map((c: unknown) => (isRecord(c) ? c["title"] : c)) : [];
  assert.deepStrictEqual(titles, ["B", "A"]);
  view.unmount();
});

test("a bullet still reorders among its own siblings", async () => {
  // The outward walk must not swallow the inner level when the inner level is the right one.
  const view = await mountBeatView(nestedBeat(), { editable: true });
  dragItemOnto(view, "columns[0].content[0].items[0]", "columns[0].content[0].items[1]");
  assert.equal(view.emitted.length, 1);
  view.unmount();
});

// ─── the animation is actually played ───

const GAP = 100;

test("the drop actually plays the FLIP on the re-rendered items", async () => {
  // Nothing else in the suite reaches this seam: `test_flip.ts` never mounts a component, and
  // every rect in jsdom is zero, so `playPendingFlip()` could be deleted outright and the suite
  // would stay green. Measured — it was, at 291 pass / 0 fail.
  //
  // What is asserted here is that the play REACHED the elements. The distances it inverts by are
  // pinned in `test_flip.ts`, against a layout this environment cannot provide for real.
  const restore = withItemLayout(GAP);
  try {
    const view = await mountBeatViewReactive(gridBeat(), { hostApplies: true });
    dragItemOnto(view, "items[2]", "items[0]");
    await settle();
    // The transition is cleared on `transitionend`, which jsdom never fires, so it is still on
    // every element the play touched.
    const played = [...view.host.querySelectorAll<HTMLElement>("[data-mulmo-item-path]")].filter((element) => element.style.transition !== "");
    assert.equal(played.length, 3, "all three items changed place, so all three must animate");
    view.unmount();
  } finally {
    restore();
  }
});

test("a drop the host ignores leaves no FLIP armed for a later, unrelated render", async () => {
  // `pending_flip` used to be cleared only by the html watcher, so a consumer that validates and
  // rejects the emit left the rectangles waiting to fire on the next text commit instead.
  const restore = withItemLayout(GAP);
  try {
    const view = await mountBeatViewReactive(gridBeat());
    dragItemOnto(view, "items[2]", "items[0]");
    await settle();
    // The host did not apply it, so nothing re-rendered and nothing must have moved.
    const touched = [...view.host.querySelectorAll<HTMLElement>("[data-mulmo-item-path]")].filter((element) => element.style.transition !== "");
    assert.deepStrictEqual(touched, []);
    view.unmount();
  } finally {
    restore();
  }
});
