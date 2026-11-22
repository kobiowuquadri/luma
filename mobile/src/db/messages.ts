import type { SQLiteDatabase } from 'expo-sqlite';
import type { LanguageCode } from '@/profile/profile';
import { readingFileUri } from '@/lib/files';

export type MessageMode = 'question' | 'explain';

export interface Message {
  id: string;
  readingId: string;
  role: 'user' | 'assistant';
  mode: MessageMode;
  language: LanguageCode;
  text: string;
  answerFound: boolean | null;
  sourceLineIds: string[];
  focusLineIds: string[];
  audioUri: string | null;
  createdAt: number;
}

interface Row {
  id: string;
  reading_id: string;
  role: string;
  mode: string;
  language: string;
  text: string;
  answer_found: number | null;
  source_line_ids: string | null;
  focus_line_ids: string | null;
  audio_file: string | null;
  created_at: number;
}

function ids(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toMessage(r: Row): Message {
  return {
    id: r.id,
    readingId: r.reading_id,
    role: r.role === 'assistant' ? 'assistant' : 'user',
    mode: r.mode === 'explain' ? 'explain' : 'question',
    language: r.language as LanguageCode,
    text: r.text,
    answerFound: r.answer_found == null ? null : r.answer_found === 1,
    sourceLineIds: ids(r.source_line_ids),
    focusLineIds: ids(r.focus_line_ids),
    audioUri: r.audio_file ? readingFileUri(r.reading_id, r.audio_file) : null,
    createdAt: r.created_at,
  };
}

export async function listMessages(db: SQLiteDatabase, readingId: string): Promise<Message[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM messages WHERE reading_id = ? ORDER BY created_at ASC', readingId);
  return rows.map(toMessage);
}

export async function countMessages(db: SQLiteDatabase, readingId: string): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM messages WHERE reading_id = ?', readingId);
  return r?.n ?? 0;
}

export interface NewMessage {
  id: string;
  readingId: string;
  role: 'user' | 'assistant';
  mode: MessageMode;
  language: LanguageCode;
  text: string;
  answerFound?: boolean | null;
  sourceLineIds?: string[];
  focusLineIds?: string[];
  requestId?: string | null;
}

export async function insertMessage(db: SQLiteDatabase, m: NewMessage): Promise<void> {
  await db.runAsync(
    `INSERT INTO messages (id, reading_id, role, mode, language, text, answer_found, source_line_ids, focus_line_ids, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    m.id,
    m.readingId,
    m.role,
    m.mode,
    m.language,
    m.text,
    m.answerFound == null ? null : m.answerFound ? 1 : 0,
    JSON.stringify(m.sourceLineIds ?? []),
    JSON.stringify(m.focusLineIds ?? []),
    m.requestId ?? null,
    Date.now(),
  );
}

export async function setMessageAudio(db: SQLiteDatabase, id: string, audioFile: string): Promise<void> {
  await db.runAsync('UPDATE messages SET audio_file = ? WHERE id = ?', audioFile, id);
}

export interface Draft {
  text: string;
  mode: MessageMode;
  requestId: string | null;
}

export async function getDraft(db: SQLiteDatabase, readingId: string): Promise<Draft | null> {
  const r = await db.getFirstAsync<{ text: string; mode: string; request_id: string | null }>(
    'SELECT text, mode, request_id FROM drafts WHERE reading_id = ?',
    readingId,
  );
  return r ? { text: r.text, mode: r.mode === 'explain' ? 'explain' : 'question', requestId: r.request_id } : null;
}

/** Keep the student's unsent question, and the retry key that goes with it. */
export async function saveDraft(db: SQLiteDatabase, readingId: string, d: Draft): Promise<void> {
  if (!d.text.trim() && !d.requestId) {
    await db.runAsync('DELETE FROM drafts WHERE reading_id = ?', readingId);
    return;
  }
  await db.runAsync(
    `INSERT INTO drafts (reading_id, text, mode, request_id, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(reading_id) DO UPDATE SET text = excluded.text, mode = excluded.mode, request_id = excluded.request_id, updated_at = excluded.updated_at`,
    readingId,
    d.text,
    d.mode,
    d.requestId,
    Date.now(),
  );
}

export async function clearDraft(db: SQLiteDatabase, readingId: string): Promise<void> {
  await db.runAsync('DELETE FROM drafts WHERE reading_id = ?', readingId);
}

export async function getReadAloudAudio(db: SQLiteDatabase, readingId: string, paragraphId: string, language: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ audio_file: string }>(
    'SELECT audio_file FROM read_aloud_audio WHERE reading_id = ? AND paragraph_id = ? AND language = ?',
    readingId,
    paragraphId,
    language,
  );
  return r ? readingFileUri(readingId, r.audio_file) : null;
}

export async function saveReadAloudAudio(db: SQLiteDatabase, readingId: string, paragraphId: string, language: string, audioFile: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO read_aloud_audio (reading_id, paragraph_id, language, audio_file, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(reading_id, paragraph_id, language) DO UPDATE SET audio_file = excluded.audio_file`,
    readingId,
    paragraphId,
    language,
    audioFile,
    Date.now(),
  );
}
