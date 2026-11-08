---
id: terraform/ci-cd
title: CI/CD para Terraform
technology: terraform
version: 1
status: stable
severity: MUST
summary: Pipeline de infraestrutura — checagens estáticas e plan em todo PR, apply somente a partir da main com o plan salvo, credenciais via OIDC e aprovação para produção.
tags: [terraform, opentofu, ci-cd, github-actions, oidc, plan, apply]
applies_to: [".github/workflows/**", ".gitlab-ci.yml"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [terraform/security, terraform/state-and-backends, terraform/testing, shared/git-workflow]
---

# CI/CD para Terraform

Infraestrutura muda só pelo pipeline. Exemplos usam GitHub Actions; em outras ferramentas as
garantias são as mesmas: plan revisado no PR, apply a partir da `main`, credenciais temporárias.

### TF-CI-001 [MUST] Rode fmt, validate, tflint e scanner de segurança em todo PR

**Por quê:** falhas baratas devem quebrar o PR antes de chegar a um plan. `validate` exige `init`,
mas pode rodar sem backend.

✅ Correto:

```yaml
- run: terraform fmt -recursive -check
- run: terraform -chdir=live/prod/app init -backend=false
- run: terraform -chdir=live/prod/app validate
- run: tflint --recursive --format compact
- run: trivy config --severity HIGH,CRITICAL --exit-code 1 .
```

❌ Errado:

```yaml
- run: terraform plan || true
```

### TF-CI-002 [MUST] Aplique apenas a partir da main, pelo pipeline

**Por quê:** apply local ou de branch gera infraestrutura que não corresponde a nenhum commit
revisado. Pessoas e agentes MUST NOT rodar `apply` contra ambientes compartilhados.

✅ Correto:

```yaml
on:
  push:
    branches: [main]
jobs:
  apply:
    environment: prod
    steps:
      - run: terraform -chdir=live/prod/app apply -input=false tfplan
```

❌ Errado:

```bash
# na máquina do desenvolvedor, branch feature/x
terraform -chdir=live/prod/app apply -auto-approve
```

### TF-CI-003 [MUST] Autentique no provedor de nuvem via OIDC, sem chaves estáticas

**Por quê:** chaves de longa duração em secrets do CI vazam e raramente são rotacionadas. OIDC
emite credenciais de minutos, restritas ao repositório, branch e ambiente.

✅ Correto:

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gha-terraform-prod
      aws-region: us-east-1
```

❌ Errado:

```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### TF-CI-004 [MUST] Use papéis separados para plan e apply com trust restrito

**Por quê:** o job de PR roda código não revisado; ele MUST ter só leitura. O papel de apply só
pode ser assumido a partir da `main` e do environment protegido.

✅ Correto:

```hcl
data "aws_iam_policy_document" "apply_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:acme/infra:environment:prod"]
    }
  }
}
```

❌ Errado:

```hcl
condition {
  test     = "StringLike"
  variable = "token.actions.githubusercontent.com:sub"
  values   = ["repo:acme/*"]
}
```

### TF-CI-005 [MUST] Publique o plan no PR e aplique exatamente o plan revisado

**Por quê:** revisar HCL não basta; o revisor precisa ver o que será criado, alterado e destruído.
Aplicar o arquivo de plan salvo garante que nada mudou entre revisão e apply.

✅ Correto:

```yaml
- run: terraform -chdir=live/prod/app plan -input=false -lock-timeout=5m -out=tfplan
- run: terraform -chdir=live/prod/app show -no-color tfplan > plan.txt
- uses: actions/upload-artifact@v4
  with: { name: plan-prod-app, path: live/prod/app/tfplan }
```

❌ Errado:

```yaml
- run: terraform -chdir=live/prod/app apply -auto-approve # novo plan, não revisado
```

### TF-CI-006 [MUST] Exija aprovação manual para apply em produção

**Por quê:** um merge acidental não pode alterar produção sozinho. Use environments protegidos com
revisores obrigatórios e sem auto-aprovação pelo autor.

✅ Correto:

```yaml
jobs:
  apply-prod:
    environment:
      name: prod # required reviewers configurados no repositório
```

❌ Errado:

```yaml
jobs:
  apply-prod:
    runs-on: ubuntu-latest # sem environment, aplica direto após o merge
```

### TF-CI-007 [MUST] Serialize execuções por root module

**Por quê:** dois pipelines no mesmo estado brigam pelo lock ou aplicam planos obsoletos. Use
`concurrency` por diretório e não cancele um apply em andamento.

✅ Correto:

```yaml
concurrency:
  group: terraform-live-prod-app
  cancel-in-progress: false
```

❌ Errado:

```yaml
concurrency:
  group: terraform
  cancel-in-progress: true # pode interromper um apply no meio
```

### TF-CI-008 [SHOULD] Rode plan apenas nos root modules afetados pelo PR

**Por quê:** planejar todos os ambientes a cada PR é lento e polui a revisão. Detecte diretórios
alterados (inclusive módulos usados por eles) e gere uma matriz.

✅ Correto:

```yaml
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      prod-app: ['live/prod/app/**', 'modules/ecs-service/**']
```

❌ Errado:

```yaml
- run: for d in live/*/*; do terraform -chdir=$d plan; done
```

### TF-CI-009 [SHOULD] Detecte drift com plan agendado

**Por quê:** mudanças feitas no console divergem do código e explodem no próximo apply. Um plan
diário com `-detailed-exitcode` (código 2 = mudanças) abre alerta para o time dono.

✅ Correto:

```yaml
on:
  schedule:
    - cron: "0 9 * * 1-5"
steps:
  - run: terraform -chdir=live/prod/app plan -detailed-exitcode -input=false
```

❌ Errado:

```yaml
# sem verificação: o drift só é descoberto no próximo deploy
```

### TF-CI-010 [SHOULD] Fixe as versões de Terraform/OpenTofu e das ferramentas no pipeline

**Por quê:** `latest` faz o pipeline mudar de comportamento sem commit. Use a mesma versão do
`required_version` e das actions por tag de versão.

✅ Correto:

```yaml
- uses: hashicorp/setup-terraform@v3
  with:
    terraform_version: 1.10.5
```

❌ Errado:

```yaml
- uses: hashicorp/setup-terraform@main
  with:
    terraform_version: latest
```
