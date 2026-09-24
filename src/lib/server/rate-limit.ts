import "server-only";

// In-memory sliding window. Per server instance only: it blunts abuse but is not a global limit.
// For multi-instance production, back this with a shared store (e.g. Upstash Redis).
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000)
    for (const [k, v] of hits)
      if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
