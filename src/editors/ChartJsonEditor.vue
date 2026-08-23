<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { beatImage, chartDataKey, draftOwnsBeat, serializeChartData, withImageField, UNSERIALIZABLE, type EditableBeat } from "../beatHelpers";
import { FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

/**
 * The whole `chartData`, as text.
 *
 * The textarea's own text is the source of truth while it is being typed: invalid JSON leaves
 * the beat alone and is reported, so the preview keeps the last valid chart rather than
 * blanking on every keystroke.
 *
 * The draft is dropped when the beat under it is no longer the one it was typed into. Object
 * identity cannot detect that — Vue hands props a reactive proxy, so the very object this
 * component emitted returns as a different reference — which is why `draftOwnsBeat` compares
 * content instead.
 */
const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

const draft = ref<string | null>(null);

watch(
  () => chartDataKey(props.beat),
  () => {
    if (draft.value !== null && !draftOwnsBeat(draft.value, props.beat)) draft.value = null;
  },
);

const text = computed({
  get: () => draft.value ?? serializeChartData(beatImage(props.beat).chartData ?? {}, 2) ?? UNSERIALIZABLE,
  set: (value: string) => {
    draft.value = value;
    try {
      emit("update", withImageField(props.beat, "chartData", JSON.parse(value)));
    } catch {
      // Reported below; the beat keeps its last valid chartData.
    }
  },
});

const error = computed(() => {
  if (draft.value === null) return "";
  try {
    JSON.parse(draft.value);
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">chartData <span class="font-normal text-stone-400">(Chart.js config)</span></span>
    <textarea v-model="text" rows="16" :class="[FIELD_CLASS, 'font-mono', error ? 'border-red-400 bg-red-50' : '']"></textarea>
    <span v-if="error" class="text-red-600">{{ error }} — the preview keeps the last valid config</span>
  </label>
</template>
