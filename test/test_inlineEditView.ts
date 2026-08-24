import test from "node:test";
import assert from "node:assert";

import {
  mountBeatView,
  clickPath,
  setEditedHtml,
  blurActive,
  pressOn,
  pressWhileComposing,
  reachability,
  graftMarker,
  blurAsIfEditing,
  selectWithin,
  settle,
  toolbarOf,
} from "./support/beatViewHarness";
import { documentListenerCount } from "./support/domGlobals";
import { withEditingAffordances } from "../src/inlineEdit";

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
  // Every text field this layout has, not just the one the other tests happen to drive.
  assert.deepEqual(
    [...paths].sort((a, b) => (a ?? "").localeCompare(b ?? "")),
    ["subtitle", "title"],
  );
  assert.ok(paths.includes("title"), `expected a title marker, got ${JSON.stringify(paths)}`);
});

test("clicking a marked element makes that one editable and no other", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  const editable = [...view.host.querySelectorAll('[contenteditable="true"]')].map((el) => el.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.deepEqual(editable, ["title"]);
});

test("an edited element, on blur, emits the beat carrying its new text", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "After");
  blurActive(view);
  const emitted = view.emitted.at(-1) as Record<string, Record<string, Record<string, unknown>>> | undefined;
  view.unmount();
  assert.ok(emitted, "nothing was emitted");
  assert.equal(emitted.image.slide.title, "After");
  assert.equal(emitted.image.slide.subtitle, "Sub", "the other fields must survive");
});

test("a <strong> in the edited html round-trips into deck markup", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "<strong>After</strong>");
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

test("an editable marker is reachable without a mouse", async () => {
  // Codex round 1: the feature was mouse-only — nothing tabbable, and a screen reader was never
  // told the text could be edited. The attributes go on after each render because the elements
  // come from `v-html`.
  const on = await mountBeatView(slide(), { editable: true });
  const attrs = reachability(on, "title");
  on.unmount();
  assert.equal(attrs.tabindex, "0");
  assert.equal(attrs.role, "textbox");
  assert.equal(attrs.label, "Edit title");
});

test("a read-only beat carries none of those attributes", async () => {
  const off = await mountBeatView(slide(), { editable: false });
  const attrs = reachability(off, "title");
  off.unmount();
  assert.deepEqual(attrs, { tabindex: null, role: null, label: null });
});

test("Enter on a focused marker starts editing, and Enter again commits", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  pressOn(view, "title", "Enter");
  // `pressOn` focuses first and refuses if the element cannot take focus, so reaching here at
  // all is part of the claim: a keyboard user can get to this marker without a pointer.
  const focused = view.host.querySelector('[data-mulmo-path="title"]') === view.host.ownerDocument.activeElement;
  const started = view.host.querySelectorAll('[contenteditable="true"]').length;
  setEditedHtml(view, "title", "ByKeyboard");
  pressOn(view, "title", "Enter");
  blurActive(view);
  const emitted = view.emitted.at(-1) as Record<string, Record<string, Record<string, unknown>>> | undefined;
  view.unmount();
  assert.equal(focused, true, "the marker must actually hold focus, not merely receive the event");
  assert.equal(started, 1, "Enter should have started editing");
  assert.equal(emitted?.image.slide.title, "ByKeyboard");
});

test("Space also starts editing", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  pressOn(view, "title", " ");
  const started = view.host.querySelectorAll('[contenteditable="true"]').length;
  view.unmount();
  assert.equal(started, 1);
});

test("Escape discards what was typed, on screen as well as in the beat", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "Discarded");
  pressOn(view, "title", "Escape");
  blurActive(view);
  const shown = view.host.querySelector('[data-mulmo-path="title"]')?.textContent.trim();
  const count = view.emitted.length;
  view.unmount();
  assert.equal(count, 0, "nothing is written");
  // Nothing re-renders when the beat does not change, so text left behind here stays on screen
  // and reads as a saved edit.
  assert.equal(shown, "Before", "and nothing is left on screen either");
});

test("withEditingAffordances: marks the real elements and leaves prose alone", () => {
  // The defect this replaced: a regex over `data-mulmo-path="…"` also rewrote that text when a
  // user TYPED it into a slide, so a title of `data-mulmo-path="injected"` rendered showing
  // `tabindex="0"` as visible prose. Parsing means an attribute only lands on an element.
  const marked = withEditingAffordances('<p data-mulmo-path="title">hello</p>');
  assert.match(marked.html, /tabindex="0"/);
  assert.match(marked.html, /role="textbox"/);
  assert.match(marked.html, /aria-label="Edit title"/);
  assert.deepEqual([...marked.paths], ["title"], "the same pass records what may be written");

  const prose = withEditingAffordances('<p data-mulmo-path="title">data-mulmo-path="typed by a user"</p>');
  assert.equal((prose.html.match(/tabindex="0"/g) ?? []).length, 1, "the typed text must not become an attribute");
  assert.deepEqual([...prose.paths], ["title"], "nor become a writable path");
});

test("withEditingAffordances: an element that already has a tabindex is not given two", () => {
  const out = withEditingAffordances('<p data-mulmo-path="a" tabindex="-1">x</p>').html;
  assert.equal((out.match(/tabindex=/g) ?? []).length, 1);
  assert.match(out, /tabindex="0"/);
});

test("a marker the renderer never emitted cannot write to the beat", async () => {
  // The permit list only protects anything if the commit consults the set that was RENDERED.
  // `layout` exists on every slide, so a marker naming it would otherwise write prose into the
  // field that decides how the slide is drawn.
  const view = await mountBeatView(slide(), { editable: true });
  graftMarker(view, "layout");
  clickPath(view, "layout");
  assert.equal(view.host.querySelector('[data-mulmo-path="layout"]')?.getAttribute("contenteditable"), null, "nor should it take a caret it cannot commit");
  setEditedHtml(view, "layout", "<b>broken</b>");
  blurActive(view);
  assert.deepEqual(view.emitted, [], "a grafted marker must not reach the beat");

  // ...and the real markers still do, so this is a permit list and not a dead commit path.
  clickPath(view, "title");
  setEditedHtml(view, "title", "After");
  blurActive(view);
  assert.equal(view.emitted.length, 1);
  view.unmount();
});

test("withEditingAffordances: an empty path is offered to nobody", () => {
  const out = withEditingAffordances('<p data-mulmo-path="">x</p>');
  assert.deepEqual([...out.paths], [], "an empty path names no field, so nothing may write through it");
  assert.doesNotMatch(out.html, /tabindex/, "nor should it read as editable");
});

test("a commit is refused for a path the current render does not offer", async () => {
  // The click gate and the write gate are separate on purpose: the caret can be placed while a
  // path is offered and the beat can change before the blur. This drives the write gate alone.
  const view = await mountBeatView(slide(), { editable: true });
  graftMarker(view, "layout");
  blurAsIfEditing(view, "layout", "<b>prose</b>");
  assert.deepEqual(view.emitted, [], "only what the render offered may be written");
  view.unmount();
});

test("a key pressed mid-conversion belongs to the IME, not the editor", async () => {
  // Confirming an IME candidate sends Enter. Treating it as "done editing" commits the
  // unconverted reading and drops the caret — once per 文節 for anyone typing Japanese.
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "にほんご");
  pressWhileComposing(view, "title", "Enter");
  const stillEditing = view.host.querySelector('[data-mulmo-path="title"]')?.getAttribute("contenteditable");
  assert.equal(stillEditing, "true", "the conversion must survive its own confirmation key");
  assert.deepEqual(view.emitted, [], "and nothing is written mid-conversion");

  // Once the conversion is over, the same key commits as usual.
  pressOn(view, "title", "Enter");
  blurActive(view);
  assert.equal(view.emitted.length, 1);
  view.unmount();
});

test("Escape mid-conversion abandons the candidate, not the edit", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "にほんご");
  pressWhileComposing(view, "title", "Escape");
  assert.equal(view.host.querySelector('[data-mulmo-path="title"]')?.getAttribute("contenteditable"), "true");
  view.unmount();
});

test("the formatting toolbar appears for a selection inside the beat being edited", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  await settle();
  assert.equal(toolbarOf(view), null, "nothing to format until something is selected");
  selectWithin(view, "title");
  await settle();
  assert.ok(toolbarOf(view), "a selection inside the edited beat shows it");
  view.unmount();
});

test("committing leaves the document as it was found", async () => {
  // A listener left behind is invisible until something else goes wrong, so it is asserted.
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  selectWithin(view, "title");
  await settle();
  blurActive(view);
  await settle();
  const shown = toolbarOf(view);
  const listeners = documentListenerCount("selectionchange");
  view.unmount();
  assert.equal(shown, null, "committing puts the toolbar away");
  assert.equal(listeners, 0, "and detaches the listener");
});

test("a read-only beat never shows the toolbar, however you select in it", async () => {
  const view = await mountBeatView(slide(), { editable: false });
  selectWithin(view, "title");
  await settle();
  const shown = toolbarOf(view);
  view.unmount();
  assert.equal(shown, null);
});

test("unmounting mid-edit leaves no selection listener behind", async () => {
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  selectWithin(view, "title");
  await settle();
  assert.ok(toolbarOf(view), "the toolbar is up before unmounting");
  // Unmounting removes the component's DOM either way, so a toolbar count proves nothing here.
  // The leak is the listener itself: it would keep running against an unmounted instance.
  assert.equal(documentListenerCount("selectionchange"), 1, "editing attaches exactly one");
  view.unmount();
  assert.equal(documentListenerCount("selectionchange"), 0, "and unmounting takes it away");
});

test("a beat replaced mid-edit takes the toolbar and the listener with it", async () => {
  // No focusout fires for an element that was removed rather than blurred, so nothing else
  // tears this down. Measured before the fix: the toolbar stayed up over a fragment that no
  // longer had anything editable in it.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  clickPath(view, "title");
  selectWithin(view, "title");
  await settle();
  assert.ok(toolbarOf(view), "the toolbar is up while editing");

  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Replaced" } } });
  await settle();
  await settle();
  const stillShowing = view.host.parentElement?.querySelectorAll('[role="toolbar"]').length ?? 0;
  const listeners = documentListenerCount("selectionchange");
  view.unmount();
  assert.equal(stillShowing, 0, "the toolbar goes with the fragment");
  assert.equal(listeners, 0, "and so does the listener");
});
