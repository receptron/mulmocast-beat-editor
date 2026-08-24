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
 * `offered` is the set of paths the renderer marked editable — {@link withEditingAffordances}
 * hands back exactly that, from the same pass that adds the affordances. A path outside it is
 * refused: "the path exists" is not enough, because `layout` exists and writing prose into it
 * breaks the slide (measured — it took `"**x**"` before this was a permitted set).
 *
 * Returns null when the edit cannot be applied. Null means "leave the beat alone", never "clear
 * the field": telling a refused path apart from a real no-op edit is what stops a mis-read
 * attribute from silently blanking a slide.
 */
export const applyInlineEdit = (beat: EditableBeat, path: string, html: string, offered: ReadonlySet<string>): EditableBeat | null => {
  if (!offered.has(path) || !isInlineEditable(beat)) return null;
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

/** A fragment ready to edit, and the only paths an edit to it may write. */
export type EditingSurface = { html: string; paths: ReadonlySet<string> };

/**
 * The sanitized fragment with each editable leaf made keyboard-reachable, and the paths it offers.
 *
 * The two come from one pass on purpose: the pass that makes a path editable is the pass that
 * records it as permitted, so the permit list cannot drift from what the reader can actually
 * reach. `applyInlineEdit` refuses anything else, which fails closed for a path nobody rendered.
 *
 * Applied to a parsed document rather than by rewriting the string. A regex over
 * `data-mulmo-path="…"` also matches that text when a user TYPES it into a slide — measured:
 * a title of `data-mulmo-path="injected"` came back showing `tabindex="0"` as visible prose.
 * Parsing means an attribute is only ever added to something that is already an element.
 *
 * Rendered rather than applied to the live DOM afterwards, because the content comes from
 * `v-html`: attributes that are part of what Vue renders cannot fall out of step with it.
 */
export const withEditingAffordances = (html: string): EditingSurface => {
  const paths = new Set<string>();
  if (typeof document === "undefined") return { html, paths };
  const holder = document.createElement("template");
  holder.innerHTML = html;
  holder.content.querySelectorAll("[data-mulmo-path]").forEach((element) => {
    const path = element.getAttribute("data-mulmo-path") ?? "";
    if (!path) return;
    paths.add(path);
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "textbox");
    element.setAttribute("aria-label", `Edit ${path}`);
  });
  return { html: holder.innerHTML, paths };
};
