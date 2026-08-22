import type { BeatHtmlFragment } from "mulmocast/browser";

/**
 * Loading and driving the runtimes a set of fragments asks for. Shared by the gallery and
 * the editor, because both are hosts and a host's job is the same in either.
 *
 * Nothing here is Vue-specific — it takes a container element and a list of fragments.
 */

type ChartInstance = { destroy: () => void };
type ChartCtor = new (context: CanvasRenderingContext2D, config: unknown) => ChartInstance;
type MermaidApi = { initialize: (options: object) => void; init: (a: undefined, nodes: ArrayLike<Element>) => void };

/** Load a CDN script once. Resolves immediately if the tag is already there. */
export const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(el);
  });

export const requiredRuntimes = (fragments: readonly (BeatHtmlFragment | undefined)[]): string[] => [...new Set(fragments.flatMap((f) => f?.requires ?? []))];

export const requiredChartPlugins = (fragments: readonly (BeatHtmlFragment | undefined)[]): string[] => [
  ...new Set(fragments.flatMap((f) => f?.chartPlugins ?? [])),
];

export const collectedCss = (fragments: readonly (BeatHtmlFragment | undefined)[]): string =>
  fragments
    .map((f) => f?.css ?? "")
    .filter(Boolean)
    .join("\n");

/**
 * Draw every chart and diagram inside `container`.
 *
 * `charts` carries the instances from the previous call so they can be destroyed: Chart.js
 * refuses a canvas that still has one, which is what a re-render hands it.
 */
export const driveRuntimes = async (
  container: HTMLElement,
  fragments: readonly (BeatHtmlFragment | undefined)[],
  charts: ChartInstance[],
): Promise<ChartInstance[]> => {
  const requires = requiredRuntimes(fragments);
  charts.forEach((chart) => chart.destroy());
  const next: ChartInstance[] = [];

  if (requires.includes("chart")) {
    await loadScript("https://cdn.jsdelivr.net/npm/chart.js");
    // Plugins register onto Chart, so they load after it and before anything draws.
    for (const cdn of requiredChartPlugins(fragments)) await loadScript(cdn);
    const Chart = (window as unknown as { Chart?: ChartCtor }).Chart;
    container.querySelectorAll<HTMLCanvasElement>("canvas[data-mulmo-chart]").forEach((canvas) => {
      const config = canvas.dataset.mulmoChart;
      const context = canvas.getContext("2d");
      if (!Chart || !config || !context) return;
      next.push(new Chart(context, JSON.parse(config)));
    });
  }

  if (requires.includes("mermaid")) {
    await loadScript("https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js");
    const mermaid = (window as unknown as { mermaid?: MermaidApi }).mermaid;
    mermaid?.initialize({ startOnLoad: false });
    // mermaid rewrites the element it renders into, so a re-render has to start from the
    // markup again — the caller replaces innerHTML before calling this.
    mermaid?.init(undefined, container.querySelectorAll(".mermaid"));
  }

  return next;
};
