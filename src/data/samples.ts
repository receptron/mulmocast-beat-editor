import type { SlideLayout, SlideTheme } from "@mulmocast/deck";
import { sampleDeck, defaultTheme } from "./sampleDeck";
import bootcampScript from "./bootcamp_v2_kickoff.json";
import showcaseScript from "./slide_deck_showcase.json";

/**
 * Pull slides + theme out of a MulmoScript-shaped object.
 * Picks every beat whose image.type === "slide" and preserves their order.
 */
const fromMulmoScript = (script: unknown): { slides: SlideLayout[]; theme?: SlideTheme } => {
  if (!script || typeof script !== "object") return { slides: [] };
  const s = script as {
    beats?: Array<{ image?: { type?: string; slide?: SlideLayout } }>;
    slideParams?: { theme?: SlideTheme };
    presentationStyle?: { slideParams?: { theme?: SlideTheme } };
  };
  const slides = (s.beats ?? []).flatMap((b) => (b.image?.type === "slide" && b.image.slide ? [b.image.slide] : []));
  const theme = s.presentationStyle?.slideParams?.theme ?? s.slideParams?.theme;
  return { slides, theme };
};

export type SampleDeck = {
  /** Stable key for the picker dropdown. */
  key: string;
  /** Display label. */
  label: string;
  /** Short hint shown under the label. */
  description?: string;
  slides: SlideLayout[];
  theme?: SlideTheme;
};

const bootcamp = fromMulmoScript(bootcampScript);
const showcase = fromMulmoScript(showcaseScript);

/** Registered samples in picker order. The first one is the initial deck. */
export const SAMPLES: SampleDeck[] = [
  {
    key: "minimal",
    label: "Minimal",
    description: "4 slides showcasing title / stats / comparison / bigQuote.",
    slides: sampleDeck,
    theme: defaultTheme,
  },
  {
    key: "showcase",
    label: "Layout showcase (12 slides)",
    // The one layout it omits is manifesto, which the BootCamp sample carries — so between
    // the two the picker reaches all thirteen.
    description: "One slide per layout: title / bigQuote / columns / comparison / grid / stats / timeline / split / matrix / table / funnel / waterfall.",
    slides: showcase.slides,
    theme: showcase.theme ?? defaultTheme,
  },
  {
    key: "bootcamp",
    label: "BootCamp v2 (19 slides)",
    description: "Full Phase 1-6 showcase — glass cards, manifesto, hot timeline, icon bullets, *emphasis*, etc.",
    slides: bootcamp.slides,
    theme: bootcamp.theme ?? defaultTheme,
  },
];
