const locks = new Map<string, number>();
const TTL_MS = 12_000;

export function acquirePackageLock(userId: string, jobPostingId: string): boolean {
  const key = `${userId}:${jobPostingId}`;
  const existing = locks.get(key);
  if (existing && existing > Date.now()) return false;
  locks.set(key, Date.now() + TTL_MS);
  return true;
}

export function releasePackageLock(userId: string, jobPostingId: string): void {
  locks.delete(`${userId}:${jobPostingId}`);
}
