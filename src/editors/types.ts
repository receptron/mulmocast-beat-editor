import type { Component } from "vue";
import type { EditableBeat } from "../beatHelpers";

/**
 * One way to edit one kind of beat.
 *
 * A beat type may have several — `chart` ships with a form and a raw-JSON editor — and a
 * consumer can add or replace any of them by passing their own list. That is the whole
 * extension point: everything else is convention.
 *
 * The component's contract is deliberately tiny:
 *
 *   props:  { beat: EditableBeat }
 *   emits:  update(beat: EditableBeat)
 *
 * It edits `beat.image` and nothing else. Fields every beat has — the spoken `text` — are
 * the host's job, so an editor stays about the one shape it knows.
 */
export type BeatEditorDefinition = {
  /** Stable id, `<beatType>.<variant>`. Used to remember a choice, not shown to the user. */
  id: string;
  /** Shown when a beat type has more than one editor. */
  label: string;
  /** The `image.type` this edits. */
  beatType: string;
  component: Component;
};

export type BeatEditorProps = { beat: EditableBeat };
export type BeatEditorEmits = { update: [beat: EditableBeat] };
