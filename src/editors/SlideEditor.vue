<script setup lang="ts">
import { computed } from "vue";
import type { SlideLayout } from "@mulmocast/deck";
import { beatImage, withImageField, type EditableBeat } from "../beatHelpers";
import { LAYOUT_TYPES, makeSlide, isSlideLayout } from "../editorHelpers";
import Inspector from "../components/Inspector.vue";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

// A beat is edited as `Record<string, unknown>`, so `image.slide` is whatever the script or a
// half-finished edit left there; one that is not a slide gets the starter below, not a blank pane.
const slide = computed<SlideLayout | undefined>(() => {
  const candidate = beatImage(props.beat).slide;
  return isSlideLayout(candidate) ? candidate : undefined;
});

const replace = (next: SlideLayout) => emit("update", withImageField(props.beat, "slide", next));

const start = (value: string) => {
  const layout = LAYOUT_TYPES.find((candidate) => candidate === value);
  if (layout) replace(makeSlide(layout));
};
</script>

<template>
  <Inspector v-if="slide" :slide="slide" @update="replace" />
  <div v-else class="flex flex-col gap-2 rounded border border-stone-200 bg-stone-50 p-2">
    <p class="text-stone-500">This beat carries no @mulmocast/deck layout yet.</p>
    <label :class="LABEL_CLASS">
      <span :class="LABEL_TEXT_CLASS">start from a layout</span>
      <select :value="''" :class="FIELD_CLASS" @change="start(inputValue($event))">
        <option value="" disabled>choose…</option>
        <option v-for="layout in LAYOUT_TYPES" :key="layout" :value="layout">{{ layout }}</option>
      </select>
    </label>
  </div>
</template>
