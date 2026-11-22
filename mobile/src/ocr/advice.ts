/**
 * Practical retake advice from photo-quality signals and recognition results.
 * Thresholds are deliberately conservative heuristics; tune them with real
 * classroom photos during the pilot. Pure module.
 */
import type { PhotoQuality } from '../../modules/luma-ocr';
import type { DocStats } from './layout';

export type CaptureKind = 'page' | 'board';

export type AdviceReason = 'dark' | 'glare' | 'blurry' | 'noText' | 'lowConfidence';

export interface CaptureAdvice {
  reason: AdviceReason;
  /** True when no text was found: the student must retake. */
  blocking: boolean;
  title: string;
  instruction: string;
  promptId: 'too_dark' | 'glare' | 'too_blurry' | 'no_text' | 'try_again';
}

export const THRESHOLDS = {
  darkBrightness: 55,
  glareShare: 0.06,
  blurSharpness: 60,
  softSharpness: 120,
  lowMeanConfidence: 0.62,
  uncertainShare: 0.25,
};

function reasonFromPhoto(q: PhotoQuality | null, sharpLimit: number): AdviceReason | null {
  if (!q) return null;
  if (q.brightness < THRESHOLDS.darkBrightness) return 'dark';
  if (q.glare > THRESHOLDS.glareShare) return 'glare';
  if (q.sharpness < sharpLimit) return 'blurry';
  return null;
}

const TEXT: Record<AdviceReason, Record<CaptureKind, { title: string; instruction: string }>> = {
  dark: {
    page: { title: 'The photo is too dark', instruction: 'Move closer to a window or a light, or turn on the camera flash. Then take the photo again.' },
    board: { title: 'The photo is too dark', instruction: 'Turn on the classroom light or move so light falls on the board. Then take the photo again.' },
  },
  glare: {
    page: { title: 'Light is shining on the page', instruction: 'Tilt the page a little, or move so the light is behind you, until the shiny patch is gone. Then retake.' },
    board: { title: 'Light is reflecting off the board', instruction: 'Step a little to the left or right until the bright patch moves off the writing. Then retake.' },
  },
  blurry: {
    page: { title: 'The photo is blurry', instruction: 'Rest your elbows on the desk, hold the phone steady, and tap the words on the screen to focus before you take the photo.' },
    board: { title: 'The photo is blurry', instruction: 'Hold the phone with both hands and wait a second before taking the photo. Tap the writing on the screen to focus.' },
  },
  noText: {
    page: { title: 'No words were found', instruction: 'Fill the screen with the page and keep the words the right way up. Then take the photo again.' },
    board: { title: 'No words were found', instruction: 'Move closer so the writing fills most of the screen. For a long board, take it in parts.' },
  },
  lowConfidence: {
    page: { title: 'Some words may be wrong', instruction: 'Words LUMA is unsure about are marked. Check them against the photo, or retake the photo closer and in better light.' },
    board: { title: 'Some words may be wrong', instruction: 'Words LUMA is unsure about are marked. Check them against the photo, or move closer to the board and retake.' },
  },
};

const PROMPT: Record<AdviceReason, CaptureAdvice['promptId']> = {
  dark: 'too_dark',
  glare: 'glare',
  blurry: 'too_blurry',
  noText: 'no_text',
  lowConfidence: 'try_again',
};

function make(reason: AdviceReason, kind: CaptureKind, blocking: boolean): CaptureAdvice {
  return { reason, blocking, ...TEXT[reason][kind], promptId: PROMPT[reason] };
}

/** Advice after a scan, or null when the result looks good. */
export function adviseCapture(quality: PhotoQuality | null, stats: DocStats, kind: CaptureKind): CaptureAdvice | null {
  if (stats.wordCount === 0) {
    return make(reasonFromPhoto(quality, THRESHOLDS.blurSharpness) ?? 'noText', kind, true);
  }
  const uncertainShare = stats.uncertainCount / stats.wordCount;
  const weak =
    (stats.meanConfidence != null && stats.meanConfidence < THRESHOLDS.lowMeanConfidence) ||
    uncertainShare > THRESHOLDS.uncertainShare;
  if (!weak) return null;
  const photoReason = reasonFromPhoto(quality, THRESHOLDS.softSharpness);
  if (photoReason) {
    // Text was found, so this is advice, not a blocker.
    const a = make(photoReason, kind, false);
    return { ...a, instruction: `${a.instruction} Uncertain words are marked so you can check them.` };
  }
  return make('lowConfidence', kind, false);
}
