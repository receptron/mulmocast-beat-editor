<script setup lang="ts">
import { ref, computed } from "vue";
import type { SlideLayout, SlideTheme } from "@mulmocast/deck";
import DeckEditor from "./DeckEditor.vue";
import BeatGallery from "./components/BeatGallery.vue";
import BeatListEditor from "./BeatListEditor.vue";
import { type EditableBeat, makeBeat } from "./beatHelpers";
import { SAMPLES } from "./data/samples";
import { clone } from "./editorHelpers";

// Two views: the slide editor, and every beat type beatToHtml renders.
const view = ref<"editor" | "beats" | "beatEditor">("editor");

// A starting script for the beat editor. Separate from the slide samples, which are
// SlideLayout[]; this is a beat array, which is the thing being edited here.
const beats = ref<EditableBeat[]>([makeBeat("textSlide"), makeBeat("markdown"), makeBeat("chart"), makeBeat("mermaid"), makeBeat("slide")]);

const sampleKey = ref<string>(SAMPLES[0].key);
const currentSample = computed(() => SAMPLES.find((s) => s.key === sampleKey.value) ?? SAMPLES[0]);

// Local working copy of slides. Re-clone whenever the user picks a different sample so edits
// to one sample don't bleed into another (and so reloading the same sample resets it).
const slides = ref<SlideLayout[]>(clone(currentSample.value.slides));
const theme = ref<SlideTheme | undefined>(currentSample.value.theme);

const onSampleChange = (e: Event) => {
  const next = (e.target as HTMLSelectElement).value;
  sampleKey.value = next;
  const sample = SAMPLES.find((s) => s.key === next);
  if (!sample) return;
  slides.value = clone(sample.slides);
  theme.value = sample.theme;
};

const resetSample = () => {
  slides.value = clone(currentSample.value.slides);
  theme.value = currentSample.value.theme;
};
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <header class="flex shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 py-2 text-xs">
      <nav class="flex overflow-hidden rounded border border-stone-300">
        <button
          type="button"
          :class="['px-2 py-1 text-xs font-medium', view === 'editor' ? 'bg-stone-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-100']"
          @click="view = 'editor'"
        >
          Slide editor
        </button>
        <button
          type="button"
          :class="[
            'border-l border-stone-300 px-2 py-1 text-xs font-medium',
            view === 'beats' ? 'bg-stone-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-100',
          ]"
          @click="view = 'beats'"
        >
          All beat types
        </button>
        <button
          type="button"
          :class="[
            'border-l border-stone-300 px-2 py-1 text-xs font-medium',
            view === 'beatEditor' ? 'bg-stone-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-100',
          ]"
          @click="view = 'beatEditor'"
        >
          Beat editor
        </button>
      </nav>
      <template v-if="view === 'editor'">
        <span class="font-semibold uppercase tracking-wider text-stone-500">Sample</span>
        <select :value="sampleKey" class="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium" @change="onSampleChange">
          <option v-for="s in SAMPLES" :key="s.key" :value="s.key">{{ s.label }}</option>
        </select>
        <span v-if="currentSample.description" class="hidden text-stone-500 sm:inline">{{ currentSample.description }}</span>
        <button
          type="button"
          class="ml-auto rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
          title="Reload the sample, discarding any in-editor changes"
          @click="resetSample"
        >
          Reset sample
        </button>
      </template>
      <span v-else-if="view === 'beats'" class="text-stone-500">Every beat type <code>beatToHtml</code> renders, driven the way a host would</span>
      <span v-else class="text-stone-500">Edit any beat — the preview updates as you type</span>
    </header>
    <div class="flex-1 min-h-0">
      <DeckEditor v-if="view === 'editor'" v-model:slides="slides" :theme="theme" />
      <BeatGallery v-else-if="view === 'beats'" />
      <BeatListEditor v-else v-model:beats="beats" />
    </div>
  </div>
</template>
