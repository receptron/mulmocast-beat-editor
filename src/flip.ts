/**
 * The First-Last-Invert-Play animation for a reordered list.
 *
 * The fragment is replaced wholesale by `v-html`, so none of the elements survive a reorder —
 * a transition that keys on node identity has nothing to hold. What does survive is the item
 * path, and the move itself says how the paths were permuted, so an element can be matched to
 * the rectangle its predecessor occupied.
 */

/** Where the item now at `index` sat before a move from `from` to `to`. */
export const indexBeforeMove = (index: number, from: number, to: number): number => {
  if (index === to) return from;
  if (from < to && index >= from && index < to) return index + 1;
  if (to < from && index > to && index <= from) return index - 1;
  return index;
};

const ITEM_PATH = "data-mulmo-item-path";

/** Split `stats[2]` into its array and its index, or null for anything else. */
const splitIndexed = (path: string): { parent: string; index: number } | null => {
  const match = /^(.*?)\[(\d+)\]$/.exec(path);
  return match ? { parent: match[1].replace(/\.$/, ""), index: Number(match[2]) } : null;
};

/** The path this element's item held before the move, or null when the move did not touch it. */
export const pathBeforeMove = (path: string, fromPath: string, toPath: string): string | null => {
  const now = splitIndexed(path);
  const from = splitIndexed(fromPath);
  const to = splitIndexed(toPath);
  if (!now || !from || !to || now.parent !== from.parent || from.parent !== to.parent) return null;
  return `${now.parent}[${indexBeforeMove(now.index, from.index, to.index)}]`;
};

export type ItemRects = ReadonlyMap<string, DOMRect>;

/** Every marked item's rectangle, keyed by its path. */
export const captureItemRects = (root: HTMLElement | null): ItemRects => {
  const rects = new Map<string, DOMRect>();
  root?.querySelectorAll(`[${ITEM_PATH}]`).forEach((element) => {
    const path = element.getAttribute(ITEM_PATH);
    if (path) rects.set(path, element.getBoundingClientRect());
  });
  return rects;
};

const TRANSITION = "transform 180ms ease";

/** Force the pending style writes to be laid out, so the next ones start a new frame. */
const reflow = (root: HTMLElement): number => root.offsetHeight;

/**
 * Put each item back where it was, then let it travel to where it now is.
 *
 * Answers how many items were actually animated, which is what a test can assert: a FLIP that
 * silently matches nothing looks exactly like one that had nothing to do.
 */
type Displacement = { element: HTMLElement; dx: number; dy: number };

/** How far each item has travelled from the rectangle its predecessor held. */
const displacements = (root: HTMLElement, before: ItemRects, fromPath: string, toPath: string): Displacement[] => {
  const moves: Displacement[] = [];
  root.querySelectorAll<HTMLElement>(`[${ITEM_PATH}]`).forEach((element) => {
    const path = element.getAttribute(ITEM_PATH);
    const was = path === null ? null : before.get(pathBeforeMove(path, fromPath, toPath) ?? "");
    if (!was) return;
    const now = element.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (dx !== 0 || dy !== 0) moves.push({ element, dx, dy });
  });
  return moves;
};

export const playItemFlip = (root: HTMLElement | null, before: ItemRects, fromPath: string, toPath: string): number => {
  if (!root || before.size === 0) return 0;
  const moves = displacements(root, before, fromPath, toPath);
  moves.forEach(({ element, dx, dy }) => {
    element.style.transition = "none";
    element.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  // Reading a layout property between the two writes is what makes them two frames rather than
  // one: without it the browser coalesces them and the element simply appears at its new place.
  reflow(root);
  moves.forEach(({ element }) => {
    element.style.transition = TRANSITION;
    element.style.transform = "";
  });
  return moves.length;
};
