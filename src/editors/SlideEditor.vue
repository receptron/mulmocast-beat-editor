<script setup lang="ts">
import { withNestedField, readString, type EditableBeat } from "../beatHelpers";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();
const set = (field: string, value: unknown) => emit("update", withNestedField(props.beat, "slide", field, value));
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
  <p class="rounded border border-stone-200 bg-stone-50 p-2 text-stone-500">
    A slide beat carries a full @mulmocast/deck layout. Only its title and subtitle are edited here; the rest of the layout comes from the script.
  </p>
</template>
