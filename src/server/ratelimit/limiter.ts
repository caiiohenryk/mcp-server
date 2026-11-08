import "server-only";
import { lt, sql } from "drizzle-orm";
import { env } from "@/env";
import type { Db } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Requests left in the current window (never negative). */
  remaining: number;
  /** Request count in the current window, including this one. */
  count: number;
  /** When the current window ends. */
  resetAt: Date;
  /** Seconds until the window resets (>= 1), suitable for `Retry-After`. */
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Max requests per window. Default: `MCP_RATE_LIMIT_PER_MINUTE`. */
  limit?: number;
  /** Window length. Default: 60s. */
  windowMs?: number;
  now?: Date;
}

/**
 * Fixed-window rate limiter backed by the `rate_limits` table.
 *
 * Each (key, window) pair is one row, incremented atomically with an upsert,
 * so it is safe across concurrent serverless instances. The first request of
 * every window also deletes expired rows (cheap, bounded garbage collection).
 */
export async function consumeRateLimit(
  db: Db,
  key: string,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const limit = options.limit ?? env().MCP_RATE_LIMIT_PER_MINUTE;
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? new Date();

  const windowIndex = Math.floor(now.getTime() / windowMs);
  const resetAt = new Date((windowIndex + 1) * windowMs);
  const rowKey = `${key}:${windowIndex}`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key: rowKey, count: 1, expiresAt: resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  const count = row!.count;

  if (count === 1) {
    await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now));
  }

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    count,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}
