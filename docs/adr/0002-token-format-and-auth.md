# ADR-0002: Autenticação do painel e formato dos tokens

- Status: aceito
- Data: 2026-11-08

## Decisão

### Painel

- Auth.js v5 com OAuth (Google, Microsoft Entra ID e/ou GitHub, habilitados por variável de ambiente).
- **Allowlist obrigatória** (`allowed_users`). O callback `signIn` rejeita qualquer email fora dela.
  Toda request do painel revalida a allowlist (`requireUser()`), então remover alguém tem efeito imediato.
- Remover/desativar alguém revoga todos os seus tokens e apaga suas sessões.
- Bootstrap de admins via `ADMIN_EMAILS`.
- Sessões em banco, 8h.

### Tokens (Personal Access Tokens)

- Formato `pv1_<prefix 10 chars>_<secret 43 chars base64url>`. O prefixo `pv1_` permite secret scanning.
- Persistimos apenas `prefix` (lookup) e `HMAC-SHA256(TOKEN_PEPPER, token)`. Comparação em tempo constante.
- Plaintext exibido **uma única vez**.
- Expiração obrigatória (padrão 90 dias, máx. 365). Máx. 10 tokens ativos por pessoa.
- Escopos: `standards:read:*` ou `standards:read:<tecnologia>`. A tecnologia `shared` é sempre legível.
- Uso no MCP: `Authorization: Bearer pv1_...`.

## Alternativas consideradas

- **OAuth 2.1 nativo do MCP** (authorization server + CIMD): melhor UX em conectores web, porém maior complexidade. Planejado como evolução (fase 7); a camada de verificação (`verifyToken`) foi isolada para permitir aceitar ambos.
- JWT auto-contido: rejeitado — revogação imediata exigiria lista de bloqueio de qualquer forma.
