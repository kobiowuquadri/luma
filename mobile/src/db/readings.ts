import type { SQLiteDatabase } from 'expo-sqlite';
import type { CaptureKind } from '@/ocr/advice';
import type { ReadingDocument } from '@/ocr/layout';
import { deleteReadingFiles, readingFileUri } from '@/lib/files';

export interface ReadingSummary {
  id: string;
  title: string;
  kind: CaptureKind;
  createdAt: number;
  openedAt: number;
  lineCount: number;
  uncertainCount: number;
  preview: string;
}

export interface Reading extends ReadingSummary {
  updatedAt: number;
  imageUri: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  doc: ReadingDocument;
  positionParagraph: number;
}

interface Row {
  id: string;
  title: string;
  kind: string;
  created_at: number;
  updated_at: number;
  opened_at: number;
  image_file: string | null;
  image_width: number | null;
  image_height: number | null;
  document_json: string;
  plain_text: string;
  line_count: number;
  uncertain_count: number;
  position_paragraph: number;
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 140 ? flat.slice(0, 137).trimEnd() + '…' : flat;
}

function toSummary(r: Pick<Row, 'id' | 'title' | 'kind' | 'created_at' | 'opened_at' | 'line_count' | 'uncertain_count' | 'plain_text'>): ReadingSummary {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind === 'board' ? 'board' : 'page',
    createdAt: r.created_at,
    openedAt: r.opened_at,
    lineCount: r.line_count,
    uncertainCount: r.uncertain_count,
    preview: preview(r.plain_text),
  };
}

export async function listReadings(db: SQLiteDatabase, limit = 200): Promise<ReadingSummary[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT id, title, kind, created_at, opened_at, line_count, uncertain_count, substr(plain_text, 1, 400) AS plain_text FROM readings ORDER BY opened_at DESC LIMIT ?',
    limit,
  );
  return rows.map(toSummary);
}

export async function getReading(db: SQLiteDatabase, id: string): Promise<Reading | null> {
  const r = await db.getFirstAsync<Row>('SELECT * FROM readings WHERE id = ?', id);
  if (!r) return null;
  return {
    ...toSummary(r),
    updatedAt: r.updated_at,
    imageUri: r.image_file ? readingFileUri(r.id, r.image_file) : null,
    imageWidth: r.image_width,
    imageHeight: r.image_height,
    doc: JSON.parse(r.document_json) as ReadingDocument,
    positionParagraph: r.position_paragraph,
  };
}

export interface NewReading {
  id: string;
  title: string;
  kind: CaptureKind;
  imageFile: string | null;
  imageWidth: number;
  imageHeight: number;
  doc: ReadingDocument;
  plainText: string;
}

export async function insertReading(db: SQLiteDatabase, r: NewReading): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO readings (id, title, kind, created_at, updated_at, opened_at, image_file, image_width, image_height,
       document_json, plain_text, line_count, uncertain_count, position_paragraph)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    r.id,
    r.title,
    r.kind,
    now,
    now,
    now,
    r.imageFile,
    r.imageWidth,
    r.imageHeight,
    JSON.stringify(r.doc),
    r.plainText,
    r.doc.stats.lineCount,
    r.doc.stats.uncertainCount,
  );
}

export async function renameReading(db: SQLiteDatabase, id: string, title: string): Promise<void> {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!clean) return;
  await db.runAsync('UPDATE readings SET title = ?, updated_at = ? WHERE id = ?', clean, Date.now(), id);
}

export async function markOpened(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE readings SET opened_at = ? WHERE id = ?', Date.now(), id);
}

export async function savePosition(db: SQLiteDatabase, id: string, paragraph: number): Promise<void> {
  await db.runAsync('UPDATE readings SET position_paragraph = ? WHERE id = ?', Math.max(0, Math.floor(paragraph)), id);
}

/** Delete a reading with its photo, saved answers and saved audio. */
export async function deleteReading(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM readings WHERE id = ?', id);
  deleteReadingFiles(id);
}
