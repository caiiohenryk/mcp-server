import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  REQUIRED_TECHNOLOGY_SECTIONS,
  findPlaceholders,
  hasExamples,
  lintRuleIds,
  lintStandardDoc,
  lintStandards,
  lintTechnologyDoc,
  relativeLinks,
} from "./lint-standards";
import type { StandardFrontmatter } from "../src/server/standards/schema";

const FENCE = "```";

function rule(id: string, level = "MUST", examples = true) {
  const ex = examples
    ? `✅ Correto:\n\n${FENCE}ts\nconst ok = 1;\n${FENCE}\n\n❌ Errado:\n\n${FENCE}ts\nvar bad = 1;\n${FENCE}\n`
    : "Sem exemplos.\n";
  return `### ${id} [${level}] Faça a coisa certa\n\nPorque sim.\n\n${ex}`;
}

function meta(overrides: Partial<StandardFrontmatter> = {}): StandardFrontmatter {
  return {
    id: "demo/doc",
    title: "Documento de teste",
    technology: "demo",
    version: 1,
    status: "stable",
    severity: "MUST",
    summary: "Um documento de teste para o linter de standards.",
    tags: ["test"],
    applies_to: [],
    owners: ["@caiiohenryk"],
    updated_at: "2026-11-08",
    related: [],
    ...overrides,
  };
}

function doc(body: string, overrides: Partial<StandardFrontmatter> = {}) {
  const m = meta(overrides);
  return { meta: m, body, file: `standards/${m.technology}/${m.id.split("/")[1]}.md` };
}

const messages = (issues: { message: string }[]) => issues.map((i) => i.message);

describe("hasExamples", () => {
  it("requires each marker to be followed by a code block", () => {
    expect(hasExamples(rule("A-B-001"))).toEqual({ good: true, bad: true });
    expect(hasExamples("✅ bom\n\n❌ ruim\n\n```ts\nx\n```")).toEqual({ good: false, bad: true });
    expect(hasExamples("```ts\n// ✅ inside code\n```\n")).toEqual({ good: false, bad: false });
  });
});

describe("findPlaceholders", () => {
  it("flags TODO/TBD/lorem in prose but not in code or Portuguese words", () => {
    const body = [
      "Todo projeto deve ter testes.",
      "Isto é TBD.",
      "Use `// TODO(#123)` com issue.",
      "```ts",
      "// TODO inside code is fine",
      "```",
      "Lorem ipsum dolor.",
    ].join("\n");
    expect(findPlaceholders(body)).toEqual([2, 7]);
  });
});

describe("relativeLinks", () => {
  it("returns only relative targets without anchors", () => {
    const body =
      "[a](./x.md#top) [b](https://example.com) [c](#local) [d](mailto:a@b.c) `[e](no.md)`";
    expect(relativeLinks(body)).toEqual(["./x.md"]);
  });
});

describe("lintStandardDoc", () => {
  it("accepts a valid document", () => {
    const body = `# Documento de teste\n\n${rule("DEMO-X-001")}\n${rule("DEMO-X-002", "MAY", false)}`;
    expect(lintStandardDoc(doc(body))).toEqual([]);
  });

  it("requires exactly one H1 equal to the title", () => {
    expect(messages(lintStandardDoc(doc(`# Outro título\n\n${rule("DEMO-X-001")}`)))).toContain(
      'H1 "Outro título" must equal frontmatter title "Documento de teste"',
    );
    expect(messages(lintStandardDoc(doc(rule("DEMO-X-001"))))).toContain(
      "expected exactly one H1, found 0",
    );
    expect(
      messages(
        lintStandardDoc(doc(`# Documento de teste\n# Documento de teste\n${rule("DEMO-X-001")}`)),
      ),
    ).toContain("expected exactly one H1, found 2");
  });

  it("ignores H1-looking lines inside code fences", () => {
    const body = `# Documento de teste\n\n${FENCE}bash\n# comment\n${FENCE}\n\n${rule("DEMO-X-001")}`;
    expect(lintStandardDoc(doc(body))).toEqual([]);
  });

  it("requires at least one rule and flags malformed headings", () => {
    const msgs = messages(
      lintStandardDoc(doc("# Documento de teste\n\n### demo-x-1 [MUST] errado\n")),
    );
    expect(msgs).toContain("document has no rules");
    expect(msgs.some((m) => m.startsWith('malformed rule heading "### demo-x-1'))).toBe(true);
  });

  it("requires ✅/❌ examples except for MAY rules", () => {
    const body = `# Documento de teste\n\n${rule("DEMO-X-001", "MUST", false)}`;
    expect(messages(lintStandardDoc(doc(body)))).toEqual([
      "rule DEMO-X-001 is missing a ✅ example followed by a code block",
      "rule DEMO-X-001 is missing a ❌ example followed by a code block",
    ]);
  });

  it("requires severity to equal the highest rule level", () => {
    const body = `# Documento de teste\n\n${rule("DEMO-X-001", "SHOULD NOT")}`;
    expect(messages(lintStandardDoc(doc(body)))).toEqual([
      'severity "MUST" must equal highest rule level "SHOULD"',
    ]);
    const mustNot = `# Documento de teste\n\n${rule("DEMO-X-001", "MUST NOT")}\n${rule("DEMO-X-002", "SHOULD")}`;
    expect(lintStandardDoc(doc(mustNot, { severity: "MUST" }))).toEqual([]);
    expect(messages(lintStandardDoc(doc(mustNot, { severity: "SHOULD" })))).toHaveLength(1);
  });

  it("flags placeholder text", () => {
    const body = `# Documento de teste\n\nTBD\n\n${rule("DEMO-X-001")}`;
    expect(messages(lintStandardDoc(doc(body)))).toEqual([
      "placeholder text (TODO/TBD/FIXME/lorem) at body line 3",
    ]);
  });
});

describe("lintRuleIds", () => {
  it("flags duplicate rule ids across documents", () => {
    const a = doc(`# Documento de teste\n${rule("DEMO-X-001")}`);
    const b = doc(`# Documento de teste\n${rule("DEMO-X-001")}`, { id: "demo/other" });
    expect(messages(lintRuleIds([a, b]))).toEqual([
      "duplicate rule id DEMO-X-001 (also in standards/demo/doc.md)",
    ]);
  });

  it("flags inconsistent prefixes within a technology only", () => {
    const a = doc(`${rule("DEMO-X-001")}\n${rule("DEMO-X-002")}`);
    const b = doc(rule("OTHER-X-001"), { id: "demo/b" });
    const c = doc(rule("ELSE-X-001"), { id: "else/c", technology: "else" });
    const issues = lintRuleIds([a, b, c]);
    expect(issues).toEqual([
      {
        file: "standards/demo/b.md",
        message: 'rule id prefix "OTHER-" differs from "DEMO-" used by technology "demo"',
      },
    ]);
  });
});

function technologyBody(ids: string[], omit?: string) {
  return REQUIRED_TECHNOLOGY_SECTIONS.filter((s) => s !== omit)
    .map((s) => {
      if (s === "Como usar este arquivo")
        return `## ${s}\n\nConsulte list_standards, get_standard e search_standards.`;
      if (s === "Standards relacionados")
        return `## ${s}\n\n${ids.map((i) => `- \`${i}\``).join("\n")}`;
      return `## ${s}\n\nConteúdo.`;
    })
    .join("\n\n");
}

describe("lintTechnologyDoc", () => {
  const tech = (body: string) => ({
    meta: {
      technology: "demo",
      name: "Demo",
      description: "Tecnologia de demonstração para testes.",
      versions: {},
      owners: ["@x"],
    },
    body,
    file: "standards/demo/_technology.md",
  });

  it("accepts a complete AGENTS.md template", () => {
    expect(lintTechnologyDoc(tech(technologyBody(["demo/doc"])), ["demo/doc", "x/y"])).toEqual([]);
  });

  it("requires every section", () => {
    expect(
      messages(lintTechnologyDoc(tech(technologyBody(["demo/doc"], "Comandos")), ["demo/doc"])),
    ).toEqual(['missing required section "## Comandos"']);
  });

  it("requires the MCP tools in 'Como usar este arquivo'", () => {
    const body = technologyBody(["demo/doc"]).replace("search_standards", "busca");
    expect(messages(lintTechnologyDoc(tech(body), ["demo/doc"]))).toEqual([
      '"## Como usar este arquivo" must mention the MCP tool search_standards',
    ]);
  });

  it("checks the related standards list against existing ids", () => {
    const msgs = messages(lintTechnologyDoc(tech(technologyBody(["demo/ghost"])), ["demo/doc"]));
    expect(msgs).toEqual([
      '"Standards relacionados" lists unknown id "demo/ghost"',
      '"Standards relacionados" must list "demo/doc"',
    ]);
  });
});

describe("lintStandards (filesystem)", () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function fixture(files: Record<string, string>) {
    dir = await mkdtemp(path.join(tmpdir(), "lint-standards-"));
    const root = path.join(dir, "standards");
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
      await writeFile(path.join(root, rel), content);
    }
    return root;
  }

  const techFile = (ids: string[]) =>
    `---\ntechnology: demo\nname: Demo\ndescription: Tecnologia de demonstração para testes.\nowners: ["@x"]\n---\n\n${technologyBody(ids)}\n`;
  const docFile = (body: string, extra = "") =>
    `---\nid: demo/doc\ntitle: Documento de teste\ntechnology: demo\nversion: 1\nstatus: stable\nseverity: MUST\nsummary: Um documento de teste para o linter de standards.\ntags: [test]\nowners: ["@x"]\nupdated_at: 2026-11-08\n${extra}---\n\n${body}\n`;

  it("passes a valid tree and ignores _meta", async () => {
    const root = await fixture({
      "_meta/AUTHORING.md": "# qualquer coisa TODO",
      "demo/_technology.md": techFile(["demo/doc"]),
      "demo/doc.md": docFile(
        `# Documento de teste\n\nVeja [o guia](../_meta/AUTHORING.md).\n\n${rule("DEMO-X-001")}`,
      ),
    });
    const res = await lintStandards(root);
    expect(res.issues).toEqual([]);
    expect(res).toMatchObject({ technologies: 1, standards: 1, rules: 1 });
  });

  it("reports parser issues and broken links together", async () => {
    const root = await fixture({
      "demo/_technology.md": techFile(["demo/doc"]),
      "demo/doc.md": docFile(
        `# Documento de teste\n\n[x](./missing.md)\n\n${rule("DEMO-X-001")}`,
        "related: [demo/nope]\n",
      ),
    });
    const msgs = messages((await lintStandards(root)).issues);
    expect(msgs).toContain('related "demo/nope" does not exist');
    expect(msgs).toContain('broken relative link "./missing.md"');
  });
});
