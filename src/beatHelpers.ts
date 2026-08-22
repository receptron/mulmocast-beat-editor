import { supportedBeatTypes } from "mulmocast/browser";

/**
 * Editing works on the beat array directly, so a beat is `Record<string, unknown>` here
 * rather than the cli's `MulmoBeat`: an in-progress edit is routinely invalid (a half-typed
 * url, chartData mid-keystroke), and a type that forbids that would have to be fought at
 * every keystroke. `beatToHtml` returns undefined for anything it cannot render, which is
 * the same answer it gives for a beat type it does not support, so the preview degrades
 * rather than breaking.
 */
export type EditableBeat = Record<string, unknown>;

export type BeatType = (typeof supportedBeatTypes)[number];

/** A plain object — not an array, not null. Every nested read below goes through it. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The beat types this editor can create. Mirrors what beatToHtml renders. */
export const BEAT_TYPES: readonly BeatType[] = supportedBeatTypes;

const NEW_BEAT: Record<BeatType, () => Record<string, unknown>> = {
  textSlide: () => ({ type: "textSlide", slide: { title: "Title", bullets: ["First point"] } }),
  markdown: () => ({ type: "markdown", markdown: "## Heading\n\nBody text." }),
  chart: () => ({
    type: "chart",
    title: "Chart",
    chartData: { type: "bar", data: { labels: ["A", "B"], datasets: [{ label: "series", data: [1, 2] }] } },
  }),
  mermaid: () => ({ type: "mermaid", title: "Diagram", code: { kind: "text", text: "graph TD\n  A --> B" } }),
  image: () => ({ type: "image", source: { kind: "url", url: "" } }),
  movie: () => ({ type: "movie", source: { kind: "url", url: "" } }),
  slide: () => ({ type: "slide", slide: { layout: "title", title: "Title", subtitle: "Subtitle" } }),
  html_tailwind: () => ({ type: "html_tailwind", html: '<div class="p-4">Author markup</div>' }),
};

export const makeBeat = (type: BeatType): EditableBeat => ({ text: "", image: NEW_BEAT[type]() });

export const beatType = (beat: EditableBeat): string => {
  if (!isRecord(beat.image)) return "(no image)";
  const type = beat.image.type;
  return typeof type === "string" ? type : "(no type)";
};

/** Read `beat.image` as a record. Returns an empty one rather than throwing on a malformed beat. */
export const beatImage = (beat: EditableBeat): Record<string, unknown> => (isRecord(beat.image) ? beat.image : {});

/** A beat with one `image` field replaced. Returns a new object; nothing is mutated. */
export const withImageField = (beat: EditableBeat, field: string, value: unknown): EditableBeat => ({
  ...beat,
  image: { ...beatImage(beat), [field]: value },
});

/** A beat with one field replaced on `image.<parent>`, for the nested `slide` / `source` / `code` shapes. */
export const withNestedField = (beat: EditableBeat, parent: string, field: string, value: unknown): EditableBeat => {
  const image = beatImage(beat);
  const current = image[parent];
  const parentObject = isRecord(current) ? current : {};
  return { ...beat, image: { ...image, [parent]: { ...parentObject, [field]: value } } };
};

/** Read a string field off `image`, or off `image.<parent>` when a parent is given. */
export const readString = (beat: EditableBeat, field: string, parent?: string): string => {
  const image = beatImage(beat);
  const holder = parent ? image[parent] : image;
  if (!isRecord(holder)) return "";
  const value = holder[field];
  return typeof value === "string" ? value : "";
};

/** Move `from` to `to`, returning a new array. Out-of-range moves return the input unchanged. */
export const moveItem = <T>(items: readonly T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items.slice();
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/**
 * Where the selection lands after the beat at `removed` is deleted. `remaining` is the length
 * after the removal. The selection follows the beat it was on, so deleting a row above the
 * selected one does not silently move the user onto the next beat.
 */
export const selectionAfterRemove = (selected: number, removed: number, remaining: number): number =>
  Math.max(0, Math.min(removed < selected ? selected - 1 : selected, remaining - 1));

/** Where the selection lands after `moveItem(items, from, to)` — same rule, same reason. */
export const selectionAfterMove = (selected: number, from: number, to: number, length: number): number => {
  if (from === to || from < 0 || to < 0 || from >= length || to >= length) return selected;
  if (selected === from) return to;
  if (from < selected && selected <= to) return selected - 1;
  if (to <= selected && selected < from) return selected + 1;
  return selected;
};

/**
 * Whether a chart JSON draft still belongs to the beat under it.
 *
 * The draft owns the beat exactly while the beat's `chartData` is what the draft parses to:
 * that is the state this textarea puts them in, and nothing else does. A half-typed draft
 * parses to nothing and emits nothing, so if the beat changed underneath it, the beat was
 * replaced. `?? null` rather than `?? {}` so an absent chartData and an empty one differ —
 * collapsing them lets a draft survive onto a beat that never had a chart.
 */
export const draftOwnsBeat = (draft: string, chartData: unknown): boolean => {
  try {
    return JSON.stringify(JSON.parse(draft)) === JSON.stringify(chartData ?? null);
  } catch {
    return false;
  }
};
