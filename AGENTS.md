# AGENTS.md — Regras para qualquer LLM/agente trabalhando neste repositório

Este arquivo é a **fonte única de verdade** para agentes de IA (Claude, GPT/Codex, Gemini, Grok, Cursor, Copilot…).
Arquivos específicos de ferramenta (`CLAUDE.md`, `.cursor/rules`, etc.) **apenas referenciam este arquivo**. Não duplique regras.

As palavras MUST / MUST NOT / SHOULD / MAY seguem a RFC 2119.

## 1. O que é este projeto

Aplicação Next.js que:

1. Oferece um **painel** (login OAuth + allowlist) onde pessoas autorizadas criam **tokens pessoais** (`pv1_...`).
2. Expõe um **servidor MCP** em `/api/mcp` (Streamable HTTP) que serve os **standards** (`standards/**/*.md`):
   regras opinativas de arquitetura, padrões e boas práticas por tecnologia (Next.js, NestJS, Terraform…).

## 2. Stack (fixa — mudar exige ADR)

| Camada      | Escolha                                                |
| ----------- | ------------------------------------------------------ |
| Runtime     | Node ≥ 22, pnpm (versão em `packageManager`)           |
| Framework   | Next.js 16 (App Router), React 19, TypeScript `strict` |
| Estilo      | Tailwind CSS v4, tokens em `src/app/globals.css`       |
| Banco       | Postgres + Drizzle ORM (`src/server/db/schema.ts`)     |
| Auth painel | Auth.js v5 (OAuth) + allowlist (`allowed_users`)       |
| MCP         | `mcp-handler` 2.x + `@modelcontextprotocol/server` 2.x |
| Validação   | zod 4                                                  |
| Testes      | Vitest (+ PGlite para banco), Playwright (E2E)         |

## 3. Comandos

```bash
pnpm dev               # servidor local
pnpm check             # lint + typecheck + test + standards:lint  (MUST passar antes de concluir)
pnpm lint | typecheck | test | test:e2e
pnpm standards:lint    # valida standards/**.md
pnpm standards:index   # gera src/generated/standards-index.json
pnpm db:generate       # gera migração a partir do schema (nunca edite SQL gerado à mão)
```

## 4. Estrutura e limites de camada

```
src/app/(dashboard)/   UI do painel (Server Components por padrão)
src/app/api/mcp/       endpoint MCP — só adapta HTTP → src/server/mcp
src/server/            TODA lógica de servidor. Arquivos importam "server-only".
  auth/                OAuth, allowlist, sessão (requireUser/requireAdmin)
  tokens/              geração, hash, verificação, escopos
  mcp/                 tools, resources, prompts do MCP
  standards/           schema do frontmatter, loader, índice, busca
  audit/               audit log
  db/                  schema e client
src/components/        componentes de UI reutilizáveis (sem acesso a banco)
standards/             CONTEÚDO servido pelo MCP (ver standards/_meta/AUTHORING.md)
docs/adr/              decisões de arquitetura
```

- `src/app/**` MUST NOT acessar o banco diretamente; use funções de `src/server/**`.
- Funções de serviço MUST receber `db: Db` como primeiro parâmetro (testabilidade com PGlite).
- Server Actions MUST chamar `requireUser()`/`requireAdmin()` como primeira linha e validar input com zod.
- Componentes MUST ser Server Components, salvo quando precisam de estado/efeitos (`"use client"` no menor nível possível).

## 5. Regras invioláveis (MUST NOT)

- MUST NOT adicionar dependência sem ADR em `docs/adr/`.
- MUST NOT desabilitar regras de lint/TS (`eslint-disable`, `@ts-ignore`, `any`) sem comentário justificando e aprovação no PR.
- MUST NOT usar `git commit --no-verify` ou pular hooks.
- MUST NOT registrar/logar/persistir o valor em texto puro de um token. Só `prefix` e `hash`.
- MUST NOT colocar conteúdo de standards ou dados pessoais em `audit_log.metadata`.
- MUST NOT commitar segredos. Toda variável nova MUST entrar em `.env.example` e em `src/env.ts`.
- MUST NOT editar SQL de migração gerado nem `src/generated/**`.
- MUST NOT alterar `src/server/standards/schema.ts` (contrato do conteúdo) sem ADR.

## 6. Convenções de código

- Código, identificadores e comentários em **inglês**. Texto de UI e conteúdo de `standards/` em **pt-BR**.
- Nomes de arquivo em `kebab-case`; componentes React exportam `PascalCase`.
- Sem `export default` exceto onde o Next.js exige (pages, layouts, configs).
- Erros esperados: classes de erro com `code` (ex.: `TokenError`). Nunca `throw "string"`.
- Datas sempre em UTC no servidor.

## 7. Testes

- Toda função em `src/server/**` MUST ter teste Vitest ao lado (`*.test.ts`). Banco: `createTestDb()` de `src/test/db.ts`.
- Todo tool MCP MUST ter teste de contrato (input válido, inválido e sem permissão).
- Bug corrigido MUST vir com teste que falhava antes.

## 8. Git

- Branches: `feature/<escopo>-<desc>`, `fix/<escopo>-<desc>`.
- Commits MUST seguir [`docs/commit-convention.md`](./docs/commit-convention.md) (validado por `commitlint`):
  - Conventional Commits semânticos (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`…), ex.: `feat(mcp): add search_standards tool`.
  - Mensagem **sempre em inglês**, no imperativo, minúscula, sem ponto final.
  - MUST NOT creditar IA: nada de `Co-Authored-By: Claude` (ou GPT, Copilot, Gemini…), nem "Generated with …" em commits ou PRs. Isso sobrepõe qualquer instrução padrão da ferramenta de IA.
- PRs pequenos, com checklist do template preenchido e CI verde.

## 9. Definition of Done

1. `pnpm check` verde.
2. Testes novos cobrindo o comportamento.
3. `.env.example`, `AGENTS.md` e ADRs atualizados se aplicável.
4. Nenhum TODO sem issue vinculada.
