<script setup lang="ts">
import type { ContentBlock, BulletItem } from "@mulmocast/deck";
import AccentColorSelect from "./AccentColorSelect.vue";
import { BLOCK_TYPES, TEXT_SIZES, BULLET_ICONS, ALIGNS, CALLOUT_STYLES, makeBlock, clone } from "../editorHelpers";

const props = defineProps<{ block: ContentBlock; index: number; total: number }>();
const emit = defineEmits<{
  update: [block: ContentBlock];
  remove: [];
  move: [delta: number];
}>();

const patch = (partial: Partial<ContentBlock>) => {
  emit("update", { ...(props.block as object), ...partial } as ContentBlock);
};

const setType = (t: ContentBlock["type"]) => {
  if (t === props.block.type) return;
  // Swap the entire block. The old fields are dropped — that's the user's intent when changing type.
  emit("update", makeBlock(t));
};

// ─── helpers for bullets-block items ───
const bulletText = (item: BulletItem): string => (typeof item === "string" ? item : item.text);
const isBulletObj = (item: BulletItem): item is Exclude<BulletItem, string> => typeof item !== "string";

const updateBulletItem = (i: number, changes: Partial<Exclude<BulletItem, string>>) => {
  if (props.block.type !== "bullets") return;
  const items = props.block.items.map((it, idx) => {
    if (idx !== i) return it;
    const obj = isBulletObj(it) ? { ...it } : { text: it };
    Object.assign(obj, changes);
    // Drop the object form back to plain string when nothing extra survives.
    const hasExtras = obj.icon !== undefined || obj.size !== undefined || (obj.items?.length ?? 0) > 0;
    return hasExtras ? obj : obj.text;
  });
  patch({ items } as Partial<ContentBlock>);
};

const setBulletText = (i: number, text: string) => {
  if (props.block.type !== "bullets") return;
  const items = props.block.items.map((it, idx) => {
    if (idx !== i) return it;
    if (isBulletObj(it)) return { ...it, text };
    return text;
  });
  patch({ items } as Partial<ContentBlock>);
};

const addBulletItem = () => {
  if (props.block.type !== "bullets") return;
  patch({ items: [...props.block.items, "New item"] } as Partial<ContentBlock>);
};

const removeBulletItem = (i: number) => {
  if (props.block.type !== "bullets") return;
  const items = props.block.items.slice();
  items.splice(i, 1);
  patch({ items } as Partial<ContentBlock>);
};

// ─── table block helpers ───
const setTableCell = (r: number, c: number, value: string) => {
  if (props.block.type !== "table") return;
  const rows = clone(props.block.rows);
  if (!rows[r]) rows[r] = [];
  rows[r][c] = value;
  patch({ rows } as Partial<ContentBlock>);
};
const addTableRow = () => {
  if (props.block.type !== "table") return;
  const headerCount = props.block.headers?.length ?? 1;
  const rows = clone(props.block.rows);
  rows.push(Array(headerCount).fill(""));
  patch({ rows } as Partial<ContentBlock>);
};
const removeTableRow = (r: number) => {
  if (props.block.type !== "table") return;
  const rows = clone(props.block.rows);
  rows.splice(r, 1);
  patch({ rows } as Partial<ContentBlock>);
};
const addTableCol = () => {
  if (props.block.type !== "table") return;
  const headers = (props.block.headers ?? []).concat(["New column"]);
  const rows = props.block.rows.map((row) => row.concat([""]));
  patch({ headers, rows } as Partial<ContentBlock>);
};
const removeTableCol = (c: number) => {
  if (props.block.type !== "table") return;
  const headers = (props.block.headers ?? []).slice();
  headers.splice(c, 1);
  const rows = props.block.rows.map((row) => {
    const copy = row.slice();
    copy.splice(c, 1);
    return copy;
  });
  patch({ headers, rows } as Partial<ContentBlock>);
};
const setTableHeader = (c: number, value: string) => {
  if (props.block.type !== "table") return;
  const headers = (props.block.headers ?? []).slice();
  headers[c] = value;
  patch({ headers } as Partial<ContentBlock>);
};

const cellText = (cell: unknown): string => {
  if (typeof cell === "string") return cell;
  if (cell && typeof cell === "object" && "text" in cell) return String((cell as { text: string }).text);
  return "";
};
</script>

<template>
  <div class="rounded-md border border-stone-200 bg-stone-50/40 p-2.5 space-y-2 text-xs">
    <div class="flex items-center gap-2">
      <select
        :value="block.type"
        class="rounded border border-stone-300 bg-white px-1.5 py-1 text-[11px] font-mono"
        @change="setType(($event.target as HTMLSelectElement).value as ContentBlock['type'])"
      >
        <option v-for="t in BLOCK_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
      <span class="text-[10px] text-stone-400">#{{ index + 1 }}</span>
      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          :disabled="index === 0"
          class="rounded px-1.5 py-0.5 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
          @click="emit('move', -1)"
        >
          ↑
        </button>
        <button
          type="button"
          :disabled="index === total - 1"
          class="rounded px-1.5 py-0.5 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
          @click="emit('move', 1)"
        >
          ↓
        </button>
        <button type="button" class="rounded px-1.5 py-0.5 text-rose-600 hover:bg-rose-100" @click="emit('remove')">×</button>
      </div>
    </div>

    <!-- text -->
    <template v-if="block.type === 'text'">
      <textarea
        :value="block.value"
        rows="2"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1 font-mono"
        @input="patch({ value: ($event.target as HTMLTextAreaElement).value })"
      />
      <div class="flex flex-wrap gap-2">
        <label class="flex items-center gap-1"
          >size
          <select
            :value="block.size ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ size: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">default</option>
            <option v-for="s in TEXT_SIZES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1"
          >align
          <select
            :value="block.align ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ align: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">default</option>
            <option v-for="a in ALIGNS" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1"
          >color
          <AccentColorSelect :model-value="block.color" placeholder="default" @update:model-value="patch({ color: $event })" />
        </label>
        <label class="flex items-center gap-1"
          ><input type="checkbox" :checked="!!block.bold" @change="patch({ bold: ($event.target as HTMLInputElement).checked || undefined })" />bold</label
        >
        <label class="flex items-center gap-1"
          ><input type="checkbox" :checked="!!block.dim" @change="patch({ dim: ($event.target as HTMLInputElement).checked || undefined })" />dim</label
        >
      </div>
    </template>

    <!-- bullets -->
    <template v-if="block.type === 'bullets'">
      <div class="flex flex-wrap gap-2">
        <label class="flex items-center gap-1"
          >size
          <select
            :value="block.size ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ size: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">default</option>
            <option v-for="s in TEXT_SIZES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1"
          ><input
            type="checkbox"
            :checked="!!block.ordered"
            @change="patch({ ordered: ($event.target as HTMLInputElement).checked || undefined })"
          />ordered</label
        >
        <label class="flex items-center gap-1"
          >marker
          <input
            type="text"
            :value="block.icon ?? ''"
            placeholder="• ★ ▶"
            class="w-12 rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="patch({ icon: ($event.target as HTMLInputElement).value || undefined })"
          />
        </label>
      </div>
      <ul class="space-y-1">
        <li v-for="(item, i) in block.items" :key="i" class="flex flex-wrap items-start gap-1 rounded border border-stone-200 bg-white p-1">
          <input
            type="text"
            :value="bulletText(item)"
            class="min-w-0 flex-1 rounded border border-stone-200 px-1.5 py-0.5"
            @input="setBulletText(i, ($event.target as HTMLInputElement).value)"
          />
          <select
            :value="isBulletObj(item) ? (item.icon ?? '') : ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5 text-[10px]"
            @change="updateBulletItem(i, { icon: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">—</option>
            <option v-for="ic in BULLET_ICONS" :key="ic" :value="ic">{{ ic }}</option>
          </select>
          <select
            :value="isBulletObj(item) ? (item.size ?? '') : ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5 text-[10px]"
            @change="updateBulletItem(i, { size: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">—</option>
            <option v-for="s in TEXT_SIZES" :key="s" :value="s">{{ s }}</option>
          </select>
          <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeBulletItem(i)">×</button>
        </li>
      </ul>
      <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addBulletItem">+ item</button>
    </template>

    <!-- callout -->
    <template v-if="block.type === 'callout'">
      <input
        type="text"
        :value="block.label ?? ''"
        placeholder="label (optional)"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ label: ($event.target as HTMLInputElement).value || undefined })"
      />
      <textarea
        :value="block.text"
        rows="2"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ text: ($event.target as HTMLTextAreaElement).value })"
      />
      <div class="flex flex-wrap gap-2">
        <label class="flex items-center gap-1"
          >style
          <select
            :value="block.style ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ style: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">default</option>
            <option v-for="s in CALLOUT_STYLES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1"
          >color
          <AccentColorSelect :model-value="block.color" placeholder="default" @update:model-value="patch({ color: $event })" />
        </label>
        <label class="flex items-center gap-1"
          >size
          <select
            :value="block.size ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ size: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">default</option>
            <option v-for="s in TEXT_SIZES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
      </div>
    </template>

    <!-- tag -->
    <template v-if="block.type === 'tag'">
      <input
        type="text"
        :value="block.text"
        placeholder="TAG TEXT"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1 font-mono uppercase tracking-wider"
        @input="patch({ text: ($event.target as HTMLInputElement).value })"
      />
      <label class="flex items-center gap-1 text-[11px]"
        >color
        <AccentColorSelect :model-value="block.color" placeholder="default" @update:model-value="patch({ color: $event })" />
      </label>
    </template>

    <!-- code -->
    <template v-if="block.type === 'code'">
      <input
        type="text"
        :value="block.language ?? ''"
        placeholder="language"
        class="w-32 rounded border border-stone-300 bg-white px-2 py-1 font-mono"
        @input="patch({ language: ($event.target as HTMLInputElement).value || undefined })"
      />
      <textarea
        :value="block.code"
        rows="4"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1 font-mono text-[11px]"
        @input="patch({ code: ($event.target as HTMLTextAreaElement).value })"
      />
    </template>

    <!-- metric -->
    <template v-if="block.type === 'metric'">
      <div class="flex gap-2">
        <input
          type="text"
          :value="block.value"
          placeholder="value"
          class="flex-1 rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch({ value: ($event.target as HTMLInputElement).value })"
        />
        <input
          type="text"
          :value="block.label"
          placeholder="label"
          class="flex-1 rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch({ label: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="flex gap-2">
        <input
          type="text"
          :value="block.change ?? ''"
          placeholder="+5%"
          class="w-24 rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch({ change: ($event.target as HTMLInputElement).value || undefined })"
        />
        <AccentColorSelect :model-value="block.color" placeholder="color" @update:model-value="patch({ color: $event })" />
      </div>
    </template>

    <!-- divider -->
    <template v-if="block.type === 'divider'">
      <label class="flex items-center gap-1 text-[11px]"
        >color
        <AccentColorSelect :model-value="block.color" placeholder="default" @update:model-value="patch({ color: $event })" />
      </label>
    </template>

    <!-- image -->
    <template v-if="block.type === 'image'">
      <input
        type="text"
        :value="block.src"
        placeholder="src (url / data url)"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ src: ($event.target as HTMLInputElement).value })"
      />
      <input
        type="text"
        :value="block.alt ?? ''"
        placeholder="alt"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ alt: ($event.target as HTMLInputElement).value || undefined })"
      />
    </template>

    <!-- imageRef -->
    <template v-if="block.type === 'imageRef'">
      <input
        type="text"
        :value="block.ref"
        placeholder="ref key"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1 font-mono"
        @input="patch({ ref: ($event.target as HTMLInputElement).value })"
      />
      <input
        type="text"
        :value="block.alt ?? ''"
        placeholder="alt"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ alt: ($event.target as HTMLInputElement).value || undefined })"
      />
    </template>

    <!-- chart -->
    <template v-if="block.type === 'chart'">
      <input
        type="text"
        :value="block.title ?? ''"
        placeholder="title"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ title: ($event.target as HTMLInputElement).value || undefined })"
      />
      <textarea
        :value="JSON.stringify(block.chartData, null, 2)"
        rows="5"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1 font-mono text-[11px]"
        @input="
          (() => {
            try {
              patch({ chartData: JSON.parse(($event.target as HTMLTextAreaElement).value) });
            } catch {
              /* ignore until JSON is valid */
            }
          })()
        "
      />
    </template>

    <!-- mermaid -->
    <template v-if="block.type === 'mermaid'">
      <input
        type="text"
        :value="block.title ?? ''"
        placeholder="title"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ title: ($event.target as HTMLInputElement).value || undefined })"
      />
      <textarea
        :value="block.code"
        rows="5"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1 font-mono text-[11px]"
        @input="patch({ code: ($event.target as HTMLTextAreaElement).value })"
      />
    </template>

    <!-- section (label only; nested content edited via JSON for now) -->
    <template v-if="block.type === 'section'">
      <input
        type="text"
        :value="block.label"
        placeholder="section label"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch({ label: ($event.target as HTMLInputElement).value })"
      />
      <AccentColorSelect :model-value="block.color" placeholder="color" @update:model-value="patch({ color: $event })" />
      <p class="text-[10px] text-stone-400">A section's contents are edited as JSON for now.</p>
    </template>

    <!-- table -->
    <template v-if="block.type === 'table'">
      <table class="w-full text-[11px]">
        <thead>
          <tr>
            <th v-for="(h, c) in block.headers ?? []" :key="c" class="px-1 py-0.5 text-left">
              <div class="flex items-center gap-1">
                <input
                  type="text"
                  :value="h"
                  class="min-w-0 flex-1 rounded border border-stone-300 bg-white px-1 py-0.5 font-bold"
                  @input="setTableHeader(c, ($event.target as HTMLInputElement).value)"
                />
                <button type="button" class="text-rose-600" @click="removeTableCol(c)">×</button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in block.rows" :key="r">
            <td v-for="(cell, c) in row" :key="c" class="px-1 py-0.5">
              <input
                type="text"
                :value="cellText(cell)"
                class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
                @input="setTableCell(r, c, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-1"><button type="button" class="text-rose-600" @click="removeTableRow(r)">×</button></td>
          </tr>
        </tbody>
      </table>
      <div class="flex gap-2">
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addTableRow">+ row</button>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addTableCol">+ column</button>
      </div>
    </template>
  </div>
</template>
