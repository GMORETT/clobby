/**
 * Sliding-window rate limiter, in-memory per process.
 *
 * MVP-grade: resets on cold start and doesn't sync across serverless instances.
 * Good enough for abuse prevention until we move to Redis/KV.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup so idle keys don't accumulate
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number, maxWindowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - maxWindowMs;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export interface RateLimitRule {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  rule?: RateLimitRule;
}

/**
 * Check multiple sliding-window rules against a key.
 * Returns the first violated rule, or `allowed: true` if none.
 */
export function checkRateLimit(key: string, rules: RateLimitRule[]): RateLimitResult {
  const now = Date.now();
  const maxWindow = Math.max(...rules.map((r) => r.windowMs));
  cleanup(now, maxWindow);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Trim out-of-window entries (of the largest window)
  bucket.timestamps = bucket.timestamps.filter((t) => t > now - maxWindow);

  for (const rule of rules) {
    const cutoff = now - rule.windowMs;
    const hits = bucket.timestamps.filter((t) => t > cutoff).length;
    if (hits >= rule.max) {
      const oldest = bucket.timestamps.find((t) => t > cutoff) ?? now;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, oldest + rule.windowMs - now),
        rule,
      };
    }
  }

  // Passed all checks — record this hit
  bucket.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}
