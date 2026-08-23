<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { beatToHtml, type BeatHtmlFragment, type MulmoBeat } from "mulmocast/browser";
import type { EditableBeat } from "../beatHelpers";
import { driveRuntimes, releaseRuntimes } from "../beatRuntime";
import { sanitizeFragment } from "../sanitize";
import { ensureDocumentStyles } from "../documentStyles";
import { applyInlineEdit, isInlineEditable } from "../inlineEdit";

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
  /** Click any marked text to edit it in place. Only a `slide` beat carries the markers. */
  editable?: boolean;
}>();

const emit = defineEmits<{ update: [beat: EditableBeat] }>();

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

const editing = computed(() => props.editable && isInlineEditable(props.beat));

/** The `[data-mulmo-path]` element a pointer or key event happened inside, if any. */
const editableTarget = (event: Event): HTMLElement | null => {
  const from = event.target;
  return from instanceof Element ? from.closest<HTMLElement>("[data-mulmo-path]") : null;
};

const beginEdit = (event: MouseEvent) => {
  if (!editing.value) return;
  const target = editableTarget(event);
  if (!target || target.getAttribute("contenteditable") === "true") return;
  target.setAttribute("contenteditable", "true");
  // The click already places the caret; focusing again would move it to the start. Only step in
  // when the click did not take focus at all.
  if (document.activeElement !== target) target.focus();
};

/**
 * Commit on the way out. Blur fires for a click elsewhere, Enter, or Escape-then-blur, so this
 * is the single place an edit lands — and `applyInlineEdit` answers null when nothing changed,
 * which is what stops an ordinary click-away from rebuilding the fragment.
 */
const commit = (event: FocusEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.getAttribute("contenteditable") !== "true") return;
  const path = target.getAttribute("data-mulmo-path") ?? "";
  const html = target.innerHTML;
  target.removeAttribute("contenteditable");
  const next = applyInlineEdit(props.beat, path, html);
  if (next) emit("update", next);
};

const onKeydown = (event: KeyboardEvent) => {
  const target = editableTarget(event);
  if (!target || target.getAttribute("contenteditable") !== "true") return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    target.blur();
  } else if (event.key === "Escape") {
    event.preventDefault();
    // Drop the attribute first so the blur handler has nothing to commit — Escape discards.
    target.removeAttribute("contenteditable");
    target.blur();
  }
};

const draw = async () => {
  const element = host.value;
  if (element && fragment.value) await driveRuntimes(element, [fragment.value]);
};

// The first draw waits for mount: `immediate` would run during setup, before the ref exists,
// and since a fragment that never changes never fires the watcher again, nothing would ever
// be drawn. flush "post" so the DOM already carries the new markup when the runtimes look.
onMounted(() => {
  ensureDocumentStyles();
  void draw().catch(() => {});
});
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
    <!-- eslint-disable vue/no-v-html -- sanitized by sanitizeFragment above -->
    <div
      v-if="fragment"
      ref="host"
      :class="['beat-fragment', editing ? 'beat-fragment--editable' : '']"
      @click="beginEdit"
      @focusout="commit"
      @keydown="onKeydown"
      v-html="html"
    ></div>
    <!-- eslint-enable vue/no-v-html -->
    <p v-else class="rounded border border-dashed border-stone-300 p-3 text-xs text-stone-400">nothing to preview yet</p>
  </div>
</template>
