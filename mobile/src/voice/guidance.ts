import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { LanguageCode } from '@/profile/profile';
import { PROMPT_RECORDINGS } from './promptAssets.generated';
import { PROMPT_IDS, type PromptId } from './prompts';

let current: AudioPlayer | null = null;

export function promptAvailable(language: LanguageCode, id: PromptId): boolean {
  return PROMPT_RECORDINGS[language]?.[id] != null;
}

/** Which approved prompts exist for a language. */
export function promptCoverage(language: LanguageCode): { available: number; total: number } {
  return { available: PROMPT_IDS.filter((id) => promptAvailable(language, id)).length, total: PROMPT_IDS.length };
}

export function stopGuidance(): void {
  if (current) {
    try {
      current.pause();
      current.remove();
    } catch {
      // Player already released.
    }
    current = null;
  }
}

/**
 * Play an approved recording in the student's language, if one exists.
 * Returns false (and plays nothing) when there is no recording for that
 * language: guidance is never voiced in a different language.
 */
export function playGuidance(language: LanguageCode, id: PromptId, enabled: boolean): boolean {
  if (!enabled) return false;
  const rec = PROMPT_RECORDINGS[language]?.[id];
  if (!rec) return false;
  stopGuidance();
  try {
    const player = createAudioPlayer(rec.source);
    current = player;
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish && current === player) stopGuidance();
    });
    player.play();
    return true;
  } catch {
    return false;
  }
}
