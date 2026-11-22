import * as ImagePicker from 'expo-image-picker';
import type { SQLiteDatabase } from 'expo-sqlite';
import { isOcrAvailable, ocrEngine, recognizeImage } from '../../modules/luma-ocr';
import { insertReading } from '@/db/readings';
import { deleteCacheFile, deleteReadingFiles, readingFile } from '@/lib/files';
import { formatWhen } from '@/lib/format';
import { newId } from '@/lib/ids';
import { adviseCapture, type CaptureAdvice, type CaptureKind } from './advice';
import { buildDocument, documentText, suggestTitle, type DocStats } from './layout';

export type PickSource = 'camera' | 'library';

export type PickOutcome =
  | { kind: 'picked'; uri: string }
  | { kind: 'cancelled' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'error'; message: string };

/** Photograph a page or board, or choose an existing image. */
export async function pickImage(source: PickSource): Promise<PickOutcome> {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { kind: 'denied', canAskAgain: perm.canAskAgain };
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.92, exif: false, allowsEditing: false });
      if (r.canceled || !r.assets?.[0]) return { kind: 'cancelled' };
      return { kind: 'picked', uri: r.assets[0].uri };
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1, exif: false, allowsEditing: false });
    if (r.canceled || !r.assets?.[0]) return { kind: 'cancelled' };
    return { kind: 'picked', uri: r.assets[0].uri };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'The camera or gallery could not be opened.' };
  }
}

/**
 * Android can stop LUMA while the camera app is open. The picker keeps the
 * photo; this recovers it when LUMA starts again.
 */
export async function recoverPendingPhoto(): Promise<string | null> {
  try {
    const r = await ImagePicker.getPendingResultAsync();
    if (r && 'assets' in r && !r.canceled && r.assets?.[0]) return r.assets[0].uri;
  } catch {
    // Nothing pending.
  }
  return null;
}

export interface ScanResult {
  readingId: string | null;
  advice: CaptureAdvice | null;
  stats: DocStats;
  durationMs: number;
}

export class OcrUnavailableError extends Error {
  constructor() {
    super('Scanning needs the LUMA Android app (APK or development build). It is not available in Expo Go.');
  }
}

/**
 * Recognise text in an image on the phone and save it as a reading.
 * Nothing leaves the device. Empty results are not saved.
 */
export async function processImage(db: SQLiteDatabase, sourceUri: string, kind: CaptureKind, keepSource = false): Promise<ScanResult> {
  if (!isOcrAvailable) throw new OcrUnavailableError();
  const id = newId();
  const target = readingFile(id, 'source.jpg');
  try {
    const raw = await recognizeImage(sourceUri, target.uri, kind === 'board' ? 3600 : 3000);
    const doc = buildDocument(raw, ocrEngine);
    const advice = adviseCapture(raw.quality, doc.stats, kind);
    if (doc.stats.wordCount === 0) {
      deleteReadingFiles(id);
      return { readingId: null, advice, stats: doc.stats, durationMs: raw.durationMs };
    }
    const fallback = `${kind === 'board' ? 'Board' : 'Page'}, ${formatWhen(Date.now())}`;
    await insertReading(db, {
      id,
      title: suggestTitle(doc, fallback),
      kind,
      imageFile: 'source.jpg',
      imageWidth: raw.width,
      imageHeight: raw.height,
      doc,
      plainText: documentText(doc),
    });
    return { readingId: id, advice, stats: doc.stats, durationMs: raw.durationMs };
  } catch (e) {
    deleteReadingFiles(id);
    throw e;
  } finally {
    // Keep classroom photos only in LUMA's private folder.
    if (!keepSource) deleteCacheFile(sourceUri);
  }
}
