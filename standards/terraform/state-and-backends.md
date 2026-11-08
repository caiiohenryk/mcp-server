---
id: terraform/state-and-backends
title: Estado remoto e backends
technology: terraform
version: 1
status: stable
severity: MUST
summary: Como configurar estado remoto criptografado com lock, um estado por ambiente e componente, e alterar o estado apenas com blocos moved, import e removed revisados no PR.
tags: [terraform, opentofu, state, backend, s3, locking, import]
applies_to: ["live/**/backend.tf", "live/**/*.tf"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [terraform/repository-layout, terraform/security, terraform/ci-cd]
---

# Estado remoto e backends

O estado é a fonte da verdade do que o Terraform gerencia e contém segredos em texto puro. Estas
regras valem para Terraform ≥ 1.9 e OpenTofu ≥ 1.8; exemplos usam o backend S3 (AWS). Para GCS ou
azurerm, aplique as mesmas garantias: remoto, criptografado, versionado e com lock.

### TF-STATE-001 [MUST] Use backend remoto com criptografia e versionamento

**Por quê:** estado local se perde, não é compartilhado e fica no disco de quem rodou. O bucket de
estado MUST ter criptografia, versionamento (para recuperar estados corrompidos) e bloqueio de
acesso público.

✅ Correto:

```hcl
# live/prod/database/backend.tf
terraform {
  backend "s3" {
    bucket       = "acme-tfstate-prod"
    key          = "prod/database/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

❌ Errado:

```hcl
terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}
```

### TF-STATE-002 [MUST] Habilite lock de estado

**Por quê:** dois applies simultâneos no mesmo estado corrompem o estado e a infraestrutura. Com
Terraform ≥ 1.10 ou OpenTofu ≥ 1.10 use `use_lockfile = true` (lock nativo no S3). Em projetos
ainda em 1.9, use `dynamodb_table` até migrar.

✅ Correto:

```hcl
# Terraform/OpenTofu >= 1.10
backend "s3" {
  bucket       = "acme-tfstate-prod"
  key          = "prod/app/terraform.tfstate"
  region       = "us-east-1"
  encrypt      = true
  use_lockfile = true
}
```

❌ Errado:

```hcl
backend "s3" {
  bucket = "acme-tfstate-prod"
  key    = "prod/app/terraform.tfstate"
  region = "us-east-1"
  # sem lock: applies concorrentes sobrescrevem o estado
}
```

### TF-STATE-003 [MUST] Mantenha um estado por ambiente e componente

**Por quê:** o `key` do estado espelha o caminho `live/<env>/<component>`. Isso limita o raio de
impacto de cada apply e permite permissões IAM por ambiente. Produção MUST ter bucket (idealmente
conta) próprio.

✅ Correto:

```text
s3://acme-tfstate-prod/prod/network/terraform.tfstate
s3://acme-tfstate-prod/prod/app/terraform.tfstate
s3://acme-tfstate-nonprod/dev/app/terraform.tfstate
```

❌ Errado:

```text
s3://acme-tfstate/terraform.tfstate      # todos os ambientes e componentes juntos
```

### TF-STATE-004 [MUST NOT] Interpole variáveis ou locals no bloco backend

**Por quê:** o backend é lido antes das variáveis, então interpolação não funciona e leva a
"soluções" com `-backend-config` montado à mão, que apontam para o estado errado. Escreva valores
literais por diretório.

✅ Correto:

```hcl
backend "s3" {
  bucket = "acme-tfstate-nonprod"
  key    = "dev/app/terraform.tfstate"
  region = "us-east-1"
}
```

❌ Errado:

```hcl
backend "s3" {
  bucket = "acme-tfstate-${var.environment}"
  key    = "${local.component}/terraform.tfstate"
}
```

### TF-STATE-005 [MUST] Altere o estado com blocos moved, import e removed, nunca via CLI

**Por quê:** `terraform state mv/rm` e `terraform import` alteram o estado sem revisão, sem plan e
sem rastro no Git. Os blocos `moved` (≥ 1.1), `import` (≥ 1.5) e `removed` (≥ 1.7) existem em
Terraform e OpenTofu, aparecem no plan e passam por PR.

✅ Correto:

```hcl
import {
  to = aws_s3_bucket.logs
  id = "acme-prod-logs"
}

removed {
  from = aws_instance.legacy
  lifecycle {
    destroy = false
  }
}
```

❌ Errado:

```bash
terraform import aws_s3_bucket.logs acme-prod-logs
terraform state rm aws_instance.legacy
```

### TF-STATE-006 [MUST] Restrinja o acesso ao bucket de estado ao pipeline e a administradores

**Por quê:** o estado contém senhas, chaves e endpoints. Quem lê o estado lê os segredos. Conceda
leitura/escrita apenas aos papéis de CI do ambiente e a um grupo break-glass auditado.

✅ Correto:

```hcl
data "aws_iam_policy_document" "tfstate" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.tfstate.arn}/prod/*"]
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.ci_prod.arn]
    }
  }
}
```

❌ Errado:

```hcl
principals {
  type        = "AWS"
  identifiers = ["*"]
}
```

### TF-STATE-007 [MUST] Crie a infraestrutura de estado em um bootstrap separado

**Por quê:** o bucket que guarda o estado não pode depender do próprio estado. Mantenha
`live/<conta>/bootstrap` com estado inicialmente local, migre-o para o bucket criado e proteja o
bucket com `prevent_destroy`.

✅ Correto:

```hcl
resource "aws_s3_bucket" "tfstate" {
  bucket = "acme-tfstate-prod"
  lifecycle {
    prevent_destroy = true
  }
}
```

❌ Errado:

```hcl
# live/prod/app/main.tf — o componente cria o bucket do seu próprio estado
resource "aws_s3_bucket" "tfstate" {
  bucket = "acme-tfstate-prod"
}
```

### TF-STATE-008 [SHOULD NOT] Use terraform_remote_state para ler outros componentes

**Por quê:** exige leitura do estado inteiro do outro componente (incluindo segredos) e acopla ao
seu layout interno. Prefira data sources por tag/nome ou parâmetros publicados no SSM.

✅ Correto:

```hcl
data "aws_ssm_parameter" "vpc_id" {
  name = "/acme/prod/network/vpc_id"
}
```

❌ Errado:

```hcl
data "terraform_remote_state" "network" {
  backend = "s3"
  config  = { bucket = "acme-tfstate-prod", key = "prod/network/terraform.tfstate", region = "us-east-1" }
}
```

### TF-STATE-009 [MAY] Use criptografia de estado do OpenTofu quando o projeto usar OpenTofu

**Por quê:** o OpenTofu ≥ 1.7 oferece criptografia client-side do estado (bloco `encryption`), que
protege segredos mesmo para quem lê o bucket. O recurso não existe no Terraform; adote-o só em
projetos que fixaram OpenTofu e registraram a decisão em ADR.
