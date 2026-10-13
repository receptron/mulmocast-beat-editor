import test from "node:test";
import assert from "node:assert";

import { LAYOUT_TYPES, makeSlide } from "../src/editorHelpers";
import { mountEditor } from "./support/editorHarness";

/**
 * A slide under edit can hold anything in its fields, and the Inspector has to render it so the user
 * can fix it. Every field of every layout's skeleton is broken in each of these ways, and each slide
 * is mounted for real: a field missing, null or a string, and a list holding a null, a string or a
 * number. Generated from LAYOUT_TYPES and makeSlide, so a new layout is covered without editing this.
 */
type Variant = { name: string; slide: Record<string, unknown> };

const variantsOf = (layout: (typeof LAYOUT_TYPES)[number]): Variant[] => {
  const base: Record<string, unknown> = { ...makeSlide(layout) };
  return Object.keys(base)
    .filter((key) => key !== "layout")
    .flatMap((key) => {
      const missing = Object.fromEntries(Object.entries(base).filter(([name]) => name !== key));
      const fieldVariants: Variant[] = [
        { name: `${layout}.${key} missing`, slide: missing },
        { name: `${layout}.${key} null`, slide: { ...base, [key]: null } },
        { name: `${layout}.${key} string`, slide: { ...base, [key]: "x" } },
      ];
      const listVariants: Variant[] = Array.isArray(base[key])
        ? [null, "x", 3].map((item) => ({ name: `${layout}.${key} [${JSON.stringify(item)}]`, slide: { ...base, [key]: [item] } }))
        : [];
      return [...fieldVariants, ...listVariants];
    });
};

/** The failure, or null when the slide mounted. */
const mountFailure = async (variant: Variant): Promise<string | null> => {
  try {
    (await mountEditor("Inspector", variant.slide)).unmount();
    return null;
  } catch (error) {
    return `${variant.name}: ${error instanceof Error ? error.message : String(error)}`;
  }
};

test("the Inspector renders every malformed slide instead of throwing", async () => {
  const variants = LAYOUT_TYPES.flatMap(variantsOf);
  const quiet = console.warn;
  console.warn = () => undefined;
  const failures: string[] = [];
  try {
    for (const variant of variants) {
      const failure = await mountFailure(variant);
      if (failure) failures.push(failure);
    }
  } finally {
    console.warn = quiet;
  }
  assert.deepStrictEqual(failures, []);
  assert.ok(variants.length > LAYOUT_TYPES.length * 3, "the generator produced too few slides to mean anything");
});
