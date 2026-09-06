/**
 * Process-local protection against accidental double Generate clicks.
 * Appropriate for CareerOS's local single-user architecture. Not a
 * distributed lock.
 */

type LockEntry = {
  draftId: string;
  expiresAt: number;
};

const LOCK_TTL_MS = 8_000;
const locks = new Map<string, LockEntry>();

function keyFor(userId: string, fingerprint: string): string {
  return `${userId}:${fingerprint}`;
}

export function peekGenerationLock(userId: string, fingerprint: string): string | null {
  const key = keyFor(userId, fingerprint);
  const existing = locks.get(key);
  if (!existing) return null;
  if (existing.expiresAt < Date.now()) {
    locks.delete(key);
    return null;
  }
  return existing.draftId;
}

export function setGenerationLock(userId: string, fingerprint: string, draftId: string): void {
  locks.set(keyFor(userId, fingerprint), {
    draftId,
    expiresAt: Date.now() + LOCK_TTL_MS,
  });
}

export function tryAcquireGenerationSlot(userId: string, fingerprint: string): boolean {
  return peekGenerationLock(userId, fingerprint) === null;
}
