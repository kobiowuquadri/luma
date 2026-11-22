import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palettes, requiredPairs, textSwatches, backgroundSwatches } from './palettes.ts';
import { contrastRatio, contrastLevel } from './contrast.ts';
import { brandFontCovers } from './fontCoverage.ts';
import { customPalette, parseProfile, DEFAULT_PROFILE } from '../profile/profile.ts';

test('every built-in palette meets its contrast minimums', () => {
  for (const p of Object.values(palettes)) {
    for (const { fg, bg, min } of requiredPairs) {
      const ratio = contrastRatio(p[fg], p[bg]);
      assert.ok(ratio >= min, `${p.id}: ${fg} on ${bg} is ${ratio.toFixed(2)}, needs ${min}`);
    }
  }
});

test('contrast helper matches known WCAG values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrastLevel(4.6), 'good');
  assert.equal(contrastLevel(3), 'low');
});

test('custom colours keep buttons as visible as the text', () => {
  const p = customPalette('#FFE14D', '#0B2545');
  assert.equal(contrastRatio(p.onAccent, p.accent), contrastRatio('#FFE14D', '#0B2545'));
  assert.equal(p.scheme, 'dark');
});

test('swatch lists offer at least one strong pair for every background', () => {
  for (const bg of backgroundSwatches) {
    assert.ok(textSwatches.some((t) => contrastRatio(t.hex, bg.hex) >= 7), `no strong text colour for ${bg.name}`);
  }
});

test('profile parsing repairs bad stored values', () => {
  const p = parseProfile('{"textSize": 999, "language": "fr", "paletteId": "neon", "customText": "red"}');
  assert.equal(p.textSize, 56);
  assert.equal(p.language, 'en');
  assert.equal(p.paletteId, 'paper');
  assert.equal(p.customText, DEFAULT_PROFILE.customText);
  assert.deepEqual(parseProfile('not json'), DEFAULT_PROFILE);
});

test('brand font coverage detects letters the typeface lacks', () => {
  assert.equal(brandFontCovers('Submit on Friday, 21 November 2026.'), true);
  assert.equal(brandFontCovers('Yorùbá'), true);
  assert.equal(brandFontCovers('Ọmọ ilé ẹ̀kọ́'), false);
  assert.equal(brandFontCovers('Ina ɗan makaranta'), false);
  assert.equal(brandFontCovers('Ụlọ akwụkwọ'), false);
});
