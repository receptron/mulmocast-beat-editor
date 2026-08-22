/**
 * One beat of every type `mulmocast/browser`'s `beatToHtml` can render, so the demo shows
 * what a host actually has to handle — not just the `slide` beats the other samples carry.
 *
 * Media is remote on purpose: a `path` source is resolved against the host page and a
 * `base64` one renders nothing, so neither would show anything in a demo served from Vite.
 */
export type BeatSample = {
  /** Rendered above the fragment, so a reader can tell which type produced what. */
  label: string;
  /** What this beat is meant to demonstrate about the browser contract. */
  note: string;
  beat: Record<string, unknown>;
};

// Both verified to return 200. The first URLs written here 404'd, and the demo showed alt
// text and a black video rather than failing — which is how a broken sample survives review.
const IMAGE_URL = "https://github.com/receptron/mulmocast-cli/raw/refs/heads/main/assets/images/mulmocast_credit.png";
const MOVIE_URL = "https://github.com/receptron/mulmocast-media/raw/refs/heads/main/movies/actions.mp4";

export const ALL_BEAT_TYPES: BeatSample[] = [
  {
    label: "textSlide",
    note: "Markdown built from title / subtitle / bullets. No runtime, no utility classes.",
    beat: {
      text: "A text slide is title, subtitle and bullets.",
      image: {
        type: "textSlide",
        slide: { title: "Text Slide", subtitle: "title / subtitle / bullets", bullets: ["Rendered through marked", "No runtime needed"] },
      },
    },
  },
  {
    label: "markdown (string)",
    note: "Plain markdown. Produces no utility classes — the host's own typography applies.",
    beat: {
      text: "Plain markdown.",
      image: { type: "markdown", markdown: "## Markdown\n\nA plain string of markdown, rendered by `marked`.\n\n- lists work\n- so does **emphasis**" },
    },
  },
  {
    label: "markdown (layout)",
    note: "The object form lays out named slots, and does use utility classes.",
    beat: {
      text: "Markdown in the layout form.",
      image: { type: "markdown", markdown: { header: "## Header slot", "sidebar-left": "- side\n- bar", content: "The layout form fills named slots." } },
    },
  },
  {
    label: "markdown (mermaid fence)",
    note: 'A ```mermaid fence becomes a diagram, and the fragment sets requires: ["mermaid"].',
    beat: {
      text: "A mermaid fence inside markdown.",
      image: { type: "markdown", markdown: "### Fenced diagram\n\n```mermaid\ngraph LR\n  Beat --> Fragment --> Host\n```" },
    },
  },
  {
    label: "chart",
    note: 'requires: ["chart"]. The config rides on the canvas as data-mulmo-chart; the host draws it.',
    beat: {
      text: "A Chart.js chart.",
      image: {
        type: "chart",
        title: "Beats rendered per type",
        chartData: { type: "bar", data: { labels: ["text", "media", "diagram"], datasets: [{ label: "count", data: [3, 2, 3] }] } },
      },
    },
  },
  {
    label: "chart (sankey plugin)",
    note: "A chart type whose plugin the host must load too — it arrives in chartPlugins.",
    beat: {
      text: "A chart needing a Chart.js plugin.",
      image: {
        type: "chart",
        title: "Sankey needs a plugin",
        chartData: {
          type: "sankey",
          data: {
            datasets: [
              {
                data: [
                  { from: "script", to: "beat", flow: 8 },
                  { from: "beat", to: "fragment", flow: 8 },
                ],
              },
            ],
          },
        },
      },
    },
  },
  {
    label: "mermaid",
    note: 'requires: ["mermaid"]. Only code.kind === "text" renders in a browser.',
    beat: {
      text: "A mermaid diagram.",
      image: {
        type: "mermaid",
        title: "Beat to fragment",
        code: { kind: "text", text: "graph TD\n  A[MulmoScript] --> B[beatToHtml]\n  B --> C[fragment]\n  C --> D[host]" },
      },
    },
  },
  {
    label: "image",
    note: "alt comes from the beat's description, then its text — MulmoImageMedia has no alt of its own.",
    beat: {
      description: "The MulmoCast credit image",
      text: "A remote image.",
      image: { type: "image", source: { kind: "url", url: IMAGE_URL } },
    },
  },
  {
    label: "movie",
    note: "A <video> with controls. No runtime needed.",
    beat: {
      text: "A remote movie.",
      image: { type: "movie", source: { kind: "url", url: MOVIE_URL } },
    },
  },
  {
    label: "slide",
    note: "The deck renderer, as a fragment. Carries scoped css the host must attach.",
    beat: {
      text: "A deck slide.",
      image: {
        type: "slide",
        slide: {
          layout: "stats",
          title: "Slide beats use the deck renderer",
          stats: [
            { value: "8", label: "beat types" },
            { value: "1", label: "dispatcher" },
            { value: "0", label: "iframes" },
          ],
        },
      },
    },
  },
  {
    label: "html_tailwind",
    note: "Raw author markup. Nothing is sanitized here — the host must, before inserting.",
    beat: {
      text: "Author-written markup.",
      image: {
        type: "html_tailwind",
        html: '<div class="rounded-lg border border-stone-300 bg-white p-4"><p class="text-sm font-semibold text-stone-700">Author markup</p><p class="mt-1 text-xs text-stone-500">This beat type is raw HTML by design.</p></div>',
      },
    },
  },
];
