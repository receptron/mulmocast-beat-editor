<script setup lang="ts">
import type { AccentColorKey } from "@mulmocast/deck";
import { ACCENT_COLORS } from "../editorHelpers";

defineProps<{ modelValue?: AccentColorKey; placeholder?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: AccentColorKey | undefined] }>();

// `find` is the type guard: an empty selection and an unknown string both come back undefined,
// which is what every caller means by "no accent".
const pick = (event: Event) => {
  const target = event.target;
  const value = target instanceof HTMLSelectElement ? target.value : "";
  emit(
    "update:modelValue",
    ACCENT_COLORS.find((accent) => accent === value),
  );
};
</script>

<template>
  <select :value="modelValue ?? ''" class="rounded border border-stone-300 bg-white px-1 py-0.5" @change="pick">
    <option value="">{{ placeholder ?? "—" }}</option>
    <option v-for="accent in ACCENT_COLORS" :key="accent" :value="accent">{{ accent }}</option>
  </select>
</template>
