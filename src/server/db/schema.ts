import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Access control                                                      */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["admin", "member"]);

/** Only emails present (and active) here may sign in. */
export const allowedUsers = pgTable("allowed_users", {
  email: text("email").primaryKey(), // always stored lower-cased
  role: roleEnum("role").notNull().default("member"),
  active: boolean("active").notNull().default(true),
  addedBy: text("added_by"), // email of the admin who added it, null for bootstrap
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Auth.js tables (shape required by @auth/drizzle-adapter)           */
/* ------------------------------------------------------------------ */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ------------------------------------------------------------------ */
/* API tokens (Personal Access Tokens for MCP)                         */
/* ------------------------------------------------------------------ */

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Public lookup part of the token (`pv1_<prefix>_...`). Unique. */
    prefix: text("prefix").notNull(),
    /** HMAC-SHA256(TOKEN_PEPPER, fullToken), hex. The plaintext is never stored. */
    hash: text("hash").notNull(),
    /** e.g. ["standards:read:*"] or ["standards:read:nextjs", "standards:read:shared"] */
    scopes: text("scopes").array().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("api_tokens_prefix_idx").on(t.prefix),
    index("api_tokens_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** e.g. "token.created", "token.revoked", "mcp.tool_call", "allowlist.added" */
    action: text("action").notNull(),
    actorUserId: text("actor_user_id"),
    actorEmail: text("actor_email"),
    tokenId: text("token_id"),
    /** Small, non-sensitive metadata. NEVER store token plaintext or standard content. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_token_idx").on(t.tokenId),
    index("audit_log_actor_idx").on(t.actorUserId),
  ],
);

/* ------------------------------------------------------------------ */
/* Rate limiting (fixed window, per key)                               */
/* ------------------------------------------------------------------ */

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(), // e.g. "token:<id>:<windowStartEpochMinute>"
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type AllowedUser = typeof allowedUsers.$inferSelect;
export type User = typeof users.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
