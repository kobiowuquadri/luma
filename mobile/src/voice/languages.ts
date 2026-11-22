import type { LanguageCode } from '@/profile/profile';

export interface LanguageInfo {
  code: LanguageCode;
  /** Name in English. */
  name: string;
  /** Name in the language itself. */
  nativeName: string;
  /** Codes Android text-to-speech engines may use for this language. */
  ttsCodes: string[];
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', ttsCodes: ['en', 'eng'] },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', ttsCodes: ['yo', 'yor'] },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', ttsCodes: ['ha', 'hau'] },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', ttsCodes: ['ig', 'ibo'] },
  { code: 'pcm', name: 'Nigerian Pidgin', nativeName: 'Naijá', ttsCodes: ['pcm'] },
];

export function languageInfo(code: LanguageCode): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** "Yorùbá (Yoruba)" or "English". */
export function languageLabel(code: LanguageCode): string {
  const l = languageInfo(code);
  return l.name === l.nativeName ? l.name : `${l.nativeName} (${l.name})`;
}

/** Map an ML Kit / BCP-47 language tag to a LUMA language, if supported. */
export function toLanguageCode(tag: string | null | undefined): LanguageCode | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((l) => l.ttsCodes.includes(base))?.code ?? null;
}
