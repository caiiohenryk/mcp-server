# ADR-0001: Transporte MCP e SDK

- Status: aceito
- Data: 2026-11-08

## Contexto

Clientes MCP heterogêneos (Claude Code, Cursor, Codex, Gemini CLI, Windsurf…) precisam se conectar a um servidor remoto hospedado junto ao painel Next.js.

## Decisão

- Endpoint único `/api/mcp` usando **Streamable HTTP** via `mcp-handler` 2.x sobre `@modelcontextprotocol/server` 2.x.
- Servidor **stateless** (sem sessões MCP), compatível com a spec 2026-07-28 e fallback para clientes da era 2025.
- **Tools são o mecanismo primário.** Resources e prompts são oferecidos em paralelo, mas nenhum fluxo pode depender só deles, pois vários clientes não os suportam.
- Respostas em Markdown/JSON simples, sem recursos específicos de fornecedor.
- Clientes somente stdio usam `mcp-remote`.

## Consequências

- Escala horizontal trivial (serverless).
- Sem notificações server-push; aceitável para conteúdo estático versionado.
