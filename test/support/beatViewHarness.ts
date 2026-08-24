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

/** Mount a BeatView whose `beat` prop can be changed afterwards, the way a host would. */
export const mountBeatViewReactive = async (beat: EditableBeat): Promise<ReactiveBeat> => {
  const { ref } = await import("vue");
  const emitted: unknown[] = [];
  const current = ref<EditableBeat>(beat);
  const props = () => ({ beat: current.value, idPrefix: "probe", editable: true, onUpdate: (next: unknown) => emitted.push(next) });
  const { mountPoint, unmount } = await mount("BeatView", props);
  const host = mountPoint.querySelector<HTMLElement>(".beat-fragment");
  if (!host) throw new Error("BeatView rendered no fragment");
  const replaceBeat = (next: EditableBeat) => {
    current.value = next;
  };
  return { host, emitted, unmount, replaceBeat };
};
