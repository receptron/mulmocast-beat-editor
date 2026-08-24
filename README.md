# @mulmocast/beat-editor

[![npm version](https://img.shields.io/npm/v/@mulmocast/beat-editor.svg)](https://www.npmjs.com/package/@mulmocast/beat-editor)
[![npm downloads](https://img.shields.io/npm/dm/@mulmocast/beat-editor.svg)](https://www.npmjs.com/package/@mulmocast/beat-editor)
[![License: MIT](https://img.shields.io/npm/l/@mulmocast/beat-editor.svg)](LICENSE)
[![CI](https://github.com/receptron/mulmocast-beat-editor/actions/workflows/pull_request.yaml/badge.svg)](https://github.com/receptron/mulmocast-beat-editor/actions/workflows/pull_request.yaml)
[![GitHub stars](https://img.shields.io/github/stars/receptron/mulmocast-beat-editor.svg?style=social)](https://github.com/receptron/mulmocast-beat-editor/stargazers)

Vue 3 components for editing [`@mulmocast/deck`](https://www.npmjs.com/package/@mulmocast/deck) slide decks live in the browser.

A list editor over a MulmoScript's `beats`. Every beat type renders as a **div**, and the pane on the right is **whichever editor is registered for that beat's `image.type`** — that registry is the extension point: replace an editor, or add a second one for a type.

A controlled component with no backend, no persistence and no AI — just data ↔ preview.

## Highlights

- **Swappable beat editors** — one registry keyed by `image.type`, several editors allowed per type, and your own can replace or join the shipped ones.
- **Every beat type previews** — `textSlide` / `markdown` / `chart` / `mermaid` / `image` / `movie` / `slide` / `html_tailwind`, each rendered into a div. One shared copy of chart.js and mermaid serves the whole list, and the stylesheet ships prebuilt — no per-slide CDN load.
- **Inspector for structure** — add / remove / swap layout type / nest content blocks / edit non-text fields. It is the `slide` beat's editor.

## Install

```bash
yarn add @mulmocast/beat-editor @mulmocast/deck vue
```

`vue ^3.5` and `@mulmocast/deck ^2.0.0` are peer dependencies. 2.x is the only line this package is developed and tested against.

## Usage
### Edit a MulmoScript's beats

`BeatListEditor` edits the beat array itself, so add / remove / reorder are array operations — the deck editor extracts slide beats and zips them back, which is why it cannot insert mid-deck. Every beat type `beatToHtml` renders previews in the list; the pane on the right edits the selected one.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BeatListEditor, makeBeat, type EditableBeat } from "@mulmocast/beat-editor";
import "@mulmocast/beat-editor/style.css"; // required — see The stylesheet is not optional

const beats = ref<EditableBeat[]>([makeBeat("textSlide"), makeBeat("chart")]);
</script>

<template>
  <BeatListEditor v-model:beats="beats" />
</template>
```

A beat is edited as `Record<string, unknown>`, not as the cli's `MulmoBeat`: a half-typed url or a `chartData` mid-keystroke is routinely invalid, and `beatToHtml` returns `undefined` for anything it cannot render, so the preview degrades instead of breaking.

### When your host owns a whole MulmoScript

`BeatListEditor` takes and emits the beat array. If what you hold is a whole script, `beatsOf` and `withBeats` are the two lines in between:

```vue
<script setup lang="ts">
import { beatsOf, withBeats, BeatListEditor, type EditableBeat } from "@mulmocast/beat-editor";

const props = defineProps<{ script: Record<string, unknown> }>();
const emit = defineEmits<{ "update:script": [script: Record<string, unknown>] }>();
</script>

<template>
  <BeatListEditor :beats="beatsOf(props.script)" @update:beats="(beats: EditableBeat[]) => emit('update:script', withBeats(props.script, beats))" />
</template>
```

Write `withBeats(script, beats)` rather than `{ beats }` — the second drops `presentationStyle`, `slideParams`, and everything else the script carried, and nothing tells you it happened.

`beatsOf` answers with an empty array for anything without a usable `beats` array, so it is safe to call before the script has loaded. It hands through **every** element, including one the editor cannot render: dropping one would round-trip as deletion the next time the host wrote the array back.
### Embedding in a narrow host

`BeatListEditor` reflows on its **own** width, not the window's, so a host that puts it in a card or a split pane declares nothing. Below `48rem` the editing pane moves under the beat list and takes the full width; above it, the two sit side by side.

Above the breakpoint the pane's width is a token:

```css
.my-host { --beat-editor-pane-width: 20rem; } /* default: 24rem */
```

Measured in a browser at a 600px-wide host: the beat preview went from 156px to 540px.

### Register your own beat editor

Which editor opens for a beat is decided by one list. Pass your own and you can replace what ships, or add a second way into a type that already has one — which is how `chart` gets both a form and a raw-JSON view.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BeatListEditor, defaultBeatEditors, makeBeat, type BeatEditorDefinition, type EditableBeat } from "@mulmocast/beat-editor";
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

## Components

| Component | Purpose |
|---|---|
| `<BeatListEditor>` | List editor over a MulmoScript's beats. `v-model:beats`, optional `editors`. |
| `<BeatView>` / `<BeatEditorPane>` | One beat's preview and one beat's editing pane — drop into your own layout. |
| `<Inspector>` | Structural editor for one `SlideLayout`. The `slide` beat's editor is built on it. |
| `defaultBeatEditors` / `editorsFor` | The shipped editor registry, and the lookup a host uses. |
| `sanitizeFragment` | The sanitizer `BeatView` runs a fragment through before inserting it. |
| `defaultTheme` / `sampleDeck` | Data helpers for quick starts. |
| `makeBeat` / `BEAT_TYPES` / `beatType` / `beatImage` | Beat helpers, for building the array a host edits. |
| `beatsOf` / `withBeats` | Read and write a script's `beats` when the host owns a whole MulmoScript. |

The Inspector covers every layout (`title` / `bigQuote` / `columns` / `comparison` / `grid` / `stats` / `timeline` / `split` / `matrix` / `table` / `funnel` / `waterfall` / `manifesto`) and every content block type (`text` / `bullets` / `callout` / `tag` / `code` / `metric` / `divider` / `image` / `imageRef` / `chart` / `mermaid` / `section` / `table`), with full CRUD + reorder on every array.

## How preview works

`BeatView` calls `beatToHtml(beat)` from `mulmocast/browser`, which returns a **body-only fragment**
with no `<script>` in it. The fragment is sanitized and inserted into a div. chart.js and mermaid are
loaded **once per page** and shared by every beat, and the stylesheet is prebuilt (`dist/lib/style.css`)
rather than fetched — so a list of thirty beats loads the runtimes once, not thirty times.

## Architecture

```
BeatListEditor.vue       (controlled — props: beats, editors; emits: update:beats)
├── BeatView.vue         -- one per beat: its own fragment and its own chart / mermaid runtime,
│                           so editing one beat leaves the others alone
└── BeatEditorPane.vue   -- right (the fields every beat has, plus the registered editor)
    └── editors/registry.ts -- image.type -> component, replaceable by the host
        └── editors/SlideEditor.vue -> Inspector.vue (the `slide` beat's editor)
```

State is held by the parent (Vue v-model pattern). All mutations are immutable copies, so a preview re-renders reactively.

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
yarn add @mulmocast/beat-editor @mulmocast/deck mulmocast vue
```

```ts
import { BeatListEditor, BeatView, defaultBeatEditors } from "@mulmocast/beat-editor";
import "@mulmocast/beat-editor/style.css";   // required — see below
```

```vue
<BeatListEditor :beats="beats" @update:beats="beats = $event" />
```

`BeatView` renders one beat read-only; `BeatListEditor` is the list plus the editing pane.

### The stylesheet is not optional

`beatToHtml` and `generateSlideFragment` emit Tailwind class names as **strings inside
compiled JavaScript**. Tailwind honours `.gitignore`, so it never scans `node_modules` and
your build never generates `text-[60px]` — a beat renders unstyled with no error to say so.
`@mulmocast/beat-editor/style.css` carries those utilities, generated at publish time.

It contains **no preflight**: a component library should not reset your page. The typography a
markdown beat expects is restored inside `.beat-fragment` at runtime, so a beat looks the same
whether or not your app runs preflight.

### Swapping an editor

Every editor is a component with one contract — `props: { beat }`, `emits: update(beat)` —
registered as a `BeatEditorDefinition`:

```ts
import { defaultBeatEditors, type BeatEditorDefinition } from "@mulmocast/beat-editor";
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
