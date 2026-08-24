import "./support/domGlobals";

import test from "node:test";
import assert from "node:assert";

import { beatImage, isRecord, type EditableBeat } from "../src/beatHelpers";
import { dragItemAndAbandon, dragItemOnto, dragOverAccepted, dropOn, itemPaths, mountBeatView, mountBeatViewReactive, settle } from "./support/beatViewHarness";

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
