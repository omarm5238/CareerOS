const tails = new Map<string, Promise<unknown>>();

export async function withSubmissionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(sessionId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(
    sessionId,
    previous.then(
      () => current,
      () => current,
    ),
  );
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}
