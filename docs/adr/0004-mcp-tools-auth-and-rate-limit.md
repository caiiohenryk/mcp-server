# ADR-0004: Superfície do servidor MCP, autenticação e rate limit

- Status: aceito
- Data: 2026-11-08

## Contexto

O endpoint `/api/mcp` (ADR-0001) precisa servir os standards para LLMs de vários fornecedores,
autenticado por tokens pessoais (ADR-0002), sem vazar conteúdo fora do escopo do token.

## Decisão

- **Tools (primário)**: `get_usage_contract`, `list_technologies`, `list_standards`,
  `get_standard`, `search_standards`, `get_project_bootstrap`, `get_review_checklist`. Todas
  `readOnlyHint`, input validado com zod, descrições em inglês e neutras quanto a fornecedor.
  Resources (`standards://{technology}/{slug}`) e prompts (`bootstrap-project`,
  `review-against-standards`) são apenas espelhos.
- **Contrato de uso** entregue por tool (`get_usage_contract`) e, resumido, em `instructions` do
  servidor — nem todo cliente exibe `instructions`.
- **Erros** de tool são resultados `isError: true` com mensagem acionável. Tecnologia/standard
  proibido e inexistente produzem **a mesma mensagem** (não revela existência).
- `structuredContent` só em tools cujo dado é uma lista (technologies, standards, search,
  checklist). Tools cujo payload é um documento Markdown retornam apenas texto, para que clientes
  que priorizam `structuredContent` não percam o corpo.
- **Auth**: `withMcpAuth({ required: true })` + `verifyToken`. Falhas de verificação geram
  `token.auth_failed` com `reason` e o `prefix` público; requisições sem header `Authorization`
  não são auditadas (não são tentativa de autenticação e seriam vetor de flood no audit log).
  Não servimos RFC 9728 Protected Resource Metadata: não há authorization server OAuth (ADR-0002),
  e o `mcp-handler` não exige o documento para emitir o `WWW-Authenticate`.
- **Rate limit**: janela fixa de 60 s por token na tabela `rate_limits` (upsert atômico), limite
  `MCP_RATE_LIMIT_PER_MINUTE`, contando toda requisição HTTP autenticada. Excesso → `429` com
  `Retry-After`; `mcp.rate_limited` é auditado só na primeira rejeição de cada janela. A primeira
  requisição de cada janela apaga linhas expiradas.
- **Auditoria**: `mcp.tool_call` com `{ tool, outcome, technology?, id? }`. Nunca conteúdo nem a
  query de busca (pode conter informação do usuário).

## Consequências

- Um handshake MCP consome 2–3 requisições do limite; o padrão de 120/min comporta uso normal.
- Erro de banco durante a verificação do token vira `401` (comportamento do `withMcpAuth`), não `503`.
- Migrar para OAuth (fase 7) exigirá servir o metadata RFC 9728 em `/.well-known/oauth-protected-resource`.
