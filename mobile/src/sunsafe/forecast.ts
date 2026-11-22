import type { SQLiteDatabase } from 'expo-sqlite';
import type { City } from './cities';

/**
 * UV forecast from Open-Meteo (https://open-meteo.com), requested directly
 * with the chosen city's coordinates; no key and no personal data.
 * The last forecast is cached so it can be shown offline, marked as stale.
 */
export interface UvForecast {
  cityId: string;
  date: string; // YYYY-MM-DD in Africa/Lagos
  maxUv: number;
  /** First and last hour today with UV >= 6, e.g. ["10:00", "15:00"]. */
  highHours: [string, string] | null;
  fetchedAt: number;
  source: 'Open-Meteo';
}

export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

interface OpenMeteo {
  daily?: { time?: string[]; uv_index_max?: (number | null)[] };
  hourly?: { time?: string[]; uv_index?: (number | null)[] };
}

export function lagosDate(ts: number): string {
  // Nigeria is UTC+1 all year (no daylight saving).
  return new Date(ts + 3600 * 1000).toISOString().slice(0, 10);
}

export function parseForecast(cityId: string, json: OpenMeteo, fetchedAt: number): UvForecast | null {
  const date = json.daily?.time?.[0];
  const max = json.daily?.uv_index_max?.[0];
  if (!date || typeof max !== 'number') return null;
  const hours = (json.hourly?.time ?? [])
    .map((time, i) => ({ time, uv: json.hourly?.uv_index?.[i] }))
    .filter((h) => h.time.startsWith(date) && typeof h.uv === 'number' && h.uv >= 6);
  return {
    cityId,
    date,
    maxUv: Math.round(max * 10) / 10,
    highHours: hours.length ? [hours[0].time.slice(11, 16), hours[hours.length - 1].time.slice(11, 16)] : null,
    fetchedAt,
    source: 'Open-Meteo',
  };
}

export async function fetchForecast(city: City): Promise<UvForecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    '&daily=uv_index_max&hourly=uv_index&timezone=Africa%2FLagos&forecast_days=1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Forecast service returned ${res.status}`);
    const f = parseForecast(city.id, (await res.json()) as OpenMeteo, Date.now());
    if (!f) throw new Error('The forecast had no UV data.');
    return f;
  } finally {
    clearTimeout(timer);
  }
}

export async function cachedForecast(db: SQLiteDatabase, cityId: string): Promise<UvForecast | null> {
  const r = await db.getFirstAsync<{ json: string }>('SELECT json FROM uv_cache WHERE city_id = ?', cityId);
  if (!r) return null;
  try {
    return JSON.parse(r.json) as UvForecast;
  } catch {
    return null;
  }
}

export async function cacheForecast(db: SQLiteDatabase, f: UvForecast): Promise<void> {
  await db.runAsync(
    'INSERT INTO uv_cache (city_id, json, fetched_at) VALUES (?, ?, ?) ON CONFLICT(city_id) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at',
    f.cityId,
    JSON.stringify(f),
    f.fetchedAt,
  );
}

/** A forecast is stale when it is for an earlier day or older than 6 hours. */
export function isStale(f: UvForecast, now = Date.now()): boolean {
  return f.date !== lagosDate(now) || now - f.fetchedAt > STALE_AFTER_MS;
}
