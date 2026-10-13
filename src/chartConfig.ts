import { isRecord } from "./beatHelpers";

/**
 * A `data-mulmo-chart` config, set to fill the box its canvas sits in.
 *
 * Deck slides give the canvas a box sized by the slide, and Chart.js' default keeps a 2:1
 * aspect ratio instead, so a chart overflows the slide and is clipped. Deck's own document
 * driver sets the same two options; the author's other options are kept.
 */
export const chartConfigFillingBox = (config: unknown): unknown => {
  if (!isRecord(config)) return config;
  const options = isRecord(config["options"]) ? config["options"] : {};
  return { ...config, options: { ...options, responsive: true, maintainAspectRatio: false } };
};
