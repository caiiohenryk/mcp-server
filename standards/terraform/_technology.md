---
technology: terraform
name: Terraform
description: Infraestrutura como código com Terraform ≥ 1.9 e sintaxe compatível com OpenTofu — layout de repositório, módulos, estado remoto, segurança, CI/CD e testes.
versions: { terraform: ">=1.9", opentofu: ">=1.8" }
owners: ["@caiiohenryk"]
---

# AGENTS.md — <nome-do-repositório-de-infra>

Este arquivo é a fonte única de verdade para qualquer agente de IA (Claude, GPT/Codex, Gemini,
Cursor, Copilot…) e para pessoas que alteram a infraestrutura deste repositório. Arquivos
específicos de ferramenta (`CLAUDE.md`, `.cursor/rules`, etc.) apenas referenciam este arquivo.

As palavras MUST / MUST NOT / SHOULD / MAY seguem a RFC 2119.

## Como usar este arquivo

1. Antes de escrever ou alterar qualquer código HCL, consulte o servidor MCP de standards:
   - `list_standards` com `technology: "terraform"` para ver os documentos disponíveis;
   - `get_standard` para ler na íntegra o documento do tema da tarefa (ex.: `terraform/modules`
     ao criar um módulo, `terraform/state-and-backends` ao mexer em backend);
   - `search_standards` para dúvidas pontuais (ex.: "default_tags", "moved block").
2. Regras MUST/MUST NOT são obrigatórias. Se uma tarefa exigir violá-las, pare e peça decisão
   humana registrada em ADR; não contorne a regra.
3. Regras SHOULD só podem ser ignoradas com justificativa escrita no PR.
4. Cite o id da regra (ex.: `TF-STATE-002`) em comentários de revisão e descrições de PR.
5. Em caso de conflito, este arquivo e os standards prevalecem sobre exemplos da internet ou
   sobre o conhecimento prévio do modelo.

## Stack e versões

| Item           | Versão / escolha                                                  |
| -------------- | ----------------------------------------------------------------- |
| Terraform      | ≥ 1.9 (`required_version` fixado em cada root module)             |
| OpenTofu       | ≥ 1.8 (sintaxe MUST permanecer compatível com ambos)              |
| Provider AWS   | `~> <major>.<minor>` fixado em `required_providers`               |
| Estado remoto  | S3 criptografado + lock (`use_lockfile` ≥ 1.10 ou DynamoDB)       |
| Lint/segurança | `terraform fmt`, `terraform validate`, tflint, trivy ou checkov   |
| Testes         | `terraform test` / `tofu test` (`*.tftest.hcl`)                   |
| CI/CD          | <GitHub Actions/GitLab CI> com OIDC, plan no PR e apply na `main` |
| Projeto        | <nome do projeto>, contas/projetos de nuvem: <lista>              |

## Comandos

```bash
terraform fmt -recursive -check          # formatação (MUST passar)
terraform -chdir=live/<env>/<component> init
terraform -chdir=live/<env>/<component> validate
terraform -chdir=live/<env>/<component> plan -out=tfplan
tflint --recursive                       # lint
trivy config .                           # ou: checkov -d .
terraform -chdir=modules/<module> test   # testes do módulo
<comando extra do projeto>
```

Agentes MUST NOT executar `terraform apply`, `terraform destroy` ou `terraform state ...` contra
ambientes compartilhados. Apply acontece apenas no pipeline, a partir da `main`.

## Estrutura de pastas

```
modules/                 módulos reutilizáveis, sem backend nem provider configurado
  <module>/
    main.tf variables.tf outputs.tf versions.tf README.md
    tests/*.tftest.hcl
live/                    root modules: um diretório por ambiente e componente
  <env>/                 dev | staging | prod
    <component>/         network | database | app …
      backend.tf providers.tf main.tf variables.tf outputs.tf
      terraform.tfvars .terraform.lock.hcl
.tflint.hcl
.github/workflows/       plan e apply
```

- Cada diretório em `live/<env>/<component>` tem seu próprio estado.
- `modules/**` MUST NOT conter bloco `backend` nem `provider` configurado.
- Ambientes são isolados por diretório e conta/projeto de nuvem, não por workspaces.

## Regras invioláveis

- MUST NOT commitar segredos, `*.tfstate`, `*.tfplan` ou `.terraform/` (`TF-SEC-001`, `TF-REPO-004`).
- MUST commitar `.terraform.lock.hcl` de todo root module (`TF-REPO-003`).
- MUST fixar `required_version` e providers com `~>` (`TF-MOD-002`).
- MUST usar estado remoto criptografado com lock, um estado por ambiente e componente
  (`TF-STATE-001`, `TF-STATE-002`, `TF-STATE-003`).
- MUST NOT usar `terraform state mv/rm` ou `import` via CLI em ambientes compartilhados; use blocos
  `moved`, `removed` e `import` revisados no PR (`TF-STATE-005`).
- MUST aplicar tags padrão via `default_tags` (`TF-NAME-003`).
- MUST NOT usar credenciais estáticas no CI; use OIDC (`TF-CI-003`).
- MUST NOT aplicar a partir de máquina local ou de branch que não seja a `main` (`TF-CI-002`).
- MUST NOT usar `git commit --no-verify` nem pular hooks.

## Definition of Done

1. `terraform fmt -recursive -check`, `terraform validate` e `tflint` sem erros.
2. trivy/checkov sem achados HIGH/CRITICAL não justificados.
3. `terraform test` dos módulos alterados passando.
4. Plan de cada root module afetado anexado ao PR, revisado, sem destroy inesperado.
5. Variáveis novas com `description`, `type` e `validation` quando aplicável; outputs sensíveis
   marcados `sensitive = true`.
6. README do módulo atualizado quando entradas/saídas mudarem.
7. Nenhum `TODO` sem issue vinculada.

## Standards relacionados

- `terraform/repository-layout`
- `terraform/modules`
- `terraform/state-and-backends`
- `terraform/naming-and-tagging`
- `terraform/security`
- `terraform/ci-cd`
- `terraform/testing`
- `shared/git-workflow`
- `shared/security-baseline`
- `shared/code-review`
- `shared/ai-assisted-development`
