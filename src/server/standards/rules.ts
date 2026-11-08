/**
 * Rule extraction from a standard's markdown body.
 *
 * Every rule MUST be an H3 heading in exactly this format:
 *
 *   ### NEXT-DF-001 [MUST] Busque dados em Server Components
 *
 * - ID: `<TECH>-<AREA>-<NNN>`, uppercase, globally unique, never reused.
 * - Level: MUST | MUST NOT | SHOULD | SHOULD NOT | MAY  (RFC 2119)
 * - Title: imperative sentence.
 *
 * The body of a rule runs until the next H2/H3 heading.
 */
export const RULE_HEADING_REGEX =
  /^### ([A-Z0-9]+-[A-Z0-9]+-\d{3}) \[(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\] (.+)$/;

export type RuleLevel = "MUST" | "MUST NOT" | "SHOULD" | "SHOULD NOT" | "MAY";

export interface Rule {
  id: string;
  level: RuleLevel;
  title: string;
  body: string;
}

export function extractRules(markdown: string): Rule[] {
  const lines = markdown.split("\n");
  const rules: Rule[] = [];
  let current: Rule | null = null;
  let inFence = false;

  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trim())) inFence = !inFence;
    if (!inFence) {
      const m = RULE_HEADING_REGEX.exec(line);
      if (m) {
        if (current) rules.push(current);
        current = { id: m[1]!, level: m[2] as RuleLevel, title: m[3]!.trim(), body: "" };
        continue;
      }
      if (/^#{1,3} /.test(line) && current) {
        rules.push(current);
        current = null;
        continue;
      }
    }
    if (current) current.body += line + "\n";
  }
  if (current) rules.push(current);
  return rules.map((r) => ({ ...r, body: r.body.trim() }));
}

/** Lines starting with `### ` that look like a rule attempt but don't match the format. */
export function findMalformedRuleHeadings(markdown: string): string[] {
  let inFence = false;
  const bad: string[] = [];
  for (const line of markdown.split("\n")) {
    if (/^(```|~~~)/.test(line.trim())) inFence = !inFence;
    if (!inFence && line.startsWith("### ") && !RULE_HEADING_REGEX.test(line)) bad.push(line);
  }
  return bad;
}
