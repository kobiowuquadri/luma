import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '@/db/settings';
import { useReduceMotion } from '@/lib/a11y';
import { DEFAULT_PROFILE, paletteFor, parseProfile, type VisionProfile } from '@/profile/profile';
import type { Palette } from './palettes';

export const FONT = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
} as const;

export type FontWeightName = keyof typeof FONT;

export interface Theme {
  profile: VisionProfile;
  palette: Palette;
  size: { small: number; body: number; title: number; display: number };
  reader: { fontSize: number; lineHeight: number; letterSpacing: number; weight: FontWeightName };
  /** Spacing scale in dp, grows slightly with the text size. */
  space: (steps: number) => number;
  radius: number;
  reduceMotion: boolean;
}

interface ThemeContextValue extends Theme {
  ready: boolean;
  updateProfile: (patch: Partial<VisionProfile>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function buildTheme(profile: VisionProfile, reduceMotion: boolean): Theme {
  const body = Math.min(28, Math.max(18, Math.round(profile.textSize * 0.78)));
  const unit = 4 * Math.min(1.5, Math.max(1, body / 19));
  return {
    profile,
    palette: paletteFor(profile),
    size: {
      small: Math.max(16, Math.round(body * 0.88)),
      body,
      title: Math.round(body * 1.3),
      display: Math.round(body * 1.6),
    },
    reader: {
      fontSize: profile.textSize,
      lineHeight: Math.round(profile.textSize * profile.lineSpacing),
      letterSpacing: Math.round(profile.textSize * profile.letterSpacing * 10) / 10,
      weight: profile.boldText ? 'bold' : 'regular',
    },
    space: (steps: number) => Math.round(steps * unit),
    radius: 14,
    reduceMotion,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const reduceMotion = useReduceMotion();
  const [profile, setProfile] = useState<VisionProfile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    getSetting(db, 'profile').then((json) => {
      if (!alive) return;
      setProfile(parseProfile(json));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [db]);

  const updateProfile = useCallback((patch: Partial<VisionProfile>) => {
    setProfile((prev) => parseProfile(JSON.stringify({ ...prev, ...patch })));
  }, []);

  // Persist every change once the stored profile has been loaded.
  useEffect(() => {
    if (ready) setSetting(db, 'profile', JSON.stringify(profile)).catch(() => {});
  }, [db, profile, ready]);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...buildTheme(profile, reduceMotion), ready, updateProfile }),
    [profile, reduceMotion, ready, updateProfile],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
