# Changelog

## 1.1.1 — 2026-08-25

### Fixed

- **The editing affordances now reach a beat rendered inside a shadow root** (receptron/mulmoclaude#2947).
  `ensureDocumentStyles` appended to `document.head`, which does not cross a shadow boundary, so
  a host that mounts the editor inside one got a draggable item with no grab cursor and an
  editable one with no hover outline. Measured in MulmoTerminal, which mounts every plugin that
  way: `cursor` read `auto` in the shadow root and `grab` outside it.

  `BeatView` now passes its own `getRootNode()`, which answers the document when there is no
  shadow root — so the same call is correct either way and no host has to do anything. The sheet
  is added once **per root**, since a page with several shadow roots needs a copy in each.

  The slide itself was never affected: its theme variables are inline on the element.

### Added

- `beatDocumentCss()` and `ensureDocumentStyles(root?)` are exported, for a host that would
  rather place the sheet itself.

## 1.1.0 — 2026-08-25

Editing on the slide itself is back. 1.0.0 shipped without it — the iframe editor was removed
and nothing had replaced it yet — so a beat rendered as a `div` was read-only and the only way
to change a slide was the `Inspector` form. Everything below runs against the host's own
document, so a host embeds it the way it embeds any other component.


### Added

- **The four things the iframe editor took away are back on the div path** (#53). 1.0.0 recorded
  them as removed, and that record stands for that release — this is where they return:
  click-to-edit text on the slide, the inline bold / emphasis / colour toolbar, drag-and-drop
  reorder of in-slide list items, and the FLIP animation on reorder.

  The reorder is offered only where a move is possible: a marked item whose array has a single
  entry gets no drag affordance, because its only candidate target is itself. A drag that starts
  on a text selection, or on a natively-draggable child such as an `<img>` inside a card, is left
  to the browser rather than taken as a reorder.

### Fixed

- **Inline formatting no longer writes markup deck cannot read back** (#64). Colour and emphasis
  share one slot, so applying one supersedes the others over that text instead of nesting — a
  nested `{a:x{b:y}z}` put its own braces on screen and the next edit formatted those.

  Measured over the same sweeps before and after: 34 → 0 of 1375 single edits, 282 → 0 toggles,
  291 → 0 stacked sequences.

- **Editing a `bigQuote` slide multiplied its quotation marks** (#67). The marker sat on the
  `<blockquote>`, which also holds the decorative `“ ”`, so each edit absorbed them. Fixed in
  `@mulmocast/deck` 2.0.1; the peer floor moves with it, because `mulmocast` also depends on
  deck and leaving it at 2.0.0 let the lockfile resolve two copies.

- **Clicking a marker sometimes lost the edit before it started** (#61, #62, #63).

### Host integration (#57)

- **`beatsOf(script)` / `withBeats(script, beats)`** — the two pure functions a host needs to
  hand a whole MulmoScript to `BeatListEditor`, which takes and emits a beat array. Every element
  of the original array is preserved, including ones that are not records.

- **The editing pane adapts to a narrow host.** The layout is a container query rather than a
  prop, so nothing has to be declared: below `@3xl` the pane moves under the list instead of
  beside it. Its width is `--beat-editor-pane-width` (default `24rem`) for hosts that want to
  set it.

  Reordering beats themselves stays on the up/down buttons — deliberate, and confirmed as the
  intended replacement for the iframe editor's drag.

## @mulmocast/beat-editor 1.0.0 — 2026-08-23

**The package is renamed.** `@mulmocast/deck-web` becomes `@mulmocast/beat-editor`, and the deck
editor it was named after is gone.

```diff
- import { BeatListEditor } from "@mulmocast/deck-web";
- import "@mulmocast/deck-web/style.css";
+ import { BeatListEditor } from "@mulmocast/beat-editor";
+ import "@mulmocast/beat-editor/style.css";
```

Nothing else changes for a caller of `BeatListEditor`, `BeatView`, `BeatEditorPane`, `Inspector`
or the editor registry — same components, same props, same emits.

`@mulmocast/deck-web@2.0.0` is the final release under the old name and is deprecated on npm.

### Removed

- `DeckEditor`, `MulmoScriptDeckEditor`, `DeckList`, `SlidePreview` — the iframe deck editor,
  deprecated in 2.0.0. With them go the four things only they could do: click-to-edit text on the
  slide, the inline bold/italic/colour toolbar, drag-and-drop reorder of in-slide list items, and
  the FLIP animation on reorder. **Structural editing of a slide is unaffected** — that was always
  `Inspector`, and it now runs against a div.
- The WYSIWYG path/markup layer those components were the only callers of (`parsePath`,
  `getByPath`, `setByPath`, `moveByPath`, `splitItemPath`, `htmlToMarkup`). None of it was
  exported, so no public API is affected.

Net: −1763 lines.

### Changed

- The demo is the beat editor alone, with a script picker. The sample MulmoScripts it used to
  extract slides from are now loaded as beats directly.
- The document-level style element is `mulmocast-beat-editor-document-styles`, renamed from
  `mulmocast-deck-web-document-styles`. Only matters if something reached for that id.

## @mulmocast/deck-web 2.0.0 — 2026-08-23

The release where the beat editor becomes the package, and the deck editor becomes the part being
retired. Everything the deck editor exported still ships and still works — this is the last version
that carries it.

### Breaking

- **Peer dependency `@mulmocast/deck` moves from `^0.5.1` to `^2.0.0`.** No exported component was
  removed and no signature changed, so an app already on deck 2.x can upgrade without touching its
  code — but the range no longer admits deck 0.x or 1.x, which is a major by semver.

### Deprecated (still exported, still working)

`DeckEditor`, `MulmoScriptDeckEditor`, `DeckList` and `SlidePreview` render each slide into an
`<iframe srcdoc>`, which loads chart.js, mermaid and Tailwind from a CDN **once per slide**, and
they only understand `image.type === "slide"`. They now carry `@deprecated` with the replacement
named, and your editor will say so. `Inspector` is **not** deprecated — the beat editor's `slide`
editor is built on it.

### Added

- **Beat editor** (#26, #31) — `BeatListEditor` edits a MulmoScript's `beats` array directly, so
  add / remove / reorder are array operations rather than a slide-extract-and-zip-back. Every beat
  type renders into a **div** through `beatToHtml`, one shared copy of chart.js and mermaid serves
  the whole list, and editing one beat redraws only that beat.
- **Swappable editor registry** (#31) — `defaultBeatEditors` / `editorsFor`, keyed by `image.type`.
  A host can replace what ships or add a second editor for a type; `chart` ships two (a form and
  raw JSON) and the pane offers them as tabs. The contract is `props: { beat }` /
  `emits: update(beat)`.
- **Prebuilt stylesheet** (#37) — `@mulmocast/deck-web/style.css`. `beatToHtml` emits Tailwind class
  names as strings inside compiled JavaScript, and Tailwind honours `.gitignore`, so it never scans
  `node_modules` and a consumer's build cannot generate them. Carries no preflight; the typography a
  markdown beat expects is restored inside `.beat-fragment`.
- **`Inspector` edits a `slide` beat** (#33) — the full layout and content-block editor, in the beat
  pane, instead of two text fields.
- **Markdown layout form and a chart title input** (#35).
- **Demo coverage of every beat type** (#25, #36) — `yarn dev` shows all of them, plus a layout
  showcase deck and a demo-registered second `textSlide` editor.

### Changed

- The demo opens on the beat editor; the deck editor is a tab labelled `Slide editor (legacy)` and
  kept working so the deprecated exports stay exercised (#40).
- The README leads with the beat editor throughout; the three iframe sections moved under a
  `Deprecated: the iframe deck editor` heading (#40).
- `description` and `keywords` describe editing MulmoScript beats rather than SlideLayout decks
  (#46).

### Internal

- **First tests for `Inspector` and `ContentBlockEditor`** (#45) — 864 round-trips over 13 layouts
  and 13 block types, asserting that every select reads back what you chose. `:value` and `@change`
  are written separately at each site and a `<select :value>` never appears in the rendered HTML, so
  driving the control is the only way to catch a mis-wired pair.
- **Type-aware lint** (#44) — `strictTypeChecked`, every clean rule an error, the rest warnings with
  their counts recorded, and `--max-warnings 85` making the count a ratchet.
- Duplication: 17 clones down to 9. `AccentColorSelect` replaces 16 hand-copied selects, taking 16
  `as never` casts with it (#43); one shared reader for a beat's string list (#41).

## 1.1.1 and earlier

Not recorded here — see the GitHub releases.
