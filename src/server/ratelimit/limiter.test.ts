import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";
import { createTestDb } from "@/test/db";
import { consumeRateLimit } from "./limiter";

describe("consumeRateLimit", () => {
  let db: Db;
  const t0 = new Date("2026-11-08T12:00:10.000Z");

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("uses MCP_RATE_LIMIT_PER_MINUTE by default and blocks after the limit", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await consumeRateLimit(db, "token:a", { now: t0 }));
    // src/test/setup.ts sets MCP_RATE_LIMIT_PER_MINUTE=5
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([4, 3, 2, 1, 0, 0]);
    expect(results[5]).toMatchObject({ limit: 5, count: 6, retryAfterSeconds: 50 });
    expect(results[5]!.resetAt.toISOString()).toBe("2026-11-08T12:01:00.000Z");
  });

  it("resets on the next window and isolates keys", async () => {
    await consumeRateLimit(db, "token:a", { limit: 1, now: t0 });
    expect((await consumeRateLimit(db, "token:a", { limit: 1, now: t0 })).allowed).toBe(false);
    expect((await consumeRateLimit(db, "token:b", { limit: 1, now: t0 })).allowed).toBe(true);
    const next = new Date("2026-11-08T12:01:00.000Z");
    const r = await consumeRateLimit(db, "token:a", { limit: 1, now: next });
    expect(r).toMatchObject({ allowed: true, count: 1, retryAfterSeconds: 60 });
  });

  it("counts concurrent requests atomically", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeRateLimit(db, "token:c", { limit: 3, now: t0 })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("deletes expired windows opportunistically", async () => {
    await consumeRateLimit(db, "token:a", { now: t0 });
    await consumeRateLimit(db, "token:b", { now: t0 });
    expect(await db.select().from(rateLimits)).toHaveLength(2);
    await consumeRateLimit(db, "token:a", { now: new Date("2026-11-08T12:05:00.000Z") });
    const rows = await db.select().from(rateLimits);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toMatch(/^token:a:/);
  });
});
