import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { beatToHtml } from "mulmocast/browser";

/**
 * The shipped stylesheet has to cover the classes a rendered beat actually carries.
 *
 * Tailwind cannot find them by scanning: they live as strings inside compiled JavaScript
 * under node_modules, which it skips. `scripts/collect_fragment_classes.ts` names them with
 * `@source inline(...)` instead, and this asserts the naming is complete — against real
 * `beatToHtml` output rather than a list someone remembered to update.
 */
const inlined = readFileSync(new URL("../src/fragment-classes.css", import.meta.url), "utf8");
const named = new Set((inlined.match(/@source inline\("([^"]*)"\)/)?.[1] ?? "").split(/\s+/).filter(Boolean));

const BEATS: [string, Record<string, unknown>][] = [
  ["textSlide", { text: "", image: { type: "textSlide", slide: { title: "T", subtitle: "S", bullets: ["a", "b"] } } }],
  ["markdown", { text: "", image: { type: "markdown", markdown: "# H\n\n- a\n" } }],
  ["chart", { text: "", image: { type: "chart", title: "C", chartData: { type: "bar", data: { labels: ["A"], datasets: [{ data: [1] }] } } } }],
  ["mermaid", { text: "", image: { type: "mermaid", title: "D", code: { kind: "text", text: "graph TD; A-->B" } } }],
  ["image", { text: "", image: { type: "image", source: { kind: "url", url: "https://example.com/a.png" } } }],
  ["movie", { text: "", image: { type: "movie", source: { kind: "url", url: "https://example.com/a.mp4" } } }],
  ["slide", { text: "", image: { type: "slide", slide: { layout: "title", title: "T", subtitle: "S" } } }],
  ["html_tailwind", { text: "", image: { type: "html_tailwind", html: '<div class="p-4 text-lg">x</div>' } }],
];

// Classes an author wrote into their own beat are the author's problem, not the package's.
const AUTHORED = new Set(["p-4", "text-lg"]);

// Not utilities, and deliberately not in the stylesheet:
//   chart-container / mermaid-container — hooks a host sizes for its own layout
//   <idPrefix>-slide                     — the scope the slide fragment's own css targets
const NOT_A_UTILITY = (name: string) => /-container$/.test(name) || /^beat-\d+-/.test(name);

test("every class a rendered beat carries is named in fragment-classes.css", () => {
  const missing = new Map<string, string[]>();
  BEATS.forEach(([label, beat]) => {
    const fragment = beatToHtml(beat as never, { idPrefix: "beat-0" });
    assert.ok(fragment, `${label} must render`);
    const used = new Set<string>();
    for (const attr of fragment.html.matchAll(/class="([^"]*)"/g)) {
      attr[1].split(/\s+/).forEach((c) => c && !AUTHORED.has(c) && !NOT_A_UTILITY(c) && used.add(c));
    }
    const absent = [...used].filter((c) => !named.has(c));
    if (absent.length) missing.set(label, absent);
  });
  assert.deepStrictEqual(Object.fromEntries(missing), {}, "run `yarn build:css` — the collector missed classes these beats render with");
});

// The failure this guards against is silent: a beat renders, just unstyled.
test("fragment-classes.css names the arbitrary values Tailwind cannot guess", () => {
  ["text-[60px]", "h-[280px]", "w-[360px]", "-bottom-12", "bg-d-accent", "font-title"].forEach((c) => {
    assert.ok(named.has(c), `${c} must be named — it only exists inside compiled JS`);
  });
});
