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
`;

/** Append the document-level styles once. Safe to call from every beat. */
export const ensureDocumentStyles = (): void => {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = slideUtilityCss + BEAT_TYPOGRAPHY + INLINE_EDIT;
  document.head.appendChild(style);
};
