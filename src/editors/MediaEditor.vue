<script setup lang="ts">
import { beatType, withNestedField, readString, type EditableBeat } from "../beatHelpers";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

/**
 * `image` and `movie` differ only in what they render, so one editor serves both.
 *
 * The url is the only source kind a browser can reach. A local `path` is left editable
 * because a script may carry one, but it will not resolve here — the beat is authored for a
 * page, and the page is where it has to be fetchable from.
 */
const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();
</script>

<template>
  <label :class="LABEL_CLASS">
    <span :class="LABEL_TEXT_CLASS">{{ beatType(beat) }} url</span>
    <input
      :value="readString(beat, 'url', 'source')"
      placeholder="https://…"
      :class="FIELD_CLASS"
      @input="emit('update', withNestedField(props.beat, 'source', 'url', inputValue($event)))"
    />
    <span v-if="readString(beat, 'url', 'source') && !/^https?:\/\//.test(readString(beat, 'url', 'source'))" class="text-amber-700">
      a browser can only fetch an http(s) url
    </span>
  </label>
</template>
