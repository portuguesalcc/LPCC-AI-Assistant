/**
 * Small in-memory rate limiter, keyed by client IP.
 *
 * It lives inside each server instance, so it is a first line of defence against
 * runaway costs, not a hard global limit. For a strict limit, add a rate-limit
 * rule in Vercel → Firewall as well.
 */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/** Records a hit and returns true if `key` has gone over `limit` hits within `windowMs`. */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  const limited = hits.length >= limit;
  if (!limited) hits.push(now);
  if (buckets.size >= MAX_KEYS && !buckets.has(key)) buckets.clear();
  buckets.set(key, hits);
  return limited;
}

/** True if `key` already has `limit` hits within `windowMs`, without recording a new one. */
export function hasReachedLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  return (buckets.get(key) ?? []).filter((t) => now - t < windowMs).length >= limit;
}
