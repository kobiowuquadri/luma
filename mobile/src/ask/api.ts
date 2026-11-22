import { File } from 'expo-file-system';
import type { LanguageCode } from '@/profile/profile';

/**
 * Client for the LUMA Go API. Provider keys live only on the server.
 * Every paid request carries an Idempotency-Key that the app reuses when
 * the student retries, so a dropped connection never pays twice.
 */
export const API_URL = (process.env.EXPO_PUBLIC_LUMA_API_URL ?? '').trim().replace(/\/+$/, '');
const CLIENT_TOKEN = (process.env.EXPO_PUBLIC_LUMA_CLIENT_TOKEN ?? '').trim();

export const onlineConfigured = API_URL.length > 0;

export type ApiErrorCode =
  | 'app_not_configured'
  | 'network'
  | 'timeout'
  | 'bad_response'
  | 'invalid_request'
  | 'payload_too_large'
  | 'unsupported_media'
  | 'unauthorized'
  | 'not_configured'
  | 'language_unavailable'
  | 'rate_limited'
  | 'daily_limit_reached'
  | 'idempotency_conflict'
  | 'credits_exhausted'
  | 'provider_busy'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_misconfigured'
  | 'provider_rejected'
  | 'internal';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, retryable: boolean, status = 0) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

let installId = '';
export function setInstallId(id: string): void {
  installId = id;
}

async function call(path: string, init: RequestInit & { timeoutMs: number; idempotencyKey?: string }): Promise<Response> {
  if (!onlineConfigured) {
    throw new ApiError('app_not_configured', 'Online features are not set up in this version of the app. Reading and saving still work.', false);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  const headers = new Headers(init.headers);
  if (installId) headers.set('X-Luma-Install', installId);
  if (CLIENT_TOKEN) headers.set('X-Luma-Client', CLIENT_TOKEN);
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey);
  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...init, headers, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ApiError('timeout', 'LUMA took too long to respond. Your question is kept. Try again.', true);
    }
    throw new ApiError('network', "Can't reach LUMA. Check your internet connection, then try again. Reading still works offline.", true);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let code: ApiErrorCode = 'internal';
    let message = 'Something went wrong on the LUMA server. Try again.';
    let retryable = res.status >= 500 || res.status === 429;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string; retryable?: boolean } };
      if (body.error?.code) code = body.error.code as ApiErrorCode;
      if (body.error?.message) message = body.error.message;
      if (typeof body.error?.retryable === 'boolean') retryable = body.error.retryable;
    } catch {
      code = 'bad_response';
    }
    throw new ApiError(code, message, retryable, res.status);
  }
  return res;
}

export interface FeatureCap {
  available: boolean;
  reason?: string;
}

export interface LanguageCaps {
  code: LanguageCode;
  name: string;
  nativeName: string;
  answers: FeatureCap;
  transcription: FeatureCap & { listed: boolean | null };
  speech: FeatureCap;
}

export interface ServerCapabilities {
  version: string;
  /** "preview-fixtures" when the server answers with labelled test fixtures. */
  mode?: "live" | "preview-fixtures";
  features: { answers: FeatureCap; transcription: FeatureCap; speech: FeatureCap };
  languages: LanguageCaps[];
  limits: {
    maxQuestionChars: number;
    maxLineChars: number;
    maxLines: number;
    maxDocumentChars: number;
    maxHistoryTurns: number;
    maxAnswerWords: number;
    maxSpeechChars: number;
    maxAudioBytes: number;
    maxRecordingSeconds: number;
  };
}

export async function fetchCapabilities(): Promise<ServerCapabilities> {
  const res = await call('/v1/capabilities', { method: 'GET', timeoutMs: 20000 });
  try {
    return (await res.json()) as ServerCapabilities;
  } catch {
    throw new ApiError('bad_response', 'LUMA sent an unexpected reply. Try again later.', true);
  }
}

export interface AskRequest {
  mode: 'question' | 'explain';
  language: LanguageCode;
  question: string;
  lines: { id: string; text: string }[];
  focusLineIds?: string[];
  history: { role: 'user' | 'assistant'; text: string }[];
}

export interface AskResult {
  mode: 'question' | 'explain';
  language: LanguageCode;
  answer: string;
  answerFound: boolean;
  sourceLineIds: string[];
  droppedSourceIds: number;
}

export async function ask(req: AskRequest, idempotencyKey: string): Promise<AskResult> {
  const res = await call('/v1/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    timeoutMs: 75000,
    idempotencyKey,
  });
  try {
    return (await res.json()) as AskResult;
  } catch {
    throw new ApiError('bad_response', 'LUMA sent an unexpected reply. Try again.', true);
  }
}

export async function transcribe(recordingUri: string, language: LanguageCode, idempotencyKey: string): Promise<{ transcript: string; empty: boolean }> {
  const form = new FormData();
  // React Native's FormData accepts a file descriptor object.
  form.append('audio', { uri: recordingUri, name: 'question.m4a', type: 'audio/mp4' } as unknown as Blob);
  form.append('language', language);
  const res = await call('/v1/transcribe', { method: 'POST', body: form, timeoutMs: 100000, idempotencyKey });
  try {
    return (await res.json()) as { transcript: string; empty: boolean };
  } catch {
    throw new ApiError('bad_response', 'LUMA sent an unexpected reply. Try again.', true);
  }
}

/** Generate speech and save it to `destination` for offline replay. */
export async function synthesizeTo(text: string, language: LanguageCode, idempotencyKey: string, destination: File): Promise<File> {
  const res = await call('/v1/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
    timeoutMs: 100000,
    idempotencyKey,
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 64) throw new ApiError('bad_response', 'The spoken answer was empty. Try again.', true);
  if (destination.exists) destination.delete();
  destination.create({ intermediates: true });
  destination.write(bytes);
  return destination;
}

/** Plain-language reason a feature is unavailable. */
export function reasonText(reason: string | undefined, feature: string): string {
  switch (reason) {
    case 'not_configured':
      return `${feature} is not set up on the LUMA server yet.`;
    case 'daily_limit_reached':
      return `${feature} has reached today's limit. Try again tomorrow.`;
    case 'language_not_listed':
      return `${feature} is not offered for this language by the speech service yet.`;
    case 'no_voice_for_language':
      return `No approved voice for this language yet.`;
    default:
      return `${feature} is not available right now.`;
  }
}
