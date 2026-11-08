import { describe, expect, it } from "vitest";
import { extractRules, findMalformedRuleHeadings } from "./rules";

const md = `# Doc

## Seção

### NEXT-DF-001 [MUST] Busque dados em Server Components
Texto.

\`\`\`ts
### not a heading inside code
\`\`\`

### NEXT-DF-002 [MUST NOT] Não use useEffect para buscar dados
Outro.

## Outra seção
fora
### bad heading
`;

describe("extractRules", () => {
  it("extracts rules, ignoring headings inside code fences", () => {
    const rules = extractRules(md);
    expect(rules.map((r) => [r.id, r.level])).toEqual([
      ["NEXT-DF-001", "MUST"],
      ["NEXT-DF-002", "MUST NOT"],
    ]);
    expect(rules[0]!.body).toContain("### not a heading inside code");
    expect(rules[1]!.body).not.toContain("fora");
  });

  it("finds malformed rule headings", () => {
    expect(findMalformedRuleHeadings(md)).toEqual(["### bad heading"]);
  });
});
