# Changelog

## 2.0.0 — 2026-08-23

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
