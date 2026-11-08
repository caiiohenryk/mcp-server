import "server-only";
import type { Db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_in_denied"
  | "token.created"
  | "token.revoked"
  | "token.auth_failed"
  | "mcp.tool_call"
  | "mcp.rate_limited"
  | "allowlist.added"
  | "allowlist.updated"
  | "allowlist.removed";

export interface AuditInput {
  action: AuditAction;
  actorUserId?: string | null;
  actorEmail?: string | null;
  tokenId?: string | null;
  /** Small, non-sensitive metadata only. Never token plaintext nor standard contents. */
  metadata?: Record<string, unknown>;
}

export async function audit(db: Db, input: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? null,
    tokenId: input.tokenId ?? null,
    metadata: input.metadata ?? {},
  });
}
