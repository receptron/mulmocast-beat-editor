<script setup lang="ts">
import { computed, ref } from "vue";
import BeatGallery from "./components/BeatGallery.vue";
import BeatListEditor from "./BeatListEditor.vue";
import type { EditableBeat } from "./beatHelpers";
import { SAMPLES } from "./data/samples";
import { defaultBeatEditors } from "./editors/registry";
import OutlineTextSlideEditor from "./demo/OutlineTextSlideEditor.vue";
import { clone } from "./editorHelpers";
import { readPastedScript } from "./pastedScript";

const view = ref<"beatEditor" | "beats">("beatEditor");

const sampleKey = ref<string>(SAMPLES[0].key);
const currentSample = computed(() => SAMPLES.find((sample) => sample.key === sampleKey.value) ?? SAMPLES[0]);

// A local working copy. Re-cloned whenever the picker changes, so edits to one sample do not
// bleed into another and reloading the same one resets it.
const beats = ref<EditableBeat[]>(clone(currentSample.value.beats));

// A pasted script joins the picker under this key, so Reset reloads what was pasted rather than
// a sample the user never chose.
const PASTED_KEY = "pasted";
const pastedBeats = ref<EditableBeat[] | null>(null);
const pasteOpen = ref(false);
const pasteText = ref("");
const pasteError = ref("");

const loadSample = (key: string) => {
  const source = key === PASTED_KEY ? pastedBeats.value : SAMPLES.find((candidate) => candidate.key === key)?.beats;
  if (!source) return;
  sampleKey.value = key;
  beats.value = clone(source);
};

const loadPasted = () => {
  const result = readPastedScript(pasteText.value);
  if ("error" in result) {
    pasteError.value = result.error;
    return;
  }
  pastedBeats.value = result.beats;
  pasteError.value = "";
  pasteOpen.value = false;
  loadSample(PASTED_KEY);
};

const inputValue = (event: Event): string => (event.target instanceof HTMLSelectElement ? event.target.value : "");
const textareaValue = (event: Event): string => (event.target instanceof HTMLTextAreaElement ? event.target.value : "");

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
          <option v-if="pastedBeats" :value="PASTED_KEY">Pasted script</option>
        </select>
        <button
          type="button"
          class="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
          :aria-expanded="pasteOpen"
          @click="pasteOpen = !pasteOpen"
        >
          Paste JSON
        </button>
        <span v-if="sampleKey !== PASTED_KEY && currentSample.description" class="hidden text-stone-500 sm:inline">{{ currentSample.description }}</span>
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
    <section v-if="view === 'beatEditor' && pasteOpen" class="shrink-0 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs">
      <label for="paste-script" class="mb-1 block font-semibold text-stone-600">Paste a MulmoScript (JSON). It stays in this browser.</label>
      <textarea
        id="paste-script"
        :value="pasteText"
        rows="8"
        spellcheck="false"
        class="w-full rounded border border-stone-300 bg-white p-2 font-mono text-xs"
        placeholder='{ "$mulmocast": { "version": "1.1" }, "beats": [ … ] }'
        @input="pasteText = textareaValue($event)"
      ></textarea>
      <div class="mt-2 flex items-center gap-2">
        <button type="button" class="rounded bg-stone-700 px-3 py-1 font-medium text-white hover:bg-stone-600" @click="loadPasted">Load</button>
        <button type="button" class="rounded border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-100" @click="pasteOpen = false">Cancel</button>
        <p v-if="pasteError" role="alert" class="text-red-700">{{ pasteError }}</p>
      </div>
    </section>
    <div class="flex-1 min-h-0">
      <BeatListEditor v-if="view === 'beatEditor'" v-model:beats="beats" :editors="beatEditors" />
      <BeatGallery v-else />
    </div>
  </div>
</template>
