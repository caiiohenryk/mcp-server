---
id: shared/code-review
title: Code review
technology: shared
version: 1
status: stable
severity: MUST
summary: Regras para quem abre e para quem revisa pull requests — o que verificar, como comentar, prazos e quando aprovar, inclusive para código gerado por IA.
tags: [code-review, pull-request, quality, collaboration]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related:
  [
    shared/git-workflow,
    shared/security-baseline,
    shared/testing-strategy,
    shared/ai-assisted-development,
  ]
---

# Code review

A revisão existe para manter o código compreensível, correto e seguro, e para espalhar
conhecimento no time. Complementa `shared/git-workflow`, que define o formato dos PRs.

### SHARED-CR-001 [MUST] Exija ao menos uma aprovação humana e CI verde antes do merge

**Por quê:** nenhuma mudança chega à branch principal sem um segundo par de olhos humano e sem os
checks automáticos. Aprovação de bot ou agente de IA não conta. Áreas sensíveis (auth, pagamentos,
infraestrutura, migrações de dados) MUST ter aprovação do CODEOWNER da área.

✅ Correto:

```text
# Branch protection de main
Require a pull request before merging: 1 approval
Require review from Code Owners: on
Require status checks to pass: check, e2e
Dismiss stale approvals when new commits are pushed: on
```

❌ Errado:

```text
Require a pull request before merging: off
Allow administrators to bypass: on
```

### SHARED-CR-002 [MUST] Revise o próprio PR antes de pedir revisão

**Por quê:** o autor é quem melhor detecta arquivos esquecidos, logs de debug e mudanças
acidentais. Leia o diff completo na plataforma, confirme o CI verde e preencha o template antes de
marcar revisores. Isso vale também para PRs gerados por agentes de IA: a pessoa que abre o PR
responde pelo conteúdo.

✅ Correto:

```bash
git diff origin/main...HEAD --stat
pnpm check
gh pr create --fill --draft   # revisa o diff na web, depois marca como pronto
gh pr ready
```

❌ Errado:

```text
PR aberto com console.log("aqui"), arquivo .env.local e CI vermelho, já com 3 revisores marcados
```

### SHARED-CR-003 [MUST] Verifique correção, segurança e testes antes de estilo

**Por quê:** formatação e lint são responsabilidade das ferramentas automáticas. O tempo humano vai
para: o código faz o que a issue pede? Há casos de borda sem tratamento? Há risco de segurança
(entrada não validada, autorização ausente, segredo)? Os testes cobrem o comportamento novo? O
design respeita os standards?

✅ Correto:

```text
[bloqueante] `cancelOrder` não verifica se o pedido pertence ao usuário (SHARED-SEC-004).
Qualquer usuário cancela pedido alheio trocando o id.
```

❌ Errado:

```text
Prefiro aspas simples aqui.
Coloca uma linha em branco antes do return.
```

### SHARED-CR-004 [MUST] Classifique cada comentário como bloqueante ou não

**Por quê:** sem classificação o autor não sabe o que impede o merge. Use prefixos: `[bloqueante]`
(MUST ser resolvido), `[sugestão]` (autor decide), `[dúvida]` (pede explicação), `[nit]` (detalhe
opcional). Cite o id da regra do standard quando aplicável.

✅ Correto:

```text
[sugestão] Extrair este cálculo para `pricing.ts` facilita testar o desconto isolado.
[nit] Typo em "recieve".
[bloqueante] Falta teste de regressão para o bug #231 (SHARED-TEST-004).
```

❌ Errado:

```text
Isso aqui não ficou bom.
?
```

### SHARED-CR-005 [SHOULD] Responda pedidos de revisão em até um dia útil

**Por quê:** PR parado gera troca de contexto, conflitos e lotes cada vez maiores. A primeira
revisão SHOULD acontecer em até 1 dia útil; se não puder revisar, avise e indique outra pessoa.

✅ Correto:

```text
09:10 PR aberto
14:30 primeira revisão com 2 comentários
16:00 ajustes feitos, aprovado
```

❌ Errado:

```text
Seg PR aberto
Sex "ainda não consegui olhar"
```

### SHARED-CR-006 [SHOULD] Comente o código, não a pessoa

**Por quê:** revisão é colaboração. Comentários SHOULD ser objetivos, explicar o porquê e propor
alternativa concreta; perguntas são preferíveis a afirmações quando há dúvida sobre a intenção.

✅ Correto:

```text
[sugestão] Esta query roda dentro do loop (N+1). Que tal buscar os itens com
`findMany({ where: { orderId: { in: ids } } })` antes do loop?
```

❌ Errado:

```text
Você sempre faz N+1. Isso é básico.
```

### SHARED-CR-007 [MUST NOT] Aprove código que você não entendeu

**Por quê:** aprovação é corresponsabilidade. Se o diff é grande demais para entender, peça para
dividir (`shared/git-workflow`); se o domínio é desconhecido, peça explicação ou outra pessoa
revisora. Isso vale em dobro para código gerado por IA, que costuma parecer plausível mesmo quando
está errado.

✅ Correto:

```text
[dúvida] Não entendi por que o retry usa 7 tentativas com backoff de 30s. Isso não estoura o
timeout de 60s do gateway? Pode explicar ou dividir este PR em infra + lógica?
```

❌ Errado:

```text
LGTM 👍   (aprovado 40 segundos após a abertura de um PR com 1.900 linhas)
```
