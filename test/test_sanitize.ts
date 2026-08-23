import test from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";

// DOMPurify needs a window. Installing one before importing the module under test is the
// whole setup; jsdom is already a transitive dependency of the toolchain.
const dom = new JSDOM("");
Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });

const { sanitizeFragment } = await import("../src/sanitize.js");

// A guard that asserts "false" everywhere passes just as well when it matches nothing, so
// both directions are pinned: what must be stripped, and what must survive.

test("sanitizeFragment: strips what a beat can smuggle in", () => {
  const attacks: [string, string][] = [
    ["script tag", "<div>ok</div><script>alert(1)</script>"],
    ["inline handler", '<img src="x" onerror="alert(1)">'],
    ["javascript: url", '<a href="javascript:alert(1)">click</a>'],
    ["svg onload", '<svg onload="alert(1)"></svg>'],
    ["iframe", '<iframe src="https://evil.example"></iframe>'],
    ["form action", '<form action="https://evil.example"><input name="p"></form>'],
  ];
  attacks.forEach(([label, html]) => {
    const clean = sanitizeFragment(html);
    assert.ok(!/<script/i.test(clean), `${label}: no script may survive`);
    assert.ok(!/on\w+\s*=/i.test(clean), `${label}: no event handler may survive`);
    assert.ok(!/javascript:/i.test(clean), `${label}: no javascript: url may survive`);
    assert.ok(!/<iframe/i.test(clean), `${label}: no iframe may survive`);
  });
});

// The runtimes read these after mount. DOMPurify drops unknown data-* by default, so if the
// allowance regresses the charts silently stop drawing — this is what catches that.
test("sanitizeFragment: keeps what the host drives", () => {
  const chart = '<canvas id="c" data-chart-ready="false" data-mulmo-chart=\'{"type":"bar"}\'></canvas>';
  const clean = sanitizeFragment(chart);
  assert.match(clean, /<canvas/, "the canvas must survive");
  assert.match(clean, /data-mulmo-chart/, "the chart config must survive");

  const mermaid = '<div class="mermaid">graph TD; A--&gt;B</div>';
  assert.match(sanitizeFragment(mermaid), /class="mermaid"/, "the mermaid container must survive");

  const video = '<video src="https://example.com/a.mp4" controls playsinline></video>';
  const cleanVideo = sanitizeFragment(video);
  assert.match(cleanVideo, /<video/, "a movie beat must still render");
  assert.match(cleanVideo, /controls/, "its controls must survive");
});

// Ordinary slide markup must come through untouched, or the sanitizer is breaking the app.
test("sanitizeFragment: leaves ordinary markup alone", () => {
  const html = '<div class="p-4"><h1 class="text-2xl">Title</h1><ul><li>a</li></ul><img src="https://example.com/i.png" alt="x"></div>';
  const clean = sanitizeFragment(html);
  ["p-4", "text-2xl", "<h1", "<ul", "<li", "<img", "https://example.com/i.png"].forEach((needle) => {
    assert.ok(clean.includes(needle), `${needle} must survive`);
  });
});
