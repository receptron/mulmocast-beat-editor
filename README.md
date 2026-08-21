# @mulmocast/deck-web

[![npm version](https://img.shields.io/npm/v/@mulmocast/deck-web.svg)](https://www.npmjs.com/package/@mulmocast/deck-web)
[![npm downloads](https://img.shields.io/npm/dm/@mulmocast/deck-web.svg)](https://www.npmjs.com/package/@mulmocast/deck-web)
[![License: MIT](https://img.shields.io/npm/l/@mulmocast/deck-web.svg)](LICENSE)
[![CI](https://github.com/receptron/mulmocast-deck-web/actions/workflows/pull_request.yaml/badge.svg)](https://github.com/receptron/mulmocast-deck-web/actions/workflows/pull_request.yaml)
[![GitHub stars](https://img.shields.io/github/stars/receptron/mulmocast-deck-web.svg?style=social)](https://github.com/receptron/mulmocast-deck-web/stargazers)

Vue 3 components for editing [`@mulmocast/deck`](https://www.npmjs.com/package/@mulmocast/deck) slide decks live in the browser.

A 3-pane editor that holds a `SlideLayout[]` (or a full MulmoScript) in memory, renders each slide live via `generateSlideHTML()` into a sandboxed iframe, and lets you edit through **WYSIWYG click-to-edit + a floating toolbar + drag-and-drop reorder**, plus a schema-aware Inspector for structural edits. No backend, no persistence, no AI — just data ↔ preview.

## Highlights

- **WYSIWYG click-to-edit** — click any text in the preview to edit in place. Blur or Enter commits, Escape cancels.
- **Floating toolbar** — select text → toolbar appears with **B** (bold) / **★ amber highlight** / **7 color swatches** / **× clear**. Toggle off by clicking the same button again.
- **Drag-and-drop reorder** — drag bullets, stats cards, timeline steps, manifesto lines, columns, grid items in the preview to reorder. Drag slides in the left list to reorder the deck.
- **Inspector for structure** — add / remove / swap layout type / nest content blocks / edit non-text fields.

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
| `defaultTheme` / `sampleDeck` | Data helpers for quick starts. |

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
```

State is held by the parent (Vue v-model pattern). All mutations are immutable copies, so iframe re-renders reactively.

## Scripts

```bash
yarn dev          # Vite dev server with the SPA demo
yarn build        # build the demo SPA → dist/
yarn build:lib    # build the publishable library → dist/lib/ (used by prepublishOnly)
yarn lint
yarn format
```

## License

MIT
