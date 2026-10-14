/** Cache an async result for the life of the (warm) instance. A rejection is not cached, so the next call retries. */
export function memoizeAsync<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;

  return () => {
    if (!cached) {
      const pending = load();
      cached = pending;
      pending.catch(() => {
        if (cached === pending) cached = null;
      });
    }
    return cached;
  };
}
