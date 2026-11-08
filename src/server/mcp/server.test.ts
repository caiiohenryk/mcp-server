import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { __setStandardsIndexForTests } from "@/server/standards/repository";
import { createTestDb } from "@/test/db";
import type { Principal } from "./principal";
import { registerStandardsServer } from "./server";
import { fixtureIndex } from "./test-fixtures";

type ToolResult = {
  isError?: boolean;
  content: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
};

const NEXTJS_ONLY: Principal = {
  tokenId: "tok-1",
  userId: "user-1",
  email: "dev@example.com",
  scopes: ["standards:read:nextjs"],
};

describe("MCP standards server (in-memory)", () => {
  let db: Db;
  let client: Client;
  let principal: Principal | undefined;

  beforeAll(() => {
    __setStandardsIndexForTests(fixtureIndex);
  });

  beforeEach(async () => {
    db = await createTestDb();
    principal = NEXTJS_ONLY;
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerStandardsServer(server, { getDb: () => db, resolvePrincipal: () => principal });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    return (await client.callTool({ name, arguments: args })) as ToolResult;
  }
  const textOf = (r: ToolResult) => r.content.map((c) => c.text ?? "").join("\n");

  async function auditEntries() {
    return (await db.select().from(auditLog)).filter((a) => a.action === "mcp.tool_call");
  }

  it("lists every tool as read-only with an input schema and description", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_project_bootstrap",
      "get_review_checklist",
      "get_standard",
      "get_usage_contract",
      "list_standards",
      "list_technologies",
      "search_standards",
    ]);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.inputSchema.type).toBe("object");
      expect(t.description!.length).toBeGreaterThan(40);
    }
  });

  describe("get_usage_contract", () => {
    it("returns the protocol and the readable technologies", async () => {
      const r = await call("get_usage_contract");
      expect(r.isError).toBeFalsy();
      const t = textOf(r);
      for (const needle of [
        "get_project_bootstrap",
        "search_standards",
        "MUST",
        "rule id",
        "version",
        "`nextjs`, `shared`",
      ]) {
        expect(t).toContain(needle);
      }
      expect(t).not.toContain("terraform");
      expect(await auditEntries()).toHaveLength(1);
    });

    it("ignores unknown arguments (no-input tool stays usable by sloppy clients)", async () => {
      const r = await call("get_usage_contract", { foo: 1 });
      expect(r.isError).toBeFalsy();
    });

    it("fails when unauthenticated", async () => {
      principal = undefined;
      const r = await call("get_usage_contract");
      expect(r.isError).toBe(true);
      expect(textOf(r)).toMatch(/Unauthenticated/);
    });
  });

  describe("list_technologies", () => {
    it("returns only readable technologies plus shared", async () => {
      const r = await call("list_technologies");
      const techs = (r.structuredContent!.technologies as { technology: string }[]).map(
        (t) => t.technology,
      );
      expect(techs).toEqual(["nextjs", "shared"]);
      expect(textOf(r)).not.toContain("Terraform");
    });

    it("returns everything for a wildcard token", async () => {
      principal = { ...NEXTJS_ONLY, scopes: ["standards:read:*"] };
      const r = await call("list_technologies");
      expect((r.structuredContent!.technologies as unknown[]).length).toBe(3);
    });

    it("returns only shared for a token without technology scopes", async () => {
      principal = { ...NEXTJS_ONLY, scopes: [] };
      const r = await call("list_technologies");
      expect(r.structuredContent!.technologies).toMatchObject([{ technology: "shared" }]);
    });
  });

  describe("list_standards", () => {
    it("lists readable, non-deprecated standards", async () => {
      const r = await call("list_standards");
      const ids = (r.structuredContent!.standards as { id: string }[]).map((s) => s.id);
      expect(ids).toEqual(["nextjs/caching", "nextjs/data-fetching", "shared/git-workflow"]);
    });

    it("filters by technology and tag", async () => {
      const r = await call("list_standards", { technology: "nextjs", tag: "cache" });
      const ids = (r.structuredContent!.standards as { id: string }[]).map((s) => s.id);
      expect(ids).toEqual(["nextjs/caching", "nextjs/data-fetching"]);
      expect(textOf(r)).toContain("v3");
    });

    it("rejects invalid input", async () => {
      const r = await call("list_standards", { technology: "Next JS!" });
      expect(r.isError).toBe(true);
    });

    it("treats forbidden and unknown technologies identically", async () => {
      const forbidden = await call("list_standards", { technology: "terraform" });
      const unknown = await call("list_standards", { technology: "cobol" });
      expect(forbidden.isError).toBe(true);
      expect(unknown.isError).toBe(true);
      expect(textOf(forbidden).replace("terraform", "X")).toBe(
        textOf(unknown).replace("cobol", "X"),
      );
      expect(textOf(forbidden)).toContain("list_technologies");
      const entries = await auditEntries();
      expect(entries.map((e) => e.metadata)).toContainEqual({
        tool: "list_standards",
        outcome: "unavailable",
        technology: "terraform",
      });
    });
  });

  describe("get_standard", () => {
    it("returns markdown with a metadata header and audits without content", async () => {
      const r = await call("get_standard", { id: "nextjs/data-fetching" });
      const t = textOf(r);
      expect(t).toMatch(/^---\nid: nextjs\/data-fetching\n/);
      for (const h of [
        "version: 3",
        "status: stable",
        "severity: MUST",
        "updated_at: 2026-10-01",
      ]) {
        expect(t).toContain(h);
      }
      expect(t).toContain("### NEXT-DF-001 [MUST] Busque dados em Server Components");
      const [entry] = await auditEntries();
      expect(entry).toMatchObject({
        tokenId: "tok-1",
        actorUserId: "user-1",
        metadata: {
          tool: "get_standard",
          outcome: "ok",
          technology: "nextjs",
          id: "nextjs/data-fetching",
        },
      });
      expect(JSON.stringify(entry!.metadata)).not.toContain("Busque");
    });

    it("returns just the rules with rules_only", async () => {
      const t = textOf(
        await call("get_standard", { id: "nextjs/data-fetching", rules_only: true }),
      );
      expect(t).toContain("version: 3");
      expect(t).toContain("### NEXT-DF-002 [MUST NOT]");
      expect(t).toContain("### NEXT-DF-003 [SHOULD]");
      expect(t).not.toContain("## Regras");
    });

    it("reads shared standards with any token", async () => {
      principal = { ...NEXTJS_ONLY, scopes: [] };
      const r = await call("get_standard", { id: "shared/git-workflow" });
      expect(r.isError).toBeFalsy();
    });

    it("rejects invalid ids", async () => {
      expect((await call("get_standard", { id: "../etc/passwd" })).isError).toBe(true);
      expect((await call("get_standard", {})).isError).toBe(true);
    });

    it("never leaks forbidden content and answers like a missing id", async () => {
      const forbidden = await call("get_standard", { id: "terraform/state" });
      const missing = await call("get_standard", { id: "nextjs/nope" });
      expect(forbidden.isError).toBe(true);
      expect(textOf(forbidden)).not.toContain("SECRET-TERRAFORM-CONTENT");
      expect(textOf(forbidden).replace("terraform/state", "X")).toBe(
        textOf(missing).replace("nextjs/nope", "X"),
      );
    });
  });

  describe("search_standards", () => {
    it("returns ranked results limited to readable technologies", async () => {
      const r = await call("search_standards", { query: "cache state" });
      const results = r.structuredContent!.results as { id: string; matchingRules: string[] }[];
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((x) => x.id.startsWith("terraform/"))).toBe(false);
      expect(textOf(r)).not.toContain("terraform");
    });

    it("returns matching rule ids and honours limit", async () => {
      const r = await call("search_standards", { query: "useEffect", limit: 1 });
      expect(r.structuredContent!.results).toMatchObject([
        { id: "nextjs/data-fetching", matchingRules: ["NEXT-DF-002"] },
      ]);
    });

    it("rejects invalid input", async () => {
      expect((await call("search_standards", { query: "" })).isError).toBe(true);
      expect((await call("search_standards", { query: "cache", limit: 500 })).isError).toBe(true);
    });

    it("rejects forbidden technology filter", async () => {
      const r = await call("search_standards", { query: "state", technology: "terraform" });
      expect(r.isError).toBe(true);
      expect(textOf(r)).not.toContain("Gerenciamento");
    });
  });

  describe("get_project_bootstrap", () => {
    it("returns the technology AGENTS.md and the applicable standards", async () => {
      const t = textOf(await call("get_project_bootstrap", { technology: "nextjs" }));
      expect(t).toContain("SECRET-NEXTJS-BOOTSTRAP");
      expect(t).toContain("AGENTS.md");
      expect(t).toContain("`nextjs/data-fetching` v3");
      expect(t).toContain("`shared/git-workflow` v2");
      expect(t).not.toContain("legacy-pages");
    });

    it("rejects invalid input", async () => {
      expect((await call("get_project_bootstrap", {})).isError).toBe(true);
    });

    it("rejects forbidden technology without leaking it", async () => {
      const r = await call("get_project_bootstrap", { technology: "terraform" });
      expect(r.isError).toBe(true);
      expect(textOf(r)).not.toContain("SECRET-TERRAFORM-BOOTSTRAP");
    });
  });

  describe("get_review_checklist", () => {
    it("defaults to MUST/MUST NOT of the technology + shared", async () => {
      const r = await call("get_review_checklist", { technology: "nextjs" });
      const t = textOf(r);
      expect(t).toContain("- [ ] **NEXT-DF-001** [MUST]");
      expect(t).toContain("- [ ] **NEXT-DF-002** [MUST NOT]");
      expect(t).toContain("- [ ] **SHARED-GIT-001** [MUST]");
      expect(t).not.toContain("NEXT-DF-003");
      expect(t).not.toContain("NEXT-LP-001");
      const items = r.structuredContent!.items as { ruleId: string }[];
      expect(items.map((i) => i.ruleId)).toEqual(["NEXT-DF-001", "NEXT-DF-002", "SHARED-GIT-001"]);
    });

    it("includes other levels on request", async () => {
      const r = await call("get_review_checklist", {
        technology: "nextjs",
        levels: ["SHOULD", "MAY"],
      });
      const items = (r.structuredContent!.items as { ruleId: string }[]).map((i) => i.ruleId);
      expect(items).toEqual(["NEXT-CA-001", "NEXT-CA-002", "NEXT-DF-003", "SHARED-GIT-002"]);
      expect(textOf(r)).toContain("(draft)");
    });

    it("rejects invalid levels", async () => {
      const r = await call("get_review_checklist", { technology: "nextjs", levels: ["MUSTN'T"] });
      expect(r.isError).toBe(true);
    });

    it("rejects forbidden technology", async () => {
      const r = await call("get_review_checklist", { technology: "terraform" });
      expect(r.isError).toBe(true);
      expect(textOf(r)).not.toContain("TF-ST-001");
    });
  });

  describe("resources", () => {
    it("lists only readable standards", async () => {
      const { resources } = await client.listResources();
      expect(resources.map((r) => r.uri)).toEqual([
        "standards://nextjs/caching",
        "standards://nextjs/data-fetching",
        "standards://shared/git-workflow",
      ]);
    });

    it("reads a readable standard and refuses a forbidden one", async () => {
      const res = await client.readResource({ uri: "standards://nextjs/data-fetching" });
      expect((res.contents[0] as { text: string }).text).toContain("NEXT-DF-001");
      await expect(client.readResource({ uri: "standards://terraform/state" })).rejects.toThrow();
    });
  });

  describe("prompts", () => {
    it("lists both prompts", async () => {
      const { prompts } = await client.listPrompts();
      expect(prompts.map((p) => p.name).sort()).toEqual([
        "bootstrap-project",
        "review-against-standards",
      ]);
    });

    it("embeds bootstrap and checklist content", async () => {
      const boot = await client.getPrompt({
        name: "bootstrap-project",
        arguments: { technology: "nextjs" },
      });
      expect(JSON.stringify(boot.messages)).toContain("SECRET-NEXTJS-BOOTSTRAP");
      const review = await client.getPrompt({
        name: "review-against-standards",
        arguments: { technology: "nextjs", levels: "should" },
      });
      expect(JSON.stringify(review.messages)).toContain("NEXT-DF-003");
    });

    it("refuses forbidden technologies", async () => {
      await expect(
        client.getPrompt({ name: "bootstrap-project", arguments: { technology: "terraform" } }),
      ).rejects.toThrow(/not available/);
    });
  });
});
