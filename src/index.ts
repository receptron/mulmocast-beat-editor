// Public API for @mulmocast/deck-web
// Composable Vue 3 components for editing @mulmocast/deck SlideLayout decks live in the browser.

// ─── slide deck editor (deprecated — see the beat components below) ───
// These render each slide into an iframe, which loads chart.js, mermaid and Tailwind from a CDN
// once per slide. The beat components below render into a div, share one copy of each runtime,
// and cover every beat type rather than only `image.type === "slide"`.

export { /** @deprecated Use `BeatListEditor`, which edits the beat array itself and covers every beat type. */ default as DeckEditor } from "./DeckEditor.vue";
export {
  /** @deprecated Use `BeatListEditor` — it consumes a beat array directly, so it can insert mid-deck. */ default as MulmoScriptDeckEditor,
} from "./MulmoScriptDeckEditor.vue";
export { /** @deprecated Use `BeatListEditor`, whose left pane lists beats of every type. */ default as DeckList } from "./components/DeckList.vue";
export {
  /** @deprecated Use `BeatView`, which renders a beat into a div with no per-slide CDN load. */ default as SlidePreview,
} from "./components/SlidePreview.vue";

// Not deprecated: the Inspector is the structural editor for a deck layout, and the beat editor
// registry's `slide` editor is built on it.
export { default as Inspector } from "./components/Inspector.vue";

// ─── beat rendering and editing ───
// A beat renders as a div rather than an iframe, so a list of them is reactive and shares one
// copy of each runtime. Every editor is swappable: see BeatEditorDefinition.
export { default as BeatView } from "./components/BeatView.vue";
export { default as BeatEditorPane } from "./components/BeatEditorPane.vue";
export { default as BeatListEditor } from "./BeatListEditor.vue";

export { defaultBeatEditors, editorsFor } from "./editors/registry";
export type { BeatEditorDefinition, BeatEditorProps, BeatEditorEmits } from "./editors/types";
export { readChartForm, writeChartForm, parseNumbers, CHART_TYPES } from "./editors/chartData";
export type { ChartForm, ChartSeries } from "./editors/chartData";
export { sanitizeFragment } from "./sanitize";
export { BEAT_TYPES, makeBeat, beatType, beatImage } from "./beatHelpers";
export type { EditableBeat, BeatType } from "./beatHelpers";

export { defaultTheme, sampleDeck } from "./data/sampleDeck";

// Re-export deck types for convenience so consumers don't have to add @mulmocast/deck just for types.
export type { SlideLayout, SlideTheme } from "@mulmocast/deck";
