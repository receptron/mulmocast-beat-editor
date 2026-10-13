import { isRecord, type EditableBeat } from "./beatHelpers";
import { beatsOf } from "./scriptHelpers";

export type PastedScript = { beats: EditableBeat[] } | { error: string };

const parseJson = (text: string): { value: unknown } | { error: string } => {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: `Not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
};

/**
 * The beats of a MulmoScript pasted as text, or why there are none. Every reason is reported
 * rather than answered with an empty editor, which would read as "the script has no beats".
 */
export const readPastedScript = (text: string): PastedScript => {
  if (text.trim() === "") return { error: "Paste a MulmoScript (JSON) first." };
  const parsed = parseJson(text);
  if ("error" in parsed) return parsed;
  if (!isRecord(parsed.value)) return { error: "A MulmoScript is a JSON object with a `beats` array." };
  if (!Array.isArray(parsed.value["beats"])) return { error: "The script has no `beats` array." };
  const beats = beatsOf(parsed.value);
  return beats.length > 0 ? { beats } : { error: "The script's `beats` array is empty." };
};
