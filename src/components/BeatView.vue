<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { beatToHtml, type BeatHtmlFragment, type MulmoBeat } from "mulmocast/browser";
import type { EditableBeat } from "../beatHelpers";
import { driveRuntimes, releaseRuntimes } from "../beatRuntime";
import { sanitizeFragment } from "../sanitize";
import { ensureDocumentStyles } from "../documentStyles";
import { applyInlineEdit, isInlineEditable, withEditingAffordances, type EditingSurface } from "../inlineEdit";
import { BOLD, EMPHASIS, clearFormat, colorFormat, formattableSelection, toggleFormat, type AccentColor, type InlineFormat } from "../inlineFormat";
import { placeToolbar } from "../toolbarPosition";
import InlineToolbar from "./InlineToolbar.vue";

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

/** This beat's own subtree, so another beat's markup cannot be mistaken for our toolbar. */
const shell = ref<HTMLElement | null>(null);

/** The element being edited, remembered because a commit can be triggered from the toolbar. */
const editing_element = ref<HTMLElement | null>(null);

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

/**
 * Where the formatting toolbar sits, or null when there is nothing to format.
 *
 * Driven by `selectionchange`, which is a document-level event: the listener is attached only
 * while this beat has something being edited, so a list of twenty beats does not run twenty
 * handlers for every caret move.
 */
const toolbar = ref<{ x: number; y: number } | null>(null);

/** Sized to what the toolbar renders: two buttons, seven swatches, a clear, and two rules. */
const TOOLBAR_BOX = { width: 268, height: 34 };

const repositionToolbar = () => {
  const found = formattableSelection(document.getSelection());
  if (!found) {
    toolbar.value = null;
    return;
  }
  const rect = found.range.getBoundingClientRect();
  toolbar.value = placeToolbar(rect, TOOLBAR_BOX, { width: window.innerWidth, height: window.innerHeight });
};

const startWatchingSelection = () => document.addEventListener("selectionchange", repositionToolbar);

const stopWatchingSelection = () => {
  document.removeEventListener("selectionchange", repositionToolbar);
  toolbar.value = null;
};

/**
 * Run a toolbar action and leave focus where the user had it.
 *
 * Re-selecting inside a `contenteditable` moves focus back to the text — measured, a keyboard
 * user pressing Bold landed back in the heading and had to Tab to the toolbar again for every
 * single press. A mouse user never notices, because `mousedown.prevent` kept focus in the text
 * all along.
 */
const keepingToolbarFocus = (act: () => boolean) => {
  const held = document.activeElement;
  const fromToolbar = held instanceof HTMLElement && held.closest('[role="toolbar"]') !== null;
  if (!act()) return;
  repositionToolbar();
  if (fromToolbar && held instanceof HTMLElement) held.focus();
};

const applyFormat = (format: InlineFormat) => keepingToolbarFocus(() => toggleFormat(document.getSelection(), format));

const applyColor = (color: AccentColor) => applyFormat(colorFormat(color));

const applyClear = () => keepingToolbarFocus(() => clearFormat(document.getSelection()));

const startEditing = (target: HTMLElement, focusIt: boolean) => {
  if (target.getAttribute("contenteditable") === "true") return;
  htmlBeforeEdit.value = target.innerHTML;
  editing_element.value = target;
  target.setAttribute("contenteditable", "true");
  startWatchingSelection();
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
/**
 * Focus landing on THIS beat's toolbar, or coming back from it to the element being edited.
 *
 * Scoped to this component's own subtree, not to any `[role="toolbar"]` on the page: an
 * `html_tailwind` beat renders author markup verbatim, and one carrying that role would
 * otherwise suppress a commit happening in a different beat — measured, the author can put it
 * there (a `slide` beat cannot: 0 of 3 attempts survive the renderer and the sanitizer).
 *
 * `contains` rather than identity, so a descendant of the edited element is still inside it.
 */
const staysWithinThisEdit = (related: EventTarget | null): boolean => {
  if (!(related instanceof Element)) return false;
  const ownToolbar = (shell.value?.contains(related) ?? false) && related.closest('[role="toolbar"]') !== null;
  return ownToolbar || (editing_element.value?.contains(related) ?? false);
};

const commit = (event: FocusEvent) => {
  const target = editing_element.value;
  if (!target || target.getAttribute("contenteditable") !== "true") return;
  // Only a hop between the text and its own toolbar is not the end of an edit. Tabbing into the
  // toolbar must not commit, or the toolbar unmounts before a keyboard user can press anything;
  // and an action bounces focus text -> button, which must not commit either.
  //
  // "anywhere inside the beat" is too wide, and losing that distinction LOSES DATA: measured,
  // editing the title and then clicking the subtitle of the same beat left both elements
  // editable and committed only the second, dropping the title's edit silently.
  if (staysWithinThisEdit(event.relatedTarget)) return;
  const path = target.getAttribute("data-mulmo-path") ?? "";
  const html = target.innerHTML;
  target.removeAttribute("contenteditable");
  editing_element.value = null;
  stopWatchingSelection();
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
    editing_element.value = null;
    stopWatchingSelection();
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
watch(
  html,
  () => {
    // A new fragment means the element being edited was just destroyed, and no focusout fires for
    // a node that was removed rather than blurred. Measured: a host replacing the beat mid-edit
    // left the toolbar floating over content it could no longer format, and the listener attached.
    stopWatchingSelection();
    void draw().catch(() => {});
  },
  { flush: "post" },
);

onBeforeUnmount(() => {
  releaseRuntimes(host.value);
  // The selection listener is on the document, so unmounting mid-edit would otherwise leave a
  // handler holding this component alive and repositioning a toolbar nobody can see.
  stopWatchingSelection();
});
</script>

<template>
  <div ref="shell" @focusout="commit">
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
      @keydown="onKeydown"
      v-html="html"
    ></div>
    <!-- eslint-enable vue/no-v-html -->
    <p v-else class="rounded border border-dashed border-stone-300 p-3 text-xs text-stone-400">nothing to preview yet</p>
    <InlineToolbar
      v-if="toolbar"
      :x="toolbar.x"
      :y="toolbar.y"
      @bold="applyFormat(BOLD)"
      @emphasis="applyFormat(EMPHASIS)"
      @color="applyColor"
      @clear="applyClear"
    />
  </div>
</template>
