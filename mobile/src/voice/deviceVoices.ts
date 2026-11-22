import { listDeviceVoices, type DeviceVoice } from '../../modules/luma-ocr';
import type { LanguageCode } from '@/profile/profile';
import { languageInfo } from './languages';

export interface VoiceChoice {
  /** Installed voice that works without internet. */
  offline: DeviceVoice | null;
  /** A voice that needs a connection (e.g. a cloud voice of the TTS engine). */
  network: DeviceVoice | null;
  engine: string | null;
  checked: boolean;
}

let cache: { at: number; voices: DeviceVoice[]; engine: string | null; ok: boolean } | null = null;

export async function getDeviceVoices(force = false): Promise<{ voices: DeviceVoice[]; engine: string | null; ok: boolean }> {
  if (!force && cache && Date.now() - cache.at < 5 * 60 * 1000) return cache;
  try {
    const list = await listDeviceVoices();
    cache = { at: Date.now(), voices: list.voices, engine: list.engine, ok: list.ok };
  } catch {
    cache = { at: Date.now(), voices: [], engine: null, ok: false };
  }
  return cache;
}

/** Prefer Nigerian English for English text, then any matching voice. */
function rank(v: DeviceVoice): number {
  const loc = v.locale.toLowerCase();
  if (loc.endsWith('-ng')) return 0;
  if (loc === 'en-gb') return 1;
  if (loc === 'en-us') return 2;
  return 3 - Math.min(2, v.quality / 500);
}

export async function chooseVoice(language: LanguageCode, force = false): Promise<VoiceChoice> {
  const { voices, engine, ok } = await getDeviceVoices(force);
  const codes = languageInfo(language).ttsCodes;
  const matching = voices.filter((v) => codes.includes(v.language.toLowerCase())).sort((a, b) => rank(a) - rank(b));
  return {
    offline: matching.find((v) => !v.networkRequired && !v.notInstalled) ?? null,
    network: matching.find((v) => v.networkRequired && !v.notInstalled) ?? null,
    engine,
    checked: ok,
  };
}
