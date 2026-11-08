import { RULE_HEADING_REGEX, type RuleLevel } from "@/server/standards/rules";

export type MarkdownBlock =
  | { kind: "prose"; markdown: string }
  | { kind: "rule"; id: string; level: RuleLevel; title: string; markdown: string };

/**
 * Splits a standard body into prose and rule blocks, using the same semantics as
 * `extractRules()`: a rule starts at a heading matching RULE_HEADING_REGEX and runs
 * until the next H1–H3 heading; fenced code is never treated as a heading.
 */
export function splitIntoBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let current: MarkdownBlock = { kind: "prose", markdown: "" };
  let inFence = false;

  const flush = () => {
    if (current.kind === "rule" || current.markdown.trim()) {
      blocks.push({ ...current, markdown: current.markdown.trim() });
    }
  };

  for (const line of markdown.split("\n")) {
    if (/^(```|~~~)/.test(line.trim())) inFence = !inFence;
    if (!inFence) {
      const m = RULE_HEADING_REGEX.exec(line);
      if (m) {
        flush();
        current = {
          kind: "rule",
          id: m[1]!,
          level: m[2] as RuleLevel,
          title: m[3]!.trim(),
          markdown: "",
        };
        continue;
      }
      if (/^#{1,3} /.test(line) && current.kind === "rule") {
        flush();
        current = { kind: "prose", markdown: "" };
      }
    }
    current.markdown += line + "\n";
  }
  flush();
  return blocks;
}

/** Drops a leading `# Title` line: the page already renders the frontmatter title. */
export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*# [^\n]*\n+/, "");
}
