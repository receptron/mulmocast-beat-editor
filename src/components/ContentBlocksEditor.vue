<script setup lang="ts">
import type { ContentBlock } from "@mulmocast/deck";
import { BLOCK_TYPES, makeBlock, moveInArray } from "../editorHelpers";
import ContentBlockEditor from "./ContentBlockEditor.vue";

const props = defineProps<{ blocks?: ContentBlock[]; label?: string }>();
const emit = defineEmits<{ update: [blocks: ContentBlock[]] }>();

const list = () => props.blocks ?? [];

const onBlockUpdate = (i: number, block: ContentBlock) => {
  const next = list().slice();
  next[i] = block;
  emit("update", next);
};
const onBlockRemove = (i: number) => {
  const next = list().slice();
  next.splice(i, 1);
  emit("update", next);
};
const onBlockMove = (i: number, delta: number) => {
  emit("update", moveInArray(list(), i, delta));
};
const addBlock = (type: ContentBlock["type"]) => {
  emit("update", list().concat([makeBlock(type)]));
};
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{{ label ?? "Content" }}</span>
      <select
        class="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[11px]"
        @change="
          (e) => {
            const v = (e.target as HTMLSelectElement).value;
            if (v) {
              addBlock(v as ContentBlock['type']);
              (e.target as HTMLSelectElement).value = '';
            }
          }
        "
      >
        <option value="">+ Add block</option>
        <option v-for="t in BLOCK_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>
    <div v-if="list().length === 0" class="rounded border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-400">
      No content blocks
    </div>
    <ContentBlockEditor
      v-for="(b, i) in list()"
      :key="i"
      :block="b"
      :index="i"
      :total="list().length"
      @update="onBlockUpdate(i, $event)"
      @remove="onBlockRemove(i)"
      @move="onBlockMove(i, $event)"
    />
  </div>
</template>
