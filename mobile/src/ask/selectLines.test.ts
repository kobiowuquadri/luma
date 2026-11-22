import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectLines } from './selectLines.ts';

const opts = { maxChars: 120, maxLineChars: 600, maxLines: 400 };

test('short pages are sent whole', () => {
  const lines = [
    { id: 'L1', text: 'Topic: Photosynthesis' },
    { id: 'L2', text: 'Submit on Friday.' },
  ];
  assert.deepEqual(selectLines(lines, 'When?', { ...opts, maxChars: 1000 }), lines);
});

test('long pages keep matching lines and neighbours, in reading order, within the limit', () => {
  const lines = Array.from({ length: 30 }, (_, i) => ({ id: `L${i + 1}`, text: `Filler sentence number ${i + 1} here.` }));
  lines[20] = { id: 'L21', text: 'Assignment due Friday 21 November.' };
  const picked = selectLines(lines, 'When is the assignment due?', opts);
  const ids = picked.map((l) => l.id);
  assert.ok(ids.includes('L21'));
  assert.ok(ids.includes('L20') && ids.includes('L22'), 'neighbours included');
  assert.ok(picked.reduce((n, l) => n + l.text.length, 0) <= opts.maxChars);
  const nums = ids.map((id) => Number(id.slice(1)));
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
});

test('focus lines for explanations are always included', () => {
  const lines = Array.from({ length: 30 }, (_, i) => ({ id: `L${i + 1}`, text: `Line text number ${i + 1}.` }));
  const picked = selectLines(lines, '', { ...opts, focusIds: ['L29'] });
  assert.ok(picked.some((l) => l.id === 'L29'));
});

test('overlong lines are trimmed to the server limit', () => {
  const picked = selectLines([{ id: 'L1', text: 'x'.repeat(900) }], 'q', { maxChars: 5000, maxLineChars: 600, maxLines: 400 });
  assert.equal(picked[0].text.length, 600);
});
