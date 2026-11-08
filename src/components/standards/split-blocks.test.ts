import { describe, expect, it } from "vitest";
import { extractRules } from "@/server/standards/rules";
import { splitIntoBlocks, stripLeadingH1 } from "./split-blocks";

const doc = `# Data fetching

Intro text.

## Regras

### NEXT-DF-001 [MUST] Busque dados em Server Components

Corpo da regra 1.

\`\`\`ts
### NEXT-XX-999 [MUST] inside fence
\`\`\`

### NEXT-DF-002 [SHOULD NOT] Evite waterfalls

Corpo 2.

## Referências

- link
`;

describe("splitIntoBlocks", () => {
  const blocks = splitIntoBlocks(doc);

  it("produces prose and rule blocks in order", () => {
    expect(blocks.map((b) => (b.kind === "rule" ? b.id : "prose"))).toEqual([
      "prose",
      "NEXT-DF-001",
      "NEXT-DF-002",
      "prose",
    ]);
  });

  it("agrees with extractRules on ids, levels, titles and bodies", () => {
    const rules = blocks.filter((b) => b.kind === "rule");
    expect(
      rules.map((r) => ({ id: r.id, level: r.level, title: r.title, body: r.markdown })),
    ).toEqual(extractRules(doc));
  });

  it("does not treat headings inside code fences as rules", () => {
    const first = blocks[1]!;
    expect(first.markdown).toContain("### NEXT-XX-999 [MUST] inside fence");
    expect(blocks.some((b) => b.kind === "rule" && b.id === "NEXT-XX-999")).toBe(false);
  });
});

describe("stripLeadingH1", () => {
  it("removes only a leading H1", () => {
    expect(stripLeadingH1("# T\n\nbody\n# other")).toBe("body\n# other");
    expect(stripLeadingH1("body")).toBe("body");
  });
});
