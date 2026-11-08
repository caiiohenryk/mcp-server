## O que muda

<!-- Descreva a mudança e o porquê. -->

## Tipo

- [ ] feature
- [ ] fix
- [ ] standards (conteúdo)
- [ ] infra / ci
- [ ] docs

## Checklist (AGENTS.md §9)

- [ ] `pnpm check` verde localmente
- [ ] Testes novos/ajustados cobrindo o comportamento
- [ ] Sem dependência nova (ou ADR adicionado em `docs/adr/`)
- [ ] `.env.example` / `src/env.ts` atualizados (se aplicável)
- [ ] Nenhum token, segredo ou dado pessoal em logs/audit

### Se alterou `standards/`

- [ ] `version` incrementado em cada documento alterado
- [ ] `updated_at` atualizado
- [ ] Toda regra nova tem ID, palavra-chave RFC 2119 e exemplos ✅/❌
