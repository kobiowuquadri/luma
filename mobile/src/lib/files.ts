import { Directory, File, Paths } from 'expo-file-system';

/**
 * All saved media lives in the app's private documents folder:
 *   readings/<id>/source.jpg            the upright photo (no EXIF metadata)
 *   readings/<id>/audio/<message>.mp3   spoken answers
 *   readings/<id>/read-aloud/<p>.mp3    online read-aloud audio
 * Deleting a reading deletes its folder.
 */
export function readingDir(id: string): Directory {
  return new Directory(Paths.document, 'readings', id);
}

export function ensureDir(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function readingFile(id: string, relative: string): File {
  const parts = relative.split('/');
  const name = parts.pop() ?? relative;
  const dir = ensureDir(new Directory(readingDir(id), ...parts));
  return new File(dir, name);
}

export function readingFileUri(id: string, relative: string): string {
  return new File(readingDir(id), ...relative.split('/')).uri;
}

export function deleteReadingFiles(id: string): void {
  const dir = readingDir(id);
  try {
    if (dir.exists) dir.delete();
  } catch {
    // Nothing else to do; the database row is already gone.
  }
}

/** Delete a temporary file (camera capture, recording) if it is in the cache. */
export function deleteCacheFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    if (!uri.startsWith(Paths.cache.uri)) return;
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Cache files are cleaned up by the system eventually.
  }
}

export function fileExists(uri: string | null): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
