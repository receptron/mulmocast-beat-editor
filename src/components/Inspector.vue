<script setup lang="ts">
import type {
  SlideLayout,
  ContentBlock,
  ComparisonPanel,
  SplitPanel,
  TitleSlide,
  StatsSlide,
  TimelineSlide,
  ManifestoSlide,
  ColumnsSlide,
  GridSlide,
  ComparisonSlide,
  SplitSlide,
  MatrixSlide,
  TableSlide,
  FunnelSlide,
  WaterfallSlide,
  BigQuoteSlide,
} from "@mulmocast/deck";
import AccentColorSelect from "./AccentColorSelect.vue";
import { SLIDE_DENSITIES, SLIDE_TITLE_SIZES, SLIDE_SUBTITLE_SIZES, LAYOUT_TYPES, VALIGNS, clone, moveInArray, makeSlide } from "../editorHelpers";
import ContentBlocksEditor from "./ContentBlocksEditor.vue";

const props = defineProps<{ slide: SlideLayout }>();
const emit = defineEmits<{ update: [slide: SlideLayout] }>();

const replace = (next: SlideLayout) => emit("update", next);
const patch = <T extends SlideLayout>(partial: Partial<T>) => {
  emit("update", { ...(props.slide as object), ...partial } as SlideLayout);
};

const switchLayout = (layout: SlideLayout["layout"]) => {
  if (layout === props.slide.layout) return;
  const next = makeSlide(layout);
  // Carry over slide-level common fields the user has already set.
  const carry: Record<string, unknown> = {};
  if ("title" in props.slide && typeof props.slide.title === "string") carry.title = props.slide.title;
  if (props.slide.accentColor) carry.accentColor = props.slide.accentColor;
  if (props.slide.eyebrow) carry.eyebrow = props.slide.eyebrow;
  if (props.slide.density) carry.density = props.slide.density;
  if (props.slide.titleSize) carry.titleSize = props.slide.titleSize;
  if (props.slide.subtitleSize) carry.subtitleSize = props.slide.subtitleSize;
  replace({ ...next, ...carry } as SlideLayout);
};

const setEyebrow = (changes: Partial<NonNullable<SlideLayout["eyebrow"]>>) => {
  const current = props.slide.eyebrow ?? { label: "" };
  const next = { ...current, ...changes };
  if (!next.label) {
    patch({ eyebrow: undefined } as Partial<SlideLayout>);
    return;
  }
  patch({ eyebrow: next } as Partial<SlideLayout>);
};

// ─── title chips ───
const updateChip = (i: number, v: string) => {
  if (props.slide.layout !== "title") return;
  const chips = (props.slide.chips ?? []).slice();
  chips[i] = v;
  patch<TitleSlide>({ chips });
};
const addChip = () => {
  if (props.slide.layout !== "title") return;
  patch<TitleSlide>({ chips: [...(props.slide.chips ?? []), "🚀 new chip"] });
};
const removeChip = (i: number) => {
  if (props.slide.layout !== "title") return;
  const chips = (props.slide.chips ?? []).slice();
  chips.splice(i, 1);
  patch<TitleSlide>({ chips: chips.length ? chips : undefined });
};

// ─── stats ───
const updateStat = (i: number, changes: Partial<StatsSlide["stats"][number]>) => {
  if (props.slide.layout !== "stats") return;
  const stats = props.slide.stats.map((s, idx) => (idx === i ? { ...s, ...changes } : s));
  patch<StatsSlide>({ stats });
};
const addStat = () => {
  if (props.slide.layout !== "stats") return;
  patch<StatsSlide>({ stats: [...props.slide.stats, { value: "0", label: "New metric" }] });
};
const removeStat = (i: number) => {
  if (props.slide.layout !== "stats") return;
  const stats = props.slide.stats.slice();
  stats.splice(i, 1);
  patch<StatsSlide>({ stats });
};
const moveStat = (i: number, d: number) => {
  if (props.slide.layout !== "stats") return;
  patch<StatsSlide>({ stats: moveInArray(props.slide.stats, i, d) });
};

// ─── timeline ───
const updateTimelineItem = (i: number, changes: Partial<TimelineSlide["items"][number]>) => {
  if (props.slide.layout !== "timeline") return;
  const items = props.slide.items.map((it, idx) => (idx === i ? { ...it, ...changes } : it));
  patch<TimelineSlide>({ items });
};
const addTimelineItem = () => {
  if (props.slide.layout !== "timeline") return;
  patch<TimelineSlide>({ items: [...props.slide.items, { date: "Qn", title: "New step" }] });
};
const removeTimelineItem = (i: number) => {
  if (props.slide.layout !== "timeline") return;
  const items = props.slide.items.slice();
  items.splice(i, 1);
  patch<TimelineSlide>({ items });
};
const moveTimelineItem = (i: number, d: number) => {
  if (props.slide.layout !== "timeline") return;
  patch<TimelineSlide>({ items: moveInArray(props.slide.items, i, d) });
};

// ─── manifesto ───
const updateManifestoItem = (i: number, changes: Partial<ManifestoSlide["items"][number]>) => {
  if (props.slide.layout !== "manifesto") return;
  const items = props.slide.items.map((it, idx) => (idx === i ? { ...it, ...changes } : it));
  patch<ManifestoSlide>({ items });
};
const addManifestoItem = () => {
  if (props.slide.layout !== "manifesto") return;
  patch<ManifestoSlide>({ items: [...props.slide.items, { title: "New principle" }] });
};
const removeManifestoItem = (i: number) => {
  if (props.slide.layout !== "manifesto") return;
  const items = props.slide.items.slice();
  items.splice(i, 1);
  patch<ManifestoSlide>({ items });
};
const moveManifestoItem = (i: number, d: number) => {
  if (props.slide.layout !== "manifesto") return;
  patch<ManifestoSlide>({ items: moveInArray(props.slide.items, i, d) });
};

// ─── columns ───
const updateColumn = (i: number, changes: Partial<ColumnsSlide["columns"][number]>) => {
  if (props.slide.layout !== "columns") return;
  const columns = props.slide.columns.map((c, idx) => (idx === i ? { ...c, ...changes } : c));
  patch<ColumnsSlide>({ columns });
};
const setColumnContent = (i: number, content: ContentBlock[]) => updateColumn(i, { content: content.length ? content : undefined });
const addColumn = () => {
  if (props.slide.layout !== "columns") return;
  patch<ColumnsSlide>({ columns: [...props.slide.columns, { title: "New column" }] });
};
const removeColumn = (i: number) => {
  if (props.slide.layout !== "columns") return;
  const columns = props.slide.columns.slice();
  columns.splice(i, 1);
  patch<ColumnsSlide>({ columns });
};
const moveColumn = (i: number, d: number) => {
  if (props.slide.layout !== "columns") return;
  patch<ColumnsSlide>({ columns: moveInArray(props.slide.columns, i, d) });
};

// ─── grid ───
const updateGridItem = (i: number, changes: Partial<GridSlide["items"][number]>) => {
  if (props.slide.layout !== "grid") return;
  const items = props.slide.items.map((it, idx) => (idx === i ? { ...it, ...changes } : it));
  patch<GridSlide>({ items });
};
const setGridItemContent = (i: number, content: ContentBlock[]) => updateGridItem(i, { content: content.length ? content : undefined });
const addGridItem = () => {
  if (props.slide.layout !== "grid") return;
  patch<GridSlide>({ items: [...props.slide.items, { title: "New item" }] });
};
const removeGridItem = (i: number) => {
  if (props.slide.layout !== "grid") return;
  const items = props.slide.items.slice();
  items.splice(i, 1);
  patch<GridSlide>({ items });
};
const moveGridItem = (i: number, d: number) => {
  if (props.slide.layout !== "grid") return;
  patch<GridSlide>({ items: moveInArray(props.slide.items, i, d) });
};

// ─── comparison panel ───
const updatePanel = (side: "left" | "right", changes: Partial<ComparisonPanel>) => {
  if (props.slide.layout !== "comparison") return;
  patch<ComparisonSlide>({ [side]: { ...props.slide[side], ...changes } } as Partial<ComparisonSlide>);
};
const setPanelContent = (side: "left" | "right", content: ContentBlock[]) => updatePanel(side, { content: content.length ? content : undefined });

// ─── split panel ───
const updateSplit = (side: "left" | "right", changes: Partial<SplitPanel>) => {
  if (props.slide.layout !== "split") return;
  const current = props.slide[side] ?? {};
  patch<SplitSlide>({ [side]: { ...current, ...changes } } as Partial<SplitSlide>);
};
const setSplitContent = (side: "left" | "right", content: ContentBlock[]) => updateSplit(side, { content: content.length ? content : undefined });

// ─── matrix ───
const updateMatrixCell = (i: number, changes: Partial<MatrixSlide["cells"][number]>) => {
  if (props.slide.layout !== "matrix") return;
  const cells = props.slide.cells.map((c, idx) => (idx === i ? { ...c, ...changes } : c));
  patch<MatrixSlide>({ cells });
};
const setMatrixContent = (i: number, content: ContentBlock[]) => updateMatrixCell(i, { content: content.length ? content : undefined });

// ─── funnel ───
const updateFunnelStage = (i: number, changes: Partial<FunnelSlide["stages"][number]>) => {
  if (props.slide.layout !== "funnel") return;
  const stages = props.slide.stages.map((s, idx) => (idx === i ? { ...s, ...changes } : s));
  patch<FunnelSlide>({ stages });
};
const addFunnelStage = () => {
  if (props.slide.layout !== "funnel") return;
  patch<FunnelSlide>({ stages: [...props.slide.stages, { label: "Step", value: "0" }] });
};
const removeFunnelStage = (i: number) => {
  if (props.slide.layout !== "funnel") return;
  const stages = props.slide.stages.slice();
  stages.splice(i, 1);
  patch<FunnelSlide>({ stages });
};

// ─── waterfall ───
const updateWaterfallItem = (i: number, changes: Partial<WaterfallSlide["items"][number]>) => {
  if (props.slide.layout !== "waterfall") return;
  const items = props.slide.items.map((it, idx) => (idx === i ? { ...it, ...changes } : it));
  patch<WaterfallSlide>({ items });
};
const addWaterfallItem = () => {
  if (props.slide.layout !== "waterfall") return;
  patch<WaterfallSlide>({ items: [...props.slide.items, { label: "Step", value: 0 }] });
};
const removeWaterfallItem = (i: number) => {
  if (props.slide.layout !== "waterfall") return;
  const items = props.slide.items.slice();
  items.splice(i, 1);
  patch<WaterfallSlide>({ items });
};

// ─── table slide ───
const setTableSlideHeader = (c: number, value: string) => {
  if (props.slide.layout !== "table") return;
  const headers = (props.slide.headers ?? []).slice();
  headers[c] = value;
  patch<TableSlide>({ headers });
};
const setTableSlideCell = (r: number, c: number, value: string) => {
  if (props.slide.layout !== "table") return;
  const rows = clone(props.slide.rows);
  if (!rows[r]) rows[r] = [];
  rows[r][c] = value;
  patch<TableSlide>({ rows });
};
const addTableSlideRow = () => {
  if (props.slide.layout !== "table") return;
  const headerCount = (props.slide.headers ?? []).length || 1;
  const rows = clone(props.slide.rows);
  rows.push(Array(headerCount).fill(""));
  patch<TableSlide>({ rows });
};
const removeTableSlideRow = (r: number) => {
  if (props.slide.layout !== "table") return;
  const rows = clone(props.slide.rows);
  rows.splice(r, 1);
  patch<TableSlide>({ rows });
};
const addTableSlideCol = () => {
  if (props.slide.layout !== "table") return;
  const headers = (props.slide.headers ?? []).concat(["New column"]);
  const rows = props.slide.rows.map((row) => row.concat([""]));
  patch<TableSlide>({ headers, rows });
};
const removeTableSlideCol = (c: number) => {
  if (props.slide.layout !== "table") return;
  const headers = (props.slide.headers ?? []).slice();
  headers.splice(c, 1);
  const rows = props.slide.rows.map((row) => {
    const r = row.slice();
    r.splice(c, 1);
    return r;
  });
  patch<TableSlide>({ headers, rows });
};
const tableCellText = (cell: unknown): string => {
  if (typeof cell === "string") return cell;
  if (cell && typeof cell === "object" && "text" in cell) return String((cell as { text: string }).text);
  return "";
};
</script>

<template>
  <div class="space-y-5 p-4 text-xs">
    <header class="flex items-center justify-between border-b border-stone-200 pb-3">
      <h2 class="text-sm font-semibold tracking-wide text-stone-700">Inspector</h2>
      <select
        :value="slide.layout"
        class="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[11px] font-mono"
        @change="switchLayout(($event.target as HTMLSelectElement).value as SlideLayout['layout'])"
      >
        <option v-for="l in LAYOUT_TYPES" :key="l" :value="l">{{ l }}</option>
      </select>
    </header>

    <!-- ─── slide-level common fields ─── -->
    <section class="space-y-2">
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-stone-500">Slide</span>
      <label v-if="'title' in slide" class="block">
        Title
        <input
          type="text"
          :value="(slide as { title?: string }).title ?? ''"
          class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch({ title: ($event.target as HTMLInputElement).value } as Partial<SlideLayout>)"
        />
      </label>
      <label v-if="'subtitle' in slide" class="block">
        Subtitle
        <input
          type="text"
          :value="(slide as { subtitle?: string }).subtitle ?? ''"
          class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch({ subtitle: ($event.target as HTMLInputElement).value || undefined } as Partial<SlideLayout>)"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <label class="flex items-center gap-1"
          >accent
          <AccentColorSelect :model-value="slide.accentColor" @update:model-value="patch({ accentColor: $event })" />
        </label>
        <label class="flex items-center gap-1"
          >density
          <select
            :value="slide.density ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ density: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">—</option>
            <option v-for="d in SLIDE_DENSITIES" :key="d" :value="d">{{ d }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1"
          >titleSize
          <select
            :value="slide.titleSize ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ titleSize: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">—</option>
            <option v-for="t in SLIDE_TITLE_SIZES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1"
          >subtitleSize
          <select
            :value="slide.subtitleSize ?? ''"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @change="patch({ subtitleSize: (($event.target as HTMLSelectElement).value || undefined) as never })"
          >
            <option value="">—</option>
            <option v-for="s in SLIDE_SUBTITLE_SIZES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
      </div>
      <div class="rounded border border-stone-200 bg-stone-50/40 p-2">
        <div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Eyebrow</div>
        <div class="flex gap-2">
          <input
            type="text"
            :value="slide.eyebrow?.label ?? ''"
            placeholder="(empty = none)"
            class="flex-1 rounded border border-stone-300 bg-white px-2 py-1"
            @input="setEyebrow({ label: ($event.target as HTMLInputElement).value })"
          />
          <AccentColorSelect :model-value="slide.eyebrow?.color" placeholder="color" @update:model-value="setEyebrow({ color: $event })" />
        </div>
      </div>
    </section>

    <!-- title -->
    <section v-if="slide.layout === 'title'" class="space-y-2">
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-stone-500">Title slide</span>
      <label class="block"
        >Author
        <input
          type="text"
          :value="slide.author ?? ''"
          class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch<TitleSlide>({ author: ($event.target as HTMLInputElement).value || undefined })"
        />
      </label>
      <label class="block"
        >Note
        <input
          type="text"
          :value="slide.note ?? ''"
          class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch<TitleSlide>({ note: ($event.target as HTMLInputElement).value || undefined })"
        />
      </label>
      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Chips</span>
          <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addChip">+ chip</button>
        </div>
        <ul class="space-y-1">
          <li v-for="(chip, i) in slide.chips ?? []" :key="i" class="flex gap-1">
            <input
              type="text"
              :value="chip"
              class="flex-1 rounded border border-stone-300 bg-white px-2 py-1"
              @input="updateChip(i, ($event.target as HTMLInputElement).value)"
            />
            <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeChip(i)">×</button>
          </li>
        </ul>
      </div>
    </section>

    <!-- bigQuote -->
    <section v-if="slide.layout === 'bigQuote'" class="space-y-2">
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-stone-500">Big quote</span>
      <textarea
        :value="slide.quote"
        rows="3"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch<BigQuoteSlide>({ quote: ($event.target as HTMLTextAreaElement).value })"
      />
      <label class="block"
        >Author
        <input
          type="text"
          :value="slide.author ?? ''"
          class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch<BigQuoteSlide>({ author: ($event.target as HTMLInputElement).value || undefined })"
        />
      </label>
      <label class="block"
        >Role
        <input
          type="text"
          :value="slide.role ?? ''"
          class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1"
          @input="patch<BigQuoteSlide>({ role: ($event.target as HTMLInputElement).value || undefined })"
        />
      </label>
    </section>

    <!-- stats -->
    <section v-if="slide.layout === 'stats'" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Stats</span>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addStat">+ stat</button>
      </div>
      <div v-for="(s, i) in slide.stats" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="flex items-center justify-between text-[10px] text-stone-400">
          <span>#{{ i + 1 }}</span>
          <div class="flex gap-1">
            <button type="button" :disabled="i === 0" class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30" @click="moveStat(i, -1)">
              ↑
            </button>
            <button
              type="button"
              :disabled="i === slide.stats.length - 1"
              class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              @click="moveStat(i, 1)"
            >
              ↓
            </button>
            <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeStat(i)">×</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1">
          <input
            type="text"
            :value="s.value"
            placeholder="value"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateStat(i, { value: ($event.target as HTMLInputElement).value })"
          />
          <input
            type="text"
            :value="s.label"
            placeholder="label"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateStat(i, { label: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div class="grid grid-cols-3 gap-1">
          <input
            type="text"
            :value="s.numLabel ?? ''"
            placeholder="numLabel"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateStat(i, { numLabel: ($event.target as HTMLInputElement).value || undefined })"
          />
          <input
            type="text"
            :value="s.change ?? ''"
            placeholder="+5%"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateStat(i, { change: ($event.target as HTMLInputElement).value || undefined })"
          />
          <AccentColorSelect :model-value="s.color" placeholder="color" @update:model-value="updateStat(i, { color: $event })" />
        </div>
      </div>
    </section>

    <!-- timeline -->
    <section v-if="slide.layout === 'timeline'" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Timeline</span>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addTimelineItem">+ step</button>
      </div>
      <div v-for="(it, i) in slide.items" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="flex items-center justify-between text-[10px] text-stone-400">
          <span>#{{ i + 1 }}</span>
          <div class="flex gap-1">
            <button
              type="button"
              :disabled="i === 0"
              class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              @click="moveTimelineItem(i, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="i === slide.items.length - 1"
              class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              @click="moveTimelineItem(i, 1)"
            >
              ↓
            </button>
            <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeTimelineItem(i)">×</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1">
          <input
            type="text"
            :value="it.date"
            placeholder="date"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateTimelineItem(i, { date: ($event.target as HTMLInputElement).value })"
          />
          <input
            type="text"
            :value="it.title"
            placeholder="title"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateTimelineItem(i, { title: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <input
          type="text"
          :value="it.description ?? ''"
          placeholder="description"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateTimelineItem(i, { description: ($event.target as HTMLInputElement).value || undefined })"
        />
        <div class="flex flex-wrap gap-2">
          <label class="flex items-center gap-1"
            >color
            <AccentColorSelect :model-value="it.color" @update:model-value="updateTimelineItem(i, { color: $event })" />
          </label>
          <label class="flex items-center gap-1"
            ><input
              type="checkbox"
              :checked="!!it.done"
              @change="updateTimelineItem(i, { done: ($event.target as HTMLInputElement).checked || undefined })"
            />done</label
          >
          <label class="flex items-center gap-1"
            ><input
              type="checkbox"
              :checked="!!it.hot"
              @change="updateTimelineItem(i, { hot: ($event.target as HTMLInputElement).checked || undefined })"
            />hot</label
          >
        </div>
      </div>
    </section>

    <!-- manifesto -->
    <section v-if="slide.layout === 'manifesto'" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Manifesto</span>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addManifestoItem">+ line</button>
      </div>
      <label class="block"
        >columns
        <input
          type="number"
          min="1"
          max="4"
          :value="slide.columns ?? 2"
          class="ml-1 w-14 rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="patch<ManifestoSlide>({ columns: Number(($event.target as HTMLInputElement).value) || undefined })"
        />
      </label>
      <div v-for="(it, i) in slide.items" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="flex items-center justify-between text-[10px] text-stone-400">
          <span>#{{ i + 1 }}</span>
          <div class="flex gap-1">
            <button
              type="button"
              :disabled="i === 0"
              class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              @click="moveManifestoItem(i, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="i === slide.items.length - 1"
              class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              @click="moveManifestoItem(i, 1)"
            >
              ↓
            </button>
            <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeManifestoItem(i)">×</button>
          </div>
        </div>
        <input
          type="text"
          :value="it.title"
          placeholder="title"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateManifestoItem(i, { title: ($event.target as HTMLInputElement).value })"
        />
        <input
          type="text"
          :value="it.description ?? ''"
          placeholder="description"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateManifestoItem(i, { description: ($event.target as HTMLInputElement).value || undefined })"
        />
        <label class="flex items-center gap-1"
          >accent
          <AccentColorSelect :model-value="it.accentColor" @update:model-value="updateManifestoItem(i, { accentColor: $event })" />
        </label>
      </div>
    </section>

    <!-- columns -->
    <section v-if="slide.layout === 'columns'" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Columns</span>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addColumn">+ column</button>
      </div>
      <label class="flex items-center gap-1"
        ><input
          type="checkbox"
          :checked="!!slide.showArrows"
          @change="patch<ColumnsSlide>({ showArrows: ($event.target as HTMLInputElement).checked || undefined })"
        />show arrows</label
      >
      <div v-for="(col, i) in slide.columns" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="flex items-center justify-between text-[10px] text-stone-400">
          <span>#{{ i + 1 }}</span>
          <div class="flex gap-1">
            <button type="button" :disabled="i === 0" class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30" @click="moveColumn(i, -1)">
              ↑
            </button>
            <button
              type="button"
              :disabled="i === slide.columns.length - 1"
              class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              @click="moveColumn(i, 1)"
            >
              ↓
            </button>
            <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeColumn(i)">×</button>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-1">
          <input
            type="text"
            :value="col.title"
            placeholder="title"
            class="col-span-2 rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateColumn(i, { title: ($event.target as HTMLInputElement).value })"
          />
          <AccentColorSelect :model-value="col.accentColor" placeholder="accent" @update:model-value="updateColumn(i, { accentColor: $event })" />
        </div>
        <div class="grid grid-cols-3 gap-1">
          <input
            type="text"
            :value="col.label ?? ''"
            placeholder="label"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateColumn(i, { label: ($event.target as HTMLInputElement).value || undefined })"
          />
          <input
            type="text"
            :value="col.numLabel ?? ''"
            placeholder="numLabel"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateColumn(i, { numLabel: ($event.target as HTMLInputElement).value || undefined })"
          />
          <input
            type="text"
            :value="col.icon ?? ''"
            placeholder="icon"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateColumn(i, { icon: ($event.target as HTMLInputElement).value || undefined })"
          />
        </div>
        <ContentBlocksEditor :blocks="col.content" label="column content" @update="setColumnContent(i, $event)" />
      </div>
    </section>

    <!-- comparison -->
    <section v-if="slide.layout === 'comparison'" class="space-y-2">
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-stone-500">Comparison</span>
      <div v-for="side in ['left', 'right'] as const" :key="side" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{{ side }}</div>
        <input
          type="text"
          :value="slide[side].title"
          placeholder="title"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updatePanel(side, { title: ($event.target as HTMLInputElement).value })"
        />
        <div class="flex flex-wrap gap-2">
          <label class="flex items-center gap-1"
            >accent
            <AccentColorSelect :model-value="slide[side].accentColor" @update:model-value="updatePanel(side, { accentColor: $event })" />
          </label>
          <label class="flex items-center gap-1"
            >ratio
            <input
              type="number"
              step="0.1"
              min="0.1"
              :value="slide[side].ratio ?? ''"
              class="w-16 rounded border border-stone-300 bg-white px-1 py-0.5"
              @input="updatePanel(side, { ratio: Number(($event.target as HTMLInputElement).value) || undefined })"
            />
          </label>
          <label class="flex items-center gap-1"
            ><input
              type="checkbox"
              :checked="!!slide[side].cardless"
              @change="updatePanel(side, { cardless: ($event.target as HTMLInputElement).checked || undefined })"
            />cardless</label
          >
        </div>
        <input
          type="text"
          :value="slide[side].footer ?? ''"
          placeholder="footer"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updatePanel(side, { footer: ($event.target as HTMLInputElement).value || undefined })"
        />
        <ContentBlocksEditor :blocks="slide[side].content" :label="`${side} content`" @update="setPanelContent(side, $event)" />
      </div>
    </section>

    <!-- grid -->
    <section v-if="slide.layout === 'grid'" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Grid</span>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addGridItem">+ item</button>
      </div>
      <label class="block"
        >gridColumns
        <input
          type="number"
          min="1"
          max="6"
          :value="slide.gridColumns ?? 3"
          class="ml-1 w-14 rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="patch<GridSlide>({ gridColumns: Number(($event.target as HTMLInputElement).value) || undefined })"
        />
      </label>
      <input
        type="text"
        :value="slide.footer ?? ''"
        placeholder="footer (optional)"
        class="w-full rounded border border-stone-300 bg-white px-2 py-1"
        @input="patch<GridSlide>({ footer: ($event.target as HTMLInputElement).value || undefined })"
      />
      <div v-for="(it, i) in slide.items" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="flex items-center justify-between text-[10px] text-stone-400">
          <span>#{{ i + 1 }}</span>
          <div class="flex gap-1">
            <button type="button" :disabled="i === 0" class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30" @click="moveGridItem(i, -1)">
              ↑
            </button>
            <button
              type="button"
              :disabled="i === slide.items.length - 1"
              class="rounded px-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              @click="moveGridItem(i, 1)"
            >
              ↓
            </button>
            <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeGridItem(i)">×</button>
          </div>
        </div>
        <input
          type="text"
          :value="it.title"
          placeholder="title"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateGridItem(i, { title: ($event.target as HTMLInputElement).value })"
        />
        <input
          type="text"
          :value="it.description ?? ''"
          placeholder="description"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateGridItem(i, { description: ($event.target as HTMLInputElement).value || undefined })"
        />
        <div class="grid grid-cols-4 gap-1">
          <AccentColorSelect :model-value="it.accentColor" placeholder="accent" @update:model-value="updateGridItem(i, { accentColor: $event })" />
          <input
            type="number"
            :value="it.num ?? ''"
            placeholder="num"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateGridItem(i, { num: Number(($event.target as HTMLInputElement).value) || undefined })"
          />
          <input
            type="text"
            :value="it.icon ?? ''"
            placeholder="icon"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateGridItem(i, { icon: ($event.target as HTMLInputElement).value || undefined })"
          />
          <input
            type="number"
            min="1"
            max="4"
            :value="it.span ?? ''"
            placeholder="span"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateGridItem(i, { span: Number(($event.target as HTMLInputElement).value) || undefined })"
          />
        </div>
        <ContentBlocksEditor :blocks="it.content" label="item content" @update="setGridItemContent(i, $event)" />
      </div>
    </section>

    <!-- split -->
    <section v-if="slide.layout === 'split'" class="space-y-2">
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-stone-500">Split</span>
      <div v-for="side in ['left', 'right'] as const" :key="side" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{{ side }}</div>
        <input
          type="text"
          :value="slide[side]?.title ?? ''"
          placeholder="title"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateSplit(side, { title: ($event.target as HTMLInputElement).value || undefined })"
        />
        <input
          type="text"
          :value="slide[side]?.label ?? ''"
          placeholder="label"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateSplit(side, { label: ($event.target as HTMLInputElement).value || undefined })"
        />
        <div class="flex flex-wrap gap-2">
          <label class="flex items-center gap-1"
            >accent
            <AccentColorSelect :model-value="slide[side]?.accentColor" @update:model-value="updateSplit(side, { accentColor: $event })" />
          </label>
          <label class="flex items-center gap-1"
            >ratio
            <input
              type="number"
              step="0.1"
              min="0.1"
              :value="slide[side]?.ratio ?? ''"
              class="w-16 rounded border border-stone-300 bg-white px-1 py-0.5"
              @input="updateSplit(side, { ratio: Number(($event.target as HTMLInputElement).value) || undefined })"
            />
          </label>
          <label class="flex items-center gap-1"
            >valign
            <select
              :value="slide[side]?.valign ?? ''"
              class="rounded border border-stone-300 bg-white px-1 py-0.5"
              @change="updateSplit(side, { valign: (($event.target as HTMLSelectElement).value || undefined) as never })"
            >
              <option value="">—</option>
              <option v-for="v in VALIGNS" :key="v" :value="v">{{ v }}</option>
            </select>
          </label>
        </div>
        <ContentBlocksEditor :blocks="slide[side]?.content" :label="`${side} content`" @update="setSplitContent(side, $event)" />
      </div>
    </section>

    <!-- matrix -->
    <section v-if="slide.layout === 'matrix'" class="space-y-2">
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-stone-500">Matrix</span>
      <div class="flex gap-2">
        <label class="flex items-center gap-1"
          >rows
          <input
            type="number"
            min="1"
            max="6"
            :value="slide.rows ?? 2"
            class="w-14 rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="patch<MatrixSlide>({ rows: Number(($event.target as HTMLInputElement).value) || undefined })"
          />
        </label>
        <label class="flex items-center gap-1"
          >cols
          <input
            type="number"
            min="1"
            max="6"
            :value="slide.cols ?? 2"
            class="w-14 rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="patch<MatrixSlide>({ cols: Number(($event.target as HTMLInputElement).value) || undefined })"
          />
        </label>
      </div>
      <div v-for="(cell, i) in slide.cells" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="text-[10px] text-stone-400">Cell #{{ i + 1 }}</div>
        <input
          type="text"
          :value="cell.label"
          placeholder="label"
          class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
          @input="updateMatrixCell(i, { label: ($event.target as HTMLInputElement).value })"
        />
        <ContentBlocksEditor :blocks="cell.content" label="cell content" @update="setMatrixContent(i, $event)" />
      </div>
    </section>

    <!-- table -->
    <section v-if="slide.layout === 'table'" class="space-y-2">
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-stone-500">Table</span>
      <table class="w-full text-[11px]">
        <thead>
          <tr>
            <th v-for="(h, c) in slide.headers ?? []" :key="c" class="px-1 py-0.5 text-left">
              <div class="flex items-center gap-1">
                <input
                  type="text"
                  :value="h"
                  class="min-w-0 flex-1 rounded border border-stone-300 bg-white px-1 py-0.5 font-bold"
                  @input="setTableSlideHeader(c, ($event.target as HTMLInputElement).value)"
                />
                <button type="button" class="text-rose-600" @click="removeTableSlideCol(c)">×</button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in slide.rows" :key="r">
            <td v-for="(cell, c) in row" :key="c" class="px-1 py-0.5">
              <input
                type="text"
                :value="tableCellText(cell)"
                class="w-full rounded border border-stone-300 bg-white px-1 py-0.5"
                @input="setTableSlideCell(r, c, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-1"><button type="button" class="text-rose-600" @click="removeTableSlideRow(r)">×</button></td>
          </tr>
        </tbody>
      </table>
      <div class="flex gap-2">
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addTableSlideRow">+ row</button>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addTableSlideCol">+ column</button>
      </div>
    </section>

    <!-- funnel -->
    <section v-if="slide.layout === 'funnel'" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Funnel</span>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addFunnelStage">+ stage</button>
      </div>
      <div v-for="(s, i) in slide.stages" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="flex items-center justify-between text-[10px] text-stone-400">
          <span>#{{ i + 1 }}</span>
          <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeFunnelStage(i)">×</button>
        </div>
        <div class="grid grid-cols-3 gap-1">
          <input
            type="text"
            :value="s.label"
            placeholder="label"
            class="col-span-2 rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateFunnelStage(i, { label: ($event.target as HTMLInputElement).value })"
          />
          <input
            type="text"
            :value="s.value"
            placeholder="value"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateFunnelStage(i, { value: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <AccentColorSelect :model-value="s.color" placeholder="color" @update:model-value="updateFunnelStage(i, { color: $event })" />
      </div>
    </section>

    <!-- waterfall -->
    <section v-if="slide.layout === 'waterfall'" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Waterfall</span>
        <button type="button" class="text-[11px] text-stone-600 hover:text-stone-900" @click="addWaterfallItem">+ item</button>
      </div>
      <div v-for="(it, i) in slide.items" :key="i" class="rounded border border-stone-200 bg-stone-50/40 p-2 space-y-1">
        <div class="flex items-center justify-between text-[10px] text-stone-400">
          <span>#{{ i + 1 }}</span>
          <button type="button" class="rounded px-1 text-rose-600 hover:bg-rose-100" @click="removeWaterfallItem(i)">×</button>
        </div>
        <div class="grid grid-cols-3 gap-1">
          <input
            type="text"
            :value="it.label"
            placeholder="label"
            class="col-span-2 rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateWaterfallItem(i, { label: ($event.target as HTMLInputElement).value })"
          />
          <input
            type="number"
            :value="it.value"
            placeholder="value"
            class="rounded border border-stone-300 bg-white px-1 py-0.5"
            @input="updateWaterfallItem(i, { value: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </div>
    </section>
  </div>
</template>
