<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { beatType, type EditableBeat } from "../beatHelpers";
import { defaultBeatEditors, editorsFor } from "../editors/registry";
import type { BeatEditorDefinition } from "../editors/types";
import { inputValue, FIELD_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from "../editors/field";

/**
 * The editing pane for one beat: the fields every beat has, plus whichever registered editor
 * handles its image type.
 *
 * Splitting it this way is what keeps each editor small — none of them repeats the `text`
 * field — and it is what lets a beat type have more than one editor, since only the
 * image-specific half varies.
 */
const props = withDefaults(defineProps<{ beat: EditableBeat; editors?: BeatEditorDefinition[] }>(), {
  editors: () => defaultBeatEditors,
});
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

const type = computed(() => beatType(props.beat));
const available = computed(() => editorsFor(type.value, props.editors));

// Remembered per beat type, so switching beats does not switch the editor back.
const chosen = ref<Record<string, string>>({});
const current = computed<BeatEditorDefinition | undefined>(
  () => available.value.find((editor) => editor.id === chosen.value[type.value]) ?? available.value[0],
);

// A type with no registered editor is not an error — a consumer may register only some.
watch(type, () => undefined);
</script>

<template>
  <div class="flex flex-col gap-3 text-xs">
    <div class="flex items-baseline gap-2">
      <span class="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-600">{{ type }}</span>
      <span v-if="available.length > 1" class="ml-auto flex gap-1">
        <button
          v-for="editor in available"
          :key="editor.id"
          type="button"
          :class="[
            'rounded border px-2 py-0.5',
            editor.id === current?.id ? 'border-stone-700 bg-stone-700 text-white' : 'border-stone-300 bg-white hover:bg-stone-100',
          ]"
          @click="chosen[type] = editor.id"
        >
          {{ editor.label }}
        </button>
      </span>
    </div>

    <label :class="LABEL_CLASS">
      <span :class="LABEL_TEXT_CLASS">text <span class="font-normal text-stone-400">(spoken; also the image alt fallback)</span></span>
      <textarea
        :value="typeof beat.text === 'string' ? beat.text : ''"
        rows="2"
        :class="FIELD_CLASS"
        @input="emit('update', { ...beat, text: inputValue($event) })"
      ></textarea>
    </label>

    <component :is="current.component" v-if="current" :beat="beat" @update="emit('update', $event)" />
    <p v-else class="rounded border border-dashed border-stone-300 p-3 text-stone-400">No editor registered for "{{ type }}".</p>
  </div>
</template>
