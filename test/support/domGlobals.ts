import { JSDOM } from "jsdom";

/**
 * This module MUST be evaluated before anything that loads Vue, which is why it is a module of
 * its own rather than a block at the top of the harness — ES imports are hoisted, so a statement
 * cannot run before a sibling `import`.
 *
 * Vue's CommonJS build captures the document once, at load:
 *
 *     const doc = typeof document !== "undefined" ? document : null;
 *
 * and `@vitejs/plugin-vue` pulls that build in. Import the plugin first and every later mount
 * dies on `Cannot read properties of null (reading 'createElement')`, with a live `document`
 * sitting in scope the whole time. It survived a warm `node_modules` and only failed on a clean
 * install, so the ordering is load-bearing rather than incidental.
 */
export const dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true });

const scoped: Record<string, unknown> = dom.window;
const GLOBALS = [
  "window",
  "document",
  "HTMLElement",
  "SVGElement",
  "Element",
  "Node",
  "Event",
  "CustomEvent",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
];
GLOBALS.forEach((name) => {
  Object.defineProperty(globalThis, name, { value: name === "window" ? dom.window : scoped[name], configurable: true, writable: true });
});
