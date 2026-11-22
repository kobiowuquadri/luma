import demoJson from "./demo.json";
import handoutJson from "./handout.json";
import releaseJson from "./release.json";
import voiceSamplesJson from "./voice-samples.json";

/**
 * Project details shown on the site. Leave a field null until the team has
 * a real value; the site then leaves that detail out instead of inventing it.
 */
export const project = {
  name: "LUMA",
  expansion: "Light-adaptive Understanding & Multilingual Assistant",
  event: "Data Science Nigeria AI for Visually Impaired Hackathon",
  teamName: null as string | null,
  supportEmail: null as string | null,
  sourceUrl: null as string | null,
};

export interface Release {
  available: boolean;
  version: string | null;
  url: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  minAndroid: string | null;
  publishedOn: string | null;
  testedOn: string | null;
}

export interface Demo {
  available: boolean;
  video: string | null;
  captions: string | null;
  poster: string | null;
  durationLabel: string | null;
  transcript: { time: string; text: string }[];
}

export interface VoiceSample {
  language: string;
  languageName: string;
  nativeName: string;
  prompt: string;
  english: string;
  transcript: string;
  src: string;
  reviewedOn: string;
}

export interface HandoutLine {
  id: string;
  text: string;
  quad: number[][];
}

export interface Handout {
  note: string;
  image: { src: string; fallback: string; width: number; height: number };
  paragraphs: { id: string; kind: string; lines: HandoutLine[] }[];
}

export const release = releaseJson as Release;
export const demo = demoJson as Demo;
export const voiceSamples = voiceSamplesJson as VoiceSample[];
export const handout = handoutJson as Handout;

/** The APK is offered only when every detail needed to trust it is known. */
export const downloadReady =
  release.available && !!release.url && !!release.version && !!release.sizeBytes && !!release.sha256;

export function formatBytes(n: number): string {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
  { code: "ig", name: "Igbo", nativeName: "Igbo" },
  { code: "pcm", name: "Nigerian Pidgin", nativeName: "Naijá" },
] as const;
