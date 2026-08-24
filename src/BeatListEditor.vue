<script setup lang="ts">
import { ref } from "vue";
import { slideUtilityCss } from "@mulmocast/deck";
import BeatView from "./components/BeatView.vue";
import BeatEditorPane from "./components/BeatEditorPane.vue";
import { BEAT_TYPES, type BeatType, type EditableBeat, beatType, makeBeat, moveItem, selectionAfterMove, selectionAfterRemove } from "./beatHelpers";
import type { BeatEditorDefinition } from "./editors/types";

/**
 * Edit a MulmoScript's beats: the list on the left previews every beat, the pane on the
 * right edits the selected one, and a keystroke updates the preview.
 *
 * The beat array is edited directly. The older DeckEditor extracts slide beats, edits those,
 * and zips them back — which is why it cannot reorder or insert mid-deck. Here a beat is a
 * beat, so add / remove / move are array operations.
 *
 * Each beat renders through its own BeatView, so editing one leaves the others' charts and
 * diagrams alone.
 */
const props = defineProps<{ beats: EditableBeat[]; editors?: BeatEditorDefinition[] }>();
const emit = defineEmits<{ "update:beats": [beats: EditableBeat[]] }>();

const selected = ref(0);
const addType = ref<BeatType>("markdown");

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
  selected.value = selectionAfterRemove(selected.value, index, next.length);
};

const move = (index: number, delta: number) => {
  const to = index + delta;
  if (to < 0 || to >= props.beats.length) return;
  emit("update:beats", moveItem(props.beats, index, to));
  selected.value = selectionAfterMove(selected.value, index, to, props.beats.length);
};
</script>

<template>
  <div class="flex h-full min-h-0">
    <component :is="'style'">{{ slideUtilityCss }}</component>
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
      .relative.overflow-hidden { height: 300px; } /* The swipe `elements` root is w-full h-full, so it collapses unless the host gives its PARENT a box — an
      inline height:100% beats any rule aimed at the root itself. mulmocast marks it data-mulmo-swipe-root (#1567) so this no longer has to match on that inline
      style. */ .beat-fragment:has(> [data-mulmo-swipe-root]) { height: 260px; }
    </component>

    <!-- list -->
    <div class="min-h-0 flex-1 overflow-auto bg-stone-50 p-4">
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
        <BeatView :beat="beat" :id-prefix="`beat-${index}`" editable @update="update(index, $event)" />
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
      <BeatEditorPane v-if="beats[selected]" :beat="beats[selected]" :editors="editors" @update="update(selected, $event)" />
      <p v-else class="text-xs text-stone-400">No beats. Add one to start.</p>
    </aside>
  </div>
</template>
