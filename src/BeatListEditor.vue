<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { beatToHtml, type BeatHtmlFragment } from "mulmocast/browser";
import { slideUtilityCss } from "@mulmocast/deck";
import BeatEditor from "./components/BeatEditor.vue";
import { BEAT_TYPES, type BeatType, type EditableBeat, beatType, makeBeat, moveItem } from "./beatHelpers";
import { collectedCss, driveRuntimes } from "./beatRuntime";

/**
 * Edit a MulmoScript's beats: the list on the left previews every beat, the pane on the
 * right edits the selected one, and a keystroke updates the preview.
 *
 * The beat array is edited directly. The older DeckEditor extracts slide beats, edits those,
 * and zips them back — which is why it cannot reorder or insert mid-deck. Here a beat is a
 * beat, so add / remove / move are array operations.
 */
const props = defineProps<{ beats: EditableBeat[] }>();
const emit = defineEmits<{ "update:beats": [beats: EditableBeat[]] }>();

const selected = ref(0);
const addType = ref<BeatType>("markdown");

// idPrefix must be unique per beat and stable across re-renders, and cannot start with a
// digit. The index gives both — and it is why moving a beat re-renders both positions.
const fragments = computed<(BeatHtmlFragment | undefined)[]>(() =>
  props.beats.map((beat, index) => {
    try {
      return beatToHtml(beat as never, { idPrefix: `beat-${index}` });
    } catch {
      // A half-typed beat is routine while editing; the list shows a placeholder for it
      // rather than the whole editor going blank.
      return undefined;
    }
  }),
);

const fragmentCss = computed(() => collectedCss(fragments.value));

const container = ref<HTMLElement | null>(null);
let charts: { destroy: () => void }[] = [];

const redraw = async () => {
  await nextTick();
  if (!container.value) return;
  charts = await driveRuntimes(container.value, fragments.value, charts);
};

onMounted(() => {
  redraw().catch(() => {});
});
watch(fragments, () => {
  redraw().catch(() => {});
});

const update = (index: number, beat: EditableBeat) => {
  const next = props.beats.slice();
  next[index] = beat;
  emit("update:beats", next);
};

const add = () => {
  const next = props.beats.slice();
  next.splice(selected.value + 1, 0, makeBeat(addType.value));
  emit("update:beats", next);
  selected.value = Math.min(selected.value + 1, next.length - 1);
};

const remove = (index: number) => {
  const next = props.beats.slice();
  next.splice(index, 1);
  emit("update:beats", next);
  selected.value = Math.max(0, Math.min(selected.value, next.length - 1));
};

const move = (index: number, delta: number) => {
  const to = index + delta;
  if (to < 0 || to >= props.beats.length) return;
  emit("update:beats", moveItem(props.beats, index, to));
  selected.value = to;
};
</script>

<template>
  <div class="flex h-full min-h-0">
    <component :is="'style'">{{ slideUtilityCss }}</component>
    <component :is="'style'" v-if="fragmentCss">{{ fragmentCss }}</component>
    <!--
      Tailwind's preflight strips the browser's defaults for h1-h6, ul/ol and p, so markup a
      fragment produces from markdown arrives unstyled. Restoring it is the host's job.
    -->
    <component :is="'style'">
      .beat-fragment h1 { font-size: 1.6rem; font-weight: 700; margin: 0.4rem 0; } .beat-fragment h2 { font-size: 1.3rem; font-weight: 700; margin: 0.4rem 0; }
      .beat-fragment h3 { font-size: 1.1rem; font-weight: 600; margin: 0.3rem 0; } .beat-fragment p { margin: 0.4rem 0; } .beat-fragment ul { list-style: disc;
      padding-left: 1.4rem; margin: 0.4rem 0; } .beat-fragment ol { list-style: decimal; padding-left: 1.4rem; margin: 0.4rem 0; } .beat-fragment li { margin:
      0.1rem 0; } .beat-fragment code { background: #f5f5f4; padding: 0.1rem 0.3rem; border-radius: 0.2rem; } /* A chart card is sized for a slide (400px tall);
      in a list that is mostly empty space. */ .beat-fragment .chart-container > div { height: 220px !important; } .beat-fragment img, .beat-fragment video {
      max-height: 240px; width: auto; } /* A slide fragment is w-full h-full and designed at 1280px, so it needs a box to fill. */ .beat-fragment >
      .relative.overflow-hidden { height: 300px; }
    </component>

    <!-- list -->
    <div ref="container" class="min-h-0 flex-1 overflow-auto bg-stone-50 p-4">
      <div
        v-for="(beat, index) in beats"
        :key="index"
        :class="[
          'mx-auto mb-4 max-w-2xl rounded border-2 p-3',
          index === selected ? 'border-stone-700 bg-white' : 'border-transparent bg-white/60 hover:border-stone-300',
        ]"
        @click="selected = index"
      >
        <header class="mb-2 flex items-center gap-2 text-[11px]">
          <span class="font-mono font-bold uppercase tracking-wider text-stone-600">{{ index + 1 }}. {{ beatType(beat) }}</span>
          <span v-if="fragments[index]?.requires?.length" class="rounded bg-stone-200 px-1.5 py-0.5 font-mono text-stone-600">
            {{ fragments[index]?.requires?.join(" ") }}
          </span>
          <span class="ml-auto flex gap-1">
            <button
              type="button"
              class="rounded border border-stone-300 px-1.5 hover:bg-stone-100 disabled:opacity-30"
              :disabled="index === 0"
              title="Move up"
              @click.stop="move(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="rounded border border-stone-300 px-1.5 hover:bg-stone-100 disabled:opacity-30"
              :disabled="index === beats.length - 1"
              title="Move down"
              @click.stop="move(index, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="rounded border border-stone-300 px-1.5 text-red-600 hover:bg-red-50"
              title="Delete this beat"
              @click.stop="remove(index)"
            >
              ✕
            </button>
          </span>
        </header>
        <!-- eslint-disable-next-line vue/no-v-html -- inserting the fragment is the point; a real host sanitizes first, as docs/api.md says -->
        <div v-if="fragments[index]" class="beat-fragment" v-html="fragments[index]!.html"></div>
        <p v-else class="rounded border border-dashed border-stone-300 p-3 text-xs text-stone-400">nothing to preview yet</p>
      </div>

      <div class="mx-auto flex max-w-2xl items-center gap-2 text-xs">
        <select v-model="addType" class="rounded border border-stone-300 bg-white px-2 py-1">
          <option v-for="t in BEAT_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
        <button type="button" class="rounded border border-stone-300 bg-white px-2 py-1 font-medium hover:bg-stone-100" @click="add">+ Add beat below</button>
      </div>
    </div>

    <!-- editor -->
    <aside class="w-96 shrink-0 overflow-auto border-l border-stone-200 bg-white p-4">
      <BeatEditor v-if="beats[selected]" :beat="beats[selected]" :index="selected" @update="update(selected, $event)" />
      <p v-else class="text-xs text-stone-400">No beats. Add one to start.</p>
    </aside>
  </div>
</template>
