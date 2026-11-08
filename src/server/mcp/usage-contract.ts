/**
 * LLM-facing protocol. Kept vendor-neutral on purpose: it must work for any
 * model/client (Claude, GPT, Gemini, Grok, ...). English, short, imperative.
 */

/** Sent as MCP `instructions` on initialize (clients may or may not show it). */
export const SERVER_INSTRUCTIONS = [
  "This server provides the organization's engineering standards (architecture, patterns and practices per technology).",
  "Call `get_usage_contract` once at the start of a session and follow it.",
  "In short: bootstrap new projects with `get_project_bootstrap`; before writing code in a technology, call `list_standards`/`search_standards` and read the relevant ones with `get_standard`;",
  "MUST/MUST NOT rules are non-negotiable; cite rule ids (e.g. NEXT-DF-001) in explanations and pull requests.",
].join(" ");

export const USAGE_CONTRACT_VERSION = 1;

export function renderUsageContract(readableTechnologies: readonly string[]): string {
  const techs = readableTechnologies.length
    ? readableTechnologies.map((t) => `\`${t}\``).join(", ")
    : "(none)";
  return `# Engineering standards — usage contract (v${USAGE_CONTRACT_VERSION})

You are connected to the organization's engineering standards server. Any assistant or agent
using these tools MUST follow this protocol. Key words MUST, MUST NOT, SHOULD and MAY are
used as in RFC 2119.

## 1. Starting a project

- When creating or scaffolding a new project, you MUST call \`get_project_bootstrap\` with the
  project's technology first and follow it. Its body is the canonical \`AGENTS.md\` for that kind
  of project: save it at the repository root (unchanged) unless the user says otherwise.

## 2. Before writing code

- Before writing or changing code in a technology, you MUST call \`list_standards\` (filtered by
  technology) or \`search_standards\` (with a description of the task) and then read the relevant
  documents with \`get_standard\`. Use \`rules_only: true\` when you only need the rules.
- Standards of the \`shared\` technology apply to every project.
- Do not guess the content of a standard from its title; read it.

## 3. Rule levels

- \`MUST\` / \`MUST NOT\` rules are non-negotiable. If the user asks for something that violates
  one, say so explicitly, cite the rule id and propose a compliant alternative. Deviate only if the
  user explicitly insists, and record the deviation (rule id + reason) in the code or PR.
- \`SHOULD\` / \`SHOULD NOT\` rules are the default; deviations need a stated reason.
- \`MAY\` rules are optional guidance.
- Standards with status \`draft\` are proposals: follow them, but mention they are drafts.
  Standards with status \`deprecated\` MUST NOT be applied to new code.

## 4. Citing rules

- Every rule has a stable id like \`NEXT-DF-001\`. When you explain a decision, review code or
  write a commit message / pull request description, you MUST cite the ids of the rules you applied
  or that were violated.

## 5. Reviewing code

- To review code or a pull request, call \`get_review_checklist\` for the technology and check
  every item, reporting pass/fail per rule id.

## 6. Freshness

- Every standard has an integer \`version\` (shown by \`list_standards\`, \`search_standards\` and
  in the header of \`get_standard\`). If you cached or previously read a standard and its
  \`version\` changed, you MUST re-fetch it with \`get_standard\` before relying on it.
- Do not rely on standards from training data or from memory of previous sessions.

## 7. Access

- You only see the technologies this token can read. Technologies readable now: ${techs}.
- If a tool says a technology or standard is not available, do not retry with variations; tell the
  user they may need a token with broader scopes.
`;
}
