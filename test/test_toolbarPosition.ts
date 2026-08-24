import test from "node:test";
import assert from "node:assert";

import { placeToolbar, type Rect } from "../src/toolbarPosition";

const TOOLBAR = { width: 240, height: 36 };
const VIEWPORT = { width: 1280, height: 800 };
const rect = (left: number, top: number, width: number, height: number): Rect => ({ left, top, right: left + width, bottom: top + height, width });

test("placeToolbar: above the selection, centred on it", () => {
  const { x, y } = placeToolbar(rect(500, 400, 100, 20), TOOLBAR, VIEWPORT);
  assert.equal(y, 400 - 36 - 6, "six pixels above the selection");
  assert.equal(x, 500 + 50 - 120, "centred on the selection, not aligned to its left");
});

test("placeToolbar: below the selection when there is no room above", () => {
  // A selection in the first line of the page has nothing above it; the iframe version
  // clamped to 0 and drew the toolbar on top of the text it was formatting.
  const { y } = placeToolbar(rect(500, 10, 100, 20), TOOLBAR, VIEWPORT);
  assert.equal(y, 30 + 6, "below the selection instead");
});

test("placeToolbar: stays inside the viewport horizontally", () => {
  assert.equal(placeToolbar(rect(0, 400, 40, 20), TOOLBAR, VIEWPORT).x, 0, "a selection at the left edge");
  assert.equal(placeToolbar(rect(1240, 400, 40, 20), TOOLBAR, VIEWPORT).x, 1280 - 240, "a selection at the right edge");
});

test("placeToolbar: stays inside the viewport vertically when it has to go below", () => {
  // No room above AND the selection ends near the bottom — the toolbar must still be on screen.
  const { y } = placeToolbar(rect(500, 0, 100, 795), TOOLBAR, VIEWPORT);
  assert.ok(y >= 0 && y + TOOLBAR.height <= VIEWPORT.height, `y=${y} must keep the toolbar on screen`);
});

test("placeToolbar: a viewport smaller than the toolbar still yields a drawable position", () => {
  const { x, y } = placeToolbar(rect(10, 10, 20, 10), TOOLBAR, { width: 100, height: 20 });
  assert.ok(x >= 0 && y >= 0, `x=${x} y=${y}`);
});
