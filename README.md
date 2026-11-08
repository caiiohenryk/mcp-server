# MCP Standards Server

Servidor MCP + painel para padronizar como LLMs (Claude, GPT, Grok, Gemini…) escrevem código nos projetos do time.
Pessoas autorizadas entram via OAuth, geram um token pessoal e conectam sua ferramenta de IA ao endpoint
`/api/mcp`, que serve standards opinativos de arquitetura e boas práticas por tecnologia.

> Agentes de IA: leiam [`AGENTS.md`](./AGENTS.md) antes de qualquer alteração.

## Rodando localmente

```bash
cp .env.example .env            # preencha AUTH_SECRET, TOKEN_PEPPER, ADMIN_EMAILS e ao menos 1 provider OAuth
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm dev                        # http://localhost:3000
```

Callback OAuth a cadastrar no provider: `http://localhost:3000/api/auth/callback/<google|microsoft-entra-id|github>`.

## Como funciona

| Parte             | Onde                                  |
| ----------------- | ------------------------------------- |
| Login + allowlist | `src/server/auth/`                    |
| Tokens `pv1_…`    | `src/server/tokens/`                  |
| Servidor MCP      | `src/server/mcp/`, `src/app/api/mcp/` |
| Conteúdo          | `standards/<tecnologia>/*.md`         |
| Painel            | `src/app/(dashboard)/`                |
| Decisões          | `docs/adr/`                           |

## Contribuindo com standards

Veja [`standards/_meta/AUTHORING.md`](./standards/_meta/AUTHORING.md). Valide com `pnpm standards:lint`.

## Qualidade

`pnpm check` roda lint, typecheck, testes e validação de conteúdo — o mesmo que o CI.
