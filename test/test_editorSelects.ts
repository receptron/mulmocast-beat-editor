import test from "node:test";
import assert from "node:assert";
import type { SlideLayout } from "@mulmocast/deck";

import { LAYOUT_TYPES, BLOCK_TYPES, makeSlide, makeBlock } from "../src/editorHelpers";
import { mountEditor, chooseOption, findSelect, signatureOf, type EditorName, type Mounted } from "./support/editorHarness";

/**
 * The property: every select in these editors reads back what you just chose.
 *
 * `:value` and `@change` are written separately at every site, so they can point at different
 * paths and nothing notices — the rendered HTML is identical either way, because `<select :value>`
 * sets a DOM property and never appears as an attribute. Driving the select and re-mounting on
 * what the editor emitted is the only thing that ties the two halves together.
 *
 * Neither `Inspector.vue` nor `ContentBlockEditor.vue` had any test before this one.
 */

type Fixture = { name: string; editor: EditorName; value: unknown };
type Target = { signature: string; occurrence: number; options: string[] };
type Outcome = "checked" | "command" | "noEmit" | "gone";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * The eyebrow is optional and its colour only means anything once it has a label — see the last
 * test. Every fixture carries one so that colour select is a live control rather than a no-op.
 */
const withEyebrow = (layout: SlideLayout["layout"]): SlideLayout => ({ ...makeSlide(layout), eyebrow: { label: "Eyebrow" } });

const FIXTURES: Fixture[] = [
  ...LAYOUT_TYPES.map((layout) => ({ name: `layout:${layout}`, editor: "Inspector" as const, value: withEyebrow(layout) })),
  ...BLOCK_TYPES.map((type) => ({ name: `block:${type}`, editor: "ContentBlockEditor" as const, value: makeBlock(type) })),
];

/** A floor, not a target: 864 cases round-trip today. Without it, a refactor that stopped
 *  rendering selects would leave every assertion unreached and the suite still green. */
const MINIMUM_ROUND_TRIPS = 800;

/** (signature, occurrence) survives the form being rebuilt; a bare index does not. */
const targetsOf = (mounted: Mounted): Target[] => {
  const seen = new Map<string, number>();
  return mounted.selects.map((select) => {
    const signature = signatureOf(select);
    const occurrence = seen.get(signature) ?? 0;
    seen.set(signature, occurrence + 1);
    return { signature, occurrence, options: [...select.options].map((option) => option.value) };
  });
};

const driveOne = async (fixture: Fixture, target: Target, option: string): Promise<Outcome> => {
  const before = await mountEditor(fixture.editor, fixture.value);
  const select = findSelect(before, target.signature, target.occurrence);
  if (select === null) {
    before.unmount();
    return "gone";
  }
  const { emitted, selfCleared } = chooseOption(before, select, option);
  before.unmount();
  if (selfCleared) return "command";
  if (emitted === undefined) return "noEmit";

  const after = await mountEditor(fixture.editor, emitted);
  const readback = findSelect(after, target.signature, target.occurrence)?.value;
  after.unmount();
  if (readback === undefined) return "gone";

  assert.equal(readback, option, `${fixture.name} select ${target.signature} #${target.occurrence} was set to "${option}" but reads back "${readback}"`);
  return "checked";
};

const driveFixture = async (fixture: Fixture, tally: Record<Outcome, number>): Promise<number> => {
  const first = await mountEditor(fixture.editor, fixture.value);
  const targets = targetsOf(first);
  const count = first.selects.length;
  first.unmount();

  for (const target of targets) {
    for (const option of target.options) {
      tally[await driveOne(fixture, target, option)] += 1;
    }
  }
  return count;
};

test("every select round-trips through the value its editor emits", async (t) => {
  const tally: Record<Outcome, number> = { checked: 0, command: 0, noEmit: 0, gone: 0 };

  for (const fixture of FIXTURES) {
    const count = await driveFixture(fixture, tally);
    await t.test(`${fixture.name} renders selects`, () => {
      assert.ok(count > 0, `${fixture.name} rendered no select at all`);
    });
  }

  // Printed rather than left implicit: the skips are part of the coverage story, and a silent
  // drop reads as "everything was checked".
  t.diagnostic(`round-trips checked ${tally.checked}; command selects ${tally.command}; no emit ${tally.noEmit}; control gone ${tally.gone}`);

  await t.test("checked enough cases to mean something", () => {
    assert.ok(tally.checked >= MINIMUM_ROUND_TRIPS, `only ${tally.checked} round-trips were checked (floor ${MINIMUM_ROUND_TRIPS})`);
  });
});

test("an eyebrow colour without a label leaves no eyebrow behind", async () => {
  // Deliberate: the label's placeholder reads "(empty = none)", so an eyebrow with no label is
  // not an eyebrow. Pinned here because it is the one place a select is a no-op by design, and
  // the round-trip property above would otherwise look broken rather than inapplicable.
  const mounted = await mountEditor("Inspector", makeSlide("title"));
  const colour = mounted.selects.find((select) => [...select.options].some((option) => option.value === "highlight"));
  assert.ok(colour, "no accent select on a title slide");

  const { emitted } = chooseOption(mounted, colour, "primary");
  mounted.unmount();
  assert.ok(isRecord(emitted), "the editor emitted nothing to inspect");
  assert.equal(emitted["eyebrow"], undefined);
});
