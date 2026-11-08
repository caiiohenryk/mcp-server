---
id: terraform/naming-and-tagging
title: Nomenclatura e tags em Terraform
technology: terraform
version: 1
status: stable
severity: MUST
summary: Convenção de nomes para recursos na nuvem e endereços Terraform, e tags obrigatórias aplicadas via default_tags para custo, dono e rastreabilidade.
tags: [terraform, opentofu, naming, tagging, default-tags, finops]
applies_to: ["**/*.tf"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [terraform/modules, terraform/repository-layout]
---

# Nomenclatura e tags em Terraform

Nomes e tags consistentes permitem achar o dono de um recurso, ratear custo e escrever políticas
IAM por prefixo. Valem para qualquer provedor; exemplos usam AWS.

### TF-NAME-001 [MUST] Nomeie recursos na nuvem como <org>-<env>-<component>-<name>

**Por quê:** um padrão único torna nomes previsíveis, evita colisão entre ambientes na mesma conta
e permite políticas IAM com curingas (`acme-prod-*`). Use só minúsculas, dígitos e hífen.

✅ Correto:

```hcl
locals {
  name_prefix = "${var.org}-${var.environment}-${var.component}"
}

resource "aws_s3_bucket" "logs" {
  bucket = "${local.name_prefix}-logs" # acme-prod-app-logs
}
```

❌ Errado:

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "LogsBucket_Prod2"
}
```

### TF-NAME-002 [MUST] Use snake_case nos identificadores Terraform e não repita o tipo

**Por quê:** o endereço `aws_s3_bucket.logs` já diz o tipo; `aws_s3_bucket.logs_bucket` é ruído.
Quando o módulo cria um único recurso de um tipo, chame-o de `this`.

✅ Correto:

```hcl
resource "aws_security_group" "this" {}
resource "aws_iam_role" "task_execution" {}
variable "retention_in_days" {}
```

❌ Errado:

```hcl
resource "aws_security_group" "security-group" {}
resource "aws_iam_role" "TaskExecutionRole" {}
variable "RetentionDays" {}
```

### TF-NAME-003 [MUST] Aplique as tags obrigatórias via default_tags no provider

**Por quê:** `default_tags` garante as tags em todo recurso suportado sem depender de cada autor
lembrar. Tags obrigatórias: `Project`, `Environment`, `Component`, `Owner`, `ManagedBy`,
`Repository`.

✅ Correto:

```hcl
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "acme-checkout"
      Environment = "prod"
      Component   = "app"
      Owner       = "team-payments"
      ManagedBy   = "terraform"
      Repository  = "github.com/acme/infra"
    }
  }
}
```

❌ Errado:

```hcl
resource "aws_instance" "api" {
  tags = { Name = "api" } # sem dono, ambiente ou projeto
}
```

### TF-NAME-004 [MUST] Valide os valores de tag obrigatórios nas variáveis

**Por quê:** uma tag `Environment = "Prod "` quebra relatórios de custo e políticas. Valide os
valores na entrada.

✅ Correto:

```hcl
variable "owner" {
  description = "Team that owns the resources (team-<name>)."
  type        = string
  validation {
    condition     = can(regex("^team-[a-z0-9-]+$", var.owner))
    error_message = "owner must match team-<name>."
  }
}
```

❌ Errado:

```hcl
variable "owner" {
  type    = string
  default = ""
}
```

### TF-NAME-005 [SHOULD] Adicione a tag Name e tags específicas no recurso, sem repetir as padrão

**Por quê:** `Name` aparece no console e diferencia recursos do mesmo tipo. Repetir as tags de
`default_tags` em cada recurso gera diffs perpétuos quando os valores divergem.

✅ Correto:

```hcl
resource "aws_instance" "bastion" {
  tags = {
    Name = "${local.name_prefix}-bastion"
  }
}
```

❌ Errado:

```hcl
resource "aws_instance" "bastion" {
  tags = {
    Name        = "bastion"
    Project     = "acme-checkout"
    Environment = "prod"
    Owner       = "team-payments"
  }
}
```

### TF-NAME-006 [SHOULD] Gere sufixos aleatórios só para nomes que exigem unicidade global

**Por quê:** nomes globais (buckets S3) colidem entre contas; para eles use `random_id` com
`keepers`. Para os demais, sufixo aleatório só dificulta encontrar o recurso.

✅ Correto:

```hcl
resource "random_id" "bucket" {
  byte_length = 4
  keepers     = { env = var.environment }
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "${local.name_prefix}-artifacts-${random_id.bucket.hex}"
}
```

❌ Errado:

```hcl
resource "aws_iam_role" "app" {
  name = "role-${uuid()}" # muda a cada plan e força recriação
}
```

### TF-NAME-007 [MAY] Centralize nomes e tags em um módulo de labels

**Por quê:** em organizações com muitos repositórios, um módulo `labels` que recebe org, ambiente
e componente e devolve `name_prefix` e `tags` evita divergências. Versione-o como qualquer módulo.
