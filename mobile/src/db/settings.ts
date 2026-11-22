import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '@/lib/ids';

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

export async function getJSON<T>(db: SQLiteDatabase, key: string): Promise<T | null> {
  const v = await getSetting(db, key);
  if (v == null) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export async function setJSON(db: SQLiteDatabase, key: string, value: unknown): Promise<void> {
  await setSetting(db, key, JSON.stringify(value));
}

/**
 * A random ID for this installation. Sent only to the LUMA server so it can
 * apply per-phone limits; it is not linked to the student's identity.
 */
export async function getInstallId(db: SQLiteDatabase): Promise<string> {
  const existing = await getSetting(db, 'install_id');
  if (existing) return existing;
  const id = newId();
  await setSetting(db, 'install_id', id);
  return id;
}
