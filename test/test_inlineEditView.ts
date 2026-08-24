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
  toolbarButtons,
  tabTo,
  focusOutTo,
  focusOutToForeignToolbar,
  bounceFocusBackTo,
  blurToNowhere,
  type MountedBeat,
  pressDownOn,
  rightPressOn,
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
  // A listener left behind is invisible until something else goes wrong, so it is asserted —
  // and so is its presence, or "never attached" would look the same as "cleaned up".
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  selectWithin(view, "title");
  await settle();
  // The toolbar follows the selection, and the selection moves when anything scrolls or the
  // window resizes — measured, scrolling the list 300px left the toolbar exactly where it was.
  ["selectionchange", "scroll", "resize"].forEach((type) => assert.equal(documentListenerCount(type), 1, `editing watches ${type}`));
  blurActive(view);
  await settle();
  const shown = toolbarOf(view);
  const listeners = documentListenerCount("selectionchange");
  view.unmount();
  assert.equal(shown, null, "committing puts the toolbar away");
  assert.equal(listeners, 0, "and detaches the listener");
  ["scroll", "resize"].forEach((type) => assert.equal(documentListenerCount(type), 0, `no ${type} listener either`));
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

test("the toolbar is one tab stop, not ten", async () => {
  // `role="toolbar"` promises arrows between the buttons and Tab past them. Ten stops would
  // make skipping the toolbar cost ten presses.
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  selectWithin(view, "title");
  await settle();
  const buttons = toolbarButtons(view);
  const stops = buttons.filter((button) => button.getAttribute("tabindex") === "0");
  view.unmount();
  assert.equal(buttons.length, 10, "bold, emphasis, seven colours, clear");
  assert.equal(stops.length, 1, "exactly one of them is in the tab order");
});

test("tabbing into the toolbar does not end the edit", async () => {
  // Focus leaving the editable element used to commit, which unmounted the toolbar before a
  // keyboard user could press anything — the buttons are focusable and it says role="toolbar".
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  selectWithin(view, "title");
  await settle();
  tabTo(view, toolbarButtons(view)[0]);
  await settle();
  const stillEditing = view.host.querySelector('[contenteditable="true"]') !== null;
  const stillShowing = toolbarOf(view) !== null;
  const emitted = view.emitted.length;
  view.unmount();
  assert.equal(stillEditing, true, "the element is still being edited");
  assert.equal(stillShowing, true, "and the toolbar is still there to press");
  assert.equal(emitted, 0, "nothing was committed");
});

test("moving to another marker in the same beat commits the first edit", async () => {
  // The keyboard fix widened the commit guard to "anywhere inside the beat", and that LOST
  // DATA: both elements stayed editable and only the second committed. Only a hop between the
  // text and its own toolbar may skip the commit.
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "T-EDITED");
  focusOutTo(view, "subtitle");
  await settle();
  const emitted = view.emitted.at(-1) as { image: { slide: Record<string, unknown> } } | undefined;
  const stillEditable = view.host.querySelectorAll('[contenteditable="true"]').length;
  view.unmount();
  assert.equal(emitted?.image.slide.title, "T-EDITED", "the first edit is not dropped");
  assert.equal(stillEditable, 0, "and the first element stops being editable");
});

test("another element claiming role=toolbar does not suppress this beat's commit", async () => {
  // An `html_tailwind` beat renders author markup verbatim, and the author can put
  // `role="toolbar"` in it — measured. Checking for any toolbar on the page rather than this
  // beat's own would let that markup swallow an edit happening somewhere else.
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "T-EDITED");
  focusOutToForeignToolbar(view);
  await settle();
  const emitted = view.emitted.at(-1) as { image: { slide: Record<string, unknown> } } | undefined;
  view.unmount();
  assert.equal(emitted?.image.slide.title, "T-EDITED", "the edit is committed all the same");
});

test("focus bouncing from a toolbar button back to the text does not commit", async () => {
  // Applying a format re-selects inside the contenteditable, which moves focus off the button
  // and back to the text. Treating that as the end of the edit would commit after every press
  // and unmount the toolbar under the user's finger.
  const view = await mountBeatView(slide(), { editable: true });
  clickPath(view, "title");
  selectWithin(view, "title");
  await settle();
  bounceFocusBackTo(view, "title");
  await settle();
  const stillShowing = toolbarOf(view) !== null;
  const emitted = view.emitted.length;
  view.unmount();
  assert.equal(emitted, 0, "nothing is committed");
  assert.equal(stillShowing, true, "and the toolbar stays up");
});

test("a beat replaced mid-edit cannot write the old element's html into the new one", async () => {
  // Codex round 5. Cleanup cleared the toolbar and the listener but not the element the commit
  // path trusts, so a later blur wrote the DETACHED node's html into the current beat —
  // measured, `title: "STALE"` landed on a beat whose title was already "Replaced".
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  clickPath(view, "title");
  setEditedHtml(view, "title", "STALE");
  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Replaced", subtitle: "NewSub" } } });
  await settle();
  await settle();
  const marker = view.host.querySelector<HTMLElement>('[data-mulmo-path="title"]');
  const win = view.host.ownerDocument.defaultView;
  if (!marker || !win) throw new Error("setup");
  marker.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  await settle();
  const emitted = view.emitted.length;
  view.unmount();
  assert.equal(emitted, 0, "the replaced beat is left alone");
});

/**
 * Codex round 7: refusing the write is not enough. A half-alive session keeps the element
 * `contenteditable`, so `startEditing` early-returns, no new session is recorded, and the NEXT
 * edit is refused too — the field is stuck.
 */
const assertEditingIsFullyOver = (view: { host: HTMLElement }): void => {
  assert.equal(view.host.querySelectorAll('[contenteditable="true"]').length, 0, "nothing is left editable");
  assert.equal(view.host.parentElement?.querySelector('[role="toolbar"]') ?? null, null, "the toolbar is gone");
  ["selectionchange", "scroll", "resize"].forEach((type) => assert.equal(documentListenerCount(type), 0, `no ${type} listener is left behind`));
};

test("a beat replaced by one that renders identically still ends the edit", async () => {
  // Codex round 6. When the replacement renders byte-identical HTML, Vue never touches the DOM,
  // so the edited node stays connected and "has it left the document" answers no. Measured, the
  // typed text was written into the replacement beat.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  clickPath(view, "title");
  setEditedHtml(view, "title", "STALE");
  selectWithin(view, "title");
  await settle();
  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Before", subtitle: "Sub" } } });
  await settle();
  blurToNowhere(view);
  await settle();

  assert.equal(view.emitted.length, 0, "the replacement beat is left alone");
  assertEditingIsFullyOver(view);
  await assertTheMarkerStillWorks(view);
  view.unmount();
});

/** After a refused commit the field must not be stuck: the next edit of it has to land. */
const assertTheMarkerStillWorks = async (view: MountedBeat): Promise<void> => {
  clickPath(view, "title");
  setEditedHtml(view, "title", "AFTER");
  blurToNowhere(view);
  await settle();
  const next = view.emitted.at(-1) as { image: { slide: Record<string, unknown> } } | undefined;
  assert.equal(next?.image.slide.title, "AFTER", "the next edit of the same marker commits");
};

test("a click on another marker survives the rebuild its own commit causes", async () => {
  // #61. Pressing on another field commits the one being edited, the parent replaces the beat,
  // and `v-html` rebuilds the fragment — so the `click` lands on a detached node and the
  // delegated handler never sees it. Measured on main: the field did not open and a second
  // click was needed. `mousedown` runs before all of that.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  // `hostApplies` because the timing is the point: a real host replaces the beat inside the
  // emit, so Vue's flush is queued there. Driving the replacement from the test instead put it
  // a tick late and the intent had already been dropped.
  const view = await mountBeatViewReactive(slide(), { hostApplies: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "FIRST");
  pressDownOn(view, "subtitle");
  focusOutTo(view, "subtitle");
  await settle();
  await settle();

  const editable = [...view.host.querySelectorAll("[contenteditable]")].map((element) => element.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.deepEqual(editable, ["subtitle"], "the marker the pointer went down on is the one that opens");
});

test("a press that never becomes a click opens nothing later", async () => {
  // Found by asking what leaves an intent set. Pressing on a marker and releasing somewhere
  // else — a drag away, a right-button press — records the path with no commit behind it.
  // Measured before the intent was promoted only inside a commit: the next unrelated
  // re-render opened that field.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  pressDownOn(view, "title");
  await settle();
  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Something else", subtitle: "Sub" } } });
  await settle();
  await settle();
  const opened = view.host.querySelectorAll("[contenteditable]").length;
  view.unmount();
  assert.equal(opened, 0, "no field opens on a re-render the press had nothing to do with");
});

test("a blur that writes nothing carries no intent either", async () => {
  // A commit runs on every blur; it writes only when something changed. Carrying the intent
  // regardless leaves it set with no rebuild coming — and the next unrelated re-render spends
  // it. Nothing typed here, so `applyInlineEdit` answers null.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  clickPath(view, "title");
  pressDownOn(view, "subtitle");
  focusOutTo(view, "subtitle");
  await settle();
  assert.equal(view.emitted.length, 0, "an untouched field writes nothing");

  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Elsewhere", subtitle: "Sub" } } });
  await settle();
  await settle();
  const opened = view.host.querySelectorAll("[contenteditable]").length;
  view.unmount();
  assert.equal(opened, 0, "the re-render opens nothing");
});

test("a click that lands normally leaves no intent behind", async () => {
  // Otherwise the next unrelated re-render would open an editor nobody asked for.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  pressDownOn(view, "title");
  clickPath(view, "title");
  await settle();
  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Other", subtitle: "Sub" } } });
  await settle();
  await settle();
  const editable = view.host.querySelectorAll("[contenteditable]").length;
  view.unmount();
  assert.equal(editable, 0, "the re-render opens nothing");
});

test("Enter leaves the caret at the END of the field", async () => {
  // #62. Chromium does not place a caret in an element that only became `contenteditable` this
  // tick, and focusing it again on a later tick does not help — measured, all three. Without a
  // caret inside, the next `Cmd+A` selects the whole page instead of the field.
  //
  // Asserted as a POSITION, not merely as "a caret exists": jsdom is more forgiving than
  // Chromium and puts one at offset 0 on its own, so "inside and collapsed" passes with the
  // fix removed. Where it sits is what discriminates — and the end is what makes typing append
  // rather than replace.
  const view = await mountBeatView(slide(), { editable: true });
  pressOn(view, "title", "Enter");
  await settle();
  const selection = view.host.ownerDocument.defaultView?.getSelection();
  const marker = view.host.querySelector('[data-mulmo-path="title"]');
  const at_end = selection?.anchorNode === marker && selection.anchorOffset === marker?.childNodes.length;
  const collapsed = selection?.isCollapsed;
  view.unmount();
  assert.equal(at_end, true, "the caret is at the end of the field");
  assert.equal(collapsed, true, "and it is a caret, not a selection — typing must not replace the text");
});

test("a right-click records no intent", async () => {
  // Codex round 1. A right-button press on another marker still moves focus, so the edit
  // commits and the fragment rebuilds — and the field the context menu was aimed at would
  // open behind it. `hostApplies` because that rebuild is same-tick, which is the only window
  // an intent now survives.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide(), { hostApplies: true });
  clickPath(view, "title");
  setEditedHtml(view, "title", "FIRST");
  rightPressOn(view, "subtitle");
  focusOutTo(view, "subtitle");
  await settle();
  await settle();
  const opened = view.host.querySelectorAll("[contenteditable]").length;
  const committed = view.emitted.length;
  view.unmount();
  assert.equal(committed, 1, "the edit still commits");
  assert.equal(opened, 0, "but nothing opens");
});

test("Escape abandons a press on another marker too", async () => {
  // Otherwise the press sits there and the next commit carries it. The later edit is started
  // with the KEYBOARD on purpose: a click clears the intent by itself, so a test that clicks
  // cannot tell whether Escape did anything.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide(), { hostApplies: true });
  clickPath(view, "title");
  pressDownOn(view, "subtitle");
  pressOn(view, "title", "Escape");
  await settle();

  pressOn(view, "title", "Enter");
  setEditedHtml(view, "title", "LATER");
  blurToNowhere(view);
  await settle();
  await settle();
  const opened = [...view.host.querySelectorAll("[contenteditable]")].map((element) => element.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.deepEqual(opened, [], "the abandoned press opens nothing");
});

test("an update the host ignores leaves no intent to spend later", async () => {
  // A host is free to drop an update. Then there is no rebuild for the intent to ride, and
  // measured, it waited: a later unrelated re-render opened the field.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  clickPath(view, "title");
  setEditedHtml(view, "title", "FIRST");
  pressDownOn(view, "subtitle");
  focusOutTo(view, "subtitle");
  await settle();
  assert.equal(view.emitted.length, 1, "the edit was offered");

  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Unrelated", subtitle: "Sub" } } });
  await settle();
  await settle();
  const opened = view.host.querySelectorAll("[contenteditable]").length;
  view.unmount();
  assert.equal(opened, 0, "nothing opens on a re-render the press had nothing to do with");
});

test("an intent cannot land on a different beat that happens to have the same path", async () => {
  // Codex round 2. A path is just a string, and every slide has a `subtitle`. Carrying only
  // the path meant a replacement that was NOT the emitted beat spent the intent all the same.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide());
  clickPath(view, "title");
  setEditedHtml(view, "title", "FIRST");
  pressDownOn(view, "subtitle");
  focusOutTo(view, "subtitle");
  await settle();
  assert.equal(view.emitted.length, 1, "the edit was offered");

  // The host applies something else entirely — a different beat object, same paths.
  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Another", subtitle: "Sub" } } });
  await settle();
  await settle();
  const opened = [...view.host.querySelectorAll("[contenteditable]")].map((element) => element.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.deepEqual(opened, [], "the press belonged to the beat that is no longer here");
});

test("a press invalidated by an unrelated rebuild is not carried by a later commit", async () => {
  // Codex round 3. The rebuild clears the CARRIED intent but was leaving the PENDING one, so a
  // press during an edit that an external replacement interrupted rode along on whatever
  // committed next.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide(), { hostApplies: true });
  clickPath(view, "title");
  pressDownOn(view, "subtitle");

  // The host replaces the beat before the click or the commit gets there.
  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Replaced", subtitle: "Sub" } } });
  await settle();
  await settle();

  // Now an ordinary keyboard edit, which must not drag the abandoned press along.
  pressOn(view, "title", "Enter");
  setEditedHtml(view, "title", "LATER");
  blurToNowhere(view);
  await settle();
  await settle();
  const opened = [...view.host.querySelectorAll("[contenteditable]")].map((element) => element.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.deepEqual(opened, [], "the abandoned press opens nothing");
});

test("a refused commit drops the press it was carrying", async () => {
  // The beat-identity refusal writes nothing, so there is nothing to carry — and the press
  // belonged to the session being refused.
  //
  // The replacement renders byte-identical HTML on purpose: that is the only way to reach the
  // refusal WITHOUT a rebuild, and the rebuild clears the pending press by itself. With a
  // visible replacement this test cannot tell whether the refusal did anything.
  const { mountBeatViewReactive } = await import("./support/beatViewHarness");
  const view = await mountBeatViewReactive(slide(), { hostApplies: true });
  clickPath(view, "title");
  pressDownOn(view, "subtitle");
  view.replaceBeat({ text: "", image: { type: "slide", slide: { layout: "title", title: "Before", subtitle: "Sub" } } });
  await settle();
  blurToNowhere(view);
  await settle();
  assert.equal(view.emitted.length, 0, "the refusal writes nothing");

  // A later edit commits for real. The abandoned press must not ride along.
  pressOn(view, "title", "Enter");
  setEditedHtml(view, "title", "LATER");
  blurToNowhere(view);
  await settle();
  await settle();
  const opened = [...view.host.querySelectorAll("[contenteditable]")].map((element) => element.getAttribute("data-mulmo-path"));
  view.unmount();
  assert.deepEqual(opened, [], "the refused session's press opens nothing");
});
