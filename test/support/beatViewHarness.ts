// Must come first: it installs the DOM globals before anything can load Vue. See domGlobals.ts.
import { vueCanRender } from "./vueCanary";
import { dom, compiled } from "./editorHarness";
import type { EditableBeat } from "../../src/beatHelpers";

/**
 * Mount one `BeatView` and drive it the way a person would.
 *
 * Reuses the bundle and jsdom window the editor harness already builds — a second `vite` build
 * per run buys nothing, and a second jsdom would give Vue a document it did not capture at load.
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

export const mountBeatView = async (beat: EditableBeat, options: { editable: boolean }): Promise<MountedBeat> => {
  await vueCanRender;
  const { createApp, h } = await import("vue");
  const components = await compiled;
  const mountPoint = mountPointIn();
  const emitted: unknown[] = [];
  const props = { beat, idPrefix: "probe", editable: options.editable, onUpdate: (next: unknown) => emitted.push(next) };
  const app = createApp({ render: () => h(components.BeatView, props) });
  app.mount(mountPoint);
  const host = mountPoint.querySelector<HTMLElement>(".beat-fragment");
  if (!host) throw new Error("BeatView rendered no fragment — the beat did not render at all");
  const unmount = () => {
    app.unmount();
    mountPoint.remove();
  };
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

/** Replace what the element holds, standing in for the browser's own contenteditable editing. */
export const typeInto = (view: MountedBeat, path: string, html: string): void => {
  at(view, path).innerHTML = html;
};

/** Blur whatever is being edited, which is where a commit happens. */
export const blurActive = (view: MountedBeat): void => {
  const editing = view.host.querySelector<HTMLElement>('[contenteditable="true"]');
  editing?.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
};
