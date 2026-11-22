/**
 * LUMA colour palettes. This file is the source of truth for both the app and
 * the website (web/src/app/globals.css mirrors these values). Every pair the
 * UI uses is verified by design/check-contrast.mjs and by palettes.test.ts.
 *
 * Keep this file free of imports so Node can load it directly for checks.
 */

export type PaletteId = 'paper' | 'light' | 'dark' | 'contrast';

export interface Palette {
  id: PaletteId | 'custom';
  name: string;
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  accentSoft: string;
  border: string;
  focus: string;
  danger: string;
  onDanger: string;
  highlight: string;
  onHighlight: string;
  uncertain: string;
  uncertainBg: string;
}

export const palettes: Record<PaletteId, Palette> = {
  paper: {
    id: 'paper',
    name: 'Warm paper',
    scheme: 'light',
    background: '#F5EFE3',
    surface: '#FCF9F2',
    surfaceSunken: '#EAE2D2',
    text: '#1D1B18',
    textMuted: '#45403A',
    accent: '#0A5651',
    accentPressed: '#073F3B',
    onAccent: '#FFFFFF',
    accentSoft: '#D6E8E2',
    border: '#7A7062',
    focus: '#0A5651',
    danger: '#9B2C1E',
    onDanger: '#FFFFFF',
    highlight: '#F3D573',
    onHighlight: '#1D1B18',
    uncertain: '#8A4A00',
    uncertainBg: '#F7E3C4',
  },
  light: {
    id: 'light',
    name: 'Plain white',
    scheme: 'light',
    background: '#FFFFFF',
    surface: '#F3F5F5',
    surfaceSunken: '#E4E9E9',
    text: '#101417',
    textMuted: '#3B4347',
    accent: '#085B55',
    accentPressed: '#05403C',
    onAccent: '#FFFFFF',
    accentSoft: '#D9EEEA',
    border: '#6F787C',
    focus: '#085B55',
    danger: '#A1281A',
    onDanger: '#FFFFFF',
    highlight: '#FFE07A',
    onHighlight: '#101417',
    uncertain: '#8A4A00',
    uncertainBg: '#FCEBCF',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    scheme: 'dark',
    background: '#121416',
    surface: '#1B1F22',
    surfaceSunken: '#0B0D0E',
    text: '#EEE8DC',
    textMuted: '#CCC4B6',
    accent: '#74D4C7',
    accentPressed: '#A3E6DD',
    onAccent: '#08201D',
    accentSoft: '#123A36',
    border: '#8D989D',
    focus: '#74D4C7',
    danger: '#FF9C8C',
    onDanger: '#2A0904',
    highlight: '#5C4A10',
    onHighlight: '#FFF6DC',
    uncertain: '#F2B65C',
    uncertainBg: '#3A2D12',
  },
  contrast: {
    id: 'contrast',
    name: 'Yellow on black',
    scheme: 'dark',
    background: '#000000',
    surface: '#000000',
    surfaceSunken: '#161616',
    text: '#FFE14D',
    textMuted: '#FFE14D',
    accent: '#FFE14D',
    accentPressed: '#FFF0A3',
    onAccent: '#000000',
    accentSoft: '#332C00',
    border: '#FFE14D',
    focus: '#FFFFFF',
    danger: '#FF9C8C',
    onDanger: '#000000',
    highlight: '#FFE14D',
    onHighlight: '#000000',
    uncertain: '#FF9C8C',
    uncertainBg: '#3B1810',
  },
};

/** Swatches offered for custom text and background colours. */
export const textSwatches: { hex: string; name: string }[] = [
  { hex: '#000000', name: 'Black' },
  { hex: '#1D1B18', name: 'Ink' },
  { hex: '#0B2545', name: 'Navy' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#EEE8DC', name: 'Cream' },
  { hex: '#FFE14D', name: 'Yellow' },
  { hex: '#9BE7FF', name: 'Light blue' },
  { hex: '#B8F2C9', name: 'Light green' },
];

export const backgroundSwatches: { hex: string; name: string }[] = [
  { hex: '#F5EFE3', name: 'Paper' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#FFF4C7', name: 'Pale yellow' },
  { hex: '#E3F1EC', name: 'Mint' },
  { hex: '#DDE8F7', name: 'Pale blue' },
  { hex: '#121416', name: 'Charcoal' },
  { hex: '#000000', name: 'Black' },
  { hex: '#0B2545', name: 'Navy' },
];

/**
 * Pairs the interface draws, with the minimum WCAG contrast each must meet.
 * 7 = AAA text, 4.5 = AA text, 3 = non-text UI (borders, focus rings).
 */
export const requiredPairs: { fg: keyof Palette; bg: keyof Palette; min: number }[] = [
  { fg: 'text', bg: 'background', min: 7 },
  { fg: 'text', bg: 'surface', min: 7 },
  { fg: 'text', bg: 'surfaceSunken', min: 7 },
  { fg: 'text', bg: 'accentSoft', min: 7 },
  { fg: 'textMuted', bg: 'background', min: 7 },
  { fg: 'textMuted', bg: 'surface', min: 7 },
  { fg: 'accent', bg: 'background', min: 7 },
  { fg: 'accent', bg: 'surface', min: 7 },
  { fg: 'onAccent', bg: 'accent', min: 7 },
  { fg: 'onAccent', bg: 'accentPressed', min: 4.5 },
  { fg: 'onHighlight', bg: 'highlight', min: 7 },
  { fg: 'text', bg: 'uncertainBg', min: 7 },
  { fg: 'uncertain', bg: 'uncertainBg', min: 3 },
  { fg: 'danger', bg: 'background', min: 4.5 },
  { fg: 'danger', bg: 'surface', min: 4.5 },
  { fg: 'onDanger', bg: 'danger', min: 4.5 },
  { fg: 'border', bg: 'background', min: 3 },
  { fg: 'border', bg: 'surface', min: 3 },
  { fg: 'focus', bg: 'background', min: 3 },
  { fg: 'focus', bg: 'surface', min: 3 },
];
