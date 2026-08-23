<script setup lang="ts">
import { computed } from "vue";
import { beatImage, withImageField, type EditableBeat } from "../beatHelpers";
import { CHART_TYPES, parseNumbers, readChartForm, writeChartForm, type ChartForm } from "./chartData";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

/**
 * The shape a Chart.js config almost always has: a kind, category labels, and series.
 *
 * Everything else — `options`, plugin config, per-dataset colours — is carried through
 * untouched by `writeChartForm`, so this and the JSON editor can be used on the same beat in
 * either order. Growing the form to cover `options` is what the JSON editor is instead of.
 */
const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

const form = computed<ChartForm>(() => readChartForm(beatImage(props.beat).chartData));
const apply = (next: ChartForm) => emit("update", withImageField(props.beat, "chartData", writeChartForm(beatImage(props.beat).chartData, next)));

const setType = (type: string) => apply({ ...form.value, type });
const setLabels = (text: string) => apply({ ...form.value, labels: text.split("\n").filter((line) => line.trim() !== "") });
const setSeriesLabel = (index: number, label: string) =>
  apply({ ...form.value, datasets: form.value.datasets.map((series, i) => (i === index ? { ...series, label } : series)) });
const setSeriesData = (index: number, text: string) =>
  apply({ ...form.value, datasets: form.value.datasets.map((series, i) => (i === index ? { ...series, data: parseNumbers(text) } : series)) });
const addSeries = () => apply({ ...form.value, datasets: [...form.value.datasets, { label: `series ${form.value.datasets.length + 1}`, data: [] }] });
const removeSeries = (index: number) => apply({ ...form.value, datasets: form.value.datasets.filter((_, i) => i !== index) });
</script>

<template>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">chart type</span>
    <select :value="form.type" :class="FIELD_CLASS" @change="setType(inputValue($event))">
      <option v-for="type in CHART_TYPES" :key="type" :value="type">{{ type }}</option>
      <option v-if="!CHART_TYPES.includes(form.type as (typeof CHART_TYPES)[number])" :value="form.type">{{ form.type }} (from JSON)</option>
    </select>
  </label>

  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">labels <span class="font-normal text-stone-400">(one per line)</span></span>
    <textarea :value="form.labels.join('\n')" rows="4" :class="FIELD_CLASS" @input="setLabels(inputValue($event))"></textarea>
  </label>

  <div class="flex flex-col gap-2">
    <span :class="LABEL_TEXT_CLASS">series</span>
    <div v-for="(series, index) in form.datasets" :key="index" class="flex flex-col gap-1 rounded border border-stone-200 bg-stone-50 p-2">
      <div class="flex items-center gap-2">
        <input :value="series.label" placeholder="name" :class="[FIELD_CLASS, 'flex-1']" @input="setSeriesLabel(index, inputValue($event))" />
        <button
          type="button"
          class="rounded border border-stone-300 bg-white px-1.5 text-red-600 hover:bg-red-50"
          title="Remove series"
          @click="removeSeries(index)"
        >
          ✕
        </button>
      </div>
      <textarea
        :value="series.data.join('\n')"
        rows="3"
        placeholder="values, one per line"
        :class="[FIELD_CLASS, 'font-mono']"
        @input="setSeriesData(index, inputValue($event))"
      ></textarea>
      <span v-if="series.data.length !== form.labels.length && form.labels.length > 0" class="text-amber-700">
        {{ series.data.length }} values for {{ form.labels.length }} labels
      </span>
    </div>
    <button type="button" class="self-start rounded border border-stone-300 bg-white px-2 py-1 font-medium hover:bg-stone-100" @click="addSeries">
      + Add series
    </button>
  </div>
</template>
