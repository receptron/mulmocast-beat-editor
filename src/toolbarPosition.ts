/** Where a floating toolbar goes for a given selection, in viewport coordinates. */

/** Only the parts of a DOMRect this needs, so a test does not have to build one. */
export type Rect = { left: number; top: number; right: number; bottom: number; width: number };

export type Viewport = { width: number; height: number };

export type ToolbarBox = { width: number; height: number };

export type Placement = { x: number; y: number };

const GAP_PX = 6;

/**
 * Above the selection by default, below it when there is no room above.
 *
 * The iframe version added the frame's own rect here; rendering in the host page means the
 * selection rect is already in the coordinates a `fixed` element uses. What remains is
 * keeping the toolbar on screen: a selection at the top of the page has nothing above it,
 * and one at either edge would otherwise push the toolbar out of the viewport.
 */
export const placeToolbar = (selection: Rect, toolbar: ToolbarBox, viewport: Viewport): Placement => {
  const above = selection.top - toolbar.height - GAP_PX;
  const below = selection.bottom + GAP_PX;
  const y = above >= 0 ? above : Math.min(below, Math.max(0, viewport.height - toolbar.height));
  const centred = selection.left + selection.width / 2 - toolbar.width / 2;
  const x = Math.min(Math.max(0, centred), Math.max(0, viewport.width - toolbar.width));
  return { x, y };
};
