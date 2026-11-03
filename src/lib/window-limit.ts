// A small per-process request limiter for public read-only endpoints that fans' browsers poll.
// It is a backstop, not the main protection: the response is cached at the edge for a few
// seconds, so repeated polls usually never reach the function at all. It lives in memory, so each
// server instance counts for itself and a restart forgets; that is fine for a read that costs one
// query. (The hourly limiter in rate-limit.ts writes a row per call, which a poll must not do.)

export function createWindowLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const windows = new Map<string, { start: number; count: number }>();
  return function allow(key: string, now = Date.now()): boolean {
    const w = windows.get(key);
    if (!w || now - w.start >= windowMs) {
      if (windows.size >= maxKeys) {
        // Forget finished windows first; if the table is still full, forget the oldest key.
        for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
        if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string);
      }
      windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (w.count >= limit) return false;
    w.count += 1;
    return true;
  };
}
