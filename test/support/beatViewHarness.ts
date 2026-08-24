// Must come first: it installs the DOM globals before anything can load Vue. See domGlobals.ts.
import { vueCanRender } from "./vueCanary";
import { dom, compiled, type EditorName } from "./editorHarness";
import type { EditableBeat } from "../../src/beatHelpers";

/**
 * Mount one `BeatView` and drive it the way a person would.
 *
 * Reuses the bundle and jsdom window the editor harness already builds — a second `vite` build
 * per run buys nothing, and a second jsdom would give Vue a document it did not capture at load.
 *
 * This used to carry a blind spot around `ref="host"`, reported by Vue as "Missing ref owner
 * context. ref cannot be used on hoisted vnodes". The cause was the harness bundling its own
 * copy of Vue: the components ran on one reactivity system and the test's `import("vue")`
 * created the render effect on another. Externalising vue in `editorHarness.ts` fixed it — the
 * warning is gone and a ref written by a DOM listener now re-renders, which is what let the
 * formatting toolbar be tested at all.
 *
 * What jsdom still cannot show is DRAWING: chart.js and mermaid need a real 2d context, so a
 * chart beat renders its `<canvas>` and nothing is painted into it. Assert structure here and
 * measure the picture in a browser.
 */
export type MountedBeat = {
  host: HTMLElement;
  emitted: unknown[];
  unmount: () => void;
};

const mountPointIn = (): HTMLElement => {
  const element = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(element);
  return element;
};

/** Mount one compiled component with `props`, and hand back the point it was mounted at. */
const mount = async (name: EditorName, props: () => Record<string, unknown>): Promise<{ mountPoint: HTMLElement; unmount: () => void }> => {
  await vueCanRender;
  const { createApp, h } = await import("vue");
  const components = await compiled;
  const mountPoint = mountPointIn();
  const app = createApp({ render: () => h(components[name], props()) });
  app.mount(mountPoint);
  return {
    mountPoint,
    unmount: () => {
      app.unmount();
      mountPoint.remove();
    },
  };
};

export const mountBeatView = async (beat: EditableBeat, options: { editable: boolean }): Promise<MountedBeat> => {
  const emitted: unknown[] = [];
  const { mountPoint, unmount } = await mount("BeatView", () => ({
    beat,
    idPrefix: "probe",
    editable: options.editable,
    onUpdate: (next: unknown) => emitted.push(next),
  }));
  const host = mountPoint.querySelector<HTMLElement>(".beat-fragment");
  if (!host) throw new Error("BeatView rendered no fragment — the beat did not render at all");
  return { host, emitted, unmount };
};

const at = (view: MountedBeat, path: string): HTMLElement => {
  const element = view.host.querySelector<HTMLElement>(`[data-mulmo-path="${path}"]`);
  if (!element) throw new Error(`no element carries data-mulmo-path="${path}"`);
  return element;
};

/** Click the element at `path`, the way a pointer would — the handler is delegated on the host. */
export const clickPath = (view: MountedBeat, path: string): void => {
  at(view, path).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
};

/**
 * Set what the element holds, the way the browser's editing engine would have left it.
 *
 * NOT typing: jsdom has no contenteditable engine, so nothing here exercises the caret, an
 * `input` event, or a formatting command. What a real click-then-type does is verified by
 * driving the built app with a browser instead — see the PR. Anything that depends on the
 * caret existing is outside what these tests can see.
 */
export const setEditedHtml = (view: MountedBeat, path: string, html: string): void => {
  at(view, path).innerHTML = html;
};

/** Blur whatever is being edited, which is where a commit happens. */
export const blurActive = (view: MountedBeat): void => {
  const editing = view.host.querySelector<HTMLElement>('[contenteditable="true"]');
  editing?.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
};

/** Press a key at `path` while an IME conversion is running, as a candidate confirmation does. */
export const pressWhileComposing = (view: MountedBeat, path: string, key: string): void => {
  const element = at(view, path);
  element.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, isComposing: true }));
};

/** Focus the element at `path` and press a key on it, the way a keyboard user reaches it. */
export const pressOn = (view: MountedBeat, path: string, key: string): void => {
  const element = at(view, path);
  element.focus();
  if (dom.window.document.activeElement !== element) throw new Error(`data-mulmo-path="${path}" cannot take focus, so no keyboard user can reach it`);
  element.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true }));
};

/** The attributes that decide whether a marker is reachable without a mouse. */
export const reachability = (view: MountedBeat, path: string): Record<string, string | null> => {
  const element = view.host.querySelector<HTMLElement>(`[data-mulmo-path="${path}"]`);
  if (!element) throw new Error(`no element carries data-mulmo-path="${path}"`);
  return { tabindex: element.getAttribute("tabindex"), role: element.getAttribute("role"), label: element.getAttribute("aria-label") };
};

/**
 * Add a marker the renderer never emitted, standing in for one that reached the DOM some other
 * way. What a commit may write is decided by what was rendered, not by what the DOM now says.
 */
export const graftMarker = (view: MountedBeat, path: string): void => {
  const element = dom.window.document.createElement("p");
  element.setAttribute("data-mulmo-path", path);
  element.textContent = "grafted";
  view.host.appendChild(element);
};

/**
 * Blur an element that is already editable, without going through a click.
 *
 * Stands in for the caret having been placed while the path was still offered and the beat
 * having changed underneath before the blur — the only way a commit sees a path the current
 * render does not offer.
 */
export const blurAsIfEditing = (view: MountedBeat, path: string, html: string): void => {
  const element = at(view, path);
  element.setAttribute("contenteditable", "true");
  element.innerHTML = html;
  element.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
};

/** Mount the whole list editor, to see a beats array the way a host would hand one over. */
export const mountBeatList = async (beats: EditableBeat[]): Promise<MountedBeat> => {
  const emitted: unknown[] = [];
  const { mountPoint, unmount } = await mount("BeatListEditor", () => ({ beats, "onUpdate:beats": (next: unknown) => emitted.push(next) }));
  return { host: mountPoint, emitted, unmount };
};

/** Select the whole text of the marker at `path`, the way a double-click would. */
export const selectWithin = (view: MountedBeat, path: string): void => {
  const element = at(view, path);
  const selection = dom.window.getSelection();
  if (!selection) throw new Error("jsdom gave no Selection");
  const range = dom.window.document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  dom.window.document.dispatchEvent(new dom.window.Event("selectionchange"));
};

/** Let Vue flush. A ref set by a DOM listener renders on a microtask, not synchronously. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The formatting toolbar belonging to THIS mount, if it is showing. */
export const toolbarOf = (view: MountedBeat): Element | null => view.host.parentElement?.querySelector('[role="toolbar"]') ?? null;

export type ReactiveBeat = MountedBeat & { replaceBeat: (next: EditableBeat) => void };

const isBeat = (value: unknown): value is EditableBeat => typeof value === "object" && value !== null && !Array.isArray(value);

/** Mount a BeatView whose `beat` prop can be changed afterwards, the way a host would. */
/**
 * `hostApplies` makes the update land synchronously, the way `BeatListEditor` does it — the
 * emit handler replaces the beat there and then, so Vue's flush is queued inside the emit.
 * Tests that want to control the replacement themselves leave it off and call `replaceBeat`.
 */
export const mountBeatViewReactive = async (beat: EditableBeat, options: { hostApplies?: boolean } = {}): Promise<ReactiveBeat> => {
  const { ref } = await import("vue");
  const emitted: unknown[] = [];
  const current = ref<EditableBeat>(beat);
  const receive = (next: unknown) => {
    emitted.push(next);
    if (options.hostApplies && isBeat(next)) current.value = next;
  };
  const props = () => ({ beat: current.value, idPrefix: "probe", editable: true, onUpdate: receive });
  const { mountPoint, unmount } = await mount("BeatView", props);
  const host = mountPoint.querySelector<HTMLElement>(".beat-fragment");
  if (!host) throw new Error("BeatView rendered no fragment");
  const replaceBeat = (next: EditableBeat) => {
    current.value = next;
  };
  return { host, emitted, unmount, replaceBeat };
};

/** The toolbar's buttons, in order. */
export const toolbarButtons = (view: MountedBeat): HTMLElement[] => [
  ...(view.host.parentElement?.querySelectorAll<HTMLElement>('[role="toolbar"] button') ?? []),
];

/**
 * Move focus from the edited element to `next`, the way Tab does.
 *
 * jsdom COLLAPSES the selection when focus moves to a button; Chromium keeps it, which is the
 * only reason a floating toolbar is usable at all — measured, the whole keyboard flow works in
 * a browser. The range is put back here so the mounted tests exercise the browser's behaviour
 * rather than jsdom's.
 */
export const tabTo = (view: MountedBeat, next: HTMLElement): void => {
  const from = view.host.querySelector<HTMLElement>('[contenteditable="true"]');
  const selection = dom.window.getSelection();
  const held = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
  next.focus();
  if (held && selection) {
    selection.removeAllRanges();
    selection.addRange(held);
  }
  from?.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget: next }));
};

/** Move focus from the edited element to another marker, the way clicking a sibling does. */
export const focusOutTo = (view: MountedBeat, path: string): void => {
  const from = view.host.querySelector<HTMLElement>('[contenteditable="true"]');
  from?.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget: at(view, path) }));
};

/** Focus something outside this beat that merely claims `role="toolbar"`. */
export const focusOutToForeignToolbar = (view: MountedBeat): void => {
  const from = view.host.querySelector<HTMLElement>('[contenteditable="true"]');
  const foreign = dom.window.document.createElement("div");
  foreign.setAttribute("role", "toolbar");
  const button = dom.window.document.createElement("button");
  foreign.appendChild(button);
  dom.window.document.body.appendChild(foreign);
  from?.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget: button }));
  foreign.remove();
};

/** The bounce a toolbar action causes: focus leaves the button back to the text being edited. */
export const bounceFocusBackTo = (view: MountedBeat, path: string): void => {
  const button = view.host.parentElement?.querySelector<HTMLElement>('[role="toolbar"] button');
  button?.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget: at(view, path) }));
};

/** Blur the element being edited with nothing receiving focus, as clicking the page does. */
export const blurToNowhere = (view: MountedBeat): void => {
  const editing = view.host.querySelector<HTMLElement>('[contenteditable="true"]') ?? view.host.querySelector<HTMLElement>("[data-mulmo-path]");
  editing?.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
};

/** Press the pointer down on a marker, which is what carries the intent before a commit. */
export const pressDownOn = (view: MountedBeat, path: string): void => {
  at(view, path).dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
};

/** Press a non-primary button on a marker, as a right-click does. */
export const rightPressOn = (view: MountedBeat, path: string): void => {
  at(view, path).dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 2 }));
};

const itemAt = (view: MountedBeat, path: string): HTMLElement => {
  const element = view.host.querySelector<HTMLElement>(`[data-mulmo-item-path="${path}"]`);
  if (!element) throw new Error(`no element carries data-mulmo-item-path="${path}"`);
  return element;
};

/** The item paths the render put on screen, in document order. */
export const itemPaths = (view: MountedBeat): string[] =>
  [...view.host.querySelectorAll("[data-mulmo-item-path]")].map((element) => element.getAttribute("data-mulmo-item-path") ?? "");

/**
 * Drag the item at `fromPath` onto the one at `toPath`.
 *
 * NOT a real drag: jsdom implements neither `DragEvent` nor `DataTransfer`, so these are plain
 * bubbling events and nothing here exercises `setData`, `effectAllowed`, or `dropEffect` — the
 * three lines that decide whether Firefox starts the drag at all. Those are checked by dragging
 * in a real browser; see the PR. What this does cover is the targeting, the permit list, the
 * emitted beat, and that a rejected drop stays rejected.
 */
export const dragItemOnto = (view: MountedBeat, fromPath: string, toPath: string): void => {
  itemAt(view, fromPath).dispatchEvent(new dom.window.Event("dragstart", { bubbles: true }));
  const target = itemAt(view, toPath);
  target.dispatchEvent(new dom.window.Event("dragover", { bubbles: true, cancelable: true }));
  target.dispatchEvent(new dom.window.Event("drop", { bubbles: true, cancelable: true }));
};

/** Start a drag and let go of it without dropping, the way Escape or a drop outside would. */
export const dragItemAndAbandon = (view: MountedBeat, fromPath: string): void => {
  itemAt(view, fromPath).dispatchEvent(new dom.window.Event("dragstart", { bubbles: true }));
  itemAt(view, fromPath).dispatchEvent(new dom.window.Event("dragend", { bubbles: true }));
};

/** Whether `dragover` was accepted — the only signal that a drop would be allowed here. */
export const dragOverAccepted = (view: MountedBeat, fromPath: string, toPath: string): boolean => {
  const source = itemAt(view, fromPath);
  source.dispatchEvent(new dom.window.Event("dragstart", { bubbles: true }));
  const event = new dom.window.Event("dragover", { bubbles: true, cancelable: true });
  itemAt(view, toPath).dispatchEvent(event);
  // Balanced: without this the drag stays latched on the component and the next verb inherits it.
  source.dispatchEvent(new dom.window.Event("dragend", { bubbles: true }));
  return event.defaultPrevented;
};

/** Drop on an item with no drag in flight — what a stray event, or one from elsewhere, looks like. */
export const dropOn = (view: MountedBeat, path: string): void => {
  itemAt(view, path).dispatchEvent(new dom.window.Event("drop", { bubbles: true, cancelable: true }));
};

/** An item marker the render never emitted, so its path is valid data but was not offered. */
export const graftItemMarker = (view: MountedBeat, path: string): HTMLElement => {
  const element = dom.window.document.createElement("div");
  element.setAttribute("data-mulmo-item-path", path);
  element.textContent = "grafted";
  view.host.appendChild(element);
  return element;
};

/**
 * Dispatch a dragstart from `element` and answer whether the component took it as an item drag.
 *
 * `overPath` must name a DIFFERENT item from the one the drag would resolve to: a drop onto the
 * source's own index is refused whatever the source was, so hovering it cannot tell "the drag was
 * refused" apart from "the drag was accepted and this target is invalid".
 */
export const dragStartFrom = (view: MountedBeat, element: Element, overPath: string): boolean => {
  const event = new dom.window.Event("dragstart", { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  // A cancelled dragstart is the component refusing to carry anything.
  if (event.defaultPrevented) return false;
  // Otherwise the only observable the drag left is whether a dragover is now honoured.
  const over = new dom.window.Event("dragover", { bubbles: true, cancelable: true });
  itemAt(view, overPath).dispatchEvent(over);
  element.dispatchEvent(new dom.window.Event("dragend", { bubbles: true }));
  return over.defaultPrevented;
};

/** Put a child inside a marked item — deck renders `<img>` and `<a>` in cards this way. */
export const childOfItem = (view: MountedBeat, path: string, tag: string): HTMLElement => {
  const child = dom.window.document.createElement(tag);
  itemAt(view, path).appendChild(child);
  return child;
};

/** Leave a non-collapsed selection in the document, the way dragging across words does. */
export const selectTextIn = (view: MountedBeat, path: string): void => {
  const element = itemAt(view, path);
  const range = dom.window.document.createRange();
  range.selectNodeContents(element);
  const selection = dom.window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

export const clearSelection = (): void => {
  dom.window.getSelection()?.removeAllRanges();
};

/**
 * Give the fragment a layout for as long as the returned restore is not called.
 *
 * jsdom reports every rect as zero, which makes the whole animation a no-op that cannot be told
 * apart from one that never ran. Patched on the PROTOTYPE rather than per element: `v-html`
 * replaces the whole subtree on the render the FLIP is measured across, so the elements it
 * measures do not exist yet when a test could reach them.
 */
const rectAt = (left: number, top: number): DOMRect => ({ top, left, right: left, bottom: top, width: 0, height: 0, x: left, y: top, toJSON: () => ({}) });

/** The row a marked item occupies, or null for anything that is not one. */
const rowOf = (element: Element): number | null => {
  const path = element.getAttribute("data-mulmo-item-path");
  if (path === null) return null;
  const index = /\[(\d+)\]$/.exec(path)?.[1];
  return index === undefined ? null : Number(index);
};

export const withItemLayout = (gap: number): (() => void) => {
  const proto = dom.window.Element.prototype;
  const original = proto.getBoundingClientRect.bind(proto);
  proto.getBoundingClientRect = function measured(this: Element): DOMRect {
    const row = rowOf(this);
    return row === null ? rectAt(0, 0) : rectAt(0, row * gap);
  };
  return () => {
    proto.getBoundingClientRect = original;
  };
};

/** What `style.transform` was set to on each item, in order, keyed by path. */
export const recordItemTransforms = (view: MountedBeat): Map<string, string[]> => {
  const written = new Map<string, string[]>();
  view.host.querySelectorAll<HTMLElement>("[data-mulmo-item-path]").forEach((element) => {
    const log: string[] = [];
    written.set(element.getAttribute("data-mulmo-item-path") ?? "", log);
    let held = "";
    Object.defineProperty(element.style, "transform", {
      configurable: true,
      get: () => held,
      set: (value: string) => {
        held = value;
        log.push(value);
      },
    });
  });
  return written;
};
