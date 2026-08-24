# feat: script-shaped helpers for a host that owns a whole MulmoScript

Gap 1 of #57. Decision on the issue: **option C** — export pure functions, keep
`BeatListEditor` an editor of a beat array.

## Why

`mulmoscript-plugin` is built around a whole MulmoScript and cannot migrate off
`@mulmocast/deck-web`, because `BeatListEditor` takes and emits `beats` only. Writing the
array back into the script is three lines the host has to get right, and the way it goes
wrong is silent: `{ beats }` instead of `{ ...script, beats }` drops `presentationStyle`,
`slideParams`, and everything else.

Option A (a `MulmoScriptBeatEditor` wrapper) would make the package own the shape of a
MulmoScript. Option C keeps what it knows to "an object with a `beats` array".

## What

`src/scriptHelpers.ts`:

- `beatsOf(script)` — the script's `beats` when it is an array, `[]` otherwise.
- `withBeats(script, beats)` — the script with `beats` replaced and every other field kept.

**`beatsOf` preserves every element rather than filtering to the editable ones.** Filtering
would round-trip as deletion: an element the editor could not show would be gone the next
time the host wrote the array back.

That makes a non-record element reachable, and it crashes today — measured:

```
null      → TypeError: Cannot read properties of null (reading 'image')
undefined → TypeError: Cannot read properties of undefined (reading 'image')
"oops"/42 → renders nothing (no crash)
```

So `beatImage` and `beatType` are hardened to answer for a beat that is not a record. That
is the same invariant — "a script's beats can be handed to the editor without losing or
breaking anything" — so it belongs in this change rather than a separate one.

## Verification

- unit tests for both helpers: round-trip preservation, a missing `beats`, a non-array
  `beats`, a null script, and elements the editor cannot render
- a mounted test that a beats array carrying a non-record element still renders
- break-check each new rule
- the README gets the three lines a host would otherwise write

## Not in this change

Gap 2 (narrow-host layout) is its own PR — it is revertable on its own. Gaps 3 and 4 need
no code.
