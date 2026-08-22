import test from "node:test";
import assert from "node:assert";
import type { BeatHtmlFragment } from "mulmocast/browser";

import { driveRuntimes, loadScript, resetLoadedScripts, requiredRuntimes, requiredChartPlugins, collectedCss } from "../src/beatRuntime";

/**
 * A fake DOM, because the two things worth pinning here are both about timing: a keystroke
 * starts a redraw while the previous one is still waiting on a CDN, and two redraws waiting
 * on the same CDN must not both draw. Neither is observable without controlling when a
 * script finishes loading.
 *
 * The fake Chart refuses a context that already has an instance, which is what the real
 * Chart.js does — so a double-bind is a thrown error here rather than a silent pass.
 */

type FakeScript = { src: string; onload: (() => void) | null; onerror: (() => void) | null; remove: () => void };

const scripts: FakeScript[] = [];
const bound = new Set<unknown>();
const built: { config: unknown; alive: boolean }[] = [];

class FakeChart {
  private readonly context: unknown;
  private readonly record: { config: unknown; alive: boolean };
  constructor(context: unknown, config: unknown) {
    if (bound.has(context)) throw new Error("Canvas is already in use by another Chart instance");
    bound.add(context);
    this.context = context;
    this.record = { config, alive: true };
    built.push(this.record);
  }
  destroy() {
    bound.delete(this.context);
    this.record.alive = false;
  }
}

const define = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

const installFakeDom = () => {
  scripts.length = 0;
  built.length = 0;
  bound.clear();
  resetLoadedScripts();
  define("document", {
    querySelector: (selector: string) => scripts.find((s) => selector === `script[src="${s.src}"]`) ?? null,
    createElement: (): FakeScript => {
      const el: FakeScript = {
        src: "",
        onload: null,
        onerror: null,
        remove: () => {
          const at = scripts.indexOf(el);
          if (at >= 0) scripts.splice(at, 1);
        },
      };
      return el;
    },
    head: { appendChild: (el: FakeScript) => scripts.push(el) },
  });
  // The CDN scripts install these on the global object; beatRuntime reads them there.
  define("Chart", FakeChart);
  define("mermaid", undefined);
};

const finishLoads = () => scripts.forEach((s) => s.onload?.());

// A container holding `count` chart canvases. Each canvas is its own object, so binding one
// twice is detectable.
const fakeHost = (count: number, label: string) => {
  const canvases = Array.from({ length: count }, (_, i) => ({
    dataset: { mulmoChart: JSON.stringify({ type: "bar", label: `${label}-${i}` }) },
    getContext: () => ({ canvas: `${label}-${i}` }),
  }));
  return { querySelectorAll: (selector: string) => (selector.startsWith("canvas") ? canvases : []) };
};

const chartFragment: BeatHtmlFragment = { html: "", requires: ["chart"] };
const mermaidFragment: BeatHtmlFragment = { html: "", requires: ["mermaid"] };

// ─── loadScript ───

test("loadScript: concurrent calls for one url share a single load", async () => {
  installFakeDom();
  let resolvedA = false;
  let resolvedB = false;
  const a = loadScript("https://cdn/x.js").then(() => (resolvedA = true));
  const b = loadScript("https://cdn/x.js").then(() => (resolvedB = true));

  assert.strictEqual(scripts.length, 1, "one tag, not two");
  await Promise.resolve();
  assert.strictEqual(resolvedA || resolvedB, false, "neither resolves before the script loads");

  finishLoads();
  await Promise.all([a, b]);
  assert.ok(resolvedA && resolvedB, "both callers resolve from the one load");
});

test("loadScript: a failed load is not cached, so a later redraw retries", async () => {
  installFakeDom();
  const failed = loadScript("https://cdn/bad.js");
  const firstTag = scripts[0];
  firstTag.onerror?.();
  await assert.rejects(failed, /failed to load/);
  assert.strictEqual(scripts.length, 0, "the failed tag is gone, so it cannot answer for a load that never happened");

  const retried = loadScript("https://cdn/bad.js");
  assert.strictEqual(scripts.length, 1);
  assert.notStrictEqual(scripts[0], firstTag, "the retry really loads again");
  finishLoads();
  await retried;
});

// ─── driveRuntimes: overlapping redraws ───

test("driveRuntimes: two redraws waiting on the same script, only the last draws", async () => {
  installFakeDom();
  const host = fakeHost(1, "canvas");

  const first = driveRuntimes(host, [chartFragment]);
  const second = driveRuntimes(host, [chartFragment]);
  finishLoads();
  await Promise.all([first, second]);

  // Without a render token both resume and the second construction throws "already in use".
  assert.strictEqual(built.length, 1, "exactly one chart was built");
  assert.strictEqual(built.filter((c) => c.alive).length, 1, "and it is the live one");
  assert.strictEqual(bound.size, 1, "one canvas bound once");
});

test("driveRuntimes: a redraw destroys what the previous one drew", async () => {
  installFakeDom();
  const host = fakeHost(2, "canvas");

  await (async () => {
    const run = driveRuntimes(host, [chartFragment]);
    finishLoads();
    await run;
  })();
  assert.strictEqual(built.filter((c) => c.alive).length, 2);

  await driveRuntimes(host, [chartFragment]);
  assert.strictEqual(built.length, 4, "the second redraw built its own");
  assert.strictEqual(built.filter((c) => c.alive).length, 2, "and only its own are alive");
  assert.deepStrictEqual(
    built.map((c) => c.alive),
    [false, false, true, true],
    "the ones destroyed are the first redraw's",
  );
});

// The counter is per container: a second host on the same page must not cancel the first.
test("driveRuntimes: two containers do not supersede each other", async () => {
  installFakeDom();
  const left = fakeHost(1, "left");
  const right = fakeHost(1, "right");

  const a = driveRuntimes(left, [chartFragment]);
  const b = driveRuntimes(right, [chartFragment]);
  finishLoads();
  await Promise.all([a, b]);

  assert.strictEqual(built.filter((c) => c.alive).length, 2, "both containers drew");
});

// ─── the fragment collectors ───

test("requiredRuntimes / requiredChartPlugins / collectedCss: deduped, undefined skipped", () => {
  const fragments: (BeatHtmlFragment | undefined)[] = [
    { html: "", requires: ["chart"], chartPlugins: ["https://cdn/sankey.js"], css: ".a{}" },
    undefined,
    { html: "", requires: ["chart", "mermaid"], chartPlugins: ["https://cdn/sankey.js"] },
    { html: "", css: ".b{}" },
  ];
  assert.deepStrictEqual(requiredRuntimes(fragments), ["chart", "mermaid"]);
  assert.deepStrictEqual(requiredChartPlugins(fragments), ["https://cdn/sankey.js"]);
  assert.strictEqual(collectedCss(fragments), ".a{}\n.b{}");
});

// ─── mermaid ───

// Typing a diagram means feeding mermaid a parse error on almost every keystroke. It rejects
// on one, and an unhandled rejection per keystroke is not an acceptable editing experience.
test("driveRuntimes: a diagram mermaid cannot parse does not reject", async () => {
  installFakeDom();
  const seen: unknown[] = [];
  define("mermaid", {
    initialize: () => {},
    init: (_: undefined, nodes: ArrayLike<unknown>) => {
      seen.push(nodes);
      return Promise.reject(new Error("Parse error on line 1"));
    },
  });
  const host = { querySelectorAll: () => [{}] };

  const run = driveRuntimes(host, [mermaidFragment]);
  finishLoads();
  await run; // must resolve, not reject
  assert.strictEqual(seen.length, 1, "mermaid was still asked to draw");
});
