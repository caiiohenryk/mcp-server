# ADR-0003: Formato do conteúdo de standards

- Status: aceito
- Data: 2026-11-08

## Decisão

- Conteúdo vive no repositório em `standards/<tecnologia>/<slug>.md`, versionado por Git e alterado somente via PR aprovado por CODEOWNERS.
- Cada tecnologia tem `_technology.md` (descritor) e N documentos de standard.
- Frontmatter validado por `src/server/standards/schema.ts` (zod, `strict`).
- Corpo escrito em pt-BR, regras com palavras-chave RFC 2119 e IDs estáveis (`NEXT-DF-001`), cada regra com exemplo ✅ e ❌.
- Documentos ≤ 24 KB para caber em qualquer janela de contexto.
- `scripts/lint-standards.ts` bloqueia merge com conteúdo inválido; `scripts/build-standards-index.ts` gera o índice consumido pelo MCP e pelo painel.

## Consequências

- Mudanças de conteúdo exigem deploy (aceitável: garante revisão e rastreabilidade).
- Conteúdo é tratado como código: risco de prompt injection mitigado por revisão obrigatória.
