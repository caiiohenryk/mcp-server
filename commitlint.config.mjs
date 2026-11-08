/**
 * Commit convention — see docs/commit-convention.md.
 *
 * - Conventional Commits: `<type>(<scope>)?: <subject>`
 * - Written in English (enforced as ASCII-only text)
 * - No AI attribution (no `Co-Authored-By` for Claude/GPT/Copilot/etc, no "Generated with ..." lines)
 */

const AI_ATTRIBUTION =
  /(co-authored-by:.*\b(claude|anthropic|openai|chatgpt|gpt|copilot|gemini|grok|cursor|codex|\bai\b)|generated (with|by) .*(claude|ai|gpt|copilot|gemini|grok|cursor|codex)|noreply@anthropic\.com|🤖)/i;

// Accented letters and other non-ASCII characters are a strong signal of non-English text.
const NON_ASCII = /[^\x00-\x7F]/;

/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "no-ai-attribution": ({ raw }) => [
          !AI_ATTRIBUTION.test(raw ?? ""),
          "commits must not credit AI tools (remove Co-Authored-By/Generated-with lines for Claude, GPT, Copilot, etc.)",
        ],
        "english-only": ({ header, body }) => [
          !NON_ASCII.test(`${header ?? ""}\n${body ?? ""}`),
          "commit message must be written in English (non-ASCII characters found)",
        ],
      },
    },
  ],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "revert",
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "auth",
        "tokens",
        "mcp",
        "standards",
        "dashboard",
        "db",
        "audit",
        "infra",
        "ci",
        "deps",
        "docs",
        "config",
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-full-stop": [2, "never", "."],
    "subject-max-length": [2, "always", 72],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 100],
    "no-ai-attribution": [2, "always"],
    "english-only": [2, "always"],
  },
};

export default config;
