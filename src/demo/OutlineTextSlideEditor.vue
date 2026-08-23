<script setup lang="ts">
import { computed } from "vue";
import { withNestedField, readString, readStringList, type EditableBeat } from "../beatHelpers";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "../editors/field";

/**
 * A second way into a `textSlide`, registered by the demo rather than shipped.
 *
 * It exists to show the extension point working: `textSlide` already has `Form`, so adding
 * this one puts a tab switcher in the pane — the same shape the built-in `chart` editors use,
 * where a form and a raw view are two doors to one field.
 *
 * The contract is the whole of it: take `beat`, emit `update(beat)`, touch only `image`.
 */
const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

const bullets = computed(() => readStringList(props.beat, "bullets", "slide"));

const outline = computed(() => [readString(props.beat, "title", "slide"), ...bullets.value].join("\n"));

const write = (next: string) => {
  const [title = "", ...rest] = next.split("\n");
  const written = withNestedField(props.beat, "slide", "title", title);
  emit(
    "update",
    withNestedField(
      written,
      "slide",
      "bullets",
      rest.filter((line) => line.trim() !== ""),
    ),
  );
};
</script>

<template>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">outline <span class="font-normal text-stone-400">(first line is the title, the rest are bullets)</span></span>
    <textarea :value="outline" rows="8" :class="[FIELD_CLASS, 'font-mono']" @input="write(inputValue($event))"></textarea>
  </label>
</template>
