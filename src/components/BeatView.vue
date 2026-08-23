<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { beatToHtml, type BeatHtmlFragment, type MulmoBeat } from "mulmocast/browser";
import type { EditableBeat } from "../beatHelpers";
import { driveRuntimes, releaseRuntimes } from "../beatRuntime";
import { sanitizeFragment } from "../sanitize";

/**
 * One beat, rendered as a div.
 *
 * The unit matters: the previous version computed every beat's fragment in one place and
 * drove every chart from one container, so typing into one beat destroyed and rebuilt the
 * charts of all the others — visible as a flicker. Here a beat owns its own fragment and its
 * own Chart.js instances, so Vue re-renders the one whose props changed and nothing else.
 *
 * Shared runtimes (the chart.js and mermaid script tags) stay global; only the drawing is
 * per beat.
 */
const props = defineProps<{
  beat: EditableBeat;
  /** Must be unique per beat on the page and match [A-Za-z_][A-Za-z0-9_-]* — see beatToHtml. */
  idPrefix: string;
}>();

const fragment = computed<BeatHtmlFragment | undefined>(() => {
  try {
    // The one place the editor's loose beat meets beatToHtml's MulmoBeat. Validating one
    // needs the zod schema, which the browser build exists to avoid; beatToHtml already
    // answers undefined for anything it cannot render, so a half-typed beat degrades.
    return beatToHtml(props.beat as MulmoBeat, { idPrefix: props.idPrefix });
  } catch {
    return undefined;
  }
});

const html = computed(() => (fragment.value ? sanitizeFragment(fragment.value.html) : ""));

const host = ref<HTMLElement | null>(null);

const draw = async () => {
  const element = host.value;
  if (element && fragment.value) await driveRuntimes(element, [fragment.value]);
};

// The first draw waits for mount: `immediate` would run during setup, before the ref exists,
// and since a fragment that never changes never fires the watcher again, nothing would ever
// be drawn. flush "post" so the DOM already carries the new markup when the runtimes look.
onMounted(() => void draw().catch(() => {}));
watch(html, () => void draw().catch(() => {}), { flush: "post" });

onBeforeUnmount(() => releaseRuntimes(host.value));
</script>

<template>
  <div>
    <component :is="'style'" v-if="fragment?.css">{{ fragment.css }}</component>
    <!--
      The fragment is sanitized above. `beatToHtml` documents that raw HTML, event handlers
      and javascript: urls written into a beat survive into its output, so this is the one
      place that has to strip them.
    -->
    <!-- eslint-disable-next-line vue/no-v-html -- sanitized by sanitizeFragment -->
    <div v-if="fragment" ref="host" class="beat-fragment" v-html="html"></div>
    <p v-else class="rounded border border-dashed border-stone-300 p-3 text-xs text-stone-400">nothing to preview yet</p>
  </div>
</template>
