import { splitItemPath } from "./editorHelpers";

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

/** The path this element's item held before the move, or null when the move did not touch it. */
export const pathBeforeMove = (path: string, fromPath: string, toPath: string): string | null => {
  const now = splitItemPath(path);
  const from = splitItemPath(fromPath);
  const to = splitItemPath(toPath);
  if (!now || !from || !to || now.parent !== from.parent || from.parent !== to.parent) return null;
  return `${now.parent}[${indexBeforeMove(now.index, from.index, to.index)}]`;
};

/**
 * Where each item sat, measured from the host rather than from the viewport.
 *
 * The two measurements straddle a full re-render, and anything that scrolls between them —
 * restoring focus to a marker, a card whose `overflow-auto` resets on rebuild — would otherwise
 * read as displacement and animate items that never moved.
 */
export type ItemRects = ReadonlyMap<string, { left: number; top: number }>;

const relativeTo = (origin: DOMRect, rect: DOMRect) => ({ left: rect.left - origin.left, top: rect.top - origin.top });

/** Every marked item's position, keyed by its path. `within` narrows it to one array. */
export const captureItemRects = (root: HTMLElement | null, within?: string): ItemRects => {
  const rects = new Map<string, { left: number; top: number }>();
  if (!root) return rects;
  const origin = root.getBoundingClientRect();
  root.querySelectorAll(`[${ITEM_PATH}]`).forEach((element) => {
    const path = element.getAttribute(ITEM_PATH);
    if (!path) return;
    if (within !== undefined && splitItemPath(path)?.parent !== within) return;
    rects.set(path, relativeTo(origin, element.getBoundingClientRect()));
  });
  return rects;
};

const TRANSITION = "transform 180ms ease";

/** Force the pending style writes to be laid out, so the next ones start a new frame. */
const reflow = (root: HTMLElement): number => root.offsetHeight;

export type Displacement = { element: HTMLElement; dx: number; dy: number };

/** How far each item has travelled from the position its predecessor held. */
const displacements = (root: HTMLElement, before: ItemRects, fromPath: string, toPath: string): Displacement[] => {
  const origin = root.getBoundingClientRect();
  const moves: Displacement[] = [];
  root.querySelectorAll<HTMLElement>(`[${ITEM_PATH}]`).forEach((element) => {
    const path = element.getAttribute(ITEM_PATH);
    const was = path === null ? undefined : before.get(pathBeforeMove(path, fromPath, toPath) ?? "");
    if (!was) return;
    const now = relativeTo(origin, element.getBoundingClientRect());
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (dx !== 0 || dy !== 0) moves.push({ element, dx, dy });
  });
  return moves;
};

/**
 * Deck's stagger intro animates `transform` on exactly these elements, and an animation's own
 * value outranks inline style for as long as it applies — with `both` that is forever. Suppress
 * it for the duration, and put back whatever the element declared inline.
 */
const withoutStaggerAnimation = (element: HTMLElement): (() => void) => {
  const declared = element.style.animation;
  element.style.animation = "none";
  return () => {
    element.style.animation = declared;
  };
};

const clearWhenSettled = (element: HTMLElement, restoreAnimation: () => void): void => {
  element.addEventListener(
    "transitionend",
    () => {
      element.style.transition = "";
      element.style.transform = "";
      restoreAnimation();
    },
    { once: true },
  );
};

/**
 * Put each item back where it was, then let it travel to where it now is.
 *
 * Answers the displacements it applied, which is what a test can assert: a FLIP that silently
 * matches nothing looks exactly like one that had nothing to do, and the invert step — the whole
 * of FLIP — is otherwise unobservable, since the play clears it in the same synchronous call.
 */
export const playItemFlip = (root: HTMLElement | null, before: ItemRects, fromPath: string, toPath: string): Displacement[] => {
  if (!root || before.size === 0) return [];
  const moves = displacements(root, before, fromPath, toPath);
  const restores = moves.map(({ element, dx, dy }) => {
    const restoreAnimation = withoutStaggerAnimation(element);
    element.style.transition = "none";
    element.style.transform = `translate(${dx}px, ${dy}px)`;
    return restoreAnimation;
  });
  // Reading a layout property between the two writes is what makes them two frames rather than
  // one: without it the browser coalesces them and the element simply appears at its new place.
  reflow(root);
  moves.forEach(({ element }, index) => {
    clearWhenSettled(element, restores[index]);
    element.style.transition = TRANSITION;
    element.style.transform = "";
  });
  return moves;
};
