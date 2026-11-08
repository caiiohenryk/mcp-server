import "server-only";
import { OAuthError, OAuthErrorCode, type AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db/client";
import { consumeRateLimit } from "@/server/ratelimit/limiter";
import { parseToken } from "@/server/tokens/format";
import { verifyToken } from "@/server/tokens/service";
import { principalFromAuthInfo, toAuthInfo } from "./principal";
import { registerStandardsServer } from "./server";
import { SERVER_INSTRUCTIONS } from "./usage-contract";

export const MCP_SERVER_INFO = { name: "pv1-standards", version: "1.0.0" } as const;

export interface McpHttpDeps {
  /** Resolved lazily per request so importing the route never needs env/DB. */
  getDb: () => Db;
}

/**
 * Full HTTP pipeline for `/api/mcp`:
 *   bearer auth (verifyToken, audited failures) → per-token rate limit → MCP (stateless).
 * Returns a Web-standard `(Request) => Promise<Response>`.
 */
export function createStandardsMcpHandler(deps: McpHttpDeps): (req: Request) => Promise<Response> {
  const mcp = createMcpHandler((server) => registerStandardsServer(server, { getDb: deps.getDb }), {
    serverInfo: MCP_SERVER_INFO,
    instructions: SERVER_INSTRUCTIONS,
  });

  const rateLimited = async (req: Request): Promise<Response> => {
    const principal = principalFromAuthInfo(req.auth);
    // withMcpAuth({ required: true }) guarantees auth; this is defensive only.
    if (!principal) return new Response("Unauthorized", { status: 401 });

    const db = deps.getDb();
    const rl = await consumeRateLimit(db, `token:${principal.tokenId}`);
    if (!rl.allowed) {
      // Audit once per window (first rejection) to avoid flooding the audit log.
      if (rl.count === rl.limit + 1) {
        await audit(db, {
          action: "mcp.rate_limited",
          actorUserId: principal.userId,
          actorEmail: principal.email,
          tokenId: principal.tokenId,
          metadata: { limit: rl.limit, resetAt: rl.resetAt.toISOString() },
        });
      }
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: `Rate limit exceeded (${rl.limit} requests/minute). Retry after ${rl.retryAfterSeconds}s.`,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfterSeconds),
            "RateLimit-Limit": String(rl.limit),
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": String(rl.retryAfterSeconds),
          },
        },
      );
    }
    return mcp(req);
  };

  return withMcpAuth(
    rateLimited,
    async (_req, bearerToken): Promise<AuthInfo | undefined> => {
      // No header → undefined → 401 challenge from withMcpAuth (not audited: not an attempt).
      if (!bearerToken) return undefined;
      const db = deps.getDb();
      const verified = await verifyToken(db, bearerToken);
      if (!verified.ok) {
        const prefix = parseToken(bearerToken)?.prefix;
        await audit(db, {
          action: "token.auth_failed",
          // Only the public prefix, never the token value.
          metadata: { reason: verified.reason, ...(prefix ? { prefix } : {}) },
        });
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          verified.reason === "expired"
            ? "Token expired. Create a new token in the dashboard."
            : "Invalid or revoked token.",
        );
      }
      return toAuthInfo(bearerToken, verified);
    },
    { required: true },
  );
}
