import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db/client";
import { allowedUsers, apiTokens, users } from "@/server/db/schema";
import { generateToken, hashesMatch, hashToken, maskToken, parseToken } from "./format";
import { scopeSchema } from "./scopes";

export const MAX_ACTIVE_TOKENS_PER_USER = 10;
export const DEFAULT_EXPIRATION_DAYS = 90;
export const MAX_EXPIRATION_DAYS = 365;
const LAST_USED_THROTTLE_MS = 60_000;

export const createTokenInput = z.object({
  name: z.string().trim().min(1).max(64),
  scopes: z.array(scopeSchema).min(1).max(32),
  expiresInDays: z.number().int().min(1).max(MAX_EXPIRATION_DAYS).default(DEFAULT_EXPIRATION_DAYS),
});
export type CreateTokenInput = z.input<typeof createTokenInput>;

export class TokenError extends Error {
  constructor(
    public readonly code: "limit_reached" | "not_found" | "invalid_input",
    message: string,
  ) {
    super(message);
  }
}

export interface TokenSummary {
  id: string;
  name: string;
  masked: string;
  scopes: string[];
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  status: "active" | "expired" | "revoked";
}

function toSummary(t: typeof apiTokens.$inferSelect, now = new Date()): TokenSummary {
  return {
    id: t.id,
    name: t.name,
    masked: maskToken(t.prefix),
    scopes: t.scopes,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    lastUsedAt: t.lastUsedAt,
    revokedAt: t.revokedAt,
    status: t.revokedAt ? "revoked" : t.expiresAt <= now ? "expired" : "active",
  };
}

/**
 * Creates a token. Returns the plaintext ONCE — it must be shown to the user
 * immediately and is never retrievable again.
 */
export async function createToken(
  db: Db,
  actor: { userId: string; email: string },
  rawInput: CreateTokenInput,
): Promise<{ token: string; summary: TokenSummary }> {
  const parsed = createTokenInput.safeParse(rawInput);
  if (!parsed.success) throw new TokenError("invalid_input", parsed.error.issues[0]!.message);
  const input = parsed.data;

  const now = new Date();
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.userId, actor.userId),
        isNull(apiTokens.revokedAt),
        gt(apiTokens.expiresAt, now),
      ),
    );
  if (count >= MAX_ACTIVE_TOKENS_PER_USER) {
    throw new TokenError(
      "limit_reached",
      `Limite de ${MAX_ACTIVE_TOKENS_PER_USER} tokens ativos atingido. Revogue um token antes de criar outro.`,
    );
  }

  const { token, prefix } = generateToken();
  const expiresAt = new Date(now.getTime() + input.expiresInDays * 86_400_000);
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: actor.userId,
      name: input.name,
      prefix,
      hash: hashToken(token, env().TOKEN_PEPPER),
      scopes: [...new Set(input.scopes)],
      expiresAt,
    })
    .returning();

  await audit(db, {
    action: "token.created",
    actorUserId: actor.userId,
    actorEmail: actor.email,
    tokenId: row!.id,
    metadata: { name: input.name, scopes: row!.scopes, expiresAt: expiresAt.toISOString() },
  });

  return { token, summary: toSummary(row!, now) };
}

export async function listTokens(db: Db, userId: string): Promise<TokenSummary[]> {
  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
  const now = new Date();
  return rows.map((r) => toSummary(r, now));
}

export async function revokeToken(
  db: Db,
  actor: { userId: string; email: string },
  tokenId: string,
): Promise<void> {
  const [row] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.id, tokenId),
        eq(apiTokens.userId, actor.userId),
        isNull(apiTokens.revokedAt),
      ),
    )
    .returning({ id: apiTokens.id });
  if (!row) throw new TokenError("not_found", "Token não encontrado ou já revogado.");
  await audit(db, {
    action: "token.revoked",
    actorUserId: actor.userId,
    actorEmail: actor.email,
    tokenId,
  });
}

/** Used when a user is removed/deactivated from the allowlist. */
export async function revokeAllTokensForUser(db: Db, userId: string): Promise<number> {
  const rows = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  return rows.length;
}

export type VerifiedToken = {
  ok: true;
  tokenId: string;
  userId: string;
  email: string;
  scopes: string[];
};
export type VerifyFailure = {
  ok: false;
  reason: "malformed" | "unknown" | "revoked" | "expired" | "user_not_allowed";
};

/**
 * Verifies a bearer token presented to the MCP endpoint.
 * Checks format, hash (constant time), revocation, expiration and that the
 * owner is still on the allowlist.
 */
export async function verifyToken(
  db: Db,
  rawToken: string,
): Promise<VerifiedToken | VerifyFailure> {
  const parsed = parseToken(rawToken);
  if (!parsed) return { ok: false, reason: "malformed" };

  const [row] = await db
    .select({
      token: apiTokens,
      email: users.email,
      allowed: allowedUsers.active,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .leftJoin(allowedUsers, eq(allowedUsers.email, users.email))
    .where(eq(apiTokens.prefix, parsed.prefix))
    .limit(1);

  const expectedHash = hashToken(rawToken.trim(), env().TOKEN_PEPPER);
  if (!row || !hashesMatch(row.token.hash, expectedHash)) return { ok: false, reason: "unknown" };
  if (row.token.revokedAt) return { ok: false, reason: "revoked" };
  const now = new Date();
  if (row.token.expiresAt <= now) return { ok: false, reason: "expired" };
  if (!row.allowed || !row.email) return { ok: false, reason: "user_not_allowed" };

  if (
    !row.token.lastUsedAt ||
    now.getTime() - row.token.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS
  ) {
    await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.token.id));
  }

  return {
    ok: true,
    tokenId: row.token.id,
    userId: row.token.userId,
    email: row.email,
    scopes: row.token.scopes,
  };
}
