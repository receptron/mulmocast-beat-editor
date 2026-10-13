import { slideLayoutSchema, type ContentBlock, type SlideLayout } from "@mulmocast/deck";
import { isRecord } from "./beatHelpers";
import { BLOCK_TYPES, isSlideLayout, makeBlock, makeSlide } from "./editorHelpers";

/**
 * Whether deck accepts the layout with `key` left out. The skeleton is a valid slide (pinned by a test),
 * so removing one field and parsing again answers for that field alone.
 */
const isOptionalField = (layout: SlideLayout["layout"], key: string): boolean =>
  slideLayoutSchema.safeParse(Object.fromEntries(Object.entries(makeSlide(layout)).filter(([name]) => name !== key))).success;

const repairList = (value: unknown, fallback: unknown[]): unknown => {
  const element = fallback[0];
  if (!Array.isArray(value) || !isRecord(element)) return value;
  return value.map((item: unknown) => (isRecord(item) ? item : element));
};

const repairField = (layout: SlideLayout["layout"], key: string, value: unknown, fallback: unknown): unknown => {
  if (Array.isArray(fallback)) return repairList(value, fallback);
  if (!isRecord(fallback) || isRecord(value)) return value;
  if (value === undefined && isOptionalField(layout, key)) return value;
  return fallback;
};

/**
 * A slide the Inspector can render. A slide under edit can hold anything in its fields — `isSlideLayout`
 * accepts it by layout name — and the form reads into objects without checking, so a `null` panel or
 * a `null` list item threw before the user could fix it.
 *
 * Each field is checked against the layout's own `makeSlide` skeleton: an object field that is not an
 * object takes the skeleton's value (a missing one only when deck requires it, so an omitted optional
 * side of a `split` stays omitted), and a list keeps its length with each non-object item replaced by
 * the skeleton's item, so edits still land on the item the user picked. Anything else is left as is.
 */
export const inspectableSlide = (slide: SlideLayout): SlideLayout => {
  const skeleton: Record<string, unknown> = { ...makeSlide(slide.layout) };
  const current: Record<string, unknown> = { ...slide };
  const keys = new Set([...Object.keys(current), ...Object.keys(skeleton)]);
  const repaired = Object.fromEntries(
    [...keys]
      .map((key): [string, unknown] => [key, key in skeleton && key !== "layout" ? repairField(slide.layout, key, current[key], skeleton[key]) : current[key]])
      .filter(([key, value]) => value !== undefined || key in current),
  );
  return isSlideLayout(repaired) ? repaired : slide;
};

const isContentBlock = (value: unknown): value is ContentBlock => isRecord(value) && BLOCK_TYPES.some((type) => type === value["type"]);

/**
 * A list of content blocks the block editors can render: an entry that is not a block becomes a text
 * block in the same position, for the same reason `inspectableSlide` repairs a slide. Every block list
 * in the Inspector — a panel's, a column's, a cell's — goes through `ContentBlocksEditor`, so this is
 * the one place that needs it.
 */
export const renderableBlocks = (blocks: readonly unknown[] | undefined): ContentBlock[] =>
  (blocks ?? []).map((block) => (isContentBlock(block) ? block : makeBlock("text")));
