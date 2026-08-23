<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { beatToHtml, type BeatHtmlFragment } from "mulmocast/browser";
import { slideUtilityCss } from "@mulmocast/deck";
import { ALL_BEAT_TYPES } from "../data/allBeatTypes";
import { collectedCss, driveRuntimes, requiredChartPlugins, requiredRuntimes } from "../beatRuntime";

/**
 * Every beat type `beatToHtml` renders, side by side, doing what a host has to do:
 * load what `requires` names once for the page, attach each fragment's `css`, and drive
 * `[data-mulmo-chart]` and `.mermaid` itself. Fragments carry no generated `<script>`,
 * so nothing here runs on its own.
 */

type Rendered = { label: string; note: string; fragment: BeatHtmlFragment | undefined };

// The idPrefix has to be unique per beat and stable across re-renders, and cannot start with
// a digit — see BeatHtmlOptions. The index gives both.
const rendered = computed<Rendered[]>(() =>
  ALL_BEAT_TYPES.map((sample, index) => ({
    label: sample.label,
    note: sample.note,
    fragment: beatToHtml(sample.beat as never, { idPrefix: `beat-${index}` }),
  })),
);

const fragmentList = computed(() => rendered.value.map((r) => r.fragment));
const requires = computed(() => requiredRuntimes(fragmentList.value));
const chartPlugins = computed(() => requiredChartPlugins(fragmentList.value));
const fragmentCss = computed(() => collectedCss(fragmentList.value));

const container = ref<HTMLElement | null>(null);
const status = ref<string>("loading runtimes…");

const drive = async () => {
  const host = container.value;
  if (!host) return;
  await driveRuntimes(
    host,
    rendered.value.map((r) => r.fragment),
  );
  status.value = "";
};

onMounted(() => {
  drive().catch((e: unknown) => {
    status.value = `runtime load failed: ${e instanceof Error ? e.message : String(e)}`;
  });
});

// A re-render replaces the markup, so anything driven has to be driven again.
watch(rendered, () => {
  drive().catch(() => {});
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!--
      Tailwind's preflight strips the browser's defaults for h1-h6, ul/ol and p, so markup a
      fragment produces from markdown arrives unstyled. Restoring it is the host's job — the
      fragment says nothing about typography — and doing it here is part of what this demo
      shows. Scoped to .beat-fragment so it cannot reach the demo's own chrome.
    -->
    <component :is="'style'">
      .beat-fragment h1 { font-size: 1.75rem; font-weight: 700; margin: 0.5rem 0; } .beat-fragment h2 { font-size: 1.4rem; font-weight: 700; margin: 0.5rem 0; }
      .beat-fragment h3 { font-size: 1.15rem; font-weight: 600; margin: 0.4rem 0; } .beat-fragment p { margin: 0.5rem 0; } .beat-fragment ul { list-style: disc;
      padding-left: 1.5rem; margin: 0.5rem 0; } .beat-fragment ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; } .beat-fragment li { margin:
      0.15rem 0; } .beat-fragment code { background: #f5f5f4; padding: 0.1rem 0.3rem; border-radius: 0.2rem; } /* The swipe `elements` form wraps itself in
      height:100%, so it collapses unless the host gives it a box. The wrapper carries no class or data attribute, so its inline style is the only handle there
      is. */ .beat-fragment:has(> div[style*="height:100%"]) { height: 260px; }
    </component>

    <!-- The css each fragment declares, attached once. Fragments scope their own rules. -->
    <component :is="'style'" v-if="fragmentCss">{{ fragmentCss }}</component>
    <component :is="'style'">{{ slideUtilityCss }}</component>

    <div class="shrink-0 border-b border-stone-200 bg-white px-4 py-2 text-xs text-stone-600">
      <span class="font-semibold uppercase tracking-wider text-stone-500">beatToHtml</span>
      <span class="ml-2">{{ rendered.length }} beats</span>
      <span class="ml-3"
        >requires: <code>{{ requires.length ? requires.join(", ") : "none" }}</code></span
      >
      <span v-if="chartPlugins.length" class="ml-3">chartPlugins: {{ chartPlugins.length }}</span>
      <span v-if="status" class="ml-3 text-amber-700">{{ status }}</span>
    </div>

    <div ref="container" class="min-h-0 flex-1 overflow-auto bg-stone-50 p-4">
      <section v-for="item in rendered" :key="item.label" class="mx-auto mb-6 max-w-3xl">
        <header class="mb-1 flex items-baseline gap-2">
          <h2 class="font-mono text-xs font-bold uppercase tracking-wider text-stone-700">{{ item.label }}</h2>
          <span v-if="item.fragment?.requires?.length" class="rounded bg-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
            requires {{ item.fragment.requires.join(" ") }}
          </span>
        </header>
        <p class="mb-2 text-xs text-stone-500">{{ item.note }}</p>
        <!-- eslint-disable-next-line vue/no-v-html -- the point of this demo is to show what a host does with the fragment; the samples are ours, not user input -->
        <div v-if="item.fragment" class="beat-fragment rounded border border-stone-200 bg-white p-4" v-html="item.fragment.html"></div>
        <p v-else class="rounded border border-dashed border-stone-300 p-4 text-xs text-stone-400">renders nothing in a browser</p>
      </section>
    </div>
  </div>
</template>
