/**
 * Content linter for standards/**.md (`pnpm standards:lint`).
 *
 * Reuses the parser (frontmatter contract, ids, size, related) and adds
 * structural checks on the markdown body. See standards/_meta/AUTHORING.md.
 * Exits 1 on any issue, printing `file: message` lines and a summary.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import {
  parseStandardsDir,
  type ParseIssue,
  type ParsedStandard,
  type ParsedTechnology,
} from "../src/server/standards/parse";
import {
  extractRules,
  findMalformedRuleHeadings,
  type RuleLevel,
} from "../src/server/standards/rules";
import type { StandardFrontmatter } from "../src/server/standards/schema";

export type LintIssue = ParseIssue;

/** H2 sections every `_technology.md` body (the canonical AGENTS.md) MUST contain. */
export const REQUIRED_TECHNOLOGY_SECTIONS = [
  "Como usar este arquivo",
  "Stack e versões",
  "Comandos",
  "Estrutura de pastas",
  "Regras invioláveis",
  "Definition of Done",
  "Standards relacionados",
] as const;

/** MCP tools the "Como usar este arquivo" section MUST tell agents to call. */
export const REQUIRED_MCP_TOOLS = ["list_standards", "get_standard", "search_standards"] as const;

const LEVEL_TO_SEVERITY: Record<RuleLevel, StandardFrontmatter["severity"]> = {
  MUST: "MUST",
  "MUST NOT": "MUST",
  SHOULD: "SHOULD",
  "SHOULD NOT": "SHOULD",
  MAY: "MAY",
};
const SEVERITY_RANK: Record<StandardFrontmatter["severity"], number> = {
  MUST: 3,
  SHOULD: 2,
  MAY: 1,
};

const FENCE = /^\s*(```|~~~)/;
const PLACEHOLDER_CASE_SENSITIVE = /\b(TODO|TBD|FIXME|XXX)\b/;
const LOREM = /lorem ipsum/i;

/** Returns the body lines that are outside fenced code blocks, with their 1-based line number. */
function proseLines(markdown: string): { line: string; n: number }[] {
  const out: { line: string; n: number }[] = [];
  let inFence = false;
  markdown.split("\n").forEach((line, i) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) out.push({ line, n: i + 1 });
  });
  return out;
}

function stripInlineCode(line: string): string {
  return line.replace(/`[^`]*`/g, "");
}

/** H2 headings (outside code fences), trimmed. */
export function h2Headings(markdown: string): string[] {
  return proseLines(markdown)
    .map(({ line }) => /^## (.+)$/.exec(line)?.[1]?.trim())
    .filter((h): h is string => Boolean(h));
}

/** Text of an H2 section (until the next H1/H2), or undefined when absent. */
export function sectionBody(markdown: string, heading: string): string | undefined {
  const lines = markdown.split("\n");
  let inFence = false;
  let capturing = false;
  const out: string[] = [];
  for (const line of lines) {
    const fence = FENCE.test(line);
    if (!inFence && !fence && /^#{1,2} /.test(line)) {
      if (capturing) break;
      if (line.trim() === `## ${heading}`) {
        capturing = true;
        continue;
      }
    }
    if (fence) inFence = !inFence;
    if (capturing) out.push(line);
  }
  return capturing ? out.join("\n") : undefined;
}

/** True when the rule body has a ✅ marker and a ❌ marker, each followed by a code block. */
export function hasExamples(ruleBody: string): { good: boolean; bad: boolean } {
  let inFence = false;
  let pending: "good" | "bad" | null = null;
  const found = { good: false, bad: false };
  for (const line of ruleBody.split("\n")) {
    if (FENCE.test(line)) {
      if (!inFence && pending) {
        found[pending] = true;
        pending = null;
      }
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.includes("✅")) pending = "good";
    else if (line.includes("❌")) pending = "bad";
  }
  return found;
}

/** Placeholder text (TODO/TBD/FIXME/lorem) outside code blocks and inline code. */
export function findPlaceholders(markdown: string): number[] {
  return proseLines(markdown)
    .filter(({ line }) => {
      const prose = stripInlineCode(line);
      return PLACEHOLDER_CASE_SENSITIVE.test(prose) || LOREM.test(prose);
    })
    .map(({ n }) => n);
}

/** Relative markdown link targets (outside code), without anchors. */
export function relativeLinks(markdown: string): string[] {
  const out: string[] = [];
  for (const { line } of proseLines(markdown)) {
    for (const m of stripInlineCode(line).matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const href = m[1]!;
      if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) continue;
      const target = href.split("#")[0]!;
      if (target) out.push(target);
    }
  }
  return out;
}

/** Body checks for a single standard document (no cross-document state). */
export function lintStandardDoc(
  doc: Pick<ParsedStandard, "meta" | "body" | "file">,
  opts: { absPath?: string } = {},
): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (message: string) => issues.push({ file: doc.file, message });

  const h1s = proseLines(doc.body)
    .map(({ line }) => /^# (.+)$/.exec(line)?.[1]?.trim())
    .filter((h): h is string => Boolean(h));
  if (h1s.length !== 1) add(`expected exactly one H1, found ${h1s.length}`);
  else if (h1s[0] !== doc.meta.title)
    add(`H1 "${h1s[0]}" must equal frontmatter title "${doc.meta.title}"`);

  for (const bad of findMalformedRuleHeadings(doc.body))
    add(`malformed rule heading "${bad}" (expected "### <TECH>-<AREA>-<NNN> [LEVEL] <título>")`);

  const rules = extractRules(doc.body);
  if (rules.length === 0) add("document has no rules");

  for (const r of rules) {
    if (r.level === "MAY") continue;
    const ex = hasExamples(r.body);
    if (!ex.good) add(`rule ${r.id} is missing a ✅ example followed by a code block`);
    if (!ex.bad) add(`rule ${r.id} is missing a ❌ example followed by a code block`);
  }

  if (rules.length) {
    const highest = rules
      .map((r) => LEVEL_TO_SEVERITY[r.level])
      .sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a])[0]!;
    if (doc.meta.severity !== highest)
      add(`severity "${doc.meta.severity}" must equal highest rule level "${highest}"`);
  }

  for (const n of findPlaceholders(doc.body))
    add(`placeholder text (TODO/TBD/FIXME/lorem) at body line ${n}`);

  if (opts.absPath) issues.push(...lintLinks(doc.file, doc.body, opts.absPath));
  return issues;
}

export function lintLinks(file: string, body: string, absPath: string): LintIssue[] {
  return relativeLinks(body)
    .filter((href) => !existsSync(path.resolve(path.dirname(absPath), decodeURI(href))))
    .map((href) => ({ file, message: `broken relative link "${href}"` }));
}

/** Rule-id uniqueness across all docs and prefix consistency within a technology. */
export function lintRuleIds(docs: Pick<ParsedStandard, "meta" | "body" | "file">[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const seen = new Map<string, string>();
  const prefixes = new Map<string, Map<string, string[]>>(); // tech -> prefix -> files

  for (const doc of docs) {
    for (const r of extractRules(doc.body)) {
      const prev = seen.get(r.id);
      if (prev)
        issues.push({ file: doc.file, message: `duplicate rule id ${r.id} (also in ${prev})` });
      else seen.set(r.id, doc.file);

      const prefix = r.id.split("-")[0]!;
      const byPrefix = prefixes.get(doc.meta.technology) ?? new Map<string, string[]>();
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), doc.file]);
      prefixes.set(doc.meta.technology, byPrefix);
    }
  }

  for (const [tech, byPrefix] of prefixes) {
    if (byPrefix.size <= 1) continue;
    const ranked = [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length);
    const expected = ranked[0]![0];
    for (const [prefix, files] of ranked.slice(1)) {
      for (const file of new Set(files))
        issues.push({
          file,
          message: `rule id prefix "${prefix}-" differs from "${expected}-" used by technology "${tech}"`,
        });
    }
  }
  return issues;
}

/** `_technology.md`: body must be a complete AGENTS.md template. */
export function lintTechnologyDoc(
  tech: Pick<ParsedTechnology, "meta" | "body" | "file">,
  standardIds: string[],
): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (message: string) => issues.push({ file: tech.file, message });

  const headings = new Set(h2Headings(tech.body));
  for (const s of REQUIRED_TECHNOLOGY_SECTIONS)
    if (!headings.has(s)) add(`missing required section "## ${s}"`);

  const howTo = sectionBody(tech.body, "Como usar este arquivo");
  if (howTo !== undefined) {
    for (const tool of REQUIRED_MCP_TOOLS)
      if (!howTo.includes(tool))
        add(`"## Como usar este arquivo" must mention the MCP tool ${tool}`);
  }

  const related = sectionBody(tech.body, "Standards relacionados");
  if (related !== undefined) {
    const listed = new Set([...related.matchAll(/`([a-z0-9-]+\/[a-z0-9-]+)`/g)].map((m) => m[1]!));
    const known = new Set(standardIds);
    for (const id of listed)
      if (!known.has(id)) add(`"Standards relacionados" lists unknown id "${id}"`);
    for (const id of standardIds)
      if (id.startsWith(`${tech.meta.technology}/`) && !listed.has(id))
        add(`"Standards relacionados" must list "${id}"`);
  }

  for (const n of findPlaceholders(tech.body))
    add(`placeholder text (TODO/TBD/FIXME/lorem) at body line ${n}`);
  return issues;
}

/** Full lint of a standards directory: parser issues + body checks. */
export async function lintStandards(rootDir: string): Promise<{
  issues: LintIssue[];
  standards: number;
  technologies: number;
  rules: number;
}> {
  const parsed = await parseStandardsDir(rootDir);
  const issues: LintIssue[] = [...parsed.issues];
  const absOf = (file: string) => path.join(rootDir, path.relative("standards", file));

  for (const doc of parsed.standards)
    issues.push(...lintStandardDoc(doc, { absPath: absOf(doc.file) }));
  issues.push(...lintRuleIds(parsed.standards));

  const ids = parsed.standards.map((s) => s.meta.id);
  for (const tech of parsed.technologies) {
    issues.push(...lintTechnologyDoc(tech, ids));
    issues.push(...lintLinks(tech.file, tech.body, absOf(tech.file)));
  }

  const rules = parsed.standards.reduce((n, s) => n + extractRules(s.body).length, 0);
  return {
    issues,
    standards: parsed.standards.length,
    technologies: parsed.technologies.length,
    rules,
  };
}

async function main() {
  const root = path.resolve(process.cwd(), "standards");
  const { issues, standards, technologies, rules } = await lintStandards(root);
  for (const i of issues) console.error(`${i.file}: ${i.message}`);
  const summary = `standards:lint — ${technologies} technologies, ${standards} documents, ${rules} rules, ${issues.length} issue(s)`;
  if (issues.length) {
    console.error(summary);
    process.exit(1);
  }
  console.log(summary);
}

// Run only when executed directly (tsx), not when imported by tests.
if (process.argv[1]?.endsWith("lint-standards.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
