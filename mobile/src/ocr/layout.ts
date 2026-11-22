/**
 * Turns raw ML Kit output into LUMA's reading document:
 *  - a stable reading order (XY-cut over blocks, corrected for page tilt),
 *  - numbered lines L1..Ln that keep their positions on the photo,
 *  - paragraphs that reflow to the screen,
 *  - per-word confidence so uncertain words stay visible for review.
 *
 * Text is never corrected or rewritten: names, dates, numbers and wording are
 * kept exactly as recognised. Pure module (no React Native imports).
 */
import type { PhotoQuality, RawBlock, RawBox, RawLine, RawRecognition } from '../../modules/luma-ocr';

export type Box = RawBox;

export interface DocWord {
  text: string;
  box: Box | null;
  confidence: number | null;
  uncertain: boolean;
}

export interface DocLine {
  id: string;
  text: string;
  box: Box | null;
  confidence: number | null;
  words: DocWord[];
}

export type ParagraphKind = 'heading' | 'text' | 'list';

export interface DocParagraph {
  id: string;
  kind: ParagraphKind;
  lineIds: string[];
}

export interface DocStats {
  lineCount: number;
  wordCount: number;
  uncertainCount: number;
  meanConfidence: number | null;
}

export interface ReadingDocument {
  version: 1;
  width: number;
  height: number;
  engine: string;
  language: string | null;
  quality: PhotoQuality | null;
  lines: DocLine[];
  paragraphs: DocParagraph[];
  stats: DocStats;
}

/** Words recognised with lower confidence than this are marked for review. */
export const UNCERTAIN_BELOW = 0.6;

const LIST_MARKER = /^\s*[•●▪◦‣\-–—*·]\s+/;
const NUMBERED = /^\s*(\(?\d{1,3}[.)]|\(?[a-hA-H][.)]|\(?[ivxIVX]{1,4}[.)])\s+/;

interface Item {
  key: number;
  box: Box;
}

function height(b: Box): number {
  return Math.max(1, b.bottom - b.top);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function union(boxes: (Box | null)[]): Box | null {
  const real = boxes.filter((b): b is Box => b != null);
  if (real.length === 0) return null;
  return {
    left: Math.min(...real.map((b) => b.left)),
    top: Math.min(...real.map((b) => b.top)),
    right: Math.max(...real.map((b) => b.right)),
    bottom: Math.max(...real.map((b) => b.bottom)),
  };
}

/** Rotate a box about (cx, cy) by `degrees` and return its axis-aligned bounds. */
export function rotateBox(b: Box, degrees: number, cx: number, cy: number): Box {
  if (Math.abs(degrees) < 0.5) return b;
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const pts = [
    [b.left, b.top],
    [b.right, b.top],
    [b.left, b.bottom],
    [b.right, b.bottom],
  ].map(([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]);
  return {
    left: Math.min(...pts.map((p) => p[0])),
    top: Math.min(...pts.map((p) => p[1])),
    right: Math.max(...pts.map((p) => p[0])),
    bottom: Math.max(...pts.map((p) => p[1])),
  };
}

/** Median text angle in degrees (ML Kit: clockwise positive). */
export function dominantAngle(blocks: RawBlock[]): number {
  const angles = blocks.flatMap((b) => b.lines.map((l) => l.angle)).filter((a): a is number => typeof a === 'number' && Number.isFinite(a));
  return median(angles);
}

/** Split items along an axis wherever the projection has a gap >= minGap. */
function splitAxis(items: Item[], axis: 'x' | 'y', minGap: number): Item[][] | null {
  const lo = axis === 'x' ? 'left' : 'top';
  const hi = axis === 'x' ? 'right' : 'bottom';
  const sorted = [...items].sort((a, b) => a.box[lo] - b.box[lo]);
  const groups: Item[][] = [];
  let current: Item[] = [sorted[0]];
  let end = sorted[0].box[hi];
  let found = false;
  for (const it of sorted.slice(1)) {
    if (it.box[lo] - end >= minGap) {
      groups.push(current);
      current = [it];
      found = true;
    } else {
      current.push(it);
    }
    end = Math.max(end, it.box[hi]);
  }
  groups.push(current);
  return found ? groups : null;
}

function rangeY(items: Item[]): [number, number] {
  return [Math.min(...items.map((i) => i.box.top)), Math.max(...items.map((i) => i.box.bottom))];
}

/** Columns are tall relative to the region and sit side by side. */
function looksLikeColumns(cols: Item[][], regionH: number): boolean {
  if (cols.length > 4) return false;
  const ranges = cols.map(rangeY);
  if (!ranges.every(([t, b]) => b - t >= regionH * 0.35)) return false;
  for (let i = 1; i < ranges.length; i++) {
    const [t1, b1] = ranges[i - 1];
    const [t2, b2] = ranges[i];
    const overlap = Math.min(b1, b2) - Math.max(t1, t2);
    if (overlap < 0.4 * Math.min(b1 - t1, b2 - t2)) return false;
  }
  return true;
}

/**
 * Reading order by recursive XY-cut with full-width separators.
 *
 * Items spanning most of the region's width (titles, full-width paragraphs)
 * divide it into bands, so a title above two columns does not make the
 * columns interleave. Inside a band, a column split wins when the columns
 * are tall and side by side; otherwise the band is split into rows.
 */
export function orderItems(items: Item[], lineHeight: number, pageWidth: number, depth = 0): Item[] {
  if (items.length <= 1 || depth > 40) return items;
  const recurse = (group: Item[]) => orderItems(group, lineHeight, pageWidth, depth + 1);
  const left = Math.min(...items.map((i) => i.box.left));
  const right = Math.max(...items.map((i) => i.box.right));
  const regionW = Math.max(1, right - left);
  const [top, bottom] = rangeY(items);
  const regionH = Math.max(1, bottom - top);

  const isWide = (i: Item) => i.box.right - i.box.left >= regionW * 0.6;
  const wide = items.filter(isWide).sort((a, b) => a.box.top - b.box.top);
  if (wide.length > 0 && wide.length < items.length) {
    const centre = (i: Item) => (i.box.top + i.box.bottom) / 2;
    const bands: Item[][] = wide.map(() => []);
    bands.push([]);
    for (const it of items) {
      if (isWide(it)) continue;
      const band = wide.filter((w) => centre(w) < centre(it)).length;
      bands[band].push(it);
    }
    const out: Item[] = [];
    bands.forEach((band, i) => {
      out.push(...recurse(band));
      if (i < wide.length) out.push(wide[i]);
    });
    return out;
  }

  const cols = splitAxis(items, 'x', Math.max(pageWidth * 0.02, lineHeight * 0.9));
  if (cols && looksLikeColumns(cols, regionH)) return cols.flatMap(recurse);
  const rows = splitAxis(items, 'y', Math.max(2, lineHeight * 0.3));
  if (rows) return rows.flatMap(recurse);
  if (cols) return cols.flatMap(recurse);
  return [...items].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
}

function joinLines(texts: string[]): string {
  let out = '';
  for (const t of texts) {
    const s = t.trim();
    if (!s) continue;
    if (!out) out = s;
    else if (out.endsWith('-')) out += s; // keep the hyphen exactly as printed
    else out += ' ' + s;
  }
  return out;
}

function mostlyUpper(text: string): boolean {
  const letters = [...text].filter((c) => c.toLowerCase() !== c.toUpperCase());
  if (letters.length < 4) return false;
  return letters.filter((c) => c === c.toUpperCase()).length / letters.length >= 0.7;
}

function toWords(line: RawLine): DocWord[] {
  if (line.elements.length === 0) {
    return [{ text: line.text, box: line.box, confidence: line.confidence, uncertain: line.confidence != null && line.confidence < UNCERTAIN_BELOW }];
  }
  return line.elements.map((e) => ({
    text: e.text,
    box: e.box,
    confidence: e.confidence,
    uncertain: e.confidence != null && e.confidence < UNCERTAIN_BELOW,
  }));
}

/** Build the reading document from raw recognition output. */
export function buildDocument(raw: RawRecognition, engine: string): ReadingDocument {
  const blocks = raw.blocks
    .map((b) => ({ ...b, lines: b.lines.filter((l) => l.text.trim().length > 0) }))
    .filter((b) => b.lines.length > 0);

  const angle = dominantAngle(blocks);
  const cx = raw.width / 2;
  const cy = raw.height / 2;
  const upright = (b: Box | null) => (b ? rotateBox(b, -angle, cx, cy) : null);

  const lineHeights = blocks.flatMap((b) => b.lines.map((l) => upright(l.box))).filter((b): b is Box => b != null).map(height);
  const lineH = median(lineHeights) || 20;

  const items: Item[] = [];
  const unboxed: number[] = [];
  blocks.forEach((b, i) => {
    const box = upright(b.box ?? union(b.lines.map((l) => l.box)));
    if (box) items.push({ key: i, box });
    else unboxed.push(i);
  });
  const blockOrder = [...orderItems(items, lineH, raw.width).map((i) => i.key), ...unboxed];

  const lines: DocLine[] = [];
  const paragraphs: DocParagraph[] = [];
  let lineNo = 0;

  for (const bi of blockOrder) {
    const block = blocks[bi];
    const sortedLines = [...block.lines].sort((a, b) => {
      const ba = upright(a.box);
      const bb = upright(b.box);
      if (!ba || !bb) return 0;
      const sameRow = Math.abs((ba.top + ba.bottom) / 2 - (bb.top + bb.bottom) / 2) < Math.min(height(ba), height(bb)) * 0.5;
      return sameRow ? ba.left - bb.left : ba.top - bb.top;
    });

    let current: { lineIds: string[]; texts: string[]; heights: number[]; kind: ParagraphKind } | null = null;
    let prevBottom: number | null = null;
    const flush = () => {
      if (!current) return;
      const text = joinLines(current.texts);
      let kind = current.kind;
      if (kind === 'text' && current.lineIds.length <= 2 && text.length <= 80) {
        const tall = median(current.heights) >= lineH * 1.25;
        if (tall || mostlyUpper(text)) kind = 'heading';
      }
      paragraphs.push({ id: `P${paragraphs.length + 1}`, kind, lineIds: current.lineIds });
      current = null;
    };

    for (const l of sortedLines) {
      lineNo += 1;
      const id = `L${lineNo}`;
      const ub = upright(l.box);
      const startsItem = LIST_MARKER.test(l.text) || NUMBERED.test(l.text);
      const bigGap = ub != null && prevBottom != null && ub.top - prevBottom > lineH * 0.9;
      if (current && (startsItem || bigGap)) flush();
      if (!current) {
        current = { lineIds: [], texts: [], heights: [], kind: LIST_MARKER.test(l.text) ? 'list' : 'text' };
      }
      current.lineIds.push(id);
      current.texts.push(l.text);
      if (ub) current.heights.push(height(ub));
      prevBottom = ub ? ub.bottom : prevBottom;

      lines.push({ id, text: l.text.trim(), box: l.box, confidence: l.confidence, words: toWords(l) });
    }
    flush();
  }

  const words = lines.flatMap((l) => l.words);
  const confidences = words.map((w) => w.confidence).filter((c): c is number => c != null);
  const languages = blocks.flatMap((b) => b.lines.map((l) => l.language)).filter((l): l is string => !!l && l !== 'und');
  const counts = new Map<string, number>();
  for (const l of languages) counts.set(l, (counts.get(l) ?? 0) + 1);
  const language = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    version: 1,
    width: raw.width,
    height: raw.height,
    engine,
    language,
    quality: raw.quality ?? null,
    lines,
    paragraphs,
    stats: {
      lineCount: lines.length,
      wordCount: words.length,
      uncertainCount: words.filter((w) => w.uncertain).length,
      meanConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
    },
  };
}

/** Index lines by ID. */
export function lineMap(doc: ReadingDocument): Map<string, DocLine> {
  return new Map(doc.lines.map((l) => [l.id, l]));
}

/** The reflowed text of one paragraph. */
export function paragraphText(doc: ReadingDocument, p: DocParagraph, lines = lineMap(doc)): string {
  return joinLines(p.lineIds.map((id) => lines.get(id)?.text ?? ''));
}

/** Whole document as plain text, paragraphs separated by blank lines. */
export function documentText(doc: ReadingDocument): string {
  const lines = lineMap(doc);
  return doc.paragraphs.map((p) => paragraphText(doc, p, lines)).join('\n\n');
}

/** Find the paragraph that contains a line. */
export function paragraphIndexOfLine(doc: ReadingDocument, lineId: string): number {
  return doc.paragraphs.findIndex((p) => p.lineIds.includes(lineId));
}

/** A short title from the first meaningful line. */
export function suggestTitle(doc: ReadingDocument, fallback: string): string {
  const first = doc.lines.map((l) => l.text.trim()).find((t) => t.replace(/[^\p{L}\p{N}]/gu, '').length >= 3);
  if (!first) return fallback;
  return first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : first;
}
