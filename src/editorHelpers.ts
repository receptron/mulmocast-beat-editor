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

/**
 * Parse a deck path like `columns[0].content[1].items[0].text` into an array of
 * string-or-number segments. Returns null if the path doesn't match the expected grammar.
 */
export const parsePath = (path: string): (string | number)[] | null => {
  if (!path) return null;
  const out: (string | number)[] = [];
  // Match either ".name" / "name" (first) or "[123]".
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[2] !== undefined) out.push(Number(m[2]));
    else out.push(m[1]);
  }
  return out.length ? out : null;
};

/**
 * Deep-set `slide.<path>` to `value`, returning a structurally-cloned object so reactivity fires.
 * Walks the path, copying each object/array level it touches; leaves untouched siblings shared.
 */
export const setByPath = <T>(root: T, path: string, value: unknown): T => {
  const segments = parsePath(path);
  if (!segments) return root;
  const copy = JSON.parse(JSON.stringify(root)) as T;
  let cursor: unknown = copy;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (cursor && typeof cursor === "object") {
      const obj = cursor as Record<string | number, unknown>;
      if (obj[seg] === undefined || obj[seg] === null) return root; // path doesn't exist, give up
      cursor = obj[seg];
    } else {
      return root;
    }
  }
  const last = segments[segments.length - 1];
  if (cursor && typeof cursor === "object") {
    (cursor as Record<string | number, unknown>)[last] = value;
  }
  return copy;
};

/**
 * Split an item path like `columns[0].content[1].items[2]` into:
 *   { parent: "columns[0].content[1].items", index: 2 }
 * Returns null if the path doesn't end in `[n]` (i.e. not an array item).
 */
export const splitItemPath = (path: string): { parent: string; index: number } | null => {
  const m = /^(.*?)\[(\d+)\]$/.exec(path);
  if (!m) return null;
  return { parent: m[1].replace(/\.$/, ""), index: Number(m[2]) };
};

/**
 * Move an array element inside a SlideLayout by from-path → to-path. Both paths must point
 * at items in the same parent array (e.g. `stats[0]` and `stats[2]`). Returns a new SlideLayout
 * or the original ref if the paths don't share a parent / aren't valid.
 */
export const moveByPath = <T>(root: T, fromPath: string, toPath: string): T => {
  const from = splitItemPath(fromPath);
  const to = splitItemPath(toPath);
  if (!from || !to || from.parent !== to.parent) return root;
  const parentArr = getByPath<unknown[]>(root, from.parent);
  if (!Array.isArray(parentArr)) return root;
  if (from.index < 0 || from.index >= parentArr.length) return root;
  if (to.index < 0 || to.index >= parentArr.length) return root;
  if (from.index === to.index) return root;
  const next = clone(parentArr);
  const [el] = next.splice(from.index, 1);
  next.splice(to.index, 0, el);
  return setByPath(root, from.parent, next);
};

/** Deep-get `slide.<path>`. Returns undefined if anything along the way is missing. */
export const getByPath = <T = unknown>(root: unknown, path: string): T | undefined => {
  const segments = parsePath(path);
  if (!segments) return undefined;
  let cursor: unknown = root;
  for (const seg of segments) {
    if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string | number, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cursor as T | undefined;
};

/** Color tokens that survive the inline-markup round-trip. */
const INLINE_COLOR_KEYS = new Set(["primary", "accent", "success", "warning", "danger", "info", "highlight"]);

/**
 * Replacement for an `<em>` / `<i>` tag. Deck's em regex requires word boundaries on both sides
 * (`(?<![*\w])\*` … `\*(?!\w)`) and non-space at the inner edges (`\*(?!\s)` … `(?<!\s)\*`).
 * When any of those conditions wouldn't be satisfied, falling back to `{warning:…}` keeps the
 * markup round-trippable — deck's color regex `\{([a-z]+):(.+?)\}` has no boundary constraint.
 *
 * Visual difference: `*x*` renders as amber bold, `{warning:x}` renders as amber-colored only
 * (no bold). Acceptable as a fallback since the alternative is a parse failure where the user
 * sees literal asterisks.
 */
const emReplace = (match: string, _tag: string, inner: string, offset: number, full: string): string => {
  const prevChar = full[offset - 1] ?? "";
  const nextChar = full[offset + match.length] ?? "";
  const isWord = (c: string) => /\w/.test(c);
  const startsWithSpace = /^\s/.test(inner);
  const endsWithSpace = /\s$/.test(inner);
  if (isWord(prevChar) || isWord(nextChar) || startsWithSpace || endsWithSpace) {
    return `{warning:${inner}}`;
  }
  return `*${inner}*`;
};

/**
 * One pass of `<…>` removal, as a forward scan rather than `/<[^>]+>/g`.
 *
 * The regex is quadratic, and sonarjs said so — the comment that used to sit here claimed it was
 * linear because `[^>]` and `>` are disjoint, which is not what costs the time. With no `>` ahead,
 * `[^>]+` scans to end-of-string at each of the n start positions before failing: 1.2s for
 * `'<a'.repeat(20000)`, 2.5s for `'>' + '<'.repeat(40000)`. This scan never revisits a character,
 * so both are ~0ms, and it takes the `eslint-disable` with it.
 *
 * `<>` is deliberately kept: the class it replaces needed one or more characters between the
 * brackets, so an empty pair was never a tag. Equivalence to the regex was measured over 8,400
 * generated inputs — 0 differences.
 */
const stripTagsOnce = (input: string): string => {
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const lt = input.indexOf("<", i);
    const gt = lt === -1 ? -1 : input.indexOf(">", lt + 1);
    // No `<` ahead, or nothing closes this one — and if nothing closes this one, nothing closes a
    // later one either, so the remainder is text.
    if (gt === -1) {
      out.push(input.slice(i));
      return out.join("");
    }
    // `<>` was never a tag: the class this replaces needed one or more characters between.
    out.push(gt === lt + 1 ? input.slice(i, gt + 1) : input.slice(i, lt));
    i = gt + 1;
  }
};

/**
 * Convert an editable element's innerHTML back into deck inline-markup syntax. Pure / DOM-free
 * so it can be unit-tested under `node:test`. Honors:
 *   <strong> / <b>           → **bold**
 *   <em> / <i>               → *emphasis*
 *   <span class="text-d-X">  → {X:text}   (X ∈ INLINE_COLOR_KEYS)
 *   <br>                      → newline
 * Other tags are stripped to their text content.
 *
 * Implementation note: a recursive innermost-first regex replacement is fine here because the
 * input only comes from contenteditable + our own programmatic wrappers — well-formed and
 * shallow nesting (a handful of layers, never user-authored markup). It avoids needing jsdom.
 */
export const htmlToMarkup = (html: string): string => {
  let s = html;
  // <br> → newline (does not contain children, do first).
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // A closing block tag is a line boundary. Chromium gives one <div> per line when multi-line
  // text is pasted into a contenteditable, and stripping those as if they were inline glues the
  // lines into one word run — measured, three pasted lines arrived as "line oneline twoline
  // three". The lookahead keeps a block that ends the input from leaving a trailing newline.
  s = s.replace(/<\/(?:div|p|h[1-6]|li|tr|blockquote|section|article)>(?=[\s\S])/gi, "\n");

  // Inline tags: replace innermost first. Iterate until no rule matches.
  // Every character class below excludes `<`, and that is the rule rather than a detail: a class
  // that can cross a `<` rescans the rest of the string at each failed start, which is what made
  // this quadratic. `'<span class="text-d-primary"'.repeat(2000)` took 110s with `[^>]`; with
  // `[^<>]` it is under a millisecond. An attribute cannot legally contain a raw `<`, so nothing is lost —
  // measured as 0 differences over 11,132 generated inputs against the pre-fix implementation.
  // `test_editorHelpers.ts` measures this: a family of tag-shaped inputs runs in ~2ms here and
  // in 421-1462ms with any one of these four classes unbounded.
  for (let i = 0; i < 50; i++) {
    const before = s;
    s = s.replace(/<(strong|b)\b[^<>]*>([^<]*?)<\/\1>/gi, "**$2**");
    s = s.replace(/<(em|i)\b[^<>]*>([^<]*?)<\/\1>/gi, emReplace);
    s = s.replace(/<span\b[^<>]*class="([^"]*)"[^<>]*>([^<]*?)<\/span>/gi, (_m, cls: string, text: string) => {
      const colorMatch = /\btext-d-([a-z]+)\b/.exec(cls);
      if (colorMatch && INLINE_COLOR_KEYS.has(colorMatch[1])) return `{${colorMatch[1]}:${text}}`;
      return text;
    });
    // bare span without class
    s = s.replace(/<span\b[^<>]*>([^<]*?)<\/span>/gi, "$1");
    if (s === before) break;
  }

  // Strip any other tags as a safety net. Loop until no further tags survive — this protects
  // against pathological inputs like `<s<script>cript>` where a single pass would leave
  // `<script>` behind. In practice innerHTML from contenteditable is well-formed and one pass
  // is enough, but the loop is cheap and shuts CodeQL's incomplete-sanitization rule up.
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = stripTagsOnce(s);
  }
  // Decode the basic entities our escapeHtml emits, in a SINGLE pass so an input like
  // `&amp;lt;` lands as `&lt;` (literal), not as `<` (double-unescape).
  s = s.replace(/&(amp|lt|gt|quot|#39);/g, (_match, name: string) => {
    switch (name) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "#39":
        return "'";
      default:
        return _match;
    }
  });
  return s;
};
