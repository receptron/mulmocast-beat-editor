<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { beatToHtml, type BeatHtmlFragment, type MulmoBeat } from "mulmocast/browser";
import type { EditableBeat } from "../beatHelpers";
import { driveRuntimes, releaseRuntimes } from "../beatRuntime";
import { sanitizeFragment } from "../sanitize";
import { ensureDocumentStyles } from "../documentStyles";
import { applyInlineEdit, isInlineEditable, withEditingAffordances, type EditingSurface } from "../inlineEdit";

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

const editing = computed(() => props.editable && isInlineEditable(props.beat));

/** No path may be written while the beat is not editable. */
const NO_PATHS: ReadonlySet<string> = new Set();

const sanitized = computed(() => (fragment.value ? sanitizeFragment(fragment.value.html) : ""));

const surface = computed<EditingSurface>(() => (editing.value ? withEditingAffordances(sanitized.value) : { html: sanitized.value, paths: NO_PATHS }));
const html = computed(() => surface.value.html);

const host = ref<HTMLElement | null>(null);

/**
 * The editable element a pointer or key event happened inside, if any.
 *
 * A marker only counts when the render offered its path. Without that an element the DOM merely
 * claims is editable would take a caret and then drop the edit on blur, which reads as the app
 * losing what was typed.
 */
const editableTarget = (event: Event): HTMLElement | null => {
  const from = event.target;
  const marker = from instanceof Element ? from.closest<HTMLElement>("[data-mulmo-path]") : null;
  return marker && surface.value.paths.has(marker.getAttribute("data-mulmo-path") ?? "") ? marker : null;
};

/**
 * What the element held when the caret went in, so Escape can put it back.
 *
 * Only one element is editable at a time, so one slot is enough. Without it Escape leaves the
 * typed text on screen while the beat still holds the old value — measured, and it reads as a
 * saved edit rather than a discarded one.
 */
const htmlBeforeEdit = ref("");

const startEditing = (target: HTMLElement, focusIt: boolean) => {
  if (target.getAttribute("contenteditable") === "true") return;
  htmlBeforeEdit.value = target.innerHTML;
  target.setAttribute("contenteditable", "true");
  if (focusIt || document.activeElement !== target) target.focus();
};

const beginEdit = (event: MouseEvent) => {
  if (!editing.value) return;
  const target = editableTarget(event);
  // The click already places the caret; focusing again would move it to the start.
  if (target) startEditing(target, false);
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
  const next = applyInlineEdit(props.beat, path, html, surface.value.paths);
  if (next) emit("update", next);
};

/** Enter or Space on a focused-but-not-yet-editing element is the keyboard equivalent of a click. */
const enterEditing = (event: KeyboardEvent, target: HTMLElement): void => {
  if (!editing.value || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  startEditing(target, true);
};

/** Enter commits by blurring; Escape puts back what was there and drops the attribute, so the commit sees nothing. */
const leaveEditing = (event: KeyboardEvent, target: HTMLElement): void => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    target.blur();
  } else if (event.key === "Escape") {
    event.preventDefault();
    target.innerHTML = htmlBeforeEdit.value;
    target.removeAttribute("contenteditable");
    target.blur();
  }
};

const onKeydown = (event: KeyboardEvent) => {
  // An IME sends Enter to confirm a candidate and Escape to abandon one. Those belong to the
  // conversion, not to the editor: without this, confirming 変換 ends the edit and commits the
  // unconverted reading, once per 文節.
  if (event.isComposing) return;
  const target = editableTarget(event);
  if (!target) return;
  if (target.getAttribute("contenteditable") === "true") leaveEditing(event, target);
  else enterEditing(event, target);
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
