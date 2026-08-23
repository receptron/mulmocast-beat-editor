import { beatImage, isRecord, withImageField, type EditableBeat } from "./beatHelpers";
import { getByPath, htmlToMarkup, setByPath } from "./editorHelpers";

/**
 * Applying an edit made directly on a rendered beat.
 *
 * `@mulmocast/deck` marks every editable leaf with `data-mulmo-path`, holding a path into the
 * `SlideLayout` — `left.content[0].items[0]`, not a path into the beat. So a commit reads that
 * attribute, converts the element's HTML back to deck's inline markup, and writes it into
 * `beat.image.slide`.
 *
 * Only a `slide` beat carries those attributes; `beatToHtml` emits none for the other seven
 * types, which is why inline editing is slide-only and the caller checks `isInlineEditable`.
 */

/** Whether this beat's fragment can carry `data-mulmo-path`, and so be edited in place. */
export const isInlineEditable = (beat: EditableBeat): boolean => {
  const image = beatImage(beat);
  return image["type"] === "slide" && isRecord(image["slide"]);
};

/**
 * The beat with `path` inside its slide set to the markup form of `html`.
 *
 * Returns null when the edit cannot be applied — not a slide beat, an empty path, or a path
 * that does not exist in this slide. Null means "leave the beat alone", never "clear the field":
 * `setByPath` answers with the original object for a path it cannot walk, and telling that apart
 * from a real no-op edit is what stops a mis-read attribute from silently blanking a slide.
 */
export const applyInlineEdit = (beat: EditableBeat, path: string, html: string): EditableBeat | null => {
  if (!path || !isInlineEditable(beat)) return null;
  const slide = beatImage(beat)["slide"];
  const markup = htmlToMarkup(html);
  // Blur fires whether or not anything was typed, and `setByPath` deep-clones, so identity
  // cannot tell an untouched field from an edited one. Compare the value instead: without this
  // every click-away rebuilds the fragment and the beat visibly redraws for nothing.
  if (getByPath(slide, path) === markup) return null;
  const next = setByPath(slide, path, markup);
  // `setByPath` answers with the original object for a path it cannot walk. That is the only
  // remaining way to get here with nothing written, and it must not read as a cleared field.
  if (next === slide) return null;
  return withImageField(beat, "slide", next);
};
