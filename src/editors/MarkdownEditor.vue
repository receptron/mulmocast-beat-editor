<script setup lang="ts">
import { computed } from "vue";
import { beatImage, withImageField, type EditableBeat } from "../beatHelpers";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

// markdown is a string or an object of named slots. Only the string form is editable here:
// flattening the object form into a string would silently discard its slots.
const markdown = computed(() => beatImage(props.beat).markdown);
const isString = computed(() => typeof markdown.value === "string");
</script>

<template>
  <label v-if="isString" :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">markdown</span>
    <textarea
      :value="typeof markdown === 'string' ? markdown : ''"
      rows="10"
      :class="[FIELD_CLASS, 'font-mono']"
      @input="emit('update', withImageField(beat, 'markdown', inputValue($event)))"
    ></textarea>
  </label>
  <p v-else class="rounded border border-stone-200 bg-stone-50 p-2 text-stone-500">
    This beat uses the layout form (named slots). Editing it as a single string would discard the slots, so it is left read-only here.
  </p>
</template>
