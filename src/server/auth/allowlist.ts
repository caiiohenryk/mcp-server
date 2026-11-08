import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db/client";
import { allowedUsers, sessions, users, type AllowedUser } from "@/server/db/schema";
import { revokeAllTokensForUser } from "@/server/tokens/service";

export const emailSchema = z.string().trim().toLowerCase().email();
export type Role = "admin" | "member";

export class AllowlistError extends Error {
  constructor(
    public readonly code: "self_demotion" | "self_removal",
    message: string,
  ) {
    super(message);
  }
}

export interface Actor {
  userId: string;
  email: string;
}

/**
 * Returns the allowlist entry for an email if it is active.
 * Emails listed in ADMIN_EMAILS are bootstrapped as admins on first lookup.
 */
export async function getActiveAllowedUser(db: Db, rawEmail: string): Promise<AllowedUser | null> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return null;
  const email = parsed.data;

  const [existing] = await db
    .select()
    .from(allowedUsers)
    .where(eq(allowedUsers.email, email))
    .limit(1);
  if (existing) return existing.active ? existing : null;

  if (env().ADMIN_EMAILS.includes(email)) {
    const [created] = await db
      .insert(allowedUsers)
      .values({ email, role: "admin", addedBy: null })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }
  return null;
}

export async function listAllowedUsers(db: Db): Promise<AllowedUser[]> {
  return db.select().from(allowedUsers).orderBy(asc(allowedUsers.email));
}

export async function addAllowedUser(
  db: Db,
  actor: Actor,
  input: { email: string; role: Role },
): Promise<AllowedUser> {
  const email = emailSchema.parse(input.email);
  const [row] = await db
    .insert(allowedUsers)
    .values({ email, role: input.role, addedBy: actor.email })
    .onConflictDoUpdate({
      target: allowedUsers.email,
      set: { role: input.role, active: true, updatedAt: new Date() },
    })
    .returning();
  await audit(db, {
    action: "allowlist.added",
    actorUserId: actor.userId,
    actorEmail: actor.email,
    metadata: { email, role: input.role },
  });
  return row!;
}

export async function setAllowedUserRole(db: Db, actor: Actor, rawEmail: string, role: Role) {
  const email = emailSchema.parse(rawEmail);
  if (email === actor.email && role !== "admin") {
    throw new AllowlistError("self_demotion", "Você não pode remover seu próprio acesso de admin.");
  }
  await db
    .update(allowedUsers)
    .set({ role, updatedAt: new Date() })
    .where(eq(allowedUsers.email, email));
  await audit(db, {
    action: "allowlist.updated",
    actorUserId: actor.userId,
    actorEmail: actor.email,
    metadata: { email, role },
  });
}

/**
 * Deactivates an allowlist entry and immediately cuts access:
 * all tokens are revoked and all sessions deleted.
 */
export async function deactivateAllowedUser(db: Db, actor: Actor, rawEmail: string) {
  const email = emailSchema.parse(rawEmail);
  if (email === actor.email)
    throw new AllowlistError("self_removal", "Você não pode remover o próprio acesso.");

  await db
    .update(allowedUsers)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(allowedUsers.email, email));

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  let revoked = 0;
  if (user) {
    revoked = await revokeAllTokensForUser(db, user.id);
    await db.delete(sessions).where(eq(sessions.userId, user.id));
  }
  await audit(db, {
    action: "allowlist.removed",
    actorUserId: actor.userId,
    actorEmail: actor.email,
    metadata: { email, revokedTokens: revoked },
  });
}
