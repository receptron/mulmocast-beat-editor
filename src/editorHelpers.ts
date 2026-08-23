import type { SlideLayout, ContentBlock, AccentColorKey } from "@mulmocast/deck";
import { isRecord } from "./beatHelpers";

/** Accent color tokens accepted by every layout / block in the deck schema. */
export const ACCENT_COLORS: AccentColorKey[] = ["primary", "accent", "success", "warning", "danger", "info", "highlight"];

export const TEXT_SIZES = ["lead", "big", "sub"] as const;
export const BULLET_ICONS = ["ok", "no", "warn"] as const;
export const SLIDE_DENSITIES = ["compact", "default"] as const;
export const SLIDE_TITLE_SIZES = ["small", "default", "large", "hero"] as const;
export const SLIDE_SUBTITLE_SIZES = ["default", "lead", "big"] as const;
export const VALIGNS = ["top", "center", "bottom"] as const;
export const ALIGNS = ["left", "center", "right"] as const;
export const CALLOUT_STYLES = ["quote", "info", "warning"] as const;

/** Every SlideLayout `layout` value in the order we expose in the picker. */
export const LAYOUT_TYPES: SlideLayout["layout"][] = [
  "title",
  "bigQuote",
  "columns",
  "comparison",
  "grid",
  "stats",
  "timeline",
  "split",
  "matrix",
  "table",
  "funnel",
  "waterfall",
  "manifesto",
];

/** Every content block `type` value. */
export const BLOCK_TYPES: ContentBlock["type"][] = [
  "text",
  "bullets",
  "callout",
  "tag",
  "code",
  "metric",
  "divider",
  "image",
  "imageRef",
  "chart",
  "mermaid",
  "section",
  "table",
];

/** Structured-clone replacement that works for the plain-data slide objects. */
/**
 * A value the deck can render as a slide.
 *
 * `layout` is the axis every consumer switches on — `makeSlide`, the Inspector's layout
 * picker, and the renderer itself — so it is what decides whether a value read out of a beat
 * is a slide. A beat under edit can carry anything in `image.slide`, and the answer for those
 * has to be "no" rather than a crash.
 */
export const isSlideLayout = (value: unknown): value is SlideLayout => isRecord(value) && LAYOUT_TYPES.some((layout) => layout === value.layout);

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Return a sensible default skeleton for a new content block of the given type. */
export const makeBlock = (type: ContentBlock["type"]): ContentBlock => {
  switch (type) {
    case "text":
      return { type: "text", value: "New text" };
    case "bullets":
      return { type: "bullets", items: ["New item"] };
    case "callout":
      return { type: "callout", text: "Text to call out" };
    case "tag":
      return { type: "tag", text: "TAG" };
    case "code":
      return { type: "code", code: "// code", language: "ts" };
    case "metric":
      return { type: "metric", value: "+42%", label: "label" };
    case "divider":
      return { type: "divider" };
    case "image":
      return { type: "image", src: "" };
    case "imageRef":
      return { type: "imageRef", ref: "" };
    case "chart":
      return { type: "chart", chartData: { type: "bar" } };
    case "mermaid":
      return { type: "mermaid", code: "graph TD;\n  A-->B;" };
    case "section":
      return { type: "section", label: "Section" };
    case "table":
      return { type: "table", headers: ["A", "B"], rows: [["1", "2"]] };
  }
};

/** Return a skeleton SlideLayout for a fresh slide of the given layout type. */
export const makeSlide = (layout: SlideLayout["layout"]): SlideLayout => {
  switch (layout) {
    case "title":
      return { layout: "title", title: "New title" };
    case "bigQuote":
      return { layout: "bigQuote", quote: "Quote here." };
    case "columns":
      return { layout: "columns", title: "Columns", columns: [{ title: "Column A" }, { title: "Column B" }] };
    case "comparison":
      return { layout: "comparison", title: "Compare", left: { title: "Left" }, right: { title: "Right" } };
    case "grid":
      return { layout: "grid", title: "Grid", items: [{ title: "A" }, { title: "B" }, { title: "C" }] };
    case "stats":
      return { layout: "stats", title: "Stats", stats: [{ value: "1", label: "A" }] };
    case "timeline":
      return { layout: "timeline", title: "Timeline", items: [{ date: "Q1", title: "Kickoff" }] };
    case "split":
      return { layout: "split", left: { title: "Left" }, right: { title: "Right" } };
    case "matrix":
      return {
        layout: "matrix",
        title: "Matrix",
        rows: 2,
        cols: 2,
        cells: [{ label: "TL" }, { label: "TR" }, { label: "BL" }, { label: "BR" }],
      };
    case "table":
      return { layout: "table", title: "Table", headers: ["A", "B"], rows: [["1", "2"]] };
    case "funnel":
      return { layout: "funnel", title: "Funnel", stages: [{ label: "Step 1", value: "100" }] };
    case "waterfall":
      return { layout: "waterfall", title: "Waterfall", items: [{ label: "Start", value: 100 }] };
    case "manifesto":
      return { layout: "manifesto", title: "Manifesto", items: [{ title: "Principle 1" }] };
  }
};

/** Mutate the given array in place: move element at `from` by `delta` (clamped). */
export const moveInArray = <T>(arr: T[], from: number, delta: number): T[] => {
  const to = Math.max(0, Math.min(arr.length - 1, from + delta));
  if (to === from) return arr;
  const next = arr.slice();
  const [el] = next.splice(from, 1);
  next.splice(to, 0, el);
  return next;
};
