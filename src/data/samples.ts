import bootcampScript from "./bootcamp_v2_kickoff.json";
import showcaseScript from "./slide_deck_showcase.json";
import { sampleDeck } from "./sampleDeck";
import { type EditableBeat, makeBeat } from "../beatHelpers";

/**
 * The demo's starting scripts. These JSON files are MulmoScripts, which is what the beat editor
 * edits — so the beats come straight out, with none of the slide extraction the deck editor used
 * to need.
 */
export type SampleScript = {
  /** Stable key for the picker dropdown. */
  key: string;
  /** Display label. */
  label: string;
  /** Short hint shown next to the picker. */
  description?: string;
  beats: EditableBeat[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const beatsOf = (script: unknown): EditableBeat[] => {
  const beats = isRecord(script) ? script["beats"] : undefined;
  return Array.isArray(beats) ? beats.filter(isRecord) : [];
};

/** Registered samples in picker order. The first one is what the editor opens on. */
export const SAMPLES: SampleScript[] = [
  {
    key: "mixed",
    label: "One of each",
    description: "Every beat type the registry has an editor for.",
    beats: [makeBeat("textSlide"), makeBeat("markdown"), makeBeat("chart"), makeBeat("mermaid"), makeBeat("slide")],
  },
  {
    key: "showcase",
    label: "Layout showcase",
    description: "One slide beat per @mulmocast/deck layout.",
    beats: beatsOf(showcaseScript),
  },
  {
    key: "bootcamp",
    label: "BootCamp v2",
    description: "A real deck — glass cards, manifesto, hot timeline, icon bullets, emphasis.",
    beats: beatsOf(bootcampScript),
  },
  {
    key: "starter",
    label: "Starter deck",
    description: "The four slides from `sampleDeck`, as slide beats.",
    beats: sampleDeck.map((slide) => ({ text: "", image: { type: "slide", slide } })),
  },
];
