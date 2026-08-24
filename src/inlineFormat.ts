import { ACCENT_COLORS } from "./editorHelpers";

/**
 * Applying inline formatting to a selection inside an editable beat fragment.
 *
 * The iframe editor did this inside its component, against a document only it could reach.
 * Here the selection is the host's, so all of it is ordinary DOM work on a root element and a
 * `Selection` — which means jsdom can drive every case.
 *
 * Nothing here writes to a beat. The elements it produces are read back by the existing blur
 * commit, whose `htmlToMarkup` already turns them into deck markup: `<strong>` into `**…**`,
 * `<em class="text-d-warning …">` into `*…*`, `<span class="text-d-primary">` into `{primary:…}`.
 */

export type InlineFormat = { tag: string; className?: string };

/** The accent keys deck renders as `{key: … }`. */
export type AccentColor = (typeof ACCENT_COLORS)[number];

export const BOLD: InlineFormat = { tag: "strong" };
/** Deck renders `*…*` as bold amber rather than italic, so the markup carries those classes. */
export const EMPHASIS: InlineFormat = { tag: "em", className: "text-d-warning not-italic font-bold" };
export const colorFormat = (color: AccentColor): InlineFormat => ({ tag: "span", className: `text-d-${color}` });

const INLINE_TAGS = new Set(["strong", "em", "b", "i", "span"]);

const isElement = (node: Node | null | undefined): node is Element => node?.nodeType === Node.ELEMENT_NODE;

/** An element this editor treats as formatting, as opposed to structure a layout emitted. */
const isFormatting = (element: Element): boolean => {
  const tag = element.tagName.toLowerCase();
  if (!INLINE_TAGS.has(tag)) return false;
  return tag === "span" ? /text-d-[a-z]+/.test(element.getAttribute("class") ?? "") : true;
};

const sameKind = (a: Element, b: Element): boolean => a.tagName === b.tagName && (a.getAttribute("class") ?? "") === (b.getAttribute("class") ?? "");

const formattingIn = (root: HTMLElement): Element[] => [...root.querySelectorAll([...INLINE_TAGS].join(","))].filter(isFormatting);

/** Lift an element's children into its place and remove it. */
export const unwrapElement = (element: Element): void => {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
};

/** The editable leaf a node sits in, if any. */
export const editableRootOf = (node: Node | null): HTMLElement | null => {
  const element = isElement(node) ? node : node?.parentElement;
  return element?.closest<HTMLElement>("[data-mulmo-path]") ?? null;
};

/**
 * Put an editable element back into a shape the markup converter can read.
 *
 * Wrapping a selection leaves debris that renders identically and converts badly: an empty
 * `<strong></strong>` becomes `****`, a nested `<strong><strong>x</strong></strong>` becomes
 * `****x****`, and two adjacent `<strong>` siblings become `**a****b**`.
 */
export const tidyEditable = (root: HTMLElement): void => {
  formattingIn(root).forEach((element) => {
    if (element.textContent === "") element.remove();
  });
  collapseNested(root);
  mergeAdjacent(root);
  root.normalize();
};

const collapseNested = (root: HTMLElement): void => {
  for (;;) {
    const nested = formattingIn(root).find((element) => {
      const parent = element.parentElement;
      return parent !== null && isFormatting(parent) && sameKind(element, parent);
    });
    if (!nested) return;
    unwrapElement(nested);
  }
};

const mergeAdjacent = (root: HTMLElement): void => {
  for (;;) {
    const pair = formattingIn(root)
      .map((element) => ({ element, next: element.nextSibling }))
      .find(({ element, next }) => isElement(next) && sameKind(element, next));
    if (!pair || !isElement(pair.next)) return;
    while (pair.next.firstChild) pair.element.appendChild(pair.next.firstChild);
    pair.next.remove();
  }
};

/** The nearest ancestor within `root` that is already this format, if the selection is inside one. */
const enclosingFormat = (node: Node | null, format: InlineFormat, root: HTMLElement): Element | null => {
  for (let current: Node | null = node; current && current !== root; current = current.parentNode) {
    if (!isElement(current)) continue;
    if (current.tagName.toLowerCase() === format.tag && (current.getAttribute("class") ?? "") === (format.className ?? "")) return current;
  }
  return null;
};

const wrapRange = (range: Range, format: InlineFormat): Element => {
  const wrapper = range.startContainer.ownerDocument?.createElement(format.tag) ?? document.createElement(format.tag);
  if (format.className) wrapper.setAttribute("class", format.className);
  try {
    range.surroundContents(wrapper);
  } catch {
    // The range crosses an element boundary, which `surroundContents` refuses. Lifting the
    // contents out and putting them back inside the wrapper does the same thing.
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }
  return wrapper;
};

const selectContentsOf = (selection: Selection, element: Element): void => {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
};

/** Re-select `text` inside `root` — used after an unwrap, where the old range is gone. */
const selectText = (selection: Selection, root: HTMLElement, text: string): void => {
  if (!text) return;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const index = (node.nodeValue ?? "").indexOf(text);
    if (index < 0) continue;
    const range = root.ownerDocument.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + text.length);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }
};

/** A selection worth acting on: non-empty, and inside an element this editor may format. */
export const formattableSelection = (selection: Selection | null): { range: Range; root: HTMLElement } | null => {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!range.toString().trim()) return null;
  const root = editableRootOf(range.commonAncestorContainer);
  return root && root.getAttribute("contenteditable") === "true" ? { range, root } : null;
};

/**
 * Apply a format to the selection, or remove it when the selection is already inside one.
 *
 * Answers whether anything changed, so a caller can leave the toolbar alone otherwise.
 */
export const toggleFormat = (selection: Selection | null, format: InlineFormat): boolean => {
  const found = formattableSelection(selection);
  if (!found || !selection) return false;
  const { range, root } = found;

  const start = enclosingFormat(range.startContainer, format, root);
  if (start !== null && start === enclosingFormat(range.endContainer, format, root)) {
    const inner = start.textContent;
    unwrapElement(start);
    tidyEditable(root);
    selectText(selection, root, inner);
    return true;
  }

  const wrapper = wrapRange(range, format);
  tidyEditable(root);
  selectContentsOf(selection, wrapper);
  return true;
};

/** A span this module can recognise and that `isFormatting` will not: it is scaffolding. */
const CLEAR_MARKER: InlineFormat = { tag: "span", className: "mulmo-clearing" };

/**
 * Move an element up past every formatting ancestor, splitting each one around it.
 *
 * Deleting a selection's contents and putting plain text back is not enough, because the
 * insertion point stays INSIDE the wrapper — measured, clearing a fully-selected
 * `<strong>bold</strong>` left the DOM byte-identical. Lifting the run out is what actually
 * removes the formatting, and splitting is what makes a partial selection work: clearing
 * `ol` in `<strong>bold</strong>` has to leave `<strong>b</strong>ol<strong>d</strong>`.
 */
const liftOutOfFormatting = (element: Element, root: HTMLElement): void => {
  for (let parent = element.parentElement; parent && parent !== root && isFormatting(parent); parent = element.parentElement) {
    const trailing = parent.cloneNode(false);
    while (element.nextSibling) trailing.appendChild(element.nextSibling);
    parent.after(element);
    if (trailing.hasChildNodes()) element.after(trailing);
  }
};

/** Replace the selection with its own plain text, dropping every wrapper around and inside it. */
export const clearFormat = (selection: Selection | null): boolean => {
  const found = formattableSelection(selection);
  if (!found || !selection) return false;
  const { range, root } = found;
  const text = range.toString();
  const marker = wrapRange(range, CLEAR_MARKER);
  liftOutOfFormatting(marker, root);
  marker.replaceWith(root.ownerDocument.createTextNode(text));
  tidyEditable(root);
  selectText(selection, root, text);
  return true;
};
