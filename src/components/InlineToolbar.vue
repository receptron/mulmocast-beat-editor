<script setup lang="ts">
import { ACCENT_COLORS } from "../editorHelpers";
import type { AccentColor } from "../inlineFormat";

import { onMounted, ref, watch } from "vue";

const props = defineProps<{ x: number; y: number }>();

const emit = defineEmits<{
  bold: [];
  emphasis: [];
  color: [color: AccentColor];
  clear: [];
}>();

/**
 * One tab stop for the whole toolbar, which is what `role="toolbar"` means: arrows move between
 * the buttons, Tab moves past them. Ten stops would make skipping the toolbar cost ten presses.
 *
 * The arrow navigation has no unit test and cannot have one here: moving focus inside the
 * toolbar makes jsdom collapse the document selection, which unmounts the toolbar mid-test.
 * A browser keeps the selection — measured in Chromium, Tab reaches the toolbar in one stop,
 * ArrowRight walks B -> star -> Colour: primary, Enter applies, and focus stays on the button.
 */
const focused = ref(0);
const shell = ref<HTMLElement | null>(null);

/**
 * Where `position: fixed` actually measures from.
 *
 * A `transform`, `filter` or `will-change` on ANY ancestor makes that ancestor the containing
 * block, so `left`/`top` stop being viewport coordinates — measured in a host card wrapped in
 * `translateZ(0)`, the toolbar landed 96px right and 60px BELOW a selection it should sit above.
 * Asking the element where (0,0) puts it is exact and costs one reflow per move.
 */
const origin = ref({ x: 0, y: 0 });

const measureOrigin = () => {
  const element = shell.value;
  if (!element) return;
  element.style.left = "0px";
  element.style.top = "0px";
  const box = element.getBoundingClientRect();
  origin.value = { x: box.left, y: box.top };
};

onMounted(measureOrigin);
watch(() => [props.x, props.y], measureOrigin);

/** Asked of the DOM rather than collected per button: one ref, no index bookkeeping to get wrong. */
const buttonsIn = (): HTMLElement[] => [...(shell.value?.querySelectorAll<HTMLElement>("button") ?? [])];

const moveFocus = (delta: number): void => {
  const buttons = buttonsIn();
  if (buttons.length === 0) return;
  focused.value = (focused.value + delta + buttons.length) % buttons.length;
  buttons[focused.value]?.focus();
};

/**
 * Arrow keys move within the toolbar. Handled by key name rather than with Vue's `.left` /
 * `.right` modifiers, which also mean mouse buttons and are ambiguous on a keyboard event.
 */
const onKeydown = (event: KeyboardEvent): void => {
  const steps = new Map<string, number>([
    ["ArrowRight", 1],
    ["ArrowLeft", -1],
    ["Home", -focused.value],
    ["End", buttonsIn().length - 1 - focused.value],
  ]);
  const step = steps.get(event.key);
  if (step === undefined) return;
  event.preventDefault();
  moveFocus(step);
};

/** The swatch each accent renders as. Tailwind needs the class names written out to generate them. */
const SWATCH: Record<AccentColor, string> = {
  primary: "bg-sky-500",
  accent: "bg-violet-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-cyan-500",
  highlight: "bg-fuchsia-500",
};
</script>

<template>
  <!--
    `mousedown.prevent` is the whole reason this works: without it, pressing a button blurs
    the element being edited, the blur commits, and the fragment is rebuilt before the click
    ever reaches the handler — so the format applies to a selection that no longer exists.
  -->
  <div
    ref="shell"
    class="fixed z-50 flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-1.5 py-1 text-xs shadow-lg"
    :style="{ left: `${x - origin.x}px`, top: `${y - origin.y}px` }"
    role="toolbar"
    aria-label="Format selection"
    @mousedown.prevent
    @keydown="onKeydown"
  >
    <button
      type="button"
      :tabindex="focused === 0 ? 0 : -1"
      class="rounded px-2 py-1 font-bold hover:bg-stone-100"
      aria-label="Bold"
      title="Bold (** … **) — press again to remove"
      @click="emit('bold')"
      @focus="focused = 0"
    >
      B
    </button>
    <button
      type="button"
      :tabindex="focused === 1 ? 0 : -1"
      class="rounded px-2 py-1 font-extrabold text-amber-500 hover:bg-stone-100"
      aria-label="Emphasis"
      title="Emphasis (* … *) — press again to remove"
      @click="emit('emphasis')"
      @focus="focused = 1"
    >
      ★
    </button>
    <div class="mx-1 h-4 w-px bg-stone-200"></div>
    <button
      v-for="(color, index) in ACCENT_COLORS"
      :key="color"
      type="button"
      :tabindex="focused === index + 2 ? 0 : -1"
      class="h-5 w-5 rounded-full border border-stone-200 transition-transform hover:scale-110"
      :class="SWATCH[color]"
      :title="`Colour: ${color} ({${color}: … })`"
      :aria-label="`Colour: ${color}`"
      @click="emit('color', color)"
      @focus="focused = index + 2"
    ></button>
    <div class="mx-1 h-4 w-px bg-stone-200"></div>
    <button
      type="button"
      :tabindex="focused === ACCENT_COLORS.length + 2 ? 0 : -1"
      class="rounded px-2 py-1 text-stone-500 hover:bg-stone-100"
      aria-label="Clear formatting"
      title="Clear formatting in selection"
      @click="emit('clear')"
      @focus="focused = ACCENT_COLORS.length + 2"
    >
      ×
    </button>
  </div>
</template>
