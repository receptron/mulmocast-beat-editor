<script setup lang="ts">
import { computed } from "vue";
import { beatImage, withImageField, type EditableBeat } from "../beatHelpers";
import {
  isMarkdownLayout,
  mainKindOf,
  slotsOf,
  slotText,
  writeSlot,
  setSlot,
  setFrame,
  switchMain,
  toLayout,
  isLosslessToString,
  MAIN_KINDS,
  SLOT_LABELS,
  FRAME_KEYS,
  type MainKind,
  type FrameKey,
} from "./markdownLayout";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "./field";

/**
 * `markdown` is a union: a string (or array of lines), or a layout of named slots. Both are
 * edited here, because they are one field and a beat is in one of the two forms at a time.
 *
 * Converting string -> layout is always safe, so it is a button. The other direction is
 * offered only when the layout is a bare `content`, which is the one case where nothing is
 * lost; otherwise the author would silently lose a slot's writing.
 */
const props = defineProps<{ beat: EditableBeat }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

const markdown = computed(() => beatImage(props.beat).markdown);
const layout = computed(() => (isMarkdownLayout(markdown.value) ? markdown.value : undefined));

const write = (next: unknown) => emit("update", withImageField(props.beat, "markdown", next));

const kind = computed<MainKind>(() => (layout.value ? mainKindOf(layout.value) : "content"));
const slots = computed(() => (layout.value ? slotsOf(layout.value).map(slotText) : []));
const labels = computed(() => SLOT_LABELS[kind.value]);
const frame = computed<Record<FrameKey, string>>(() => ({
  header: slotText(layout.value?.header),
  "sidebar-left": slotText(layout.value?.["sidebar-left"]),
}));

const chooseMain = (value: string) => {
  const main = MAIN_KINDS.find((candidate) => candidate === value);
  if (main && layout.value) write(switchMain(layout.value, main));
};
</script>

<template>
  <template v-if="layout">
    <label v-for="key in FRAME_KEYS" :key="key" :class="LABEL_CLASS">
      <span :class="LABEL_TEXT_CLASS">{{ key }} <span class="font-normal text-stone-400">(optional)</span></span>
      <textarea :value="frame[key]" rows="2" :class="[FIELD_CLASS, 'font-mono']" @input="write(setFrame(layout, key, inputValue($event)))"></textarea>
    </label>

    <label :class="LABEL_CLASS">
      <span :class="LABEL_TEXT_CLASS">main</span>
      <select :value="kind" :class="FIELD_CLASS" @change="chooseMain(inputValue($event))">
        <option v-for="main in MAIN_KINDS" :key="main" :value="main">{{ main }}</option>
      </select>
    </label>

    <label v-for="(text, index) in slots" :key="`${kind}-${index}`" :class="LABEL_CLASS">
      <span :class="LABEL_TEXT_CLASS">{{ labels[index] }}</span>
      <textarea :value="text" rows="5" :class="[FIELD_CLASS, 'font-mono']" @input="write(setSlot(layout, index, inputValue($event)))"></textarea>
    </label>

    <button
      v-if="isLosslessToString(layout)"
      type="button"
      class="self-start rounded border border-stone-300 bg-white px-2 py-1 font-medium hover:bg-stone-100"
      @click="write(slots[0])"
    >
      Use plain markdown
    </button>
    <p v-else class="rounded border border-stone-200 bg-stone-50 p-2 text-stone-500">
      A frame or a multi-slot main has nowhere to go in a plain string, so switching back is offered only from a bare content.
    </p>
  </template>

  <template v-else>
    <label :class="LABEL_CLASS">
      <span :class="LABEL_TEXT_CLASS">markdown</span>
      <textarea :value="slotText(markdown)" rows="10" :class="[FIELD_CLASS, 'font-mono']" @input="write(writeSlot(markdown, inputValue($event)))"></textarea>
    </label>
    <button
      type="button"
      class="self-start rounded border border-stone-300 bg-white px-2 py-1 font-medium hover:bg-stone-100"
      @click="write(toLayout(markdown))"
    >
      Use the layout form
    </button>
  </template>
</template>
