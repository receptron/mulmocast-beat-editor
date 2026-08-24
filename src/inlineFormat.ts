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

/**
 * The colour a format paints, or null when it paints none.
 *
 * Deck's markup has one colour slot and no nesting: `{warning:a{primary:b}c}` renders its own
 * braces as text. Emphasis shares that slot rather than sitting beside it — `*…*` cannot be
 * written next to a word character, so `htmlToMarkup` stores such a run as `{warning:…}`, and a
 * value cannot say afterwards which of the two produced it. Treating them as one format is what
 * the stored form already does.
 */
const colorOf = (format: InlineFormat): string | null => /\btext-d-([a-z]+)\b/.exec(format.className ?? "")?.[1] ?? null;

const formatOf = (element: Element): InlineFormat => ({
  tag: element.tagName.toLowerCase(),
  className: element.getAttribute("class") ?? undefined,
});

type FormatMatcher = (format: InlineFormat) => boolean;

/** Formats that occupy the same slot as `format`: the same colour, whatever tag carries it. */
const sameSlot =
  (format: InlineFormat): FormatMatcher =>
  (other) => {
    const color = colorOf(format);
    return color === null ? other.tag === format.tag && (other.className ?? "") === (format.className ?? "") : colorOf(other) === color;
  };

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

/**
 * One pass, not a search-and-restart per element.
 *
 * Re-querying the whole subtree after every change is quadratic, and it is reachable: 2000
 * adjacent `<strong>a</strong>` — which a paste can produce — took 4.4 SECONDS on the main
 * thread. Document order means a parent is always visited before its child, so unwrapping as
 * we go needs no second look.
 */
const collapseNested = (root: HTMLElement): void => {
  formattingIn(root).forEach((element) => {
    if (!element.isConnected) return;
    for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
      // Any ancestor of the same kind, not just the direct parent: a `<strong>` reached through a
      // colour span adds nothing on screen, and the value it produces — `**a{c:**b**}**` — is one
      // deck mis-parses, because its bold pass runs before its colour pass and does not see the
      // braces.
      if (isFormatting(parent) && sameKind(element, parent)) {
        unwrapElement(element);
        return;
      }
    }
  });
};

const mergeAdjacent = (root: HTMLElement): void => {
  formattingIn(root).forEach((element) => {
    if (!element.isConnected) return;
    for (let next = element.nextSibling; isElement(next) && sameKind(element, next); next = element.nextSibling) {
      while (next.firstChild) element.appendChild(next.firstChild);
      next.remove();
    }
  });
};

/** The nearest ancestor within `root` already holding this format's slot, if there is one. */
const enclosingFormat = (node: Node | null, matches: FormatMatcher, root: HTMLElement): Element | null => {
  for (let current: Node | null = node; current && current !== root; current = current.parentNode) {
    if (isElement(current) && isFormatting(current) && matches(formatOf(current))) return current;
  }
  return null;
};

/** A formatting ancestor within `root` that paints a colour, if the node sits inside one. */
const enclosingColor = (node: Node | null, root: HTMLElement): Element | null => enclosingFormat(node, (format) => colorOf(format) !== null, root);

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

/**
 * Where a range boundary sits, counted in characters of `root`'s text.
 *
 * Node identity cannot survive the surgery — the nodes the selection pointed at are unwrapped,
 * split or merged. Character offsets do, because removal never changes the text.
 */
const characterOffset = (root: HTMLElement, container: Node, offset: number): number => {
  const upTo = root.ownerDocument.createRange();
  upTo.selectNodeContents(root);
  upTo.setEnd(container, offset);
  return upTo.toString().length;
};

/**
 * Select characters `from`..`to` of `root`'s text, crossing elements as needed.
 *
 * Restoring by searching for the text instead lands on the FIRST match: measured, clearing the
 * second `foo` of `<strong>foo</strong> <strong>foo</strong>` left the selection inside the
 * first one, so the next toolbar press coloured the wrong word.
 */
export const selectCharacters = (selection: Selection, root: HTMLElement, from: number, to: number): void => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = root.ownerDocument.createRange();
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = (node.nodeValue ?? "").length;
    if (!started && seen + length >= from) {
      range.setStart(node, from - seen);
      started = true;
    }
    if (started && seen + length >= to) {
      range.setEnd(node, to - seen);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    seen += length;
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
  const matches = sameSlot(format);

  if (enclosingFormat(range.startContainer, matches, root) && enclosingFormat(range.endContainer, matches, root)) {
    removeFormat(selection, range, root, matches);
    return true;
  }

  const wrapper = wrapRange(range, format);
  if (colorOf(format) !== null) supersedeColor(wrapper, root);
  tidyEditable(root);
  selectContentsOf(selection, wrapper);
  return true;
};

/**
 * Leave `wrapper` as the only colour over its text, keeping every other format around it.
 *
 * A colour applied over a coloured run nests, and the value that comes back — `{a:x{b:y}z}` —
 * is one deck cannot parse, so its braces reach the screen as text and the next edit formats
 * those. On screen the inner colour already won, so dropping the outer one changes nothing a
 * user can see.
 */
const supersedeColor = (wrapper: Element, root: HTMLElement): void => {
  [...wrapper.querySelectorAll([...INLINE_TAGS].join(","))]
    .filter((element) => isFormatting(element) && colorOf(formatOf(element)) !== null)
    .forEach(unwrapElement);
  if (!enclosingColor(wrapper.parentElement, root)) return;
  const passed = liftPast(wrapper, root);
  rewrapContents(
    wrapper,
    passed.filter((format) => colorOf(format) === null),
  );
};

/** A span this module can recognise and that `isFormatting` will not: it is scaffolding. */
const CLEAR_MARKER: InlineFormat = { tag: "span", className: "mulmo-clearing" };

/**
 * Move an element up past its formatting ancestors, splitting each one around it, and answer
 * with the formats it passed — outermost last.
 *
 * Splitting is what makes a PARTIAL selection work. Unwrapping the whole ancestor instead is
 * too broad in both directions: clearing a fully-selected `<strong>bold</strong>` by deleting
 * and re-inserting text left the DOM byte-identical, and un-bolding just `ol` inside it
 * removed the bold from `bold` entirely rather than leaving `**b**ol**d**`.
 *
 * What keeps the OTHER formats is `rewrapContents`, not this.
 */
const liftPast = (element: Element, root: HTMLElement): InlineFormat[] => {
  const passed: InlineFormat[] = [];
  for (let parent = element.parentElement; parent && parent !== root && isFormatting(parent); parent = element.parentElement) {
    passed.push(formatOf(parent));
    const trailing = parent.cloneNode(false);
    while (element.nextSibling) trailing.appendChild(element.nextSibling);
    parent.after(element);
    if (trailing.hasChildNodes()) element.after(trailing);
  }
  return passed;
};

/**
 * Drop the wrappers the removal targets from INSIDE the run.
 *
 * Lifting only deals with formatting the run sits in. A selection that crosses an element
 * boundary lands its marker at the top, with the old wrappers still inside it — measured, both
 * clearing and un-bolding across `<strong>bo</strong><em>ld</em>` left the DOM untouched.
 */
const stripInside = (marker: Element, matches: FormatMatcher): void => {
  [...marker.querySelectorAll([...INLINE_TAGS].join(","))].filter((element) => isFormatting(element) && matches(formatOf(element))).forEach(unwrapElement);
};

/** Put `formats` back around the element's contents, innermost first. */
const rewrapContents = (element: Element, formats: InlineFormat[]): void => {
  formats.forEach((format) => {
    const wrapper = element.ownerDocument.createElement(format.tag);
    if (format.className) wrapper.setAttribute("class", format.className);
    while (element.firstChild) wrapper.appendChild(element.firstChild);
    element.appendChild(wrapper);
  });
};

/**
 * Take the selection out of every format `matches` answers to, keeping the ones it does not.
 *
 * The marker is scaffolding: it gives the run an identity to lift and split around, and is
 * replaced by its own contents at the end.
 */
const removeFormat = (selection: Selection, range: Range, root: HTMLElement, matches: FormatMatcher): void => {
  const from = characterOffset(root, range.startContainer, range.startOffset);
  const to = characterOffset(root, range.endContainer, range.endOffset);
  const marker = wrapRange(range, CLEAR_MARKER);
  stripInside(marker, matches);
  const passed = liftPast(marker, root);
  rewrapContents(
    marker,
    passed.filter((format) => !matches(format)),
  );
  marker.replaceWith(...marker.childNodes);
  tidyEditable(root);
  selectCharacters(selection, root, from, to);
};

/** Replace the selection with its own plain text, dropping every wrapper around and inside it. */
export const clearFormat = (selection: Selection | null): boolean => {
  const found = formattableSelection(selection);
  if (!found || !selection) return false;
  removeFormat(selection, found.range, found.root, () => true);
  return true;
};
