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
