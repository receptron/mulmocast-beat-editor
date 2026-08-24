import test from "node:test";
import assert from "node:assert";

import { beatsOf, withBeats } from "../src/scriptHelpers";
import { beatImage, beatType } from "../src/beatHelpers";

const script = {
  $mulmocast: { version: "1.1" },
  presentationStyle: { canvasSize: { width: 1280, height: 720 } },
  beats: [{ text: "one" }, { text: "two" }],
  slideParams: { theme: "dark" },
};

test("beatsOf: the script's beats", () => {
  assert.deepEqual(beatsOf(script), [{ text: "one" }, { text: "two" }]);
});

test("beatsOf: nothing usable answers with an empty array, never a throw", () => {
  // A host reads this on every render, including before its script has loaded.
  [null, undefined, "oops", 42, [], {}, { beats: null }, { beats: "no" }, { beats: 7 }].forEach((input) => {
    assert.deepEqual(beatsOf(input), [], `${JSON.stringify(input)} should answer with no beats`);
  });
});

test("beatsOf: an element the editor cannot render is still handed through", () => {
  // Filtering here would round-trip as deletion — the host writes the array back and what
  // was dropped is gone. Measured: `beatType` used to throw on the null.
  const messy = { beats: [{ text: "ok" }, null, "oops", 42] };
  assert.equal(beatsOf(messy).length, 4);
  assert.deepEqual(beatsOf(messy), [{ text: "ok" }, null, "oops", 42]);
});

test("withBeats: replaces the beats and keeps everything else", () => {
  const next = withBeats(script, [{ text: "only" }]);
  assert.deepEqual(next.beats, [{ text: "only" }]);
  assert.deepEqual(next.presentationStyle, script.presentationStyle, "the field a host most often drops");
  assert.deepEqual(next.slideParams, script.slideParams);
  assert.deepEqual(next.$mulmocast, script.$mulmocast);
});

test("withBeats: does not mutate the script it was given", () => {
  const before = JSON.stringify(script);
  withBeats(script, [{ text: "other" }]);
  assert.equal(JSON.stringify(script), before);
});

test("withBeats: a script that had no beats gains them", () => {
  const next = withBeats({ presentationStyle: { theme: "x" } }, [{ text: "first" }]);
  assert.deepEqual(next, { presentationStyle: { theme: "x" }, beats: [{ text: "first" }] });
});

test("beatsOf and withBeats round-trip every field", () => {
  // The whole point of the pair: an unedited round trip must be the identity.
  assert.deepEqual(withBeats(script, beatsOf(script)), script);
});

test("beatType / beatImage answer for a beat that is not a record", () => {
  // Reachable now that beatsOf hands through whatever the script held. Both used to throw on
  // null with `Cannot read properties of null (reading 'image')`.
  [null, undefined, "oops", 42].forEach((beat) => {
    assert.equal(beatType(beat as never), "(no image)", `beatType(${JSON.stringify(beat)})`);
    assert.deepEqual(beatImage(beat as never), {}, `beatImage(${JSON.stringify(beat)})`);
  });
});

test("a beats array carrying an element the editor cannot render still lists", async () => {
  // What `beatsOf` hands through has to survive being rendered, or preserving it would only
  // move the data loss into a crash. Measured before the guards: the null threw.
  const { mountBeatList } = await import("./support/beatViewHarness");
  const view = await mountBeatList(beatsOf({ beats: [{ text: "ok", image: { type: "slide", slide: { layout: "title", title: "T" } } }, null, "oops", 42] }));
  const cards = view.host.querySelectorAll("[data-beat-index], li, article").length;
  const text = view.host.textContent;
  view.unmount();
  assert.ok(text.includes("no image"), "an unrenderable beat is labelled rather than crashing the list");
  assert.ok(cards > 0 || text.length > 0, "the list rendered");
});

/**
 * Click every control, checking `afterEach` between clicks, and answer with what was clicked.
 *
 * Between EVERY click, not once at the end: an in-place reorder followed by its inverse leaves
 * the array where it started, so a single comparison afterwards reports nothing — measured,
 * that mutation walked through a whole-sweep assertion.
 */
type Click = { label: string; emits: number };

const clickEveryControl = (host: HTMLElement, emitted: unknown[], afterEach: () => void): Click[] =>
  [...host.querySelectorAll("button")].map((button) => {
    const before = emitted.length;
    button.click();
    afterEach();
    return { label: button.textContent.trim(), emits: emitted.length - before };
  });

/**
 * Every write path must have actually RUN, measured by what each click emitted.
 *
 * A button count, or even a label list, only says a control was on screen. `update` is reached
 * solely because the fixture's first beat is a slide, whose editor pane renders "+ chip", so
 * what has to be asserted is that clicking it produced an emit — not that it existed.
 */
const assertReachesEveryArrayOperation = (clicks: Click[]): void => {
  const emitsFrom = (matches: (label: string) => boolean): number =>
    clicks.filter((click) => matches(click.label)).reduce((total, click) => total + click.emits, 0);
  const seen = JSON.stringify(clicks);
  assert.ok(emitsFrom((label) => label === "\u2191" || label === "\u2193") >= 1, `a reorder must have emitted: ${seen}`);
  assert.ok(emitsFrom((label) => label === "\u2715") >= 1, `a remove must have emitted: ${seen}`);
  assert.ok(emitsFrom((label) => label.startsWith("+ Add")) >= 1, `the add must have emitted: ${seen}`);
  assert.ok(
    emitsFrom((label) => label.startsWith("+ ") && !label.startsWith("+ Add")) >= 1,
    `an editor-pane control must have emitted, which is what reaches update: ${seen}`,
  );
};

/** A script shaped like a host's: beats, plus the fields a careless write-back would drop. */
const hostScript = () => ({
  presentationStyle: { canvasSize: { width: 1280, height: 720 } },
  beats: [
    { text: "a", image: { type: "slide", slide: { layout: "title", title: "A" } } },
    { text: "b", image: { type: "textSlide", slide: { title: "B" } } },
  ],
  slideParams: { theme: "dark" },
});

test("a full edit cycle never writes through to the host's script", async () => {
  // `beatsOf` hands back the script's OWN array, not a copy. That is only safe because every
  // array operation in the editor slices first — and "it slices" is a property worth pinning,
  // not a line to re-read. Six operations are driven here (up, down, remove, add, chip).
  const { mountBeatList } = await import("./support/beatViewHarness");
  const host = hostScript();
  const frozen = JSON.stringify(host);
  const originalArray = host.beats;

  const view = await mountBeatList(beatsOf(host));
  const clicks = clickEveryControl(view.host, view.emitted, () => assert.equal(JSON.stringify(host), frozen, "a control wrote through to the host"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const emitted = [...view.emitted];
  view.unmount();

  assertReachesEveryArrayOperation(clicks);
  assert.ok(emitted.length >= 4, `the sweep must actually drive the editor, got ${emitted.length} emits`);
  assert.equal(host.beats, originalArray, "including the array identity it handed over");

  // And every one of those emits round-trips without losing the fields a host cares about.
  emitted.forEach((beats, index) => {
    const rebuilt = withBeats(host, beats as never);
    assert.deepEqual(rebuilt.presentationStyle, host.presentationStyle, `emit ${index}`);
    assert.deepEqual(rebuilt.slideParams, host.slideParams, `emit ${index}`);
  });
});
