# fix: starting an edit puts you in a position to type

#61 and #62. Two reports, one invariant: **after "start editing", the caret is in the field
you asked for.** Today neither the mouse path nor the keyboard path guarantees it, for
different reasons, and both fixes go through the same place.

## #62 — Enter starts editing without a caret

Measured on main, after one prior edit:

    Enter のみ        選択が要素内=false   Cmd+A → "Beat editor\n"  (the whole page)

`startEditing` sets `contenteditable` and calls `focus()` in the same tick, and Chromium does
not place a caret in an element that only just became editable. The mouse path never shows it
because the click itself places the caret — which is what `beginEdit`'s comment says.

Three options were measured rather than argued:

| | 選択が要素内 |
|---|---|
| now | false |
| C: focus again on a later tick | **false** — the option that looked cheapest does not work |
| A: place a collapsed caret at the end | true |
| B: select the whole content | true |

**A.** B works too and saves a keystroke before using the toolbar, but the next thing typed
would replace the field. A cannot lose text, and it makes `Cmd+A` work, which is what unlocks
the toolbar anyway.

## #61 — clicking another field eats the click

    subtitle をクリック   editable=[]  active=BODY  inputs=["FIRST","Subtitle"]

`mousedown` → `focusout` → commit → the parent replaces the beat → `v-html` rebuilds the
fragment → the node the `click` was heading for is detached, so the event never reaches the
delegated handler and `beginEdit` never runs.

**Carry the intent.** `mousedown` fires *before* the commit, while the target is still
attached: record the path there. The fragment watch already runs after the rebuild — if a path
is waiting, open that marker in the new fragment.

The pending path is cleared by `beginEdit` as well, so a click that completes normally cannot
leave one behind to fire on an unrelated re-render later.

## Verification

- browser: click title → type → click subtitle → **one** click starts editing it, and the
  first edit is still committed
- browser: Tab to a marker → Enter → `Cmd+A` selects the field, not the page
- browser: keyboard and mouse both still commit, and the toolbar still works
- mounted tests for the pending-path bookkeeping; the caret itself is browser-only, because
  jsdom has no caret and collapses selections on focus
- break-check each rule

## Not in this change

The FLIP reorder (#53 PR 4).
