import test from "node:test";
import assert from "node:assert";

import { mountBeatView, clickPath, typeInto, blurActive } from "./support/beatViewHarness";

/**
 * Click-to-edit, driven through a real mount.
 *
 * The pure half is covered by `test_inlineEdit.ts`. What only a mount can answer is whether the
 * DOM wiring reaches it: `data-mulmo-path` survives `sanitizeFragment` into the rendered div,
 * a click makes the right element editable, and a blur emits the edited beat rather than the
 * one that was passed in.
 */

const slide = () => ({ text: "", image: { type: "slide", slide: { layout: "title", title: "Before", subtitle: "Sub" } } });

test("a slide beat renders the path markers the editing needs", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  const paths = [...view.host.querySelectorAll("[data-mulmo-path]")].map((el) => el.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.ok(paths.includes("title"), `expected a title marker, got ${JSON.stringify(paths)}`);
});

test("clicking a marked element makes that one editable and no other", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  const editable = [...view.host.querySelectorAll('[contenteditable="true"]')].map((el) => el.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.deepEqual(editable, ["title"]);
});

test("typing and blurring emits the beat with the new text", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  typeInto(view, "title", "After");
  blurActive(view);
  const emitted = view.emitted.at(-1) as Record<string, Record<string, Record<string, unknown>>> | undefined;
  view.unmount();
  assert.ok(emitted, "nothing was emitted");
  assert.equal(emitted.image.slide.title, "After");
  assert.equal(emitted.image.slide.subtitle, "Sub", "the other fields must survive");
});

test("bold applied in the browser round-trips into deck markup", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  typeInto(view, "title", "<strong>After</strong>");
  blurActive(view);
  const emitted = view.emitted.at(-1) as Record<string, Record<string, Record<string, unknown>>> | undefined;
  view.unmount();
  assert.equal(emitted?.image.slide.title, "**After**");
});

test("blurring without typing emits nothing", async () => {
  // Otherwise every click-away pushes an identical beat and the fragment rebuilds visibly.
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  blurActive(view);
  const count = view.emitted.length;
  view.unmount();
  assert.equal(count, 0);
});

test("the editable class is on the host, which is what makes the hover affordance appear", async () => {
  // The only signal that a slide can be clicked into. `documentStyles.ts` hangs the hover outline
  // off `.beat-fragment--editable [data-mulmo-path]`, so dropping the class leaves editing that
  // works but is invisible — which every other test here would still pass.
  const on = await mountBeatView(slide(), { editable: true });
  const withClass = on.host.className.includes("beat-fragment--editable");
  on.unmount();

  const off = await mountBeatView(slide(), { editable: false });
  const withoutClass = off.host.className.includes("beat-fragment--editable");
  off.unmount();

  assert.equal(withClass, true, "an editable beat must carry the class");
  assert.equal(withoutClass, false, "a read-only beat must not");
});

test("without `editable` a click does nothing", async () => {
  const view = await mountBeatView(slide(), { editable: false });
  clickPath(view, "title");
  const editable = view.host.querySelectorAll('[contenteditable="true"]').length;
  view.unmount();
  assert.equal(editable, 0);
});

test("a non-slide beat is not made editable even when asked", async () => {
  // `beatToHtml` emits no markers for the other seven types, so there is nothing to click —
  // but the guard is explicit rather than relying on that.
  const view = await mountBeatView({ text: "", image: { type: "markdown", markdown: "## Heading" } }, { editable: true });
  const markers = view.host.querySelectorAll("[data-mulmo-path]").length;
  const editableClass = view.host.className.includes("beat-fragment--editable");
  view.unmount();
  assert.equal(markers, 0);
  assert.equal(editableClass, false);
});
