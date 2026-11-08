---
id: shared/ai-assisted-development
title: Desenvolvimento assistido por IA
technology: shared
version: 1
status: stable
severity: MUST
summary: Como agentes de IA (Claude, GPT/Codex, Gemini, Cursor, Copilot) devem se comportar em qualquer projeto — contexto, standards via MCP, diffs pequenos, verificação, segurança e limites.
tags: [ai, llm, agents, mcp, agents-md, workflow]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related:
  [shared/git-workflow, shared/code-review, shared/security-baseline, shared/testing-strategy]
---

# Desenvolvimento assistido por IA

Regras para qualquer agente de IA que lê, escreve ou executa código em projetos da organização, e
para as pessoas que o operam. O agente é um colaborador: segue as mesmas regras do time e a pessoa
que abre o PR responde pelo resultado.

### SHARED-AI-001 [MUST] Leia o AGENTS.md do repositório antes de qualquer alteração

**Por quê:** o `AGENTS.md` na raiz é a fonte única de verdade sobre stack, comandos, estrutura e
regras invioláveis do projeto. Arquivos de ferramenta (`CLAUDE.md`, `.cursor/rules`,
`.github/copilot-instructions.md`) MUST apenas apontar para ele, sem duplicar regras. Se o
repositório não tiver `AGENTS.md`, obtenha o modelo com o tool MCP `get_project_bootstrap` e
proponha-o em um PR próprio.

✅ Correto:

```markdown
<!-- CLAUDE.md -->

Leia e siga `AGENTS.md`. Este arquivo não define regras próprias.
```

❌ Errado:

```markdown
<!-- CLAUDE.md, .cursor/rules e copilot-instructions.md com três versões diferentes das regras -->

Use npm. Testes com Jest. Pode commitar direto na main.
```

### SHARED-AI-002 [MUST] Consulte os standards no MCP antes de escrever código

**Por quê:** os standards são a forma opinativa da organização de resolver cada problema; o
conhecimento de treino do modelo é genérico e pode estar desatualizado. Antes de implementar, use
`search_standards` com o tema da tarefa, leia os documentos relevantes com `get_standard` e cite os
ids das regras seguidas no PR. Regras `MUST`/`MUST NOT` prevalecem sobre a preferência do modelo.

✅ Correto:

```text
1. search_standards({ query: "server actions validação", technology: "nextjs" })
2. get_standard({ id: "nextjs/server-actions-and-mutations" })
3. Implementa seguindo NEXT-SA-001..NEXT-SA-004 e cita os ids na descrição do PR.
```

❌ Errado:

```text
Implementa a mutação com uma rota /api/update e fetch no cliente porque "é o padrão comum",
sem consultar os standards do projeto.
```

### SHARED-AI-003 [MUST] Faça diffs pequenos e restritos ao escopo da tarefa

**Por quê:** mudanças grandes ou fora do escopo são difíceis de revisar e escondem regressões. O
agente MUST alterar apenas o necessário para a tarefa, sem reformatar arquivos não relacionados,
renomear em massa ou "aproveitar para refatorar". Melhorias percebidas viram sugestão ou issue.

✅ Correto:

```text
Tarefa: corrigir arredondamento do total.
Diff: src/billing/round.ts (+4 −2), src/billing/round.test.ts (+12)
Nota no PR: "Percebi duplicação em invoice.ts; abri a issue #240."
```

❌ Errado:

```text
Tarefa: corrigir arredondamento do total.
Diff: 37 arquivos — arredondamento, migração para outra lib de datas, renomeação de pastas,
formatação de todo o projeto.
```

### SHARED-AI-004 [MUST NOT] Contorne hooks, lint, testes ou proteções

**Por quê:** essas barreiras existem para pegar exatamente os erros que agentes cometem. O agente
MUST NOT usar `--no-verify`, desabilitar regras de lint ou do compilador (`eslint-disable`,
`@ts-ignore`, `any`), apagar ou pular testes que falham, nem alterar configuração de CI para
"passar". Se não conseguir resolver, pare e explique o bloqueio.

✅ Correto:

```text
O teste orders.service.test.ts falha porque a migração 0012 não cria o índice esperado.
Não consegui determinar se o índice deve existir; preciso de decisão antes de continuar.
```

❌ Errado:

```bash
git commit --no-verify -m "fix: tests"
```

```ts
// @ts-ignore
it.skip("calculates refund", () => {});
```

### SHARED-AI-005 [MUST] Verifique o resultado executando os comandos do projeto

**Por quê:** código gerado que "parece certo" frequentemente não compila ou quebra testes. Antes de
declarar a tarefa concluída, o agente MUST rodar o check do projeto (lint, typecheck, testes) e
relatar o resultado real. Nunca afirme que algo passou sem ter executado.

✅ Correto:

```text
Executei `pnpm check`: lint ok, typecheck ok, 214 testes passando (3 novos).
```

❌ Errado:

```text
Pronto! O código deve funcionar e os testes provavelmente passam.
```

### SHARED-AI-006 [MUST NOT] Envie segredos, dados pessoais ou código proprietário para ferramentas não aprovadas

**Por quê:** o que entra no prompt pode ser retido pelo provedor. Use apenas ferramentas e contas
aprovadas pela organização (com retenção zero/sem treino), nunca cole `.env`, dumps de produção ou
dados de clientes em prompts, e não dê ao agente credenciais de produção.

✅ Correto:

```text
Agente roda com acesso ao repositório e a um banco local populado por seed sintético.
```

❌ Errado:

```text
"Analise este dump da tabela customers de produção e descubra por que o CPF está duplicado"
```

### SHARED-AI-007 [MUST NOT] Invente APIs, pacotes ou versões

**Por quê:** modelos alucinam funções e pacotes plausíveis; um nome de pacote inventado pode ser
registrado por atacantes (slopsquatting). Toda API usada MUST existir na versão fixada no lockfile;
na dúvida, consulte a documentação ou o código instalado em `node_modules`. Dependência nova segue
`SHARED-SEC-005`.

✅ Correto:

```bash
pnpm why zod                      # confirma a versão instalada no projeto
pnpm view date-fns version license # confirma que o pacote existe no registry antes de propor
```

❌ Errado:

```ts
import { validateEverything } from "zod-auto-validator"; // pacote que não existe
```

### SHARED-AI-008 [SHOULD] Peça confirmação antes de ações destrutivas ou irreversíveis

**Por quê:** apagar dados, rodar migrações, `terraform apply`, force push e chamadas a APIs pagas não
podem ser desfeitos facilmente. O agente SHOULD descrever a ação e o impacto e aguardar confirmação
humana explícita.

✅ Correto:

```text
Vou executar `terraform apply` em staging, que recria o RDS (perda de dados).
Plano anexado. Confirma?
```

❌ Errado:

```bash
terraform apply -auto-approve
psql "$DATABASE_URL" -c "drop table orders"
```

### SHARED-AI-009 [SHOULD] Declare no PR o uso de IA e as regras seguidas

**Por quê:** revisores calibram a atenção sabendo que o código foi gerado (`SHARED-CR-007`). O PR
SHOULD indicar o agente usado e os ids dos standards consultados; commits podem incluir o trailer
`Co-Authored-By` do agente.

✅ Correto:

```markdown
## IA

Gerado com assistência de agente de IA. Standards: NEXT-SA-001, NEXT-SA-003, SHARED-TEST-004.
Revisado e testado manualmente pelo autor.
```

❌ Errado:

```markdown
## Descrição

ajustes
```

### SHARED-AI-010 [MAY] Proponha atualização dos standards quando encontrar lacuna

**Por quê:** quando o agente precisa decidir algo que nenhum standard cobre, a decisão tomada pode
virar regra para todos. Abra uma issue ou PR no repositório de standards descrevendo o caso, em vez
de deixar a decisão só no código do projeto.
