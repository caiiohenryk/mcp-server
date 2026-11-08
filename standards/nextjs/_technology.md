---
technology: nextjs
name: Next.js
description: Padrões para aplicações Next.js 16 com App Router, React 19 e TypeScript strict — estrutura, dados, mutações, UI, erros, testes, segurança e performance.
versions: { next: "16", react: "19", typescript: "5", node: "22", tailwindcss: "4" }
owners: ["@caiiohenryk"]
---

# AGENTS.md — <nome-do-projeto>

Este arquivo é a fonte única de verdade para qualquer agente de IA (Claude, GPT/Codex, Gemini,
Cursor, Copilot…) e para pessoas trabalhando neste repositório. Arquivos específicos de ferramenta
(`CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`) MUST apenas referenciar este
arquivo, sem duplicar regras. As palavras MUST, MUST NOT, SHOULD e MAY seguem a RFC 2119.

## Como usar este arquivo

1. Leia este arquivo inteiro antes de qualquer alteração.
2. Antes de escrever ou revisar código, consulte o servidor MCP de standards:
   - `list_standards` com `technology: "nextjs"` (e `"shared"`) para ver os documentos disponíveis;
   - `search_standards` com o tema da tarefa (ex.: "server actions", "cache", "CSP");
   - `get_standard` para ler o documento completo antes de implementar.
3. Regras `MUST`/`MUST NOT` são obrigatórias. Se uma tarefa exigir violá-las, pare e peça
   confirmação explícita a uma pessoa, citando o id da regra (ex.: `NEXT-SA-001`).
4. Regras `SHOULD` são o padrão; desvios MUST ser justificados no PR.
5. Em conflito, a ordem de precedência é: este arquivo > standards `nextjs/*` > standards `shared/*`.
6. Para atualizar este arquivo a partir do padrão, use o tool `get_project_bootstrap`.

## Stack e versões

| Camada    | Escolha                                                   |
| --------- | --------------------------------------------------------- |
| Runtime   | Node.js 22 LTS, pnpm (versão fixada em `packageManager`)  |
| Framework | Next.js 16 (App Router, Turbopack), React 19              |
| Linguagem | TypeScript 5 com `strict: true`                           |
| Estilo    | Tailwind CSS v4 (tokens via `@theme` em `globals.css`)    |
| Validação | zod 4                                                     |
| Testes    | Vitest + Testing Library (unidade), Playwright (E2E)      |
| Lint      | ESLint 9 (flat config) com `eslint-config-next`, Prettier |
| Projeto   | <banco/ORM, auth, provedores específicos do projeto>      |

## Comandos

```bash
pnpm install          # instala dependências (lockfile MUST ser respeitado)
pnpm dev              # servidor local (Turbopack)
pnpm lint             # eslint --max-warnings=0
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
pnpm test:e2e         # playwright test
pnpm build            # next build
pnpm check            # lint + typecheck + test (MUST passar antes de concluir)
<comandos específicos do projeto, ex.: pnpm db:generate>
```

## Estrutura de pastas

```
src/
  app/                 rotas (App Router): page, layout, loading, error, route handlers
    (grupo)/           route groups para layouts distintos
  components/          componentes de UI reutilizáveis, sem acesso a dados
    ui/                primitivos (button, input, dialog)
  features/<feature>/  componentes, actions e queries de uma funcionalidade
  server/              TODA lógica de servidor (importa "server-only")
    <dominio>/         queries, mutations e regras de negócio
  lib/                 utilitários puros, isomórficos
  env.ts               validação das variáveis de ambiente com zod
proxy.ts               interceptação de requisições (substitui middleware.ts)
tests/e2e/             testes Playwright
```

- `src/app/**` e `src/components/**` MUST NOT acessar banco ou SDKs de servidor diretamente;
  use funções de `src/server/**`.
- Componentes são Server Components por padrão; `"use client"` no menor nível possível.

## Regras invioláveis

- MUST validar toda entrada de Server Action e Route Handler com zod e autorizar na primeira linha
  (`NEXT-SA-001`, `NEXT-SA-002`).
- MUST importar `"server-only"` em todo módulo que acessa segredos, banco ou SDKs (`NEXT-SEC-001`).
- MUST NOT expor segredos em variáveis `NEXT_PUBLIC_*` (`NEXT-SEC-002`).
- MUST NOT buscar dados em `useEffect` quando um Server Component resolve (`NEXT-DF-001`).
- MUST tratar `params` e `searchParams` como `Promise` e aguardá-los (`NEXT-PS-004`).
- MUST NOT passar objetos com dados sensíveis de Server para Client Components (`NEXT-CB-003`).
- MUST NOT usar `git commit --no-verify`, desabilitar regras de lint ou usar `any`/`@ts-ignore`
  sem justificativa aprovada no PR.
- MUST NOT commitar segredos; toda variável nova entra em `.env.example` e em `src/env.ts`.

## Definition of Done

1. `pnpm check` verde localmente e no CI.
2. Testes novos cobrindo o comportamento alterado (unidade e, para fluxos críticos, E2E).
3. Nenhuma regra `MUST` dos standards violada; desvios de `SHOULD` justificados no PR.
4. Estados de carregamento (`loading.tsx`/`Suspense`) e erro (`error.tsx`) tratados nas rotas novas.
5. `.env.example`, `src/env.ts`, este arquivo e ADRs atualizados quando aplicável.
6. PR pequeno, com descrição do porquê e checklist preenchido.

## Standards relacionados

- `nextjs/project-structure`
- `nextjs/data-fetching-and-caching`
- `nextjs/server-actions-and-mutations`
- `nextjs/components-and-client-boundaries`
- `nextjs/styling`
- `nextjs/error-handling`
- `nextjs/testing`
- `nextjs/security`
- `nextjs/performance`
- `shared/git-workflow`
- `shared/security-baseline`
- `shared/testing-strategy`
- `shared/observability`
- `shared/code-review`
- `shared/ai-assisted-development`
