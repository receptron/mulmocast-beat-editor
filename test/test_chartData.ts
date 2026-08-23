import test from "node:test";
import assert from "node:assert";
import { readChartForm, writeChartForm, parseNumbers, type ChartForm } from "../src/editors/chartData";

// The property that makes two editors on one beat safe: the form may only change what the
// form shows. Anything else in the config has to come back out untouched.
test("writeChartForm: keeps everything the form does not show", () => {
  const original = {
    type: "bar",
    data: {
      labels: ["A"],
      datasets: [{ label: "s", data: [1], backgroundColor: "#f00", borderWidth: 2 }],
      extraDataKey: { kept: true },
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    topLevelExtra: 7,
  };
  const form: ChartForm = { type: "line", labels: ["A", "B"], datasets: [{ label: "s2", data: [1, 2] }] };
  const written = writeChartForm(original, form);

  assert.deepStrictEqual(written.options, original.options, "options must survive");
  assert.strictEqual(written.topLevelExtra, 7, "a sibling of type/data must survive");
  const data = written.data as Record<string, unknown>;
  assert.deepStrictEqual(data.extraDataKey, { kept: true }, "a sibling of labels/datasets must survive");
  const dataset = (data.datasets as Record<string, unknown>[])[0];
  assert.strictEqual(dataset.backgroundColor, "#f00", "per-dataset styling must survive");
  assert.strictEqual(dataset.borderWidth, 2);
  assert.strictEqual(dataset.label, "s2", "and the form's own values must win");
  assert.deepStrictEqual(dataset.data, [1, 2]);
  assert.strictEqual(written.type, "line");
});

// read → write with no edit is the case a user hits by opening the form and closing it.
test("writeChartForm: a round trip through the form changes nothing", () => {
  const configs: unknown[] = [
    { type: "bar", data: { labels: ["A", "B"], datasets: [{ label: "s", data: [1, 2] }] } },
    { type: "pie", data: { labels: [], datasets: [] }, options: { responsive: true } },
    {
      type: "line",
      data: {
        labels: ["x"],
        datasets: [
          { label: "a", data: [0] },
          { label: "b", data: [3] },
        ],
      },
    },
  ];
  configs.forEach((config) => {
    assert.deepStrictEqual(writeChartForm(config, readChartForm(config)), config, JSON.stringify(config));
  });
});

test("readChartForm: a config it cannot read degrades instead of throwing", () => {
  [undefined, null, 42, "text", {}, { data: "nope" }, { data: { datasets: "nope" } }].forEach((input) => {
    const form = readChartForm(input);
    assert.strictEqual(form.type, "bar", `${JSON.stringify(input)} falls back to bar`);
    assert.deepStrictEqual(form.labels, []);
    assert.deepStrictEqual(form.datasets, []);
  });
});

test("readChartForm: values that are not numbers read as 0 rather than NaN", () => {
  const form = readChartForm({ type: "bar", data: { labels: [1, "b"], datasets: [{ label: 7, data: [1, "x", null] }] } });
  assert.deepStrictEqual(form.labels, ["1", "b"], "labels are coerced to strings");
  assert.deepStrictEqual(form.datasets[0], { label: "", data: [1, 0, 0] }, "a non-string label is dropped, non-numbers become 0");
});

test("parseNumbers: accepts newlines and commas, ignores blanks", () => {
  assert.deepStrictEqual(parseNumbers("1\n2\n3"), [1, 2, 3]);
  assert.deepStrictEqual(parseNumbers("1, 2 ,3"), [1, 2, 3]);
  assert.deepStrictEqual(parseNumbers("1\n\n 2 \n"), [1, 2]);
  assert.deepStrictEqual(parseNumbers(""), []);
  assert.deepStrictEqual(parseNumbers("1\nx\n2"), [1, 0, 2], "a value that is not a number is 0, not NaN");
});
