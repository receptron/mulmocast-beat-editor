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
  const image = beat.image;
  if (!image || typeof image !== "object") return "(no image)";
  const type = (image as Record<string, unknown>).type;
  return typeof type === "string" ? type : "(no type)";
};

/** Read `beat.image` as a record. Returns an empty one rather than throwing on a malformed beat. */
export const beatImage = (beat: EditableBeat): Record<string, unknown> =>
  beat.image && typeof beat.image === "object" ? (beat.image as Record<string, unknown>) : {};

/** A beat with one `image` field replaced. Returns a new object; nothing is mutated. */
export const withImageField = (beat: EditableBeat, field: string, value: unknown): EditableBeat => ({
  ...beat,
  image: { ...beatImage(beat), [field]: value },
});

/** A beat with one field replaced on `image.<parent>`, for the nested `slide` / `source` / `code` shapes. */
export const withNestedField = (beat: EditableBeat, parent: string, field: string, value: unknown): EditableBeat => {
  const image = beatImage(beat);
  const current = image[parent];
  const parentObject = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  return { ...beat, image: { ...image, [parent]: { ...parentObject, [field]: value } } };
};

/** Read a string field off `image`, or off `image.<parent>` when a parent is given. */
export const readString = (beat: EditableBeat, field: string, parent?: string): string => {
  const image = beatImage(beat);
  const holder = parent ? image[parent] : image;
  if (!holder || typeof holder !== "object") return "";
  const value = (holder as Record<string, unknown>)[field];
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
