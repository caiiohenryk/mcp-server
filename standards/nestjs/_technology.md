---
technology: nestjs
name: NestJS
description: APIs e serviços backend em NestJS 11 sobre Node 22 e TypeScript strict — módulos, DTOs, persistência com Prisma, configuração, erros, testes, segurança e observabilidade.
versions: { nestjs: "11", node: "22", typescript: "5", prisma: "6" }
owners: ["@caiiohenryk"]
---

# AGENTS.md — <nome-do-projeto>

Este arquivo é a fonte única de verdade para qualquer agente de IA (Claude, GPT/Codex, Gemini,
Cursor, Copilot…) que trabalhe neste repositório. Arquivos específicos de ferramenta (`CLAUDE.md`,
`.cursor/rules`, etc.) MUST apenas referenciar este arquivo. As palavras MUST / MUST NOT / SHOULD /
MAY seguem a RFC 2119.

## Como usar este arquivo

1. Leia este arquivo inteiro antes de qualquer alteração.
2. Antes de escrever código, consulte o servidor MCP de standards (padroes-pv1):
   - `list_standards` com `technology: "nestjs"` (e `"shared"`) para ver os documentos disponíveis;
   - `get_standard` para ler o documento do tema da tarefa (ex.: `nestjs/controllers-and-dtos` ao
     criar um endpoint, `nestjs/persistence` ao mexer em banco);
   - `search_standards` quando não souber qual documento cobre o assunto.
3. Regras `MUST`/`MUST NOT` são obrigatórias. Se uma tarefa exigir violar uma delas, pare e peça
   decisão humana registrada em ADR (`docs/adr/`).
4. Regras `SHOULD` só podem ser ignoradas com justificativa escrita no PR.
5. Cite o id da regra (ex.: `NEST-API-002`) em comentários de revisão e descrições de PR.

## Stack e versões

| Camada     | Escolha                                                  |
| ---------- | -------------------------------------------------------- |
| Runtime    | Node 22 LTS, pnpm (versão fixada em `packageManager`)    |
| Framework  | NestJS 11 com adapter Express                            |
| Linguagem  | TypeScript 5 com `strict: true`                          |
| Validação  | `class-validator` + `class-transformer` (ValidationPipe) |
| Banco      | PostgreSQL 16 + Prisma ORM 6                             |
| Config     | `@nestjs/config` com validação de env no boot            |
| Logs       | `nestjs-pino` (JSON estruturado)                         |
| Telemetria | OpenTelemetry SDK para Node                              |
| Health     | `@nestjs/terminus`                                       |
| Testes     | Jest + `@nestjs/testing` + supertest + Testcontainers    |
| <extra>    | <dependências específicas do projeto>                    |

## Comandos

```bash
pnpm install            # instala dependências
pnpm start:dev          # servidor local com watch
pnpm lint               # ESLint, zero warnings
pnpm typecheck          # tsc --noEmit
pnpm test               # testes unitários
pnpm test:e2e           # testes e2e (sobe Postgres via Testcontainers)
pnpm build              # nest build
pnpm prisma migrate dev # cria migração a partir do schema.prisma
<comandos específicos do projeto>
```

Antes de concluir qualquer tarefa: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.

## Estrutura de pastas

```
src/
  main.ts                 bootstrap: pipes, filtros, helmet, shutdown hooks
  app.module.ts           só importa módulos; sem providers de negócio
  config/                 namespaces registerAs + schema de validação do env
  common/                 filtros, interceptors, guards e decorators transversais
  infra/prisma/           PrismaModule e PrismaService
  health/                 HealthModule (@nestjs/terminus)
  modules/<feature>/
    <feature>.module.ts
    <feature>.controller.ts   HTTP apenas: rota, DTO, status
    <feature>.service.ts      regras de negócio
    <feature>.repository.ts   único ponto de acesso ao Prisma da feature
    dto/                      DTOs de entrada e saída
    errors/                   erros de domínio da feature
prisma/schema.prisma
prisma/migrations/        geradas pelo Prisma; nunca editadas à mão após aplicadas
test/                     testes e2e (*.e2e-spec.ts)
```

- Controllers MUST NOT acessar o Prisma; só services e repositories.
- Módulos MUST NOT ter dependência circular nem usar `forwardRef`.

## Regras invioláveis

- MUST validar todo input HTTP com DTO e o `ValidationPipe` global (`NEST-API-002`).
- MUST NOT retornar entidades do Prisma diretamente nas respostas (`NEST-API-004`).
- MUST NOT ler `process.env` fora de `src/config/` (`NEST-CFG-002`).
- MUST NOT usar `forwardRef` para resolver dependência circular (`NEST-MOD-003`).
- MUST NOT editar migrações já aplicadas (`NEST-DB-005`).
- MUST NOT logar segredos, tokens ou dados pessoais (`NEST-OBS-004`).
- MUST NOT expor stack trace ou mensagem de erro interno ao cliente (`NEST-EH-003`).
- MUST proteger rotas por padrão com guard global e marcar exceções com `@Public()` (`NEST-SEC-001`).
- MUST NOT usar `git commit --no-verify` nem desabilitar regras de lint/TS sem justificativa.
- MUST NOT commitar segredos; toda variável nova entra em `.env.example` e no schema de config.

## Definition of Done

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm test:e2e` verdes.
2. Comportamento novo coberto por teste unitário e, se for endpoint, por teste e2e.
3. Endpoints novos documentados com decorators do `@nestjs/swagger`.
4. Variáveis novas em `.env.example` e no schema de validação.
5. Migrações geradas pelo Prisma e revisadas no PR.
6. Nenhum `TODO` sem issue vinculada; nenhum log com dado sensível.
7. PR pequeno, com Conventional Commits e checklist preenchido.

## Standards relacionados

NestJS:

- `nestjs/module-architecture`
- `nestjs/controllers-and-dtos`
- `nestjs/persistence`
- `nestjs/configuration`
- `nestjs/error-handling`
- `nestjs/testing`
- `nestjs/security`
- `nestjs/observability`

Transversais:

- `shared/git-workflow`
- `shared/security-baseline`
- `shared/testing-strategy`
- `shared/observability`
- `shared/code-review`
- `shared/ai-assisted-development`
