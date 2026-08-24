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

/**
 * jsdom has no layout, so a Range cannot measure itself and `getBoundingClientRect` is absent
 * entirely — code that positions anything against a selection throws rather than mispositioning.
 *
 * A zeroed rect lets that code run. It does NOT make the position meaningful: where the toolbar
 * goes is unit-tested against real numbers in `test_toolbarPosition.ts`, and checked in a real
 * browser. A mounted test may only ask whether something is shown, never where.
 */
// Borrowed from an element rather than built with `new DOMRect`, which jsdom types as `any`.
dom.window.Range.prototype.getBoundingClientRect = () => dom.window.document.body.getBoundingClientRect();

/**
 * Document listeners, counted.
 *
 * A component that attaches one to the document and forgets to remove it leaves nothing
 * visible behind — the handler runs against an unmounted instance and writes to a ref nobody
 * renders. Counting is the only way a test can see the leak.
 */
const documentListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
const addToDocument: EventTarget["addEventListener"] = dom.window.document.addEventListener.bind(dom.window.document);
const removeFromDocument: EventTarget["removeEventListener"] = dom.window.document.removeEventListener.bind(dom.window.document);

dom.window.document.addEventListener = (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
): void => {
  if (listener) {
    const forType = documentListeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    forType.add(listener);
    documentListeners.set(type, forType);
  }
  addToDocument(type, listener, options);
};

dom.window.document.removeEventListener = (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | EventListenerOptions,
): void => {
  if (listener) documentListeners.get(type)?.delete(listener);
  removeFromDocument(type, listener, options);
};

const addToWindow: EventTarget["addEventListener"] = dom.window.addEventListener.bind(dom.window);
const removeFromWindow: EventTarget["removeEventListener"] = dom.window.removeEventListener.bind(dom.window);

const countingWindowAdd: EventTarget["addEventListener"] = (type, listener, options) => {
  if (listener) {
    const forType = documentListeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    forType.add(listener);
    documentListeners.set(type, forType);
  }
  addToWindow(type, listener, options);
};

const countingWindowRemove: EventTarget["removeEventListener"] = (type, listener, options) => {
  if (listener) documentListeners.get(type)?.delete(listener);
  removeFromWindow(type, listener, options);
};

dom.window.addEventListener = countingWindowAdd;
dom.window.removeEventListener = countingWindowRemove;

/**
 * How many listeners of `type` are attached to the harness document or window right now.
 *
 * Window as well as document, because a component that watches `resize` and forgets to detach
 * it leaks exactly as invisibly as one that forgets `selectionchange`.
 */
export const documentListenerCount = (type: string): number => documentListeners.get(type)?.size ?? 0;

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
