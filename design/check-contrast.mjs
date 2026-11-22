#!/usr/bin/env node
// Verifies every foreground/background pair LUMA draws, in the app palettes
// and in the website's CSS variables, against WCAG 2.x contrast minimums.
//
//   node design/check-contrast.mjs          # prints a table, exits 1 on failure
//
// Requires Node 22.18+ / 24 (loads the TypeScript palette file directly).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { palettes, requiredPairs } = await import('../mobile/src/theme/palettes.ts');

function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let failures = 0;
const rows = [];
for (const p of Object.values(palettes)) {
  for (const { fg, bg, min } of requiredPairs) {
    const ratio = contrast(p[fg], p[bg]);
    const ok = ratio >= min;
    if (!ok) failures++;
    rows.push([`app:${p.id}`, `${fg} ${p[fg]}`, `${bg} ${p[bg]}`, ratio.toFixed(2), `>= ${min}`, ok ? 'pass' : 'FAIL']);
  }
}

// Website: each [data-theme] block in globals.css defines --bg, --fg, etc.
const cssPath = join(root, 'web', 'src', 'app', 'globals.css');
if (existsSync(cssPath)) {
  const css = readFileSync(cssPath, 'utf8');
  const webPairs = [
    ['fg', 'bg', 7], ['fg', 'surface', 7], ['fg-muted', 'bg', 7], ['fg-muted', 'surface', 7],
    ['accent', 'bg', 7], ['accent', 'surface', 7], ['on-accent', 'accent', 7],
    ['on-highlight', 'highlight', 7], ['border', 'bg', 3], ['focus', 'bg', 3], ['fg', 'accent-soft', 7],
    // Site themes only: primary buttons are ink on the page colour.
    ['on-ink', 'ink', 7, 'optional'], ['fg', 'surface-sunken', 7, 'optional'],
  ];
  const blocks = [...css.matchAll(/\/\*\s*theme:(\w+)\s*\*\/([\s\S]*?)\}/g)];
  if (blocks.length === 0) {
    console.error('No "/* theme:name */" blocks found in globals.css');
    failures++;
  }
  for (const [, name, body] of blocks) {
    const vars = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})/g)].map((m) => [m[1], m[2]]));
    for (const [fg, bg, min, optional] of webPairs) {
      if (optional && (!vars[fg] || !vars[bg])) continue;
      if (!vars[fg] || !vars[bg]) {
        rows.push([`web:${name}`, fg, bg, '-', `>= ${min}`, 'MISSING']);
        failures++;
        continue;
      }
      const ratio = contrast(vars[fg], vars[bg]);
      const ok = ratio >= min;
      if (!ok) failures++;
      rows.push([`web:${name}`, `${fg} ${vars[fg]}`, `${bg} ${vars[bg]}`, ratio.toFixed(2), `>= ${min}`, ok ? 'pass' : 'FAIL']);
    }
  }
}

const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
for (const r of rows) console.log(r.map((c, i) => String(c).padEnd(widths[i])).join('  '));
console.log(failures ? `\n${failures} pair(s) below the minimum.` : `\nAll ${rows.length} pairs pass.`);
process.exitCode = failures ? 1 : 0;
