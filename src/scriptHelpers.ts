import { isRecord, type EditableBeat } from "./beatHelpers";

/**
 * Reading and writing the beat array of a host's script.
 *
 * `BeatListEditor` edits a beat array, but a host usually owns a whole MulmoScript. These are
 * the two lines that sit between them, here rather than in each host, because the way a host
 * gets them wrong is silent: `{ beats }` instead of `{ ...script, beats }` drops
 * `presentationStyle`, `slideParams` and everything else the script carried.
 *
 * The package deliberately does not know what a MulmoScript is — only that it is an object
 * with a `beats` array. That keeps the editor usable for anything shaped that way.
 */

/**
 * An array is the beats array whatever it holds.
 *
 * Every element is kept, including one this editor cannot render: filtering here would
 * round-trip as deletion, since the host writes the array back and what was dropped is gone.
 * `beatType` and `beatImage` answer for an element that is not a record — measured, they used
 * to throw `Cannot read properties of null (reading 'image')`.
 */
const isBeatArray = (value: unknown): value is EditableBeat[] => Array.isArray(value);

/** The script's beats, or none when it has no usable array. */
export const beatsOf = (script: unknown): EditableBeat[] => {
  if (!isRecord(script)) return [];
  const beats = script["beats"];
  return isBeatArray(beats) ? beats : [];
};

/**
 * The script with its beats replaced and every other field kept.
 *
 * A shallow copy: the fields it carries over are shared, which is what a "replace the beats"
 * operation should do. For anything the type forbids — a JS host passing an array, a string,
 * or null — the spread is what you would expect and not what you want (`["a"]` comes back as
 * `{"0":"a", beats}`), so the type is the guard. `beatsOf` answers `[]` for all of those, so a
 * host that used both would see an empty editor before it saw a malformed script.
 */
export const withBeats = <T extends object>(script: T, beats: EditableBeat[]): T & { beats: EditableBeat[] } => ({
  ...script,
  beats,
});
