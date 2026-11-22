import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RawBlock, RawLine, RawRecognition } from '../../modules/luma-ocr';
import { buildDocument, documentText, paragraphText, rotateBox, suggestTitle, UNCERTAIN_BELOW } from './layout.ts';

function line(text: string, left: number, top: number, right: number, bottom: number, confidence = 0.95, angle = 0): RawLine {
  const words = text.split(' ');
  const w = (right - left) / words.length;
  return {
    text,
    box: { left, top, right, bottom },
    angle,
    confidence,
    language: 'en',
    elements: words.map((t, i) => ({
      text: t,
      box: { left: left + i * w, top, right: left + (i + 1) * w, bottom },
      confidence: t.startsWith('?') ? 0.3 : confidence,
    })),
  };
}

function block(lines: RawLine[]): RawBlock {
  const boxes = lines.map((l) => l.box!);
  return {
    text: lines.map((l) => l.text).join('\n'),
    box: {
      left: Math.min(...boxes.map((b) => b.left)),
      top: Math.min(...boxes.map((b) => b.top)),
      right: Math.max(...boxes.map((b) => b.right)),
      bottom: Math.max(...boxes.map((b) => b.bottom)),
    },
    language: 'en',
    lines,
  };
}

function raw(blocks: RawBlock[], width = 1000, height = 1400): RawRecognition {
  return { width, height, imageUri: 'file:///x.jpg', quality: { sharpness: 400, brightness: 170, contrast: 60, glare: 0.01 }, blocks, durationMs: 1 };
}

const texts = (doc: ReturnType<typeof buildDocument>) => doc.lines.map((l) => l.text);

test('orders a single column top to bottom even when ML Kit returns blocks out of order', () => {
  const b1 = block([line('Topic: Photosynthesis', 100, 100, 600, 130)]);
  const b2 = block([line('Photosynthesis is the process by which', 100, 200, 900, 230), line('green plants make their own food.', 100, 240, 800, 270)]);
  const b3 = block([line('Assignment: page 47.', 100, 400, 700, 430)]);
  const doc = buildDocument(raw([b3, b1, b2]), 'test');
  assert.deepEqual(texts(doc), [
    'Topic: Photosynthesis',
    'Photosynthesis is the process by which',
    'green plants make their own food.',
    'Assignment: page 47.',
  ]);
  assert.deepEqual(doc.lines.map((l) => l.id), ['L1', 'L2', 'L3', 'L4']);
});

test('reads a full-width title, then the left column, then the right column', () => {
  const title = block([line('SS2 BIOLOGY HANDOUT 3', 100, 60, 900, 100)]);
  const left1 = block([line('Left one', 60, 200, 460, 230), line('Left two', 60, 240, 460, 270)]);
  const left2 = block([line('Left three', 60, 420, 460, 450)]);
  const right1 = block([line('Right one', 540, 200, 940, 230)]);
  const right2 = block([line('Right two', 540, 420, 940, 450), line('Right three', 540, 460, 940, 490)]);
  const doc = buildDocument(raw([right1, left2, title, right2, left1]), 'test');
  assert.deepEqual(texts(doc), ['SS2 BIOLOGY HANDOUT 3', 'Left one', 'Left two', 'Left three', 'Right one', 'Right two', 'Right three']);
});

test('reads blocks on the same row left to right', () => {
  const teacher = block([line('Teacher: Mrs. A. Okafor', 80, 150, 450, 180)]);
  const date = block([line('Date: 12 November 2026', 620, 152, 940, 182)]);
  const body = block([line('Photosynthesis is how plants make food.', 80, 260, 940, 290)]);
  const doc = buildDocument(raw([date, body, teacher]), 'test');
  assert.deepEqual(texts(doc), ['Teacher: Mrs. A. Okafor', 'Date: 12 November 2026', 'Photosynthesis is how plants make food.']);
});

test('keeps reading order on a tilted photo', () => {
  const angle = 8;
  const tilt = (l: RawLine): RawLine => ({ ...l, angle, box: rotateBox(l.box!, angle, 500, 700) });
  const b1 = block([tilt(line('First paragraph line', 100, 300, 900, 330))]);
  const b2 = block([tilt(line('Second paragraph line', 100, 420, 900, 450))]);
  const b3 = block([tilt(line('Third paragraph line', 100, 540, 900, 570))]);
  const doc = buildDocument(raw([b2, b3, b1]), 'test');
  assert.deepEqual(texts(doc), ['First paragraph line', 'Second paragraph line', 'Third paragraph line']);
});

test('reflows lines into paragraphs and keeps original wording, numbers and hyphens', () => {
  const b = block([
    line('Photosynthesis needs carbon diox-', 100, 100, 900, 130),
    line('ide, water and light. Submit on 21/11/2026.', 100, 140, 900, 170),
  ]);
  const doc = buildDocument(raw([b]), 'test');
  assert.equal(doc.paragraphs.length, 1);
  assert.equal(paragraphText(doc, doc.paragraphs[0]), 'Photosynthesis needs carbon diox-ide, water and light. Submit on 21/11/2026.');
});

test('starts a new paragraph for list items and marks bullet lists', () => {
  const b = block([
    line('Factors that affect the rate:', 100, 100, 700, 130),
    line('• Light intensity', 120, 140, 500, 170),
    line('• Temperature', 120, 180, 500, 210),
    line('1. Answer all questions.', 100, 220, 700, 250),
  ]);
  const doc = buildDocument(raw([b]), 'test');
  assert.equal(doc.paragraphs.length, 4);
  assert.equal(doc.paragraphs[1].kind, 'list');
  assert.equal(doc.paragraphs[3].kind, 'text');
});

test('detects short all-caps lines as headings', () => {
  const h = block([line('SS2 BIOLOGY - HANDOUT 3', 100, 60, 900, 100)]);
  const p = block([line('Photosynthesis is the process by which green plants make food.', 100, 200, 900, 230)]);
  const doc = buildDocument(raw([h, p]), 'test');
  assert.equal(doc.paragraphs[0].kind, 'heading');
  assert.equal(doc.paragraphs[1].kind, 'text');
});

test('marks low-confidence words as uncertain without changing them', () => {
  const b = block([line('Submit on ?Friday please', 100, 100, 900, 130)]);
  const doc = buildDocument(raw([b]), 'test');
  const uncertain = doc.lines[0].words.filter((w) => w.uncertain).map((w) => w.text);
  assert.deepEqual(uncertain, ['?Friday']);
  assert.equal(doc.stats.uncertainCount, 1);
  assert.ok(doc.lines[0].words.every((w) => w.uncertain === (w.confidence !== null && w.confidence < UNCERTAIN_BELOW)));
});

test('handles a photo with no text', () => {
  const doc = buildDocument(raw([]), 'test');
  assert.equal(doc.stats.wordCount, 0);
  assert.equal(doc.lines.length, 0);
  assert.equal(documentText(doc), '');
});

test('suggests a title from the first meaningful line', () => {
  const doc = buildDocument(raw([block([line('— —', 100, 40, 200, 60)]), block([line('SS2 Biology Handout 3', 100, 100, 600, 130)])]), 'test');
  assert.equal(suggestTitle(doc, 'Scan'), 'SS2 Biology Handout 3');
  assert.equal(suggestTitle(buildDocument(raw([]), 'test'), 'Scan, 20 Nov'), 'Scan, 20 Nov');
});
