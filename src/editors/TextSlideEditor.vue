<script setup lang="ts">
import { computed } from "vue";
import { beatImage, withNestedField, readString, isRecord, type EditableBeat } from "../beatHelpers";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();
const set = (field: string, value: unknown) => emit("update", withNestedField(props.beat, "slide", field, value));

// One bullet per line is how they read and how they are edited.
const bullets = computed<string[]>(() => {
  const slide = beatImage(props.beat).slide;
  const items = isRecord(slide) ? slide.bullets : undefined;
  return Array.isArray(items) ? items.filter((b): b is string => typeof b === "string") : [];
});
</script>

<template>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">title</span>
    <input :value="readString(beat, 'title', 'slide')" :class="FIELD_CLASS" @input="set('title', inputValue($event))" />
  </label>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">subtitle</span>
    <input :value="readString(beat, 'subtitle', 'slide')" :class="FIELD_CLASS" @input="set('subtitle', inputValue($event))" />
  </label>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">bullets <span class="font-normal text-stone-400">(one per line)</span></span>
    <textarea
      :value="bullets.join('\n')"
      rows="5"
      :class="FIELD_CLASS"
      @input="
        set(
          'bullets',
          inputValue($event)
            .split('\n')
            .filter((line) => line.trim() !== ''),
        )
      "
    ></textarea>
  </label>
</template>
