// Public API for @mulmocast/beat-editor
// Composable Vue 3 components for editing @mulmocast/deck SlideLayout decks live in the browser.

// The structural editor for one @mulmocast/deck layout — the `slide` beat's editor is built on it.
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
export { beatsOf, withBeats } from "./scriptHelpers";
// For a host that places the sheet itself — e.g. one that mounts plugins in a shadow root and
// injects their CSS as a string rather than letting a component append to a root.
export { beatDocumentCss, ensureDocumentStyles } from "./documentStyles";
export type { EditableBeat, BeatType } from "./beatHelpers";

export { defaultTheme, sampleDeck } from "./data/sampleDeck";

// Re-export deck types for convenience so consumers don't have to add @mulmocast/deck just for types.
export type { SlideLayout, SlideTheme } from "@mulmocast/deck";
