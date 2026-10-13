import test from "node:test";
import assert from "node:assert";

import { BLOCK_TYPES, LAYOUT_TYPES, makeBlock, makeSlide } from "../src/editorHelpers";
import { isRecord } from "../src/beatHelpers";
import { mountEditor } from "./support/editorHarness";

/**
 * A slide under edit can hold anything in its fields, and the Inspector has to render it so the user
 * can fix it. Every field of every layout's skeleton is broken in each of these ways, and each slide
 * is mounted for real: a field missing, null or a string, a list holding a null, a string or a
 * number, and every panel or list item given a block list holding a null. The same is done one level
 * down for every block type in ContentBlockEditor. Generated from LAYOUT_TYPES / BLOCK_TYPES and the
 * skeletons, so a new layout or block type is covered without editing this.
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
      return [...fieldVariants, ...listVariants, ...nestedContentVariants(layout, base, key)];
    });
};

/** The slide with the object at `key` (or each object in the list at `key`) given `content: [null]`. */
const nestedContentVariants = (layout: string, base: Record<string, unknown>, key: string): Variant[] => {
  const value = base[key];
  const withNullBlock = (item: unknown): unknown => (isRecord(item) ? { ...item, content: [null] } : item);
  if (isRecord(value)) return [{ name: `${layout}.${key}.content [null]`, slide: { ...base, [key]: withNullBlock(value) } }];
  if (Array.isArray(value) && value.some(isRecord)) return [{ name: `${layout}.${key}[].content [null]`, slide: { ...base, [key]: value.map(withNullBlock) } }];
  return [];
};

/** Every field of a block type's skeleton broken the same ways, for ContentBlockEditor. */
const blockVariantsOf = (type: (typeof BLOCK_TYPES)[number]): Variant[] => {
  const base: Record<string, unknown> = { ...makeBlock(type) };
  return Object.keys(base)
    .filter((key) => key !== "type")
    .flatMap((key) => [
      { name: `block ${type}.${key} missing`, slide: Object.fromEntries(Object.entries(base).filter(([name]) => name !== key)) },
      { name: `block ${type}.${key} null`, slide: { ...base, [key]: null } },
      { name: `block ${type}.${key} string`, slide: { ...base, [key]: "x" } },
      ...(Array.isArray(base[key]) ? [{ name: `block ${type}.${key} [null]`, slide: { ...base, [key]: [null] } }] : []),
    ]);
};

/** The failure, or null when the value mounted. */
const mountFailure = async (variant: Variant, editor: "Inspector" | "ContentBlockEditor" = "Inspector"): Promise<string | null> => {
  try {
    (await mountEditor(editor, variant.slide)).unmount();
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

test("the block editor renders every malformed block instead of throwing", async () => {
  const variants = BLOCK_TYPES.flatMap(blockVariantsOf);
  const quiet = console.warn;
  console.warn = () => undefined;
  const failures: string[] = [];
  try {
    for (const variant of variants) {
      const failure = await mountFailure(variant, "ContentBlockEditor");
      if (failure) failures.push(failure);
    }
  } finally {
    console.warn = quiet;
  }
  assert.deepStrictEqual(failures, []);
  assert.ok(variants.length > BLOCK_TYPES.length, "the generator produced too few blocks to mean anything");
});
