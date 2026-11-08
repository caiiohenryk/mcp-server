import type { RuleLevel } from "@/server/standards/rules";

const levelClass: Record<RuleLevel, string> = {
  MUST: "mark-must",
  "MUST NOT": "mark-must-not",
  SHOULD: "mark-should",
  "SHOULD NOT": "mark-should-not",
  MAY: "mark-may",
};

/** Border color for the vertical rule line next to each rule, per level. */
export const levelRuleBorder: Record<RuleLevel, string> = {
  MUST: "border-mark-must",
  "MUST NOT": "border-mark-must-not",
  SHOULD: "border-mark-should",
  "SHOULD NOT": "border-mark-should-not",
  MAY: "border-line-strong border-dotted",
};

/** RFC 2119 keyword set as a highlighter mark. The keyword is content, so it stays uppercase. */
export function RuleLevelMark({ level, className = "" }: { level: RuleLevel; className?: string }) {
  return (
    <span
      className={`mark ${levelClass[level]} text-[0.8em] font-extrabold tracking-wide whitespace-nowrap ${className}`}
    >
      {level}
    </span>
  );
}
