import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { createTestDb } from "@/test/db";
import { listAuditActions, queryAuditLog } from "./query";

describe("audit query", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    const base = Date.UTC(2026, 10, 1);
    // 7 token.created (oldest first) + 3 auth.sign_in, each one minute apart.
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => ({ action: "token.created", n: i })),
      ...Array.from({ length: 3 }, (_, i) => ({ action: "auth.sign_in", n: 7 + i })),
    ].map(({ action, n }) => ({
      action,
      actorEmail: `user${n}@example.com`,
      metadata: { n },
      createdAt: new Date(base + n * 60_000),
    }));
    await db.insert(auditLog).values(rows);
  });

  it("returns newest entries first with totals", async () => {
    const page = await queryAuditLog(db, { pageSize: 4 });
    expect(page.total).toBe(10);
    expect(page.totalPages).toBe(3);
    expect(page.entries.map((e) => e.metadata.n)).toEqual([9, 8, 7, 6]);
  });

  it("paginates with offset", async () => {
    const page = await queryAuditLog(db, { pageSize: 4, page: 3 });
    expect(page.page).toBe(3);
    expect(page.entries.map((e) => e.metadata.n)).toEqual([1, 0]);
  });

  it("filters by action", async () => {
    const page = await queryAuditLog(db, { action: "auth.sign_in" });
    expect(page.total).toBe(3);
    expect(page.entries.every((e) => e.action === "auth.sign_in")).toBe(true);
    expect(page.action).toBe("auth.sign_in");
  });

  it("treats an empty action as no filter", async () => {
    const page = await queryAuditLog(db, { action: "" });
    expect(page.total).toBe(10);
    expect(page.action).toBeUndefined();
  });

  it("clamps out-of-range and invalid pages instead of throwing", async () => {
    expect((await queryAuditLog(db, { pageSize: 4, page: 99 })).page).toBe(3);
    expect((await queryAuditLog(db, { page: "abc" as unknown as number })).page).toBe(1);
  });

  it("falls back to no filter for a malformed action", async () => {
    const page = await queryAuditLog(db, { action: "drop table;" });
    expect(page.total).toBe(10);
  });

  it("returns an empty first page for an empty log", async () => {
    const empty = await createTestDb();
    const page = await queryAuditLog(empty);
    expect(page).toMatchObject({ entries: [], total: 0, totalPages: 1, page: 1 });
  });

  it("lists distinct actions alphabetically", async () => {
    expect(await listAuditActions(db)).toEqual(["auth.sign_in", "token.created"]);
  });
});
