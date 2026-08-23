import { isRecord } from "../beatHelpers";

/**
 * The part of a Chart.js config a form can sensibly show: what kind of chart, the category
 * labels, and the series. Everything else — `options`, plugin config, per-dataset styling —
 * is left untouched, which is what lets the form and the JSON editor edit the same beat
 * without one erasing the other.
 */
export type ChartSeries = { label: string; data: number[] };
export type ChartForm = { type: string; labels: string[]; datasets: ChartSeries[] };

/** Chart types the form offers. Anything else stays reachable through the JSON editor. */
export const CHART_TYPES = ["bar", "line", "pie", "doughnut", "radar", "polarArea", "scatter", "bubble"] as const;

const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : String(v ?? ""))) : []);

const asNumbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.map((v) => (typeof v === "number" ? v : Number(v))).map((n) => (Number.isFinite(n) ? n : 0)) : [];

export const readChartForm = (chartData: unknown): ChartForm => {
  const config = isRecord(chartData) ? chartData : {};
  const data = isRecord(config.data) ? config.data : {};
  const datasets = Array.isArray(data.datasets) ? data.datasets : [];
  return {
    type: typeof config.type === "string" ? config.type : "bar",
    labels: asStrings(data.labels),
    datasets: datasets.map((entry) => {
      const dataset = isRecord(entry) ? entry : {};
      return { label: typeof dataset.label === "string" ? dataset.label : "", data: asNumbers(dataset.data) };
    }),
  };
};

/**
 * The form's values written back over the existing config.
 *
 * Everything the form does not know about is carried through: sibling keys of `type` and
 * `data`, sibling keys inside `data`, and every property of a dataset other than `label` and
 * `data`. A dataset the form added has no counterpart to preserve, so it is written as-is.
 */
export const writeChartForm = (chartData: unknown, form: ChartForm): Record<string, unknown> => {
  const config = isRecord(chartData) ? chartData : {};
  const data = isRecord(config.data) ? config.data : {};
  const existing = Array.isArray(data.datasets) ? data.datasets : [];
  return {
    ...config,
    type: form.type,
    data: {
      ...data,
      labels: form.labels,
      datasets: form.datasets.map((series, index) => ({ ...(isRecord(existing[index]) ? existing[index] : {}), ...series })),
    },
  };
};

/** One line per value, which is how a column of numbers reads and how it is typed. */
export const parseNumbers = (text: string): number[] =>
  text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => Number(part))
    .map((n) => (Number.isFinite(n) ? n : 0));
