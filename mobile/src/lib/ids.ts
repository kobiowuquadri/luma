import { randomUUID } from 'expo-crypto';

export function newId(): string {
  return randomUUID();
}

/** Idempotency keys for paid requests: reused on retry, new per question. */
export function newRequestId(): string {
  return randomUUID();
}
