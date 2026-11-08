---
id: shared/git-workflow
title: Fluxo de Git e commits
technology: shared
version: 1
status: stable
severity: MUST
summary: Como nomear branches, escrever commits no padrão Conventional Commits, manter o histórico limpo e abrir pull requests pequenos e revisáveis.
tags: [git, commits, branches, pull-request, conventional-commits]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [shared/code-review, shared/ai-assisted-development]
---

# Fluxo de Git e commits

Fluxo baseado em trunk: uma branch principal (`main`) sempre implantável, branches curtas por
tarefa e integração via pull request. Vale para todo repositório, independente da tecnologia.

## Branches

### SHARED-GIT-001 [MUST] Nomeie branches como `<tipo>/<escopo>-<descrição>`

**Por quê:** o nome da branch identifica intenção e área afetada sem abrir o PR, e permite
automações (labels, deploy de preview) baseadas no prefixo. Tipos permitidos: `feature`, `fix`,
`chore`, `docs`, `refactor`, `hotfix`. Descrição em inglês, `kebab-case`, até 50 caracteres.

✅ Correto:

```bash
git switch -c feature/auth-google-oauth
git switch -c fix/billing-rounding-error
```

❌ Errado:

```bash
git switch -c minha-branch
git switch -c Feature/NovaTelaDeLogin_v2
```

### SHARED-GIT-002 [SHOULD] Mantenha branches com vida curta

**Por quê:** branches longas acumulam conflitos e escondem integração. Uma branch SHOULD ser
integrada em até 3 dias úteis; trabalho maior MUST ser fatiado ou protegido por feature flag.

✅ Correto:

```bash
# fatia 1/3: só o schema, atrás de flag desligada
git switch -c feature/orders-schema
# PR aberto e mergeado no mesmo dia
```

❌ Errado:

```bash
# branch aberta há 4 semanas com 90 arquivos alterados
git switch feature/new-checkout-everything
git merge main   # 37 conflitos
```

### SHARED-GIT-003 [MUST NOT] Faça push direto na branch principal

**Por quê:** todo código em `main` MUST passar por CI e revisão. A branch principal MUST ter
proteção habilitada: PR obrigatório, checks obrigatórios e proibição de force push.

✅ Correto:

```bash
git push -u origin feature/auth-google-oauth
gh pr create --fill
```

❌ Errado:

```bash
git switch main
git commit -am "fix rápido"
git push origin main
```

## Commits

### SHARED-GIT-004 [MUST] Escreva commits no padrão Conventional Commits

**Por quê:** mensagens padronizadas geram changelog e versão semântica automaticamente e tornam o
histórico pesquisável. Formato: `<tipo>(<escopo>): <assunto>`, assunto em inglês, minúsculo,
imperativo, sem ponto final, cabeçalho com até 100 caracteres. Tipos: `feat`, `fix`, `docs`,
`style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. O escopo MUST estar na lista
do `commitlint.config` do projeto.

✅ Correto:

```text
feat(auth): add google oauth provider

Users can now sign in with their corporate Google account.

Closes #142
```

❌ Errado:

```text
Ajustes
WIP
fix: Fixed the bug.
```

### SHARED-GIT-005 [MUST] Marque mudanças incompatíveis com `!` e `BREAKING CHANGE`

**Por quê:** consumidores de APIs e bibliotecas dependem da versão semântica para saber quando
uma atualização exige ação. Sem o marcador, a ferramenta de release gera versão minor.

✅ Correto:

```text
feat(api)!: remove v1 orders endpoint

BREAKING CHANGE: GET /v1/orders was removed; use GET /v2/orders.
```

❌ Errado:

```text
feat(api): remove v1 orders endpoint
```

### SHARED-GIT-006 [SHOULD] Faça commits atômicos

**Por quê:** cada commit SHOULD representar uma única mudança coerente que compila e passa nos
testes. Isso viabiliza `git bisect`, `git revert` e revisão por commit.

✅ Correto:

```bash
git add src/billing/rounding.ts src/billing/rounding.test.ts
git commit -m "fix(billing): round totals half-even"
git add README.md
git commit -m "docs(billing): document rounding rule"
```

❌ Errado:

```bash
git add -A
git commit -m "fix(billing): rounding + refactor users + update deps + readme"
```

### SHARED-GIT-007 [MUST NOT] Reescreva histórico de branches compartilhadas

**Por quê:** `push --force` em branch que outras pessoas usam apaga trabalho alheio. Em branch
própria, use `--force-with-lease`, que falha se o remoto mudou desde o último fetch.

✅ Correto:

```bash
git rebase origin/main
git push --force-with-lease
```

❌ Errado:

```bash
git push --force origin main
git push -f origin release/2026.11
```

## Pull requests

### SHARED-GIT-008 [SHOULD] Mantenha PRs pequenos e focados

**Por quê:** a qualidade da revisão cai drasticamente acima de ~400 linhas alteradas. Um PR
SHOULD ter até 400 linhas (sem contar arquivos gerados e lockfiles) e tratar de um único assunto.

✅ Correto:

```text
PR #210 feat(orders): add cancel endpoint          +180 −12, 6 arquivos
PR #211 feat(orders): send cancellation e-mail     +95 −3, 4 arquivos
```

❌ Errado:

```text
PR #200 feat: orders v2                             +3.412 −1.877, 84 arquivos
```

### SHARED-GIT-009 [MUST] Preencha a descrição do PR com contexto, como testar e riscos

**Por quê:** quem revisa (pessoa ou agente) precisa do porquê, não só do diff. A descrição MUST
seguir o template do repositório e vincular a issue.

✅ Correto:

```markdown
## Contexto

Clientes não conseguiam cancelar pedidos pagos via Pix (#198).

## O que mudou

- Novo endpoint `POST /orders/:id/cancel` com estorno via gateway.

## Como testar

1. `pnpm test orders`
2. Criar pedido Pix em staging e cancelar.

## Riscos

Estorno é irreversível; protegido por flag `orders.cancel`.
```

❌ Errado:

```markdown
ajustes no pedido
```

### SHARED-GIT-010 [SHOULD] Integre PRs com squash merge

**Por quê:** squash produz um commit por PR em `main`, com a mensagem Conventional Commits do
título do PR, mantendo o histórico linear e fácil de reverter.

✅ Correto:

```bash
gh pr merge 210 --squash --delete-branch
```

❌ Errado:

```bash
gh pr merge 210 --merge   # traz "wip", "fix typo", "again" para main
```
