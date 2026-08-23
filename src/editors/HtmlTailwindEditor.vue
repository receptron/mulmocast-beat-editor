<script setup lang="ts">
import { withImageField, readString, type EditableBeat } from "../beatHelpers";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();
</script>

<template>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">html <span class="font-normal text-stone-400">(Tailwind utilities)</span></span>
    <textarea
      :value="readString(beat, 'html')"
      rows="12"
      :class="[FIELD_CLASS, 'font-mono']"
      @input="emit('update', withImageField(props.beat, 'html', inputValue($event)))"
    ></textarea>
  </label>
</template>
