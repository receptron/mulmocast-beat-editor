<script setup lang="ts">
import { computed } from "vue";
import type { SlideLayout } from "@mulmocast/deck";
import InspectorForm from "./InspectorForm.vue";
import { inspectableSlide } from "../inspectableSlide";

// The form reads into a slide's objects without checking, so it is handed one it can render; an edit
// then writes that repaired slide back. See inspectableSlide.
const props = defineProps<{ slide: SlideLayout }>();
const emit = defineEmits<{ update: [slide: SlideLayout] }>();
const renderable = computed(() => inspectableSlide(props.slide));
</script>

<template>
  <InspectorForm :slide="renderable" @update="emit('update', $event)" />
</template>
