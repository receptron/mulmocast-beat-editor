# @mulmocast/deck-web

[![npm version](https://img.shields.io/npm/v/@mulmocast/deck-web.svg)](https://www.npmjs.com/package/@mulmocast/deck-web)
[![npm downloads](https://img.shields.io/npm/dm/@mulmocast/deck-web.svg)](https://www.npmjs.com/package/@mulmocast/deck-web)
[![License: MIT](https://img.shields.io/npm/l/@mulmocast/deck-web.svg)](LICENSE)
[![CI](https://github.com/receptron/mulmocast-deck-web/actions/workflows/pull_request.yaml/badge.svg)](https://github.com/receptron/mulmocast-deck-web/actions/workflows/pull_request.yaml)
[![GitHub stars](https://img.shields.io/github/stars/receptron/mulmocast-deck-web.svg?style=social)](https://github.com/receptron/mulmocast-deck-web/stargazers)

Vue 3 components for editing [`@mulmocast/deck`](https://www.npmjs.com/package/@mulmocast/deck) slide decks live in the browser.

Two editors, both controlled components with no backend, no persistence and no AI — just data ↔ preview:

- **Slide deck editor** — a 3-pane editor over a `SlideLayout[]` (or a full MulmoScript). Each slide renders live via `generateSlideHTML()` into a sandboxed iframe, and you edit through **WYSIWYG click-to-edit + a floating toolbar + drag-and-drop reorder**, plus a schema-aware Inspector for structural edits.
- **Beat editor** — a list editor over a MulmoScript's `beats`, where every beat type renders as a div (not an iframe) and the pane on the right is **whichever editor is registered for that beat's `image.type`**. The registry is the extension point: replace an editor, or add a second one for a type.

## Highlights

- **WYSIWYG click-to-edit** — click any text in the preview to edit in place. Blur or Enter commits, Escape cancels.
- **Floating toolbar** — select text → toolbar appears with **B** (bold) / **★ amber highlight** / **7 color swatches** / **× clear**. Toggle off by clicking the same button again.
- **Drag-and-drop reorder** — drag bullets, stats cards, timeline steps, manifesto lines, columns, grid items in the preview to reorder. Drag slides in the left list to reorder the deck.
- **Inspector for structure** — add / remove / swap layout type / nest content blocks / edit non-text fields. A `slide` beat gets the same Inspector in the beat editor.
- **Swappable beat editors** — one registry keyed by `image.type`, several editors allowed per type, and your own can replace or join the shipped ones.

## Install

```bash
yarn add @mulmocast/deck-web @mulmocast/deck vue
```

`vue ^3.5` and `@mulmocast/deck ^1.0.0` are peer dependencies. The WYSIWYG editing and drag-and-drop rely on the `data-mulmo-path` / `data-mulmo-item-path` attributes, which have shipped since 0.7.0, but 1.x is the only line this package is developed and tested against.

## Usage

### Edit a `SlideLayout[]` directly

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DeckEditor, sampleDeck, defaultTheme } from "@mulmocast/deck-web";

const slides = ref(sampleDeck);
</script>

<template>
  <DeckEditor v-model:slides="slides" :theme="defaultTheme" />
</template>
```

### Edit a MulmoScript directly

`MulmoScriptDeckEditor` is a companion component that takes a `MulmoScript`, extracts the slide beats (`image.type === "slide"`), and writes edits back into the script. Non-slide beats (movie / textSlide / voice_over / etc.) stay untouched.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { MulmoScriptDeckEditor } from "@mulmocast/deck-web";

const script = ref({ /* your MulmoScript */ });
</script>

<template>
  <MulmoScriptDeckEditor v-model:script="script" />
</template>
```

Theme priority: prop `theme` > `script.presentationStyle.slideParams.theme` > `script.slideParams.theme` > built-in `defaultTheme`.

### Edit a MulmoScript's beats

`BeatListEditor` edits the beat array itself, so add / remove / reorder are array operations — the deck editor extracts slide beats and zips them back, which is why it cannot insert mid-deck. Every beat type `beatToHtml` renders previews in the list; the pane on the right edits the selected one.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BeatListEditor, makeBeat, type EditableBeat } from "@mulmocast/deck-web";

const beats = ref<EditableBeat[]>([makeBeat("textSlide"), makeBeat("chart")]);
</script>

<template>
  <BeatListEditor v-model:beats="beats" />
</template>
```

A beat is edited as `Record<string, unknown>`, not as the cli's `MulmoBeat`: a half-typed url or a `chartData` mid-keystroke is routinely invalid, and `beatToHtml` returns `undefined` for anything it cannot render, so the preview degrades instead of breaking.

### Register your own beat editor

Which editor opens for a beat is decided by one list. Pass your own and you can replace what ships, or add a second way into a type that already has one — which is how `chart` gets both a form and a raw-JSON view.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BeatListEditor, defaultBeatEditors, makeBeat, type BeatEditorDefinition, type EditableBeat } from "@mulmocast/deck-web";
import MyChartEditor from "./MyChartEditor.vue";

const beats = ref<EditableBeat[]>([makeBeat("chart")]);

const editors: BeatEditorDefinition[] = [
  // Replace what ships for one type...
  ...defaultBeatEditors.filter((editor) => editor.beatType !== "chart"),
  // ...or drop the filter to leave the built-ins in place and add yours as a second tab.
  { id: "chart.mine", label: "Mine", beatType: "chart", component: MyChartEditor },
];
</script>

<template>
  <BeatListEditor v-model:beats="beats" :editors="editors" />
</template>
```

The component's contract is the whole extension point:

```ts
props: { beat: EditableBeat }
emits: update(beat: EditableBeat)
```

It edits `beat.image` and nothing else — the fields every beat has (the spoken `text`) are drawn by the pane, so an editor stays about the one shape it knows. `editorsFor(beatType, editors)` returns every editor registered for a type in registration order, and the first one is what opens by default. A type with no editor registered is not an error: the pane says so and the beat still previews.

The demo registers one (`textSlide.outline`) on top of the defaults, so the tab switcher is visible in `yarn dev` under **Beat editor**.

#### What ships

| `image.type` | Editors | Notes |
|---|---|---|
| `textSlide` | `Form` | title / subtitle / bullets |
| `markdown` | `Markdown` | the string form; the named-slot layout form is read-only |
| `chart` | `Form`, `JSON` | the form covers the shape a Chart.js config almost always has; JSON is there for the rest |
| `mermaid` | `Diagram` | title + diagram source |
| `image` / `movie` | `Form` | media source (`url` / `path` / `base64`) |
| `slide` | `Form` | the full Inspector — every layout and content block |
| `html_tailwind` | `HTML` | author markup, emitted as written |

### Use `<SlidePreview>` standalone

If you already have your own deck-list / inspector and only want WYSIWYG editing in an iframe:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { SlidePreview, defaultTheme, type SlideLayout } from "@mulmocast/deck-web";

const slide = ref<SlideLayout>({ layout: "title", title: "Hello", subtitle: "Click any text to edit" });
</script>

<template>
  <SlidePreview :slide="slide" :theme="defaultTheme" @update="(s) => (slide = s)" />
</template>
```

`<SlidePreview>` is self-contained: click-to-edit, the floating toolbar, and D&D reorder of in-slide items all work out of the box.

## Components

| Component | Purpose |
|---|---|
| `<DeckEditor>` | All-in-one 3-pane editor. `v-model:slides` (`SlideLayout[]`), optional `theme`, optional `v-model:selectedIndex`. |
| `<MulmoScriptDeckEditor>` | Same UX but consumes/emits a MulmoScript. |
| `<DeckList>` / `<SlidePreview>` / `<Inspector>` | The individual panes — drop into your own layout. |
| `<BeatListEditor>` | List editor over a MulmoScript's beats. `v-model:beats`, optional `editors`. |
| `<BeatView>` / `<BeatEditorPane>` | One beat's preview and one beat's editing pane — drop into your own layout. |
| `defaultBeatEditors` / `editorsFor` | The shipped editor registry, and the lookup a host uses. |
| `defaultTheme` / `sampleDeck` | Data helpers for quick starts. |
| `makeBeat` / `BEAT_TYPES` / `beatType` / `beatImage` | Beat helpers, for building the array a host edits. |

The Inspector covers every layout (`title` / `bigQuote` / `columns` / `comparison` / `grid` / `stats` / `timeline` / `split` / `matrix` / `table` / `funnel` / `waterfall` / `manifesto`) and every content block type (`text` / `bullets` / `callout` / `tag` / `code` / `metric` / `divider` / `image` / `imageRef` / `chart` / `mermaid` / `section` / `table`), with full CRUD + reorder on every array.

## How preview works

Each slide is rendered through `generateSlideHTML(theme, slide)` from `@mulmocast/deck` and dropped into an `<iframe srcdoc>` sandbox. Tailwind is loaded inside the iframe via CDN, so the host page's CSS can't bleed in (or out).

### How WYSIWYG / D&D wires through the iframe

`@mulmocast/deck@0.6+` emits two data attributes that consumers can rely on:

| Attribute | On | Used for |
|--|--|--|
| `data-mulmo-path` | Every editable leaf text element | click-to-edit (set `contenteditable=true`, commit on blur via `setByPath`). Tip of the WYSIWYG path. |
| `data-mulmo-item-path` | List-item container (`<li>`, stat card, timeline step, manifesto line, columns / grid card) | HTML5 drag handle (`draggable=true`). Drop on a sibling → `moveByPath`. |

The pure helpers (`parsePath`, `getByPath`, `setByPath`, `moveByPath`, `htmlToMarkup`) are exposed from `editorHelpers.ts` and unit-tested under `node:test`.

## Architecture

```
DeckEditor.vue           (controlled — props: slides, theme; emits: update:slides)
├── DeckList.vue         -- left  (slide list / add / remove / select)
├── SlidePreview.vue     -- center (iframe srcdoc = generateSlideHTML(theme, slide))
└── Inspector.vue        -- right (form for the selected slide)

MulmoScriptDeckEditor.vue
└── DeckEditor (with a beats↔slides adapter)

BeatListEditor.vue       (controlled — props: beats, editors; emits: update:beats)
├── BeatView.vue         -- one per beat: its own fragment and its own chart / mermaid runtime,
│                           so editing one beat leaves the others alone
└── BeatEditorPane.vue   -- right (the fields every beat has, plus the registered editor)
    └── editors/registry.ts -- image.type -> component, replaceable by the host
```

State is held by the parent (Vue v-model pattern). All mutations are immutable copies, so iframe re-renders reactively.

## Scripts

```bash
yarn dev          # Vite dev server with the SPA demo
yarn build        # build the demo SPA → dist/
yarn build:lib    # build the publishable library → dist/lib/ (used by prepublishOnly)
yarn lint
yarn format
yarn typecheck    # vue-tsc over src and test
yarn test         # node:test over the pure helpers
yarn knip         # dead-code scan
```

## License

MIT

## Using the beat components

```bash
yarn add @mulmocast/deck-web @mulmocast/deck mulmocast vue
```

```ts
import { BeatListEditor, BeatView, defaultBeatEditors } from "@mulmocast/deck-web";
import "@mulmocast/deck-web/style.css";   // required — see below
```

```vue
<BeatListEditor :beats="beats" @update:beats="beats = $event" />
```

`BeatView` renders one beat read-only; `BeatListEditor` is the list plus the editing pane.

### The stylesheet is not optional

`beatToHtml` and `generateSlideFragment` emit Tailwind class names as **strings inside
compiled JavaScript**. Tailwind honours `.gitignore`, so it never scans `node_modules` and
your build never generates `text-[60px]` — a beat renders unstyled with no error to say so.
`@mulmocast/deck-web/style.css` carries those utilities, generated at publish time.

It contains **no preflight**: a component library should not reset your page. The typography a
markdown beat expects is restored inside `.beat-fragment` at runtime, so a beat looks the same
whether or not your app runs preflight.

### Swapping an editor

Every editor is a component with one contract — `props: { beat }`, `emits: update(beat)` —
registered as a `BeatEditorDefinition`:

```ts
import { defaultBeatEditors, type BeatEditorDefinition } from "@mulmocast/deck-web";
import MyChartEditor from "./MyChartEditor.vue";

const editors: BeatEditorDefinition[] = [
  ...defaultBeatEditors.filter((e) => e.id !== "chart.form"),
  { id: "chart.mine", label: "Mine", beatType: "chart", component: MyChartEditor },
];
```

```vue
<BeatListEditor :beats="beats" :editors="editors" @update:beats="beats = $event" />
```

A beat type may have several editors; the pane offers them as tabs. `chart` ships two — a form
for the shape a Chart.js config almost always has, and a raw-JSON editor for everything else.
Neither erases the other's work: the form carries `options`, plugin config and per-dataset
styling through untouched.
