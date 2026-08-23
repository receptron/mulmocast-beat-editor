<script setup lang="ts">
import { computed, ref } from "vue";
import BeatGallery from "./components/BeatGallery.vue";
import BeatListEditor from "./BeatListEditor.vue";
import type { EditableBeat } from "./beatHelpers";
import { SAMPLES } from "./data/samples";
import { defaultBeatEditors } from "./editors/registry";
import OutlineTextSlideEditor from "./demo/OutlineTextSlideEditor.vue";
import { clone } from "./editorHelpers";

const view = ref<"beatEditor" | "beats">("beatEditor");

const sampleKey = ref<string>(SAMPLES[0].key);
const currentSample = computed(() => SAMPLES.find((sample) => sample.key === sampleKey.value) ?? SAMPLES[0]);

// A local working copy. Re-cloned whenever the picker changes, so edits to one sample do not
// bleed into another and reloading the same one resets it.
const beats = ref<EditableBeat[]>(clone(currentSample.value.beats));

const loadSample = (key: string) => {
  const sample = SAMPLES.find((candidate) => candidate.key === key);
  if (!sample) return;
  sampleKey.value = key;
  beats.value = clone(sample.beats);
};

const inputValue = (event: Event): string => (event.target instanceof HTMLSelectElement ? event.target.value : "");

// What a consumer does: keep the shipped editors and add one. `textSlide` already has `Form`,
// so the pane grows a tab switcher — which is the registry being visible rather than described.
const beatEditors = [...defaultBeatEditors, { id: "textSlide.outline", label: "Outline", beatType: "textSlide", component: OutlineTextSlideEditor }];

const TAB_BASE = "px-2 py-1 text-xs font-medium";
const tabClass = (name: typeof view.value, first = false) => [
  TAB_BASE,
  first ? "" : "border-l border-stone-300",
  view.value === name ? "bg-stone-700 text-white" : "bg-white text-stone-600 hover:bg-stone-100",
];
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <header class="flex shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 py-2 text-xs">
      <nav class="flex overflow-hidden rounded border border-stone-300">
        <button type="button" :class="tabClass('beatEditor', true)" @click="view = 'beatEditor'">Beat editor</button>
        <button type="button" :class="tabClass('beats')" @click="view = 'beats'">All beat types</button>
      </nav>
      <template v-if="view === 'beatEditor'">
        <span class="font-semibold uppercase tracking-wider text-stone-500">Script</span>
        <select :value="sampleKey" class="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium" @change="loadSample(inputValue($event))">
          <option v-for="sample in SAMPLES" :key="sample.key" :value="sample.key">{{ sample.label }}</option>
        </select>
        <span v-if="currentSample.description" class="hidden text-stone-500 sm:inline">{{ currentSample.description }}</span>
        <button
          type="button"
          class="ml-auto rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
          title="Reload the script, discarding any in-editor changes"
          @click="loadSample(sampleKey)"
        >
          Reset
        </button>
      </template>
      <span v-else class="text-stone-500">Every beat type <code>beatToHtml</code> renders, driven the way a host would</span>
    </header>
    <div class="flex-1 min-h-0">
      <BeatListEditor v-if="view === 'beatEditor'" v-model:beats="beats" :editors="beatEditors" />
      <BeatGallery v-else />
    </div>
  </div>
</template>
