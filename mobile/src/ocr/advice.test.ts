import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adviseCapture } from './advice.ts';

const good = { sharpness: 400, brightness: 170, contrast: 60, glare: 0.01 };
const none = { lineCount: 0, wordCount: 0, uncertainCount: 0, meanConfidence: null };
const fine = { lineCount: 12, wordCount: 90, uncertainCount: 2, meanConfidence: 0.93 };
const weak = { lineCount: 6, wordCount: 30, uncertainCount: 12, meanConfidence: 0.55 };

test('no text in a dark photo asks for more light', () => {
  const a = adviseCapture({ ...good, brightness: 30 }, none, 'page');
  assert.equal(a?.reason, 'dark');
  assert.equal(a?.blocking, true);
});

test('no text with clipped highlights explains glare', () => {
  assert.equal(adviseCapture({ ...good, glare: 0.2 }, none, 'page')?.reason, 'glare');
});

test('no text in a soft photo explains blur', () => {
  assert.equal(adviseCapture({ ...good, sharpness: 20 }, none, 'page')?.reason, 'blurry');
});

test('no text in a good photo gives framing advice', () => {
  const a = adviseCapture(good, none, 'board');
  assert.equal(a?.reason, 'noText');
  assert.match(a!.instruction, /in parts/);
});

test('a clean scan needs no advice', () => {
  assert.equal(adviseCapture(good, fine, 'page'), null);
});

test('weak recognition with glare is advice, not a blocker', () => {
  const a = adviseCapture({ ...good, glare: 0.15 }, weak, 'board');
  assert.equal(a?.reason, 'glare');
  assert.equal(a?.blocking, false);
  assert.match(a!.instruction, /Uncertain words are marked/);
});

test('weak recognition in a good photo points to the marked words', () => {
  const a = adviseCapture(good, weak, 'page');
  assert.equal(a?.reason, 'lowConfidence');
  assert.equal(a?.blocking, false);
});
