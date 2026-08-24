# feat: inline formatting toolbar on a selection

PR 3 of #53. Select text inside a `slide` beat and apply bold / emphasis / one of seven
accent colours / clear, from a toolbar that follows the selection.

## What the port actually is

The iframe version's toolbar lived in `SlidePreview.vue` (deleted in `433f114`) as ~200
lines of Range and DOM work inside a component. Two things change and one does not:

| | iframe | div |
|---|---|---|
| Selection | `iframe.contentDocument.getSelection()` | the host's `document.getSelection()` |
| Toolbar position | selection rect **plus the iframe's rect** | the selection rect, directly |
| Commit | its own `htmlToMarkup` → `setByPath` → emit | **nothing new** — the existing blur commit already does it |

The third is the important one. `BeatView` already commits on blur through
`htmlToMarkup(innerHTML)` → `applyInlineEdit`, and that path already handles everything the
toolbar produces — measured, 6/6:

    <strong>bold</strong>                                     -> **bold**
    <em class="text-d-warning not-italic font-bold">warn</em> -> *warn*
    <span class="text-d-primary">blue</span>                  -> {primary:blue}
    <strong><span class="text-d-success">both</span></strong> -> **{success:both}**

So this PR adds no write path. It manipulates the DOM inside an element that is already
`contenteditable`, and the existing commit picks it up.

## Shape

The old code put the Range work in the component, where none of it could be tested. Here:

- `src/inlineFormat.ts` — everything that operates on an editable root and a Range:
  `wrapSelection`, `clearSelection`, `tidyEditable`, and the toggle-off detection. No Vue,
  no component, so jsdom can drive all of it.
- `src/toolbarPosition.ts` — where the toolbar goes, given a selection rect and a viewport.
  Pure arithmetic, and the part the iframe version got wrong the most.
- `src/components/InlineToolbar.vue` — restored close to its deleted form; it was already
  positioned with `fixed`, so it needs no iframe translation.
- `BeatView.vue` — listens for `selectionchange`, positions the toolbar, and calls the
  formatting functions.

## Verification

- unit tests over `inlineFormat` in jsdom: toggle on, toggle off, nested wrappers, adjacent
  merges, empty wrappers, a range crossing element boundaries, clear
- unit tests over `toolbarPosition`: above the selection, clamped at the top, clamped at
  each viewport edge
- a mounted test that a selection inside a slide beat shows the toolbar and that a beat
  which is not editable never does
- round-trip: apply each format, run the existing commit, assert the deck markup
- break-check every rule
- browser: apply each button on a real selection and read the model back

## Not in this PR

Drag-and-drop reorder inside a slide and its FLIP animation — PR 4 of #53.
