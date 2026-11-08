import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/server/db/client";
import { auditLog, type AuditEntry } from "@/server/db/schema";

export const AUDIT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export const auditQueryInput = z.object({
  /** Exact action, e.g. "token.created". Empty/undefined = all actions. */
  action: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z_]+\.[a-z_]+$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(AUDIT_PAGE_SIZE),
});
export type AuditQueryInput = z.input<typeof auditQueryInput>;

export interface AuditPage {
  entries: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  action: string | undefined;
}

/**
 * Reads the audit log newest-first, optionally filtered by action, with offset pagination.
 * Invalid input (e.g. a tampered `?page=`) falls back to safe defaults instead of throwing.
 */
export async function queryAuditLog(db: Db, rawInput: AuditQueryInput = {}): Promise<AuditPage> {
  const parsed = auditQueryInput.safeParse(rawInput);
  const input = parsed.success
    ? parsed.data
    : { action: undefined, page: 1, pageSize: AUDIT_PAGE_SIZE };
  const where = input.action ? eq(auditLog.action, input.action) : undefined;

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where);

  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, totalPages);

  const entries = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(input.pageSize)
    .offset((page - 1) * input.pageSize);

  return { entries, page, pageSize: input.pageSize, total, totalPages, action: input.action };
}

/** Distinct actions present in the log, for the filter control. */
export async function listAuditActions(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: auditLog.action })
    .from(auditLog)
    .orderBy(asc(auditLog.action));
  return rows.map((r) => r.action);
}
