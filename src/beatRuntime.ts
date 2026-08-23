import type { BeatHtmlFragment } from "mulmocast/browser";

/**
 * Loading and driving the runtimes a set of fragments asks for. Shared by the gallery and
 * the editor, because both are hosts and a host's job is the same in either.
 *
 * Nothing here is Vue-specific — it takes a container element and a list of fragments.
 */

const CHART_CDN = "https://cdn.jsdelivr.net/npm/chart.js";
const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js";

type ChartInstance = { destroy: () => void };
// The context is passed straight through to Chart.js, so this module never looks inside it.
type ChartCtor = new (context: unknown, config: unknown) => ChartInstance;
type MermaidApi = { initialize: (options: object) => void; init: (a: undefined, nodes: ArrayLike<unknown>) => void | Promise<unknown> };

// The CDN scripts install these on window. Nothing more than callability can be checked at
// runtime, so the guards verify that and no more — but they keep the cast out of the code.
const isChartCtor = (value: unknown): value is ChartCtor => typeof value === "function";
const isMermaidApi = (value: unknown): value is MermaidApi => typeof value === "object" && value !== null && "initialize" in value && "init" in value;

/** All this module needs of its container. An HTMLElement satisfies it; so can a test double. */
export type FragmentHost = { querySelectorAll: (selectors: string) => ArrayLike<unknown> };

type ChartCanvas = { dataset: { mulmoChart?: string }; getContext: (id: "2d") => unknown };

const isChartCanvas = (node: unknown): node is ChartCanvas => typeof node === "object" && node !== null && "dataset" in node && "getContext" in node;

// One promise per URL, so concurrent callers wait for the same load rather than racing.
// Resolving on "a tag exists" alone was wrong: the tag exists from the moment it is created,
// so the second caller ran while the script was still downloading and found no window.Chart.
const loading = new Map<string, Promise<void>>();

/** Load a CDN script once. Concurrent calls for the same URL share one load. */
export const loadScript = (src: string): Promise<void> => {
  const started = loading.get(src);
  if (started) return started;
  const load = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    // A failed load is forgotten AND its tag removed, so a later redraw retries. Leaving the
    // tag behind is worse than not retrying: the check above would then find it and resolve
    // without a script, so every redraw after one bad network moment silently draws nothing.
    el.onerror = () => {
      loading.delete(src);
      el.remove();
      reject(new Error(`failed to load ${src}`));
    };
    document.head.appendChild(el);
  });
  loading.set(src, load);
  return load;
};

export const requiredRuntimes = (fragments: readonly (BeatHtmlFragment | undefined)[]): string[] => [...new Set(fragments.flatMap((f) => f?.requires ?? []))];

export const requiredChartPlugins = (fragments: readonly (BeatHtmlFragment | undefined)[]): string[] => [
  ...new Set(fragments.flatMap((f) => f?.chartPlugins ?? [])),
];

export const collectedCss = (fragments: readonly (BeatHtmlFragment | undefined)[]): string =>
  fragments
    .map((f) => f?.css ?? "")
    .filter(Boolean)
    .join("\n");

// Per container: the chart instances currently drawn into it, and a counter identifying the
// redraw that owns it. A keystroke can start a redraw while the previous one is still waiting
// on a CDN; without the counter both would draw, and Chart.js refuses a canvas that already
// has an instance. The counter is per container so two hosts on one page do not cancel each
// other. Keys are elements, so a WeakMap keeps nothing alive.
const state = new WeakMap<FragmentHost, { token: number; charts: ChartInstance[] }>();

/**
 * Draw every chart and diagram inside `container`, replacing whatever the previous call drew.
 * Only the most recent call for a container draws; earlier ones stop at their next await.
 */
export const driveRuntimes = async (container: FragmentHost, fragments: readonly (BeatHtmlFragment | undefined)[]): Promise<void> => {
  const previous = state.get(container);
  const token = (previous?.token ?? 0) + 1;
  previous?.charts.forEach((chart) => chart.destroy());
  state.set(container, { token, charts: [] });
  const superseded = () => state.get(container)?.token !== token;

  const requires = requiredRuntimes(fragments);

  if (requires.includes("chart")) {
    await loadScript(CHART_CDN);
    // Plugins register onto Chart, so they load after it and before anything draws.
    for (const cdn of requiredChartPlugins(fragments)) await loadScript(cdn);
    if (superseded()) return;
    const chart = Reflect.get(globalThis, "Chart");
    const Chart = isChartCtor(chart) ? chart : undefined;
    const charts: ChartInstance[] = [];
    Array.from(container.querySelectorAll("canvas[data-mulmo-chart]")).forEach((canvas) => {
      if (!Chart || !isChartCanvas(canvas)) return;
      const config = canvas.dataset.mulmoChart;
      const context = canvas.getContext("2d");
      if (!config || !context) return;
      charts.push(new Chart(context, JSON.parse(config)));
    });
    state.set(container, { token, charts });
  }

  if (requires.includes("mermaid")) {
    await loadScript(MERMAID_CDN);
    if (superseded()) return;
    const global = Reflect.get(globalThis, "mermaid");
    const mermaid = isMermaidApi(global) ? global : undefined;
    mermaid?.initialize({ startOnLoad: false });
    // mermaid rewrites the element it renders into, so a re-render has to start from the
    // markup again — the caller replaces innerHTML before calling this.
    //
    // It rejects on a diagram it cannot parse, which is every keystroke of typing one. The
    // rejection is swallowed rather than propagated: mermaid draws its own error box into
    // the element, so the beat already shows what is wrong, and letting it through means an
    // unhandled rejection per keystroke.
    await Promise.resolve(mermaid?.init(undefined, container.querySelectorAll(".mermaid"))).catch(() => {});
  }
};

/**
 * Destroy whatever a container drew and forget it.
 *
 * A per-beat host is unmounted when its beat is deleted or the list is torn down, and
 * Chart.js keeps a live instance per canvas until it is told otherwise. Without this the
 * instances outlive their canvases.
 */
export const releaseRuntimes = (container: FragmentHost | null): void => {
  if (!container) return;
  state.get(container)?.charts.forEach((chart) => chart.destroy());
  state.delete(container);
};

/** Test seam: forget which scripts have been loaded. */
export const resetLoadedScripts = (): void => loading.clear();
