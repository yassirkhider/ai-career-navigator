/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * PRODUCTION NOTE: this is process-local and resets on restart/won't work
 * across multiple server instances. It is sufficient for single-instance
 * deployments and local development. For horizontally-scaled production
 * deployments, replace this with a shared store (Redis / Upstash) behind
 * the same `checkRateLimit` function signature — no caller changes needed.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}
