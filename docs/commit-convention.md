# Commit convention

Enforced by `commitlint.config.mjs` (local `commit-msg` hook + CI). Applies to humans and AI agents alike.

## Format

```
<type>(<scope>): <subject>

<body>            optional — what and why, wrapped at 100 chars

<footer>          optional — BREAKING CHANGE: ..., Refs: #123
```

## Rules

1. **Semantic type is mandatory.** One of:

   | Type       | Use for                                                 |
   | ---------- | ------------------------------------------------------- |
   | `feat`     | new user- or client-facing behavior                     |
   | `fix`      | bug fix                                                 |
   | `chore`    | maintenance that changes no behavior (tooling, cleanup) |
   | `docs`     | documentation only (README, ADRs, AGENTS.md)            |
   | `style`    | formatting only, no logic change                        |
   | `refactor` | code change that neither fixes a bug nor adds a feature |
   | `perf`     | performance improvement                                 |
   | `test`     | adding or fixing tests only                             |
   | `build`    | build system or dependencies                            |
   | `ci`       | CI configuration                                        |
   | `revert`   | reverting a previous commit                             |

2. **Scope is optional**, but when used it MUST be one of:
   `auth`, `tokens`, `mcp`, `standards`, `dashboard`, `db`, `audit`, `infra`, `ci`, `deps`, `docs`, `config`.
3. **Always in English.** Header and body must be ASCII-only (no accents — a Portuguese message will be rejected).
4. **Subject:** imperative mood ("add", not "added"/"adds"), lower case, no trailing period, max 72 chars.
5. **Never credit AI.** No `Co-Authored-By: Claude …` (or GPT, Copilot, Gemini, Grok, Cursor, Codex), no
   "Generated with …" lines, no 🤖. The author of the commit is the developer who reviewed and committed it.
6. **One logical change per commit.** Don't mix a feature with unrelated refactors.
7. **Breaking changes** use `!` after the type/scope (`feat(mcp)!: ...`) and a `BREAKING CHANGE:` footer.

## Examples

```
feat(mcp): add get_review_checklist tool
fix(tokens): reject tokens of users removed from the allowlist
docs(standards): clarify server actions validation rule
chore: remove create-next-app boilerplate
```

Rejected:

```
Added new tool                      # no type, past tense
feat(mcp): adiciona tool de busca   # not English
feat: Add search.                   # upper case, trailing period
feat: add search                    # + "Co-Authored-By: Claude <noreply@anthropic.com>"
```
