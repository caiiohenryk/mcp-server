import "server-only";
import {
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  ResourceTemplate,
  type CallToolResult,
  type McpServer,
  type ServerContext,
  type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db/client";
import {
  getStandard,
  getTechnology,
  listStandards,
  listTechnologies,
} from "@/server/standards/repository";
import { extractRules, type Rule, type RuleLevel } from "@/server/standards/rules";
import { searchStandards } from "@/server/standards/search";
import type { Standard, Technology } from "@/server/standards/types";
import { canReadTechnology, technologySlug } from "@/server/tokens/scopes";
import { principalFromAuthInfo, type Principal } from "./principal";
import { renderUsageContract } from "./usage-contract";

export interface StandardsServerDeps {
  getDb: () => Db;
  /** How to find the caller. Default: `ctx.http.authInfo` set by `withMcpAuth`. */
  resolvePrincipal?: (ctx: ServerContext) => Principal | undefined;
}

/* ------------------------------------------------------------------ */
/* Access helpers                                                      */
/* ------------------------------------------------------------------ */

const SHARED = "shared";

function knownTechnologies(): Set<string> {
  const set = new Set(listTechnologies().map((t) => t.technology));
  for (const s of listStandards()) set.add(s.technology);
  return set;
}

/** Technologies the principal may read, sorted, `shared` always included. */
export function readableTechnologies(p: Principal): string[] {
  const set = new Set([...knownTechnologies()].filter((t) => canReadTechnology(p.scopes, t)));
  set.add(SHARED);
  return [...set].sort();
}

/** Unknown and forbidden look identical: never leak existence of forbidden content. */
function canAccessTechnology(p: Principal, technology: string): boolean {
  return canReadTechnology(p.scopes, technology) && knownTechnologies().has(technology);
}

function readableStandard(p: Principal, id: string): Standard | undefined {
  const s = getStandard(id);
  return s && canReadTechnology(p.scopes, s.technology) ? s : undefined;
}

class ToolFailure extends Error {
  constructor(
    public readonly code: "unavailable" | "not_found" | "unauthenticated",
    message: string,
  ) {
    super(message);
  }
}

function technologyUnavailable(technology: string): ToolFailure {
  return new ToolFailure(
    "unavailable",
    `Technology "${technology}" is not available to this token. ` +
      "Call `list_technologies` to see the technologies you can read; if the one you need is " +
      "missing, ask the user for a token with the corresponding scope.",
  );
}

function standardUnavailable(id: string): ToolFailure {
  return new ToolFailure(
    "not_found",
    `Standard "${id}" was not found or is not available to this token. ` +
      "Use `search_standards` or `list_standards` to find valid ids (format `<technology>/<slug>`).",
  );
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function standardHeader(s: Standard): string {
  return [
    "---",
    `id: ${s.id}`,
    `title: ${JSON.stringify(s.title)}`,
    `technology: ${s.technology}`,
    `version: ${s.version}`,
    `status: ${s.status}`,
    `severity: ${s.severity}`,
    `updated_at: ${s.updated_at}`,
    `tags: [${s.tags.join(", ")}]`,
    ...(s.related.length ? [`related: [${s.related.join(", ")}]`] : []),
    "---",
  ].join("\n");
}

function renderRule(r: Rule): string {
  return `### ${r.id} [${r.level}] ${r.title}\n\n${r.body}`.trim();
}

function standardSummary(s: Standard) {
  return {
    id: s.id,
    title: s.title,
    technology: s.technology,
    version: s.version,
    status: s.status,
    severity: s.severity,
    summary: s.summary,
    tags: s.tags,
    updated_at: s.updated_at,
  };
}

function text(markdown: string, structuredContent?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: markdown }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

const ALL_LEVELS = ["MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY"] as const;
const DEFAULT_CHECKLIST_LEVELS: RuleLevel[] = ["MUST", "MUST NOT"];

interface ChecklistItem {
  ruleId: string;
  level: RuleLevel;
  title: string;
  standardId: string;
  standardVersion: number;
}

export function buildChecklist(technology: string, levels: readonly RuleLevel[]) {
  const techs = technology === SHARED ? [SHARED] : [technology, SHARED];
  const wanted = new Set(levels);
  const sections: { standard: Standard; items: ChecklistItem[] }[] = [];
  for (const t of techs) {
    for (const s of listStandards({ technology: t })) {
      const items = extractRules(s.body)
        .filter((r) => wanted.has(r.level))
        .map((r) => ({
          ruleId: r.id,
          level: r.level,
          title: r.title,
          standardId: s.id,
          standardVersion: s.version,
        }));
      if (items.length) sections.push({ standard: s, items });
    }
  }
  return sections;
}

/* ------------------------------------------------------------------ */
/* Tool implementations (pure: principal + args → result)              */
/* ------------------------------------------------------------------ */

export const inputSchemas = {
  get_usage_contract: z.object({}),
  list_technologies: z.object({}),
  list_standards: z.object({
    technology: technologySlug
      .optional()
      .describe("Technology slug, e.g. `nextjs`. Omit to list every readable technology."),
    tag: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional()
      .describe("Only standards having this tag, e.g. `security`."),
  }),
  get_standard: z.object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, "id must look like `<technology>/<slug>`")
      .describe("Standard id `<technology>/<slug>`, as returned by list/search."),
    rules_only: z
      .boolean()
      .optional()
      .describe("If true, return only the normative rules (id, level, title, body)."),
  }),
  search_standards: z.object({
    query: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .describe("Free text: what you are about to build, a concept, or a rule id."),
    technology: technologySlug.optional().describe("Restrict to one technology slug."),
    limit: z.number().int().min(1).max(25).optional().describe("Max results (default 10)."),
  }),
  get_project_bootstrap: z.object({
    technology: technologySlug.describe("Technology slug of the new project, e.g. `nextjs`."),
  }),
  get_review_checklist: z.object({
    technology: technologySlug.describe("Technology slug of the code under review."),
    levels: z
      .array(z.enum(ALL_LEVELS))
      .min(1)
      .optional()
      .describe('Rule levels to include. Default: ["MUST", "MUST NOT"].'),
  }),
} as const;

type Args<K extends keyof typeof inputSchemas> = z.output<(typeof inputSchemas)[K]>;

interface ToolOutcome {
  result: CallToolResult;
  /** Non-sensitive identifiers only — never content. */
  meta?: { technology?: string; id?: string };
}

export const toolHandlers = {
  get_usage_contract(_args: Args<"get_usage_contract">, p: Principal): ToolOutcome {
    return { result: text(renderUsageContract(readableTechnologies(p))) };
  },

  list_technologies(_args: Args<"list_technologies">, p: Principal): ToolOutcome {
    const readable = new Set(readableTechnologies(p));
    const techs = listTechnologies().filter((t) => readable.has(t.technology));
    const rows = techs.map((t) => ({
      technology: t.technology,
      name: t.name,
      description: t.description,
      versions: t.versions,
      standards: listStandards({ technology: t.technology }).length,
    }));
    const md = [
      "# Technologies available to this token",
      "",
      ...rows.map(
        (r) =>
          `- \`${r.technology}\` — **${r.name}** (${r.standards} standards)` +
          `${Object.keys(r.versions).length ? ` · targets ${formatVersions(r.versions)}` : ""}\n  ${r.description}`,
      ),
      "",
      "`shared` standards apply to every project. Next: `get_project_bootstrap` for a new project, " +
        "or `list_standards` / `search_standards` before writing code.",
    ].join("\n");
    return { result: text(md, { technologies: rows }) };
  },

  list_standards(args: Args<"list_standards">, p: Principal): ToolOutcome {
    if (args.technology && !canAccessTechnology(p, args.technology)) {
      throw technologyUnavailable(args.technology);
    }
    const standards = listStandards(args.technology ? { technology: args.technology } : undefined)
      .filter((s) => canReadTechnology(p.scopes, s.technology))
      .filter((s) => !args.tag || s.tags.includes(args.tag))
      .map(standardSummary);
    const md = standards.length
      ? [
          `# Standards${args.technology ? ` — ${args.technology}` : ""}${args.tag ? ` (tag: ${args.tag})` : ""}`,
          "",
          ...standards.map(
            (s) =>
              `- \`${s.id}\` v${s.version} · ${s.severity} · ${s.status} — **${s.title}**\n  ${s.summary}`,
          ),
          "",
          "Read one with `get_standard({ id })`.",
        ].join("\n")
      : "No standards matched. Call `list_technologies` to see what is available.";
    return { result: text(md, { standards }), meta: { technology: args.technology } };
  },

  get_standard(args: Args<"get_standard">, p: Principal): ToolOutcome {
    const s = readableStandard(p, args.id);
    if (!s) throw standardUnavailable(args.id);
    const meta = { technology: s.technology, id: s.id };
    if (args.rules_only) {
      const rules = extractRules(s.body);
      const body = rules.length
        ? rules.map(renderRule).join("\n\n")
        : "_This standard has no normative rules._";
      return { result: text(`${standardHeader(s)}\n\n# ${s.title} — rules\n\n${body}\n`), meta };
    }
    return { result: text(`${standardHeader(s)}\n\n${s.body}\n`), meta };
  },

  search_standards(args: Args<"search_standards">, p: Principal): ToolOutcome {
    if (args.technology && !canAccessTechnology(p, args.technology)) {
      throw technologyUnavailable(args.technology);
    }
    const results = searchStandards(args.query, {
      technology: args.technology,
      allowedTechnologies: new Set(readableTechnologies(p)),
      limit: args.limit ?? 10,
    });
    const md = results.length
      ? [
          `# Search results (${results.length})`,
          "",
          ...results.map(
            (r) =>
              `- \`${r.id}\` v${r.version} · ${r.severity} — **${r.title}** (score ${r.score})\n  ${r.summary}` +
              (r.matchingRules.length ? `\n  Matching rules: ${r.matchingRules.join(", ")}` : ""),
          ),
          "",
          "Read the relevant ones with `get_standard({ id })` before writing code.",
        ].join("\n")
      : "No standards matched. Try other words, or `list_standards` for the technology.";
    return { result: text(md, { results }), meta: { technology: args.technology } };
  },

  get_project_bootstrap(args: Args<"get_project_bootstrap">, p: Principal): ToolOutcome {
    const tech = canAccessTechnology(p, args.technology)
      ? getTechnology(args.technology)
      : undefined;
    if (!tech) throw technologyUnavailable(args.technology);
    const techs = tech.technology === SHARED ? [SHARED] : [tech.technology, SHARED];
    const standards = techs.flatMap((t) => listStandards({ technology: t }));
    const md = [
      `# Project bootstrap — ${tech.name}`,
      "",
      bootstrapIntro(tech),
      "",
      "<!-- BEGIN AGENTS.md -->",
      tech.body,
      "<!-- END AGENTS.md -->",
      "",
      "## Standards that apply to this project",
      "",
      ...standards.map((s) => `- \`${s.id}\` v${s.version} · ${s.severity} — ${s.title}`),
      "",
      "Read the relevant standards with `get_standard` before implementing each area.",
    ].join("\n");
    return { result: text(md), meta: { technology: tech.technology } };
  },

  get_review_checklist(args: Args<"get_review_checklist">, p: Principal): ToolOutcome {
    if (!canAccessTechnology(p, args.technology)) throw technologyUnavailable(args.technology);
    const levels = args.levels ?? DEFAULT_CHECKLIST_LEVELS;
    const sections = buildChecklist(args.technology, levels);
    const items = sections.flatMap((s) => s.items);
    const md = [
      `# Review checklist — ${args.technology}${args.technology === SHARED ? "" : " + shared"}`,
      "",
      `Levels: ${levels.join(", ")}. Check every item; report pass/fail citing the rule id.`,
      "",
      ...(sections.length
        ? sections.flatMap(({ standard: s, items: its }) => [
            `## \`${s.id}\` v${s.version} — ${s.title}${s.status === "draft" ? " (draft)" : ""}`,
            "",
            ...its.map((i) => `- [ ] **${i.ruleId}** [${i.level}] ${i.title}`),
            "",
          ])
        : ["_No rules at these levels._"]),
    ].join("\n");
    return {
      result: text(md.trimEnd() + "\n", { technology: args.technology, levels, items }),
      meta: { technology: args.technology },
    };
  },
};

function formatVersions(v: Record<string, string>): string {
  return Object.entries(v)
    .map(([k, ver]) => `${k} ${ver}`)
    .join(", ");
}

function bootstrapIntro(tech: Technology): string {
  return [
    "The block between the markers below is the canonical `AGENTS.md` for this kind of project.",
    "Save it verbatim as `AGENTS.md` at the repository root (create or replace it) and follow it.",
    Object.keys(tech.versions).length ? `Target versions: ${formatVersions(tech.versions)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const TOOL_DOCS: Record<keyof typeof toolHandlers, { title: string; description: string }> = {
  get_usage_contract: {
    title: "Get usage contract",
    description:
      "Returns the protocol you MUST follow when using these engineering standards (when to bootstrap, " +
      "when to search/read standards, how to treat MUST rules, how to cite rule ids, when to re-fetch). " +
      "Call this once at the start of every session, before any other tool.",
  },
  list_technologies: {
    title: "List technologies",
    description:
      "Lists the technologies (e.g. nextjs, nestjs, terraform) whose standards this token can read, " +
      "with target versions and number of standards. `shared` (cross-cutting standards) is always included.",
  },
  list_standards: {
    title: "List standards",
    description:
      "Lists standards (id, title, version, status, severity, summary, tags), optionally filtered by " +
      "technology and/or tag. Use it before writing code in a technology, then read the relevant ones " +
      "with get_standard. Compare `version` with what you read before to know when to re-fetch.",
  },
  get_standard: {
    title: "Get standard",
    description:
      "Returns one standard as Markdown with a header (id, version, status, severity, updated_at). " +
      "Rules appear as `### <RULE-ID> [LEVEL] title`; MUST/MUST NOT are mandatory and their ids must be " +
      "cited. Set rules_only=true to get only the extracted rules.",
  },
  search_standards: {
    title: "Search standards",
    description:
      "Full-text search (typo tolerant) across the standards you can read: titles, summaries, tags, " +
      "rule titles and bodies. Describe the task you are about to do (e.g. 'server actions form " +
      "validation') or pass a rule id. Returns ranked standards with matching rule ids.",
  },
  get_project_bootstrap: {
    title: "Get project bootstrap",
    description:
      "Call FIRST when creating a new project. Returns the canonical AGENTS.md for the technology " +
      "(save it at the repository root) plus the list of standards that apply (technology + shared).",
  },
  get_review_checklist: {
    title: "Get review checklist",
    description:
      "Returns a Markdown checklist (one checkbox per rule id) built from the technology's and the " +
      "shared standards, for reviewing code or pull requests. Defaults to MUST and MUST NOT rules; pass " +
      "levels to include SHOULD/SHOULD NOT/MAY.",
  },
};

function defaultResolvePrincipal(ctx: ServerContext): Principal | undefined {
  return principalFromAuthInfo(ctx.http?.authInfo);
}

/**
 * Registers every tool, resource and prompt on an McpServer. Pure wiring —
 * usable with any transport (HTTP via mcp-handler, in-memory in tests).
 */
export function registerStandardsServer(server: McpServer, deps: StandardsServerDeps): void {
  const resolvePrincipal = deps.resolvePrincipal ?? defaultResolvePrincipal;

  async function auditCall(
    p: Principal,
    tool: string,
    outcome: string,
    meta: { technology?: string; id?: string } = {},
  ) {
    await audit(deps.getDb(), {
      action: "mcp.tool_call",
      actorUserId: p.userId,
      actorEmail: p.email,
      tokenId: p.tokenId,
      metadata: {
        tool,
        outcome,
        ...(meta.technology ? { technology: meta.technology } : {}),
        ...(meta.id ? { id: meta.id } : {}),
      },
    });
  }

  function requirePrincipal(ctx: ServerContext): Principal {
    const p = resolvePrincipal(ctx);
    if (!p) throw new ToolFailure("unauthenticated", "Unauthenticated: a valid token is required.");
    return p;
  }

  for (const name of Object.keys(toolHandlers) as (keyof typeof toolHandlers)[]) {
    const schema = inputSchemas[name] as StandardSchemaWithJSON;
    const handler = toolHandlers[name] as (args: unknown, p: Principal) => ToolOutcome;
    server.registerTool(
      name,
      {
        ...TOOL_DOCS[name],
        inputSchema: schema,
        annotations: { title: TOOL_DOCS[name].title, ...READ_ONLY },
      },
      async (args: unknown, ctx: ServerContext): Promise<CallToolResult> => {
        let p: Principal;
        try {
          p = requirePrincipal(ctx);
        } catch (e) {
          return errorResult((e as Error).message);
        }
        const requested = requestedMeta(args);
        try {
          const outcome = handler(args, p);
          await auditCall(p, name, "ok", { ...requested, ...outcome.meta });
          return outcome.result;
        } catch (e) {
          if (e instanceof ToolFailure) {
            await auditCall(p, name, e.code, requested);
            return errorResult(e.message);
          }
          console.error(`[mcp] tool ${name} failed`, e);
          return errorResult("Internal error while handling the request. Try again later.");
        }
      },
    );
  }

  /* ---------------- resources (secondary mechanism) ---------------- */

  server.registerResource(
    "standard",
    new ResourceTemplate("standards://{technology}/{slug}", {
      list: (ctx) => {
        const p = resolvePrincipal(ctx);
        if (!p) return { resources: [] };
        return {
          resources: listStandards()
            .filter((s) => canReadTechnology(p.scopes, s.technology))
            .map((s) => ({
              uri: `standards://${s.id}`,
              name: s.id,
              title: s.title,
              description: `${s.severity} · v${s.version} · ${s.status} — ${s.summary}`,
              mimeType: "text/markdown",
            })),
        };
      },
    }),
    {
      title: "Engineering standard",
      description: "A standard as Markdown. Same content as the get_standard tool.",
      mimeType: "text/markdown",
    },
    async (uri, variables, ctx) => {
      const p = resolvePrincipal(ctx);
      const id = `${String(variables.technology)}/${String(variables.slug)}`;
      const s = p ? readableStandard(p, id) : undefined;
      if (!p || !s) throw new ResourceNotFoundError(uri.href);
      await auditCall(p, "resources/read", "ok", { technology: s.technology, id: s.id });
      return {
        contents: [
          { uri: uri.href, mimeType: "text/markdown", text: `${standardHeader(s)}\n\n${s.body}\n` },
        ],
      };
    },
  );

  /* ---------------- prompts (secondary mechanism) ---------------- */

  const promptTechnology = (ctx: ServerContext, technology: string) => {
    const p = resolvePrincipal(ctx);
    if (!p || !canAccessTechnology(p, technology)) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        technologyUnavailable(technology).message,
      );
    }
    return p;
  };

  server.registerPrompt(
    "bootstrap-project",
    {
      title: "Bootstrap a project with the standards",
      description: "Start a new project following the organization's standards for a technology.",
      argsSchema: z.object({
        technology: technologySlug.describe("Technology slug, e.g. nextjs"),
      }),
    },
    async ({ technology }, ctx) => {
      const p = promptTechnology(ctx, technology);
      const outcome = toolHandlers.get_project_bootstrap({ technology }, p);
      await auditCall(p, "prompts/get:bootstrap-project", "ok", { technology });
      const body = outcome.result.content[0]?.type === "text" ? outcome.result.content[0].text : "";
      return {
        description: `Bootstrap a ${technology} project`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `I am starting a new ${technology} project. Follow the engineering standards below. ` +
                "Create AGENTS.md exactly as given, then, before implementing each area, use the " +
                "`search_standards` and `get_standard` tools and cite rule ids in your explanations.\n\n" +
                body,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "review-against-standards",
    {
      title: "Review code against the standards",
      description: "Review the current changes against the MUST/MUST NOT rules of a technology.",
      argsSchema: z.object({
        technology: technologySlug.describe("Technology slug, e.g. nextjs"),
        levels: z
          .string()
          .optional()
          .describe('Comma-separated levels, e.g. "MUST,MUST NOT,SHOULD". Default MUST,MUST NOT.'),
      }),
    },
    async ({ technology, levels }, ctx) => {
      const p = promptTechnology(ctx, technology);
      const parsedLevels = z
        .array(z.enum(ALL_LEVELS))
        .min(1)
        .safeParse(
          (levels ?? "")
            .split(",")
            .map((l) => l.trim().toUpperCase())
            .filter(Boolean),
        );
      const outcome = toolHandlers.get_review_checklist(
        { technology, levels: parsedLevels.success ? parsedLevels.data : undefined },
        p,
      );
      await auditCall(p, "prompts/get:review-against-standards", "ok", { technology });
      const body = outcome.result.content[0]?.type === "text" ? outcome.result.content[0].text : "";
      return {
        description: `Review against ${technology} standards`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                "Review the current code changes against the checklist below. For every item answer " +
                "pass / fail / not applicable, cite the rule id, and for failures quote the offending " +
                "code and propose a fix. Use `get_standard` to read the full rule when in doubt.\n\n" +
                body,
            },
          },
        ],
      };
    },
  );
}

function requestedMeta(args: unknown): { technology?: string; id?: string } {
  if (!args || typeof args !== "object") return {};
  const a = args as Record<string, unknown>;
  return {
    ...(typeof a.technology === "string" ? { technology: a.technology } : {}),
    ...(typeof a.id === "string" ? { id: a.id } : {}),
  };
}
