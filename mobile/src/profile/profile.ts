/**
 * My Vision Profile: the student's reading preferences. Stored locally in
 * SQLite and applied to the whole interface as well as document text.
 * Pure module.
 */
import { contrastRatio, mix } from '../theme/contrast.ts';
import { palettes, type Palette, type PaletteId } from '../theme/palettes.ts';

export type LanguageCode = 'en' | 'yo' | 'ha' | 'ig' | 'pcm';

export interface VisionProfile {
  version: 1;
  /** Reader text size in points (before Android font scaling). */
  textSize: number;
  /** Line height as a multiple of text size. */
  lineSpacing: number;
  /** Extra letter spacing as a fraction of text size. */
  letterSpacing: number;
  paletteId: PaletteId | 'custom';
  customText: string;
  customBackground: string;
  boldText: boolean;
  markUncertainWords: boolean;
  /** Speech rate for reading aloud (1 = normal). */
  speechRate: number;
  /** Language for answers, explanations and spoken guidance. */
  language: LanguageCode;
  spokenGuidance: boolean;
  onboarded: boolean;
}

export const TEXT_SIZE = { min: 16, max: 56, step: 2 };
export const LINE_SPACING_OPTIONS = [1.3, 1.6, 2.0, 2.4] as const;
export const LETTER_SPACING_OPTIONS = [0, 0.04, 0.08, 0.12] as const;
export const SPEECH_RATE = { min: 0.6, max: 1.4, step: 0.1 };

/** A readable default: large Atkinson text on warm paper with open spacing. */
export const DEFAULT_PROFILE: VisionProfile = {
  version: 1,
  textSize: 24,
  lineSpacing: 1.6,
  letterSpacing: 0,
  paletteId: 'paper',
  customText: '#1D1B18',
  customBackground: '#F5EFE3',
  boldText: false,
  markUncertainWords: true,
  speechRate: 0.95,
  language: 'en',
  spokenGuidance: true,
  onboarded: false,
};

const LANGS: LanguageCode[] = ['en', 'yo', 'ha', 'ig', 'pcm'];
const HEX = /^#[0-9A-Fa-f]{6}$/;

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Parse stored JSON, repairing anything missing or out of range. */
export function parseProfile(json: string | null | undefined): VisionProfile {
  let raw: Partial<VisionProfile> = {};
  try {
    raw = json ? (JSON.parse(json) as Partial<VisionProfile>) : {};
  } catch {
    raw = {};
  }
  const d = DEFAULT_PROFILE;
  const paletteIds = [...Object.keys(palettes), 'custom'];
  return {
    version: 1,
    textSize: clamp(raw.textSize, TEXT_SIZE.min, TEXT_SIZE.max, d.textSize),
    lineSpacing: clamp(raw.lineSpacing, 1.1, 3, d.lineSpacing),
    letterSpacing: clamp(raw.letterSpacing, 0, 0.2, d.letterSpacing),
    paletteId: paletteIds.includes(raw.paletteId as string) ? (raw.paletteId as VisionProfile['paletteId']) : d.paletteId,
    customText: typeof raw.customText === 'string' && HEX.test(raw.customText) ? raw.customText : d.customText,
    customBackground: typeof raw.customBackground === 'string' && HEX.test(raw.customBackground) ? raw.customBackground : d.customBackground,
    boldText: typeof raw.boldText === 'boolean' ? raw.boldText : d.boldText,
    markUncertainWords: typeof raw.markUncertainWords === 'boolean' ? raw.markUncertainWords : d.markUncertainWords,
    speechRate: clamp(raw.speechRate, SPEECH_RATE.min, SPEECH_RATE.max, d.speechRate),
    language: LANGS.includes(raw.language as LanguageCode) ? (raw.language as LanguageCode) : d.language,
    spokenGuidance: typeof raw.spokenGuidance === 'boolean' ? raw.spokenGuidance : d.spokenGuidance,
    onboarded: raw.onboarded === true,
  };
}

/**
 * Build a full palette from the student's own text and background colours.
 * Interactive elements use the text colour so they are always as visible as
 * the text itself.
 */
export function customPalette(text: string, background: string): Palette {
  const dark = contrastRatio(background, '#000000') < contrastRatio(background, '#FFFFFF');
  return {
    id: 'custom',
    name: 'My colours',
    scheme: dark ? 'dark' : 'light',
    background,
    surface: mix(background, text, 0.04),
    surfaceSunken: mix(background, text, 0.1),
    text,
    textMuted: text,
    accent: text,
    accentPressed: mix(text, background, 0.25),
    onAccent: background,
    accentSoft: mix(background, text, 0.12),
    border: text,
    focus: text,
    danger: text,
    onDanger: background,
    highlight: text,
    onHighlight: background,
    uncertain: text,
    uncertainBg: mix(background, text, 0.14),
  };
}

export function paletteFor(profile: Pick<VisionProfile, 'paletteId' | 'customText' | 'customBackground'>): Palette {
  if (profile.paletteId === 'custom') return customPalette(profile.customText, profile.customBackground);
  return palettes[profile.paletteId];
}
