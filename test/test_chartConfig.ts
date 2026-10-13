import test from "node:test";
import assert from "node:assert";

import { chartConfigFillingBox } from "../src/chartConfig";

const FILL = { responsive: true, maintainAspectRatio: false };

test("chartConfigFillingBox: a config without options gets the fill options", () => {
  assert.deepStrictEqual(chartConfigFillingBox({ type: "bar", data: { labels: ["a"] } }), { type: "bar", data: { labels: ["a"] }, options: FILL });
});

test("chartConfigFillingBox: the author's options are kept, and the two sizing options win", () => {
  const config = { type: "line", options: { plugins: { legend: { display: false } }, maintainAspectRatio: true, responsive: false } };
  assert.deepStrictEqual(chartConfigFillingBox(config), { type: "line", options: { plugins: { legend: { display: false } }, ...FILL } });
});

test("chartConfigFillingBox: the input is not mutated", () => {
  const config = { type: "bar", options: { scales: {} } };
  chartConfigFillingBox(config);
  assert.deepStrictEqual(config, { type: "bar", options: { scales: {} } });
});

test("chartConfigFillingBox: options that are not an object are replaced", () => {
  [null, "x", 3, ["a"]].forEach((options) => {
    assert.deepStrictEqual(chartConfigFillingBox({ type: "bar", options }), { type: "bar", options: FILL }, JSON.stringify(options));
  });
});

test("chartConfigFillingBox: a config that is not an object is handed through for Chart.js to refuse", () => {
  [null, "bar", 3, [1, 2]].forEach((config) => {
    assert.deepStrictEqual(chartConfigFillingBox(config), config, JSON.stringify(config));
  });
});
