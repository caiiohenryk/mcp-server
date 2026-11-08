import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { deactivateAllowedUser } from "@/server/auth/allowlist";
import type { Db } from "@/server/db/client";
import { apiTokens, auditLog } from "@/server/db/schema";
import { createTestDb, seedUser } from "@/test/db";
import { parseToken } from "./format";
import { canReadTechnology } from "./scopes";
import {
  createToken,
  listTokens,
  MAX_ACTIVE_TOKENS_PER_USER,
  revokeToken,
  TokenError,
  verifyToken,
} from "./service";

describe("token service", () => {
  let db: Db;
  let userId: string;
  const email = "dev@example.com";

  beforeEach(async () => {
    db = await createTestDb();
    userId = await seedUser(db, email);
  });

  it("creates a well-formed token, stores only the hash and audits", async () => {
    const { token, summary } = await createToken(
      db,
      { userId, email },
      {
        name: "cursor",
        scopes: ["standards:read:*"],
      },
    );
    expect(parseToken(token)).not.toBeNull();
    expect(summary.status).toBe("active");
    const [row] = await db.select().from(apiTokens).where(eq(apiTokens.id, summary.id));
    expect(row!.hash).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(token.split("_")[2]);
    const logs = await db.select().from(auditLog);
    expect(logs.map((l) => l.action)).toContain("token.created");
    expect(JSON.stringify(logs)).not.toContain(token);
  });

  it("verifies a valid token and returns its scopes", async () => {
    const { token } = await createToken(
      db,
      { userId, email },
      {
        name: "a",
        scopes: ["standards:read:nextjs"],
      },
    );
    const res = await verifyToken(db, token);
    expect(res).toMatchObject({ ok: true, userId, email, scopes: ["standards:read:nextjs"] });
  });

  it("rejects malformed, unknown, tampered, revoked and expired tokens", async () => {
    const { token, summary } = await createToken(
      db,
      { userId, email },
      {
        name: "a",
        scopes: ["standards:read:*"],
      },
    );
    expect(await verifyToken(db, "nope")).toEqual({ ok: false, reason: "malformed" });
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(await verifyToken(db, tampered)).toEqual({ ok: false, reason: "unknown" });

    await revokeToken(db, { userId, email }, summary.id);
    expect(await verifyToken(db, token)).toEqual({ ok: false, reason: "revoked" });

    const second = await createToken(
      db,
      { userId, email },
      { name: "b", scopes: ["standards:read:*"] },
    );
    await db
      .update(apiTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apiTokens.id, second.summary.id));
    expect(await verifyToken(db, second.token)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects tokens of users removed from the allowlist and revokes them", async () => {
    const { token } = await createToken(
      db,
      { userId, email },
      { name: "a", scopes: ["standards:read:*"] },
    );
    const adminId = await seedUser(db, "admin@example.com", "admin");
    await deactivateAllowedUser(db, { userId: adminId, email: "admin@example.com" }, email);
    const res = await verifyToken(db, token);
    expect(res.ok).toBe(false);
    expect((await listTokens(db, userId))[0]!.status).toBe("revoked");
  });

  it("enforces the active token limit", async () => {
    for (let i = 0; i < MAX_ACTIVE_TOKENS_PER_USER; i++) {
      await createToken(db, { userId, email }, { name: `t${i}`, scopes: ["standards:read:*"] });
    }
    await expect(
      createToken(db, { userId, email }, { name: "over", scopes: ["standards:read:*"] }),
    ).rejects.toBeInstanceOf(TokenError);
  });

  it("validates input (scopes, expiration)", async () => {
    await expect(
      createToken(db, { userId, email }, { name: "x", scopes: ["admin:*"] }),
    ).rejects.toBeInstanceOf(TokenError);
    await expect(
      createToken(
        db,
        { userId, email },
        { name: "x", scopes: ["standards:read:*"], expiresInDays: 9999 },
      ),
    ).rejects.toBeInstanceOf(TokenError);
  });

  it("does not let a user revoke another user's token", async () => {
    const { summary } = await createToken(
      db,
      { userId, email },
      { name: "a", scopes: ["standards:read:*"] },
    );
    const otherId = await seedUser(db, "other@example.com");
    await expect(
      revokeToken(db, { userId: otherId, email: "other@example.com" }, summary.id),
    ).rejects.toBeInstanceOf(TokenError);
  });
});

describe("scopes", () => {
  it("grants shared to everyone and checks per-technology scopes", () => {
    expect(canReadTechnology([], "shared")).toBe(true);
    expect(canReadTechnology(["standards:read:*"], "terraform")).toBe(true);
    expect(canReadTechnology(["standards:read:nextjs"], "nextjs")).toBe(true);
    expect(canReadTechnology(["standards:read:nextjs"], "nestjs")).toBe(false);
  });
});
