import test from "node:test";
import assert from "node:assert";

import { mountBeatList } from "./support/beatViewHarness";
import { makeBeat } from "../src/beatHelpers";

/**
 * jsdom has no layout and no container queries, so nothing here can tell you the editor reflows.
 * What it can tell you is that the three elements the reflow depends on still carry the classes
 * it is built from — a rename or a stray edit that silently returns the fixed two-pane layout.
 *
 * The behaviour itself is measured in a browser; the numbers are on the PR.
 */
test("the elements the narrow-host reflow depends on carry its classes", async () => {
  const view = await mountBeatList([makeBeat("textSlide")]);
  const aside = view.host.querySelector("aside");
  const row = aside?.parentElement;
  const container = row?.parentElement;
  const classes = (el: Element | null | undefined): string => el?.getAttribute("class") ?? "";
  view.unmount();

  // The container must be an ANCESTOR of the flex row, never the row itself: an element's own
  // `@3xl:` resolves against its nearest ancestor container, so declaring both on one element
  // silently does nothing — measured, the pane resized at the breakpoint and the direction
  // never changed.
  assert.match(classes(container), /@container/, "a wrapper declares the container");
  assert.doesNotMatch(classes(row), /@container/, "the flex row must not be its own container");

  assert.match(classes(row), /flex-col/, "stacked below the breakpoint");
  assert.match(classes(row), /@3xl:flex-row/, "side by side above it");

  assert.match(classes(aside), /\bw-full\b/, "the pane fills the width when stacked");
  assert.match(classes(aside), /@3xl:w-\[var\(--beat-editor-pane-width,24rem\)\]/, "and is a token when beside the list");
});
