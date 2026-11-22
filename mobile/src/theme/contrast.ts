/** WCAG 2.x contrast helpers. Pure module. */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear blend of two colours; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export type ContrastLevel = 'strong' | 'good' | 'low';

/** strong >= 7:1 (AAA), good >= 4.5:1 (AA), otherwise low. */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'strong';
  if (ratio >= 4.5) return 'good';
  return 'low';
}

export function describeContrast(ratio: number): string {
  const level = contrastLevel(ratio);
  const r = ratio.toFixed(1);
  if (level === 'strong') return `Contrast ${r} to 1. Strong.`;
  if (level === 'good') return `Contrast ${r} to 1. Readable for most people.`;
  return `Contrast ${r} to 1. Low. Some text may be hard to read.`;
}
