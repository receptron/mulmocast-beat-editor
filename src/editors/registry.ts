import type { BeatEditorDefinition } from "./types";
import TextSlideEditor from "./TextSlideEditor.vue";
import MarkdownEditor from "./MarkdownEditor.vue";
import ChartFormEditor from "./ChartFormEditor.vue";
import ChartJsonEditor from "./ChartJsonEditor.vue";
import MermaidEditor from "./MermaidEditor.vue";
import MediaEditor from "./MediaEditor.vue";
import SlideEditor from "./SlideEditor.vue";
import HtmlTailwindEditor from "./HtmlTailwindEditor.vue";

/**
 * The editors this package ships. Order matters only within a beat type: the first one for a
 * type is what a host opens by default.
 */
export const defaultBeatEditors: BeatEditorDefinition[] = [
  { id: "textSlide.form", label: "Form", beatType: "textSlide", component: TextSlideEditor },
  { id: "markdown.text", label: "Markdown", beatType: "markdown", component: MarkdownEditor },
  // Two ways into the same field: the form covers the shape a Chart.js config almost always
  // has, and the JSON editor is there for the rest of it rather than growing the form.
  { id: "chart.form", label: "Form", beatType: "chart", component: ChartFormEditor },
  { id: "chart.json", label: "JSON", beatType: "chart", component: ChartJsonEditor },
  { id: "mermaid.text", label: "Diagram", beatType: "mermaid", component: MermaidEditor },
  { id: "image.form", label: "Form", beatType: "image", component: MediaEditor },
  { id: "movie.form", label: "Form", beatType: "movie", component: MediaEditor },
  { id: "slide.form", label: "Form", beatType: "slide", component: SlideEditor },
  { id: "html_tailwind.text", label: "HTML", beatType: "html_tailwind", component: HtmlTailwindEditor },
];

/** Every editor registered for a beat type, in registration order. */
export const editorsFor = (beatType: string, editors: BeatEditorDefinition[] = defaultBeatEditors): BeatEditorDefinition[] =>
  editors.filter((editor) => editor.beatType === beatType);
