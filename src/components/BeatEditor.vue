<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { type EditableBeat, beatType, beatImage, withImageField, withNestedField, readString } from "../beatHelpers";

/**
 * The editor for one beat, dispatched on its type.
 *
 * Every field emits a whole new beat rather than mutating: Vue is watching these objects,
 * and an editor that mutates in place gives a preview that updates only sometimes.
 *
 * `chart`'s `chartData` is a free-form record, so it gets a JSON textarea. Invalid JSON is
 * reported and the beat is left alone — the preview keeps showing the last good chart
 * instead of blanking on every keystroke.
 */
const props = defineProps<{ beat: EditableBeat; index: number }>();
const emit = defineEmits<{ update: [beat: EditableBeat] }>();

const type = computed(() => beatType(props.beat));

const setImage = (field: string, value: unknown) => emit("update", withImageField(props.beat, field, value));
const setNested = (parent: string, field: string, value: unknown) => emit("update", withNestedField(props.beat, parent, field, value));
const setBeat = (field: string, value: unknown) => emit("update", { ...props.beat, [field]: value });

// ─── markdown: a string or an object of named slots. Only the string form is edited here;
//     the object form is shown read-only rather than flattened into a string, which would
//     silently discard its slots.
const markdownIsString = computed(() => typeof beatImage(props.beat).markdown === "string");
const markdownText = computed(() => (markdownIsString.value ? (beatImage(props.beat).markdown as string) : ""));

// ─── textSlide: bullets are one per line, which is how they read and how they are edited.
const bullets = computed<string[]>(() => {
  const slide = beatImage(props.beat).slide;
  const items = slide && typeof slide === "object" ? (slide as Record<string, unknown>).bullets : undefined;
  return Array.isArray(items) ? items.filter((b): b is string => typeof b === "string") : [];
});
const setBullets = (text: string) =>
  setNested(
    "slide",
    "bullets",
    text.split("\n").filter((line) => line.trim() !== ""),
  );

// ─── chart: chartData is a free-form record, so the textarea's text is the source of truth
//     while it is being typed. Invalid JSON leaves the beat alone and is reported, so the
//     preview keeps the last valid chart instead of blanking on every keystroke.
const draft = ref<string | null>(null);

// A different beat means a different draft; keeping the old one would show the previous
// beat's JSON against this beat's preview.
watch(
  () => props.index,
  () => (draft.value = null),
);

const chartDraft = computed({
  get: () => draft.value ?? JSON.stringify(beatImage(props.beat).chartData ?? {}, null, 2),
  set: (text: string) => {
    draft.value = text;
    try {
      setImage("chartData", JSON.parse(text));
    } catch {
      // Reported by chartError below; the beat keeps its last valid chartData.
    }
  },
});

const chartError = computed(() => {
  if (draft.value === null) return "";
  try {
    JSON.parse(draft.value);
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div class="flex flex-col gap-3 text-xs">
    <div class="flex items-baseline gap-2">
      <span class="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-700">{{ type }}</span>
      <span class="text-stone-400">beat {{ index + 1 }}</span>
    </div>

    <label class="flex flex-col gap-1">
      <span class="font-medium text-stone-600">text <span class="font-normal text-stone-400">(spoken; also the image alt fallback)</span></span>
      <textarea
        :value="typeof beat.text === 'string' ? beat.text : ''"
        rows="2"
        class="rounded border border-stone-300 px-2 py-1 font-sans"
        @input="setBeat('text', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </label>

    <!-- textSlide -->
    <template v-if="type === 'textSlide'">
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">title</span>
        <input
          :value="readString(beat, 'title', 'slide')"
          class="rounded border border-stone-300 px-2 py-1"
          @input="setNested('slide', 'title', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">subtitle</span>
        <input
          :value="readString(beat, 'subtitle', 'slide')"
          class="rounded border border-stone-300 px-2 py-1"
          @input="setNested('slide', 'subtitle', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">bullets <span class="font-normal text-stone-400">(one per line)</span></span>
        <textarea
          :value="bullets.join('\n')"
          rows="4"
          class="rounded border border-stone-300 px-2 py-1 font-mono"
          @input="setBullets(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
    </template>

    <!-- markdown -->
    <template v-else-if="type === 'markdown'">
      <label v-if="markdownIsString" class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">markdown</span>
        <textarea
          :value="markdownText"
          rows="12"
          class="rounded border border-stone-300 px-2 py-1 font-mono"
          @input="setImage('markdown', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <p v-else class="rounded border border-dashed border-stone-300 p-2 text-stone-500">
        This beat uses the layout form (named slots). Editing it as a single string would discard the slots, so it is left read-only here.
      </p>
    </template>

    <!-- chart -->
    <template v-else-if="type === 'chart'">
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">title</span>
        <input
          :value="readString(beat, 'title')"
          class="rounded border border-stone-300 px-2 py-1"
          @input="setImage('title', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">chartData <span class="font-normal text-stone-400">(Chart.js config, JSON)</span></span>
        <textarea
          v-model="chartDraft"
          rows="14"
          :class="['rounded border px-2 py-1 font-mono', chartError ? 'border-red-400 bg-red-50' : 'border-stone-300']"
        ></textarea>
        <span v-if="chartError" class="text-red-600">{{ chartError }} — the preview keeps the last valid config</span>
      </label>
    </template>

    <!-- mermaid -->
    <template v-else-if="type === 'mermaid'">
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">title</span>
        <input
          :value="readString(beat, 'title')"
          class="rounded border border-stone-300 px-2 py-1"
          @input="setImage('title', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">code</span>
        <textarea
          :value="readString(beat, 'text', 'code')"
          rows="10"
          class="rounded border border-stone-300 px-2 py-1 font-mono"
          @input="setNested('code', 'text', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
    </template>

    <!-- image / movie -->
    <template v-else-if="type === 'image' || type === 'movie'">
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">url</span>
        <input
          :value="readString(beat, 'url', 'source')"
          placeholder="https://…"
          class="rounded border border-stone-300 px-2 py-1 font-mono"
          @input="setNested('source', 'url', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label v-if="type === 'image'" class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">description <span class="font-normal text-stone-400">(becomes the alt text)</span></span>
        <input
          :value="typeof beat.description === 'string' ? beat.description : ''"
          class="rounded border border-stone-300 px-2 py-1"
          @input="setBeat('description', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <p class="text-stone-500">A remote url renders; a local path is left for the host to resolve, and a base64 source renders nothing.</p>
    </template>

    <!-- html_tailwind -->
    <template v-else-if="type === 'html_tailwind'">
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">html</span>
        <textarea
          :value="typeof beatImage(beat).html === 'string' ? (beatImage(beat).html as string) : ''"
          rows="12"
          class="rounded border border-stone-300 px-2 py-1 font-mono"
          @input="setImage('html', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <p class="text-stone-500">Raw author markup. Nothing sanitizes it — that is this beat type's contract.</p>
    </template>

    <!-- slide -->
    <template v-else-if="type === 'slide'">
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">title</span>
        <input
          :value="readString(beat, 'title', 'slide')"
          class="rounded border border-stone-300 px-2 py-1"
          @input="setNested('slide', 'title', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-medium text-stone-600">subtitle</span>
        <input
          :value="readString(beat, 'subtitle', 'slide')"
          class="rounded border border-stone-300 px-2 py-1"
          @input="setNested('slide', 'subtitle', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <p class="text-stone-500">Layouts and content blocks are edited in the Slide editor tab, which has the full inspector.</p>
    </template>

    <p v-else class="rounded border border-dashed border-stone-300 p-2 text-stone-500">No editor for this beat type.</p>
  </div>
</template>
