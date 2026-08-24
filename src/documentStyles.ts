import { slideUtilityCss } from "@mulmocast/deck";

/**
 * Styles a beat needs that belong to the document, not to a component.
 *
 * `slideUtilityCss` maps deck's semantic classes (`bg-d-accent`, `font-title`, …) onto the CSS
 * variables a slide fragment carries. It is the same 4KB for every beat, so it is appended
 * once per page rather than once per component — the same reason the chart.js and mermaid
 * tags are shared.
 *
 * The `.beat-fragment` block restores what Tailwind's preflight removes from `h1`-`h3`, lists
 * and `code`. A fragment built from markdown assumes a browser's defaults, and a host running
 * preflight has taken them away. Hosts that do not run preflight get the same result, which is
 * the point: the beat looks the same either way.
 */
const STYLE_ID = "mulmocast-beat-editor-document-styles";

const BEAT_TYPOGRAPHY = `
.beat-fragment h1 { font-size: 1.6rem; font-weight: 700; margin: 0.4rem 0; }
.beat-fragment h2 { font-size: 1.3rem; font-weight: 700; margin: 0.4rem 0; }
.beat-fragment h3 { font-size: 1.1rem; font-weight: 600; margin: 0.3rem 0; }
.beat-fragment p { margin: 0.4rem 0; }
.beat-fragment ul { list-style: disc; padding-left: 1.4rem; margin: 0.4rem 0; }
.beat-fragment ol { list-style: decimal; padding-left: 1.4rem; margin: 0.4rem 0; }
.beat-fragment li { margin: 0.1rem 0; }
.beat-fragment code { background: #f5f5f4; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
`;

/**
 * Affordances for editing a slide beat in place. These have to live here rather than in
 * `BeatView.vue`: the elements they target come from `v-html`, so a scoped component style
 * would not reach them, and the repo's rule is that anything which cannot be a Tailwind utility
 * goes in one global sheet with a reason.
 */
const INLINE_EDIT = `
.beat-fragment--editable [data-mulmo-path]:hover { outline: 2px solid rgba(56,189,248,.55); outline-offset: 2px; cursor: text; }
.beat-fragment [data-mulmo-path][contenteditable="true"] { outline: 2px solid rgba(56,189,248,.9); outline-offset: 2px; box-shadow: 0 0 0 4px rgba(56,189,248,.15); }
.beat-fragment--editable [data-mulmo-path]:focus-visible { outline: 2px solid rgba(56,189,248,.9); outline-offset: 2px; }
.beat-fragment--editable [data-mulmo-item-path][draggable="true"] { cursor: grab; }
.beat-fragment--editable [data-mulmo-item-path][draggable="true"]:active { cursor: grabbing; }
.beat-fragment--editable [data-mulmo-item-path][draggable="true"] [data-mulmo-path] { cursor: text; }
`;

/** The whole sheet, for a host that would rather place it itself. */
export const beatDocumentCss = (): string => slideUtilityCss + BEAT_TYPOGRAPHY + INLINE_EDIT;

/**
 * Append these styles once to `root`, which defaults to the page.
 *
 * `root` is a `ShadowRoot` when the beat is rendered inside one, and a stylesheet on
 * `document.head` does NOT cross that boundary — measured in a host that mounts its plugins
 * that way: the slide itself was fine (its theme variables are inline on the element) but the
 * editing affordances were not, so a draggable item showed no grab cursor and an editable one
 * no hover outline. Callers pass `element.getRootNode()`, which answers the document when
 * there is no shadow root, so the same call is correct either way.
 *
 * Once PER ROOT rather than once per page: a page with several shadow roots needs a copy in
 * each, and the id check is scoped to the root being written to.
 */
export type StyleRoot = Document | ShadowRoot;

const isStyleRoot = (node: unknown): node is StyleRoot =>
  typeof node === "object" && node !== null && typeof (node as { getElementById?: unknown }).getElementById === "function";

export const ensureDocumentStyles = (root?: Node | null): void => {
  if (typeof document === "undefined") return;
  const target = isStyleRoot(root) ? root : document;
  if (target.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = beatDocumentCss();
  // A ShadowRoot has no `head`; its own children are the equivalent place.
  ("head" in target ? target.head : target).appendChild(style);
};
