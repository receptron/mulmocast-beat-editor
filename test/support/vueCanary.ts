// Must come first: it installs the DOM globals before anything here can load Vue.
import { dom } from "./domGlobals";

/**
 * Vue keeps the document it saw at load, so a live `document` global is not proof it can render.
 * Mount a bare div once and turn the failure into a sentence, instead of leaving a future reader
 * with a null dereference deep inside the runtime.
 */
export const vueCanRender: Promise<void> = (async () => {
  const { createApp, h } = await import("vue");
  const host = dom.window.document.createElement("div");
  try {
    createApp({ render: () => h("div") }).mount(host);
  } catch (cause) {
    throw new Error("Vue was loaded before the DOM globals — check that editorHarness.ts imports ./vueCanary first", { cause });
  }
})();
