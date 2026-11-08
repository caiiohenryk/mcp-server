import { RuleLevelMark } from "@/components/standards/rule-level";
import { extractRules, type Rule } from "@/server/standards/rules";
import { listStandards } from "@/server/standards/repository";

interface Specimen {
  rule: Pick<Rule, "id" | "level" | "title">;
  excerpt: string;
  source: string;
}

/** Shown when the catalog has no rules yet (it uses the format's own canonical example). */
const FALLBACK: Specimen = {
  rule: { id: "NEXT-DF-001", level: "MUST", title: "Busque dados em Server Components" },
  excerpt:
    "Dados do servidor são lidos em Server Components, perto de onde são usados. Client Components recebem só o que precisam para interagir.",
  source: "Exemplo do formato de regra dos standards",
};

function firstParagraph(markdown: string, max = 210): string {
  const para =
    markdown
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !/^(```|~~~|[-*+] |\d+\. |\||>|#)/.test(p)) ?? "";
  const plain = para
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Bold/italic markers only; keep underscores so identifiers like NEXT_PUBLIC_X survive.
    .replace(/\*\*|\*/g, "")
    .replace(/\s+/g, " ");
  if (plain.length <= max) return plain;
  return plain.slice(0, plain.lastIndexOf(" ", max)) + "…";
}

/** First MUST rule with prose in the catalog: what the product actually delivers. */
function pickSpecimen(): Specimen {
  for (const s of listStandards()) {
    for (const rule of extractRules(s.body)) {
      const excerpt = firstParagraph(rule.body);
      if (rule.level === "MUST" && excerpt.length > 40) {
        return { rule, excerpt, source: `Do standard “${s.title}”` };
      }
    }
  }
  return FALLBACK;
}

export function RuleSpecimen() {
  const { rule, excerpt, source } = pickSpecimen();
  return (
    <figure className="max-w-[34rem]">
      <p className="text-pencil font-mono text-sm">{rule.id}</p>
      <blockquote className="mt-3">
        <p className="text-2xl leading-[1.2] font-bold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
          <RuleLevelMark level={rule.level} className="mark-sweep mr-2 align-[0.2em]" />
          {rule.title}
        </p>
        <p className="text-pencil mt-5 max-w-[52ch] text-base leading-relaxed text-pretty">
          {excerpt.split("`").map((part, i) =>
            i % 2 ? (
              <code key={i} className="text-ink font-mono text-[0.875em]">
                {part}
              </code>
            ) : (
              part
            ),
          )}
        </p>
      </blockquote>
      <figcaption className="border-line mt-8 border-t pt-4 text-sm leading-relaxed">
        <span className="text-pencil block">{source}</span>
        <span className="mt-1 block font-semibold">
          Claude Code, Cursor, Codex, Gemini CLI e VS Code leem esta mesma regra pelo MCP.
        </span>
      </figcaption>
    </figure>
  );
}
