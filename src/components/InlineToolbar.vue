<script setup lang="ts">
import { ACCENT_COLORS } from "../editorHelpers";
import type { AccentColor } from "../inlineFormat";

defineProps<{ x: number; y: number }>();

const emit = defineEmits<{
  bold: [];
  emphasis: [];
  color: [color: AccentColor];
  clear: [];
}>();

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
    class="fixed z-50 flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-1.5 py-1 text-xs shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    role="toolbar"
    aria-label="Format selection"
    @mousedown.prevent
  >
    <button type="button" class="rounded px-2 py-1 font-bold hover:bg-stone-100" title="Bold (** … **) — press again to remove" @click="emit('bold')">B</button>
    <button
      type="button"
      class="rounded px-2 py-1 font-extrabold text-amber-500 hover:bg-stone-100"
      title="Emphasis (* … *) — press again to remove"
      @click="emit('emphasis')"
    >
      ★
    </button>
    <div class="mx-1 h-4 w-px bg-stone-200"></div>
    <button
      v-for="color in ACCENT_COLORS"
      :key="color"
      type="button"
      class="h-5 w-5 rounded-full border border-stone-200 transition-transform hover:scale-110"
      :class="SWATCH[color]"
      :title="`Colour: ${color} ({${color}: … })`"
      :aria-label="`Colour: ${color}`"
      @click="emit('color', color)"
    ></button>
    <div class="mx-1 h-4 w-px bg-stone-200"></div>
    <button type="button" class="rounded px-2 py-1 text-stone-500 hover:bg-stone-100" title="Clear formatting in selection" @click="emit('clear')">×</button>
  </div>
</template>
