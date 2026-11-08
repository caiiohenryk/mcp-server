---
technology: shared
name: Padrões transversais
description: Regras que valem para qualquer projeto, independente da tecnologia — Git, segurança, testes, observabilidade, code review e uso de agentes de IA.
versions: { node: "22", typescript: "5" }
owners: ["@caiiohenryk"]
---

# AGENTS.md — <nome do projeto>

Este arquivo é a **fonte única de verdade** para qualquer agente de IA (Claude, GPT/Codex, Gemini,
Cursor, Copilot…) e para pessoas que trabalham neste repositório. Arquivos específicos de
ferramenta (`CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`) MUST apenas
referenciar este arquivo. As palavras MUST / MUST NOT / SHOULD / MAY seguem a RFC 2119.

Esta é a base genérica. Projetos de uma tecnologia específica (Next.js, NestJS, Terraform) MUST
usar o AGENTS.md da tecnologia, obtido com o tool MCP `get_project_bootstrap`.

## Como usar este arquivo

1. Leia este arquivo inteiro antes de qualquer alteração.
2. Antes de escrever código, consulte o servidor MCP de standards da organização:
   - `list_standards` para ver os documentos disponíveis para a tecnologia do projeto;
   - `search_standards` com o tema da tarefa (ex.: "logs estruturados", "commits");
   - `get_standard` para ler na íntegra cada documento relevante.
3. Regras `MUST`/`MUST NOT` são obrigatórias. Se uma tarefa exigir violar uma delas, pare e peça
   decisão humana explícita; não contorne.
4. Regras `SHOULD` são o padrão; desvios MUST ser justificados no PR.
5. Em conflito, a ordem de precedência é: instrução explícita da pessoa responsável > este arquivo
   > standards do MCP > convenções da ferramenta.

## Stack e versões

| Camada    | Versão                    |
| --------- | ------------------------- |
| Runtime   | <runtime e versão fixada> |
| Linguagem | <linguagem e versão>      |
| Testes    | <framework de testes>     |
| CI        | <provedor de CI>          |

Versões fixadas em arquivos de lock MUST ser commitadas. Mudar a stack exige ADR em `docs/adr/`.

## Comandos

```bash
<instalar dependências>
<lint>
<typecheck>
<testes>
<build>
<check completo — MUST passar antes de concluir qualquer tarefa>
```

## Estrutura de pastas

```
docs/adr/      decisões de arquitetura (uma por arquivo, numeradas)
src/           código da aplicação
tests/         testes que não ficam ao lado do código (e2e, carga)
<outras pastas específicas do projeto>
```

## Regras invioláveis

- MUST NOT commitar segredos, chaves ou `.env` reais (`SHARED-SEC-001`).
- MUST NOT pular hooks (`--no-verify`) nem desabilitar lint/testes para "passar" (`SHARED-AI-004`).
- MUST NOT fazer push direto na branch principal; todo código entra por PR revisado
  (`SHARED-GIT-003`).
- MUST NOT registrar dados pessoais ou credenciais em logs (`SHARED-OBS-003`).
- MUST NOT adicionar dependência sem justificativa no PR e sem verificar licença e manutenção
  (`SHARED-SEC-005`).
- MUST escrever commits no padrão Conventional Commits (`SHARED-GIT-004`).
- MUST cobrir com teste todo bug corrigido (`SHARED-TEST-004`).

## Definition of Done

1. O check completo do projeto passa localmente e no CI.
2. Comportamento novo ou alterado está coberto por testes.
3. Documentação afetada (README, ADR, `.env.example`, este arquivo) está atualizada.
4. PR pequeno, com descrição do porquê, como testar e riscos.
5. Nenhum `TODO` sem issue vinculada.

## Standards relacionados

- `shared/git-workflow`
- `shared/security-baseline`
- `shared/testing-strategy`
- `shared/observability`
- `shared/code-review`
- `shared/ai-assisted-development`
