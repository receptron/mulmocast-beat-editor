// Must come first: it installs the DOM globals before anything can load Vue, and proves Vue can
// still render afterwards. See domGlobals.ts for why the ordering is load-bearing.
import { vueCanRender } from "./vueCanary";
import { dom } from "./domGlobals";
import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Component } from "vue";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = "node_modules/.tmp/editor-harness";

export type EditorName = "Inspector" | "ContentBlockEditor" | "BeatView";
type Editors = Record<EditorName, Component>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isEditors = (value: unknown): value is Editors =>
  isRecord(value) && isRecord(value["Inspector"]) && isRecord(value["ContentBlockEditor"]) && isRecord(value["BeatView"]);

/**
 * The editors are SFCs, so they have to be compiled before they can be mounted. `ssrLoadModule`
 * compiles them for the server and they cannot then be mounted on a client, so this builds them
 * the way the app does — once per run, well under a second.
 */
const editors: Promise<Editors> = (async () => {
  await build({
    configFile: false,
    logLevel: "error",
    root: ROOT,
    plugins: [vue()],
    build: {
      lib: { entry: "test/support/components.ts", formats: ["es"], fileName: "components" },
      outDir: OUT_DIR,
      emptyOutDir: true,
      minify: false,
    },
  });
  // `import()` takes a URL. A Windows absolute path is not one — Node reads the drive letter as a
  // scheme and fails with ERR_UNSUPPORTED_ESM_URL_SCHEME ("Received protocol 'd:'").
  const loaded: unknown = await import(pathToFileURL(path.join(ROOT, OUT_DIR, "components.js")).href);
  if (!isEditors(loaded)) throw new Error(`the harness bundle at ${OUT_DIR} exported no editors`);
  return loaded;
})();

export const compiled = editors;
export { dom };

export type Mounted = { selects: HTMLSelectElement[]; emitted: unknown[]; unmount: () => void };

/** Mount one editor on a fresh element and hand back its selects and the values it emits. */
export const mountEditor = async (name: EditorName, value: unknown): Promise<Mounted> => {
  await vueCanRender;
  const { createApp, h } = await import("vue");
  const component = (await editors)[name];
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const emitted: unknown[] = [];
  const prop = name === "Inspector" ? "slide" : "block";
  const app = createApp({ render: () => h(component, { [prop]: value, onUpdate: (next: unknown) => emitted.push(next) }) });
  app.mount(host);
  return {
    selects: [...host.querySelectorAll("select")],
    emitted,
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
};

export type Choice = {
  emitted: unknown;
  /**
   * True when the handler put the control back to empty itself. That is how a command select —
   * "+ add a block", which acts and then clears — differs from one that holds a value, and it is
   * observed rather than guessed: the parent here never re-renders, so a value select keeps what
   * was set.
   */
  selfCleared: boolean;
};

/** Drive one select to one option and report what the editor emitted and what the control did. */
export const chooseOption = (mounted: Mounted, select: HTMLSelectElement, option: string): Choice => {
  select.value = option;
  select.dispatchEvent(new dom.window.Event("change"));
  return { emitted: mounted.emitted.at(-1), selfCleared: option !== "" && select.value === "" };
};

/** A select's option list, which is what distinguishes an accent picker from a layout picker. */
export const signatureOf = (select: HTMLSelectElement): string => JSON.stringify([...select.options].map((option) => option.value));

/**
 * Locate a select by what it offers and which occurrence it is, rather than by position.
 * Changing a layout rebuilds the form, so an index means something different afterwards —
 * matching on the option list keeps the same control findable across that rebuild.
 */
export const findSelect = (mounted: Mounted, signature: string, occurrence: number): HTMLSelectElement | null => {
  const matching = mounted.selects.filter((select) => signatureOf(select) === signature);
  return matching[occurrence] ?? null;
};
