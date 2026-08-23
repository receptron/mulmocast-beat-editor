<script setup lang="ts">
import { ref, computed } from "vue";
import type { SlideLayout, SlideTheme } from "@mulmocast/deck";
import DeckEditor from "./DeckEditor.vue";
import BeatGallery from "./components/BeatGallery.vue";
import BeatListEditor from "./BeatListEditor.vue";
import { type EditableBeat, makeBeat } from "./beatHelpers";
import { SAMPLES } from "./data/samples";
import { defaultBeatEditors } from "./editors/registry";
import OutlineTextSlideEditor from "./demo/OutlineTextSlideEditor.vue";
import { clone } from "./editorHelpers";

// The beat editor leads: it renders every beat type into a div. The slide editor is the older
// iframe path, kept so the deprecated exports stay exercised rather than rotting unrun.
const view = ref<"editor" | "beats" | "beatEditor">("beatEditor");

// A starting script for the beat editor. Separate from the slide samples, which are
// SlideLayout[]; this is a beat array, which is the thing being edited here.
const beats = ref<EditableBeat[]>([makeBeat("textSlide"), makeBeat("markdown"), makeBeat("chart"), makeBeat("mermaid"), makeBeat("slide")]);

// What a consumer does: keep the shipped editors and add one. `textSlide` already has `Form`,
// so the pane grows a tab switcher — which is the registry being visible rather than described.
const beatEditors = [...defaultBeatEditors, { id: "textSlide.outline", label: "Outline", beatType: "textSlide", component: OutlineTextSlideEditor }];

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
          :class="['px-2 py-1 text-xs font-medium', view === 'beatEditor' ? 'bg-stone-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-100']"
          @click="view = 'beatEditor'"
        >
          Beat editor
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
            view === 'editor' ? 'bg-stone-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-100',
          ]"
          title="The older iframe-based deck editor. Deprecated — kept here so it stays exercised."
          @click="view = 'editor'"
        >
          Slide editor (legacy)
        </button>
      </nav>
      <template v-if="view === 'editor'">
        <span class="rounded bg-amber-100 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-800" title="Use the Beat editor instead"
          >deprecated</span
        >
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
      <span v-else class="text-stone-500"
        >Edit any beat — the preview updates as you type. <code>textSlide</code> carries a demo-registered second editor.</span
      >
    </header>
    <div class="flex-1 min-h-0">
      <DeckEditor v-if="view === 'editor'" v-model:slides="slides" :theme="theme" />
      <BeatGallery v-else-if="view === 'beats'" />
      <BeatListEditor v-else v-model:beats="beats" :editors="beatEditors" />
    </div>
  </div>
</template>
