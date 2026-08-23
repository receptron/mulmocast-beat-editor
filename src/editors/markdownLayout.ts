import { isRecord } from "../beatHelpers";

/**
 * The object form of a `markdown` beat: an optional frame (`header` / `sidebar-left`) around
 * exactly one main (`content` / `row-2` / `2x2`).
 *
 * Every slot is `string | string[]`, and the renderer joins an array with "\n", so the two
 * forms render identically — which is why editing a slot as text is safe as long as the form
 * it was authored in is written back.
 */
export type MarkdownSlot = string | string[];

/** The mains, in the order the editor offers them. Exactly one is present on a valid layout. */
export const MAIN_KINDS = ["content", "row-2", "2x2"] as const;
export type MainKind = (typeof MAIN_KINDS)[number];

/** How many slots each main carries. */
export const SLOT_COUNT: Record<MainKind, number> = { content: 1, "row-2": 2, "2x2": 4 };

/** What each slot is called, from the schema's own comments on the tuples. */
export const SLOT_LABELS: Record<MainKind, string[]> = {
  content: ["content"],
  "row-2": ["left", "right"],
  "2x2": ["top-left", "top-right", "bottom-left", "bottom-right"],
};

export const FRAME_KEYS = ["header", "sidebar-left"] as const;
export type FrameKey = (typeof FRAME_KEYS)[number];

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((line) => typeof line === "string");

/** A slot kept as authored, or an empty string when it is neither of the two accepted forms. */
const normalizeSlot = (slot: unknown): MarkdownSlot => {
  if (typeof slot === "string") return slot;
  return isStringArray(slot) ? slot : "";
};

/** The layout form, as opposed to a plain string or array of lines. Carrying a main is what identifies it. */
export const isMarkdownLayout = (value: unknown): value is Record<string, unknown> => isRecord(value) && MAIN_KINDS.some((kind) => kind in value);

/** The main this layout carries. A malformed one with several resolves in MAIN_KINDS order. */
export const mainKindOf = (layout: Record<string, unknown>): MainKind => MAIN_KINDS.find((kind) => kind in layout) ?? "content";

/** Every slot of the main, padded to the count the main declares. */
export const slotsOf = (layout: Record<string, unknown>): unknown[] => {
  const kind = mainKindOf(layout);
  const main = layout[kind];
  if (kind === "content") return [main];
  return Array.from({ length: SLOT_COUNT[kind] }, (_, index) => (Array.isArray(main) ? main[index] : undefined));
};

/** A slot as one block of text — the same join the renderer applies to an array. */
export const slotText = (slot: unknown): string => {
  if (typeof slot === "string") return slot;
  return isStringArray(slot) ? slot.join("\n") : "";
};

/** Text written back in the form the slot already had, so an authored array stays an array. */
export const writeSlot = (current: unknown, text: string): MarkdownSlot => (isStringArray(current) ? text.split("\n") : text);

export const setSlot = (layout: Record<string, unknown>, index: number, text: string): Record<string, unknown> => {
  const kind = mainKindOf(layout);
  const slots = slotsOf(layout).map((slot, position) => (position === index ? writeSlot(slot, text) : normalizeSlot(slot)));
  return { ...layout, [kind]: kind === "content" ? slots[0] : slots };
};

/** An empty frame field is absent rather than empty: both are optional in the schema. */
export const setFrame = (layout: Record<string, unknown>, key: FrameKey, text: string): Record<string, unknown> => {
  const next = { ...layout };
  if (text === "") {
    delete next[key];
    return next;
  }
  next[key] = writeSlot(layout[key], text);
  return next;
};

/**
 * The same layout under a different main, carrying the text across.
 *
 * Widening pads with empty slots; narrowing to `content` joins what there was, since dropping
 * the text of a slot that no longer exists would lose the author's writing silently.
 */
export const switchMain = (layout: Record<string, unknown>, kind: MainKind): Record<string, unknown> => {
  const texts = slotsOf(layout).map(slotText);
  const rest = { ...layout };
  MAIN_KINDS.forEach((existing) => delete rest[existing]);
  if (kind === "content") return { ...rest, content: texts.filter((text) => text !== "").join("\n\n") };
  return { ...rest, [kind]: Array.from({ length: SLOT_COUNT[kind] }, (_, index) => texts[index] ?? "") };
};

/** The string form as a layout. Always safe: the text becomes the one slot `content` holds. */
export const toLayout = (markdown: unknown): Record<string, unknown> => ({ content: normalizeSlot(markdown) });

/**
 * Whether going back to the string form would lose nothing.
 *
 * Only a bare `content` qualifies — a frame or a multi-slot main has nowhere to go in a
 * string, so the editor does not offer the conversion rather than performing it quietly.
 */
export const isLosslessToString = (layout: Record<string, unknown>): boolean => Object.keys(layout).length === 1 && "content" in layout;
