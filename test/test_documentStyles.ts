import "./support/domGlobals";

import test from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";

import { beatDocumentCss, ensureDocumentStyles } from "../src/documentStyles";

const STYLE_ID = "mulmocast-beat-editor-document-styles";

/**
 * Where the sheet lands.
 *
 * A stylesheet on `document.head` does not reach a beat rendered inside a shadow root, and a
 * host that mounts plugins that way is the normal case rather than an exotic one — measured in
 * MulmoTerminal, where a draggable item showed no grab cursor for exactly this reason.
 */

const freshDom = () => new JSDOM("<!doctype html><body><div id='host'></div></body>");

test("the sheet goes on document.head when there is no shadow root", () => {
  const dom = freshDom();
  const { document } = dom.window;
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });
  ensureDocumentStyles(document);
  assert.equal(document.head.querySelectorAll(`#${STYLE_ID}`).length, 1);
});

test("the sheet goes INTO a shadow root when the beat lives in one", () => {
  const dom = freshDom();
  const { document } = dom.window;
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });
  const shadow = document.querySelector("#host")?.attachShadow({ mode: "open" });
  if (!shadow) throw new Error("setup");
  ensureDocumentStyles(shadow);
  assert.equal(shadow.querySelectorAll(`#${STYLE_ID}`).length, 1, "the shadow root must carry its own copy");
  assert.equal(document.head.querySelectorAll(`#${STYLE_ID}`).length, 0, "and the document must not have been used instead");
});

test("each root gets its own copy, and only one", () => {
  const dom = new JSDOM("<!doctype html><body><div id='a'></div><div id='b'></div></body>");
  const { document } = dom.window;
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });
  const a = document.querySelector("#a")?.attachShadow({ mode: "open" });
  const b = document.querySelector("#b")?.attachShadow({ mode: "open" });
  if (!a || !b) throw new Error("setup");
  // Twice each: a page renders many beats, and every one of them calls this.
  [a, b, a, b].forEach((root) => ensureDocumentStyles(root));
  assert.equal(a.querySelectorAll(`#${STYLE_ID}`).length, 1);
  assert.equal(b.querySelectorAll(`#${STYLE_ID}`).length, 1);
});

test("anything that is not a style root falls back to the document", () => {
  const dom = freshDom();
  const { document } = dom.window;
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });
  // `getRootNode()` on a detached element answers the element itself, which has no
  // `getElementById` — the sheet must still land somewhere rather than be dropped.
  ensureDocumentStyles(document.createElement("div"));
  ensureDocumentStyles();
  assert.equal(document.head.querySelectorAll(`#${STYLE_ID}`).length, 1);
});

test("the sheet carries the editing affordances, which are what a shadow root was missing", () => {
  const css = beatDocumentCss();
  assert.match(css, /cursor: grab/);
  assert.match(css, /\[data-mulmo-path\]:hover/);
  assert.match(css, /\.beat-fragment h1/);
});
