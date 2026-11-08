import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/env";
import type { Db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { fixtureIndex } from "@/server/mcp/test-fixtures";
import { __setStandardsIndexForTests } from "@/server/standards/repository";
import { createToken, revokeToken } from "@/server/tokens/service";
import { createTestDb, seedUser } from "@/test/db";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/server/db/client", () => ({ getDb: () => holder.db }));

// Import after the mock so the route wires the test database.
const route = await import("./route");

const URL_MCP = "http://localhost:3000/api/mcp";

/** Routes fetches from the MCP client straight into the Next.js route exports. */
const routeFetch = async (input: string | URL | Request, init?: RequestInit) => {
  const req = new Request(input, init);
  const method = req.method.toUpperCase() as "GET" | "POST" | "DELETE";
  const handler = route[method];
  if (!handler) return new Response(null, { status: 405 });
  return handler(req);
};

function initializeRequest(token?: string) {
  return new Request(URL_MCP, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "raw", version: "0" },
      },
    }),
  });
}

async function connect(token: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
    fetch: routeFetch,
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: "e2e", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

describe("/api/mcp end-to-end", () => {
  let db: Db;
  let userId: string;
  const email = "dev@example.com";
  const originalLimit = process.env.MCP_RATE_LIMIT_PER_MINUTE;

  beforeAll(() => {
    __setStandardsIndexForTests(fixtureIndex);
    process.env.MCP_RATE_LIMIT_PER_MINUTE = "1000";
    resetEnvCache();
  });

  afterAll(() => {
    process.env.MCP_RATE_LIMIT_PER_MINUTE = originalLimit;
    resetEnvCache();
  });

  beforeEach(async () => {
    db = await createTestDb();
    holder.db = db;
    userId = await seedUser(db, email);
  });

  const newToken = async (scopes: string[]) =>
    (await createToken(db, { userId, email }, { name: "e2e", scopes })).token;

  it("exports the route contract", () => {
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(typeof route.DELETE).toBe("function");
  });

  it("returns 401 with a Bearer WWW-Authenticate challenge without token", async () => {
    const res = await route.POST(initializeRequest());
    expect(res.status).toBe(401);
    const challenge = res.headers.get("www-authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer /);
    expect(challenge).toContain("resource_metadata=");
    // Missing header is not an authentication attempt: nothing audited.
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it("returns 401 for malformed and revoked tokens and audits the reason only", async () => {
    const bad = await route.POST(initializeRequest("pv1_nope"));
    expect(bad.status).toBe(401);

    const { token, summary } = await createToken(
      db,
      { userId, email },
      { name: "r", scopes: ["standards:read:*"] },
    );
    await revokeToken(db, { userId, email }, summary.id);
    const revoked = await route.POST(initializeRequest(token));
    expect(revoked.status).toBe(401);
    expect(revoked.headers.get("www-authenticate")).toContain('error="invalid_token"');

    const failures = (await db.select().from(auditLog)).filter(
      (a) => a.action === "token.auth_failed",
    );
    expect(failures.map((f) => f.metadata.reason)).toEqual(["malformed", "revoked"]);
    expect(failures[1]!.metadata.prefix).toBe(token.split("_")[1]);
    const logs = JSON.stringify(await db.select().from(auditLog));
    expect(logs).not.toContain(token);
    expect(logs).not.toContain(token.split("_")[2]);
  });

  it("serves tools/list and get_standard to a valid token, filtered by scope", async () => {
    const token = await newToken(["standards:read:nextjs"]);
    const client = await connect(token);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("get_standard");

      const ok = (await client.callTool({
        name: "get_standard",
        arguments: { id: "nextjs/data-fetching" },
      })) as { isError?: boolean; content: { text: string }[] };
      expect(ok.isError).toBeFalsy();
      expect(ok.content[0]!.text).toContain("version: 3");

      const forbidden = (await client.callTool({
        name: "get_standard",
        arguments: { id: "terraform/state" },
      })) as { isError?: boolean; content: { text: string }[] };
      expect(forbidden.isError).toBe(true);
      expect(forbidden.content[0]!.text).not.toContain("SECRET-TERRAFORM-CONTENT");

      const techs = (await client.callTool({ name: "list_technologies", arguments: {} })) as {
        structuredContent: { technologies: { technology: string }[] };
      };
      expect(techs.structuredContent.technologies.map((t) => t.technology)).toEqual([
        "nextjs",
        "shared",
      ]);
    } finally {
      await client.close();
    }

    const calls = (await db.select().from(auditLog)).filter((a) => a.action === "mcp.tool_call");
    expect(calls.length).toBe(3);
    expect(calls.every((c) => c.tokenId && c.actorUserId === userId)).toBe(true);
  });

  it("rate limits per token with 429 + Retry-After and audits once per window", async () => {
    process.env.MCP_RATE_LIMIT_PER_MINUTE = "2";
    resetEnvCache();
    // Pin the clock mid-window so the test never straddles a minute boundary.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-08T12:00:05.000Z") });
    try {
      const token = await newToken(["standards:read:*"]);
      const other = await newToken(["standards:read:*"]);
      const statuses = [];
      for (let i = 0; i < 4; i++)
        statuses.push((await route.POST(initializeRequest(token))).status);
      expect(statuses).toEqual([200, 200, 429, 429]);

      const limited = await route.POST(initializeRequest(token));
      expect(limited.headers.get("retry-after")).toBe("55");
      expect(((await limited.json()) as { error: { message: string } }).error.message).toMatch(
        /Rate limit/,
      );

      expect((await route.POST(initializeRequest(other))).status).toBe(200);

      const audited = (await db.select().from(auditLog)).filter(
        (a) => a.action === "mcp.rate_limited",
      );
      expect(audited).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      process.env.MCP_RATE_LIMIT_PER_MINUTE = "1000";
      resetEnvCache();
    }
  });
});
