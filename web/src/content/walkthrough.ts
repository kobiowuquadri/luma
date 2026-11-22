/**
 * One student task with the same sample handout, step by step. `image` is a
 * real app screenshot (in /public/screens) or null; the site never shows a
 * mock-up in place of a missing screenshot.
 */
export interface Step {
  title: string;
  body: string;
  points: string[];
  image: { src: string; width: number; height: number; alt: string } | null;
}

export const STEPS: Step[] = [
  {
    title: "Scan the handout",
    body: "Tap Scan a page and photograph the handout, or open a photo a lecturer sent. LUMA reads it on the phone in a few seconds, even in airplane mode.",
    points: [
      "Board Reader uses the same reading engine, with tips for photographing a classroom board.",
      "If a photo is blurry, too dark or has glare, LUMA says how to take it again.",
    ],
    image: null,
  },
  {
    title: "Read it your way",
    body: "The text wraps to the screen in the student's own size, spacing and colours, so there is no sideways dragging to finish a line.",
    points: [
      "Words LUMA is unsure about are underlined, ready to check against the photo.",
      "Read aloud uses a voice installed on the phone, and a Stop button is always on screen.",
    ],
    image: null,
  },
  {
    title: "Ask about the page",
    body: "Type or say a question in English, Yorùbá, Hausa, Igbo or Nigerian Pidgin. LUMA answers from the page and lists the lines it used.",
    points: [
      "Tap a line to jump to it in the text and see it on the photo.",
      "If the page does not say, LUMA says so instead of guessing.",
    ],
    image: null,
  },
  {
    title: "Keep it for later",
    body: "Readings are saved on the phone with their photo. Rename them, delete them, and replay answers already heard without a connection.",
    points: ["No account and no cloud copy of classroom photos."],
    image: null,
  },
];
