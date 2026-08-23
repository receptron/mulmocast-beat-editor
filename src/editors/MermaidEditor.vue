<script setup lang="ts">
import { withImageField, withNestedField, readString, type EditableBeat } from "../beatHelpers";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();
</script>

<template>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">title</span>
    <input :value="readString(beat, 'title')" :class="FIELD_CLASS" @input="emit('update', withImageField(props.beat, 'title', inputValue($event)))" />
  </label>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">diagram <span class="font-normal text-stone-400">(mermaid)</span></span>
    <textarea
      :value="readString(beat, 'text', 'code')"
      rows="10"
      :class="[FIELD_CLASS, 'font-mono']"
      @input="emit('update', withNestedField(props.beat, 'code', 'text', inputValue($event)))"
    ></textarea>
  </label>
</template>
