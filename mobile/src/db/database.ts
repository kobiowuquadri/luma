import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'luma.db';
const VERSION = 1;

/**
 * Schema migrations, run once at startup by <SQLiteProvider onInit>.
 * Media lives in app-private files under Paths.document/readings/<id>/;
 * the database stores paths relative to that folder.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS readings (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'page',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        opened_at INTEGER NOT NULL,
        image_file TEXT,
        image_width INTEGER,
        image_height INTEGER,
        document_json TEXT NOT NULL,
        plain_text TEXT NOT NULL,
        line_count INTEGER NOT NULL DEFAULT 0,
        uncertain_count INTEGER NOT NULL DEFAULT 0,
        position_paragraph INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS readings_opened ON readings (opened_at DESC);
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        reading_id TEXT NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        mode TEXT NOT NULL,
        language TEXT NOT NULL,
        text TEXT NOT NULL,
        answer_found INTEGER,
        source_line_ids TEXT,
        focus_line_ids TEXT,
        audio_file TEXT,
        request_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_reading ON messages (reading_id, created_at);
      CREATE TABLE IF NOT EXISTS drafts (
        reading_id TEXT PRIMARY KEY NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'question',
        request_id TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS read_aloud_audio (
        reading_id TEXT NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
        paragraph_id TEXT NOT NULL,
        language TEXT NOT NULL,
        audio_file TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (reading_id, paragraph_id, language)
      );
      CREATE TABLE IF NOT EXISTS uv_cache (
        city_id TEXT PRIMARY KEY NOT NULL,
        json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      );
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${VERSION}`);
}
