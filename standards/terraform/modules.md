---
id: terraform/modules
title: Módulos Terraform
technology: terraform
version: 1
status: stable
severity: MUST
summary: Como escrever módulos reutilizáveis — interface mínima, versões fixadas, variáveis tipadas e validadas, outputs documentados, refatoração com moved e consumo por versão.
tags: [terraform, opentofu, modules, variables, outputs, refactoring]
applies_to: ["modules/**/*.tf"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [terraform/repository-layout, terraform/testing, terraform/naming-and-tagging]
---

# Módulos Terraform

Regras para módulos em `modules/` (ou em repositórios de módulos) com Terraform ≥ 1.9 e OpenTofu ≥
1.8. Um módulo é uma API: entradas tipadas, saídas estáveis e nenhuma suposição sobre o ambiente
em que roda.

### TF-MOD-001 [MUST NOT] Configure provider ou backend dentro de módulos reutilizáveis

**Por quê:** um bloco `provider` com região ou credenciais dentro do módulo impede reutilizá-lo em
outra conta/região, quebra `count`/`for_each` no módulo e torna a remoção do módulo impossível
sem erro. Módulos só declaram `required_providers`; quem configura é o root module.

✅ Correto:

```hcl
# modules/s3-bucket/versions.tf
terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}
```

❌ Errado:

```hcl
# modules/s3-bucket/main.tf
provider "aws" {
  region = "us-east-1"
}
```

### TF-MOD-002 [MUST] Fixe required_version e versões de provider

**Por quê:** sem restrição, um `init` pega um major novo com breaking changes. Em root modules use
`~>` no minor para receber só patches/minors controlados; em módulos reutilizáveis declare o
mínimo (`>=`) e deixe o root module fixar.

✅ Correto:

```hcl
# live/prod/app/versions.tf
terraform {
  required_version = ">= 1.9, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}
```

❌ Errado:

```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}
```

### TF-MOD-003 [MUST] Declare type e description em toda variável

**Por quê:** `type` faz o Terraform rejeitar entrada errada no plan, e `description` é a
documentação lida por pessoas, por `terraform-docs` e por agentes. Use objetos tipados em vez de
`map(any)`.

✅ Correto:

```hcl
variable "scaling" {
  description = "Autoscaling limits for the service."
  type = object({
    min = number
    max = number
  })
  default = { min = 1, max = 3 }
}
```

❌ Errado:

```hcl
variable "scaling" {
  default = {}
}
```

### TF-MOD-004 [MUST] Valide entradas com blocos validation

**Por quê:** erros de valor (CIDR inválido, ambiente inexistente) devem falhar no plan com
mensagem clara, não no meio do apply com erro da API do provedor.

✅ Correto:

```hcl
variable "environment" {
  description = "Deployment environment."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "cidr_block" {
  description = "VPC CIDR block."
  type        = string
  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "cidr_block must be a valid IPv4 CIDR."
  }
}
```

❌ Errado:

```hcl
variable "environment" {
  type = string # "producao" só falha no apply, ou nunca
}
```

### TF-MOD-005 [MUST] Marque como sensitive variáveis e outputs com segredos

**Por quê:** `sensitive = true` impede que o valor apareça no plan, no log do CI e na saída do
`apply`. O valor continua no estado, por isso o estado também precisa ser protegido.

✅ Correto:

```hcl
output "db_password" {
  description = "Master password, consumed only by the secrets module."
  value       = random_password.master.result
  sensitive   = true
}
```

❌ Errado:

```hcl
output "db_password" {
  value = random_password.master.result
}
```

### TF-MOD-006 [MUST] Use for_each com chaves estáveis em vez de count para coleções

**Por quê:** com `count`, remover um item do meio da lista renumera os índices e o Terraform
destrói e recria todos os recursos seguintes. `for_each` endereça por chave.

✅ Correto:

```hcl
resource "aws_iam_user" "this" {
  for_each = toset(var.user_names)
  name     = each.key
}
```

❌ Errado:

```hcl
resource "aws_iam_user" "this" {
  count = length(var.user_names)
  name  = var.user_names[count.index]
}
```

### TF-MOD-007 [MUST] Use blocos moved ao renomear ou reorganizar recursos

**Por quê:** renomear um recurso sem `moved` gera destroy + create. O bloco `moved` fica no código,
é revisado no PR e funciona em todos os ambientes, inclusive para consumidores do módulo.

✅ Correto:

```hcl
moved {
  from = aws_s3_bucket.bucket
  to   = aws_s3_bucket.this
}
```

❌ Errado:

```bash
terraform state mv aws_s3_bucket.bucket aws_s3_bucket.this   # só no estado de quem rodou
```

### TF-MOD-008 [MUST] Consuma módulos remotos por versão imutável

**Por quê:** referenciar uma branch faz o mesmo código gerar planos diferentes ao longo do tempo.
Use tag semântica (Git) ou `version` exata/`~>` (registry).

✅ Correto:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.16"
}

module "bucket" {
  source = "git::https://github.com/acme/tf-modules.git//s3-bucket?ref=v2.3.1"
}
```

❌ Errado:

```hcl
module "bucket" {
  source = "git::https://github.com/acme/tf-modules.git//s3-bucket?ref=main"
}
```

### TF-MOD-009 [SHOULD] Mantenha a interface do módulo pequena e com defaults seguros

**Por quê:** módulos que expõem cada argumento do recurso viram wrappers sem valor. Exponha o que
varia entre usos e fixe internamente as escolhas da empresa (criptografia, bloqueio de acesso
público, versionamento).

✅ Correto:

```hcl
resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

❌ Errado:

```hcl
variable "block_public_acls" { default = false }
variable "block_public_policy" { default = false }
variable "ignore_public_acls" { default = false }
```

### TF-MOD-010 [SHOULD] Documente o módulo com README gerado por terraform-docs

**Por quê:** o README gerado a partir de `variables.tf` e `outputs.tf` nunca fica desatualizado e
dá a agentes a interface do módulo sem ler a implementação.

✅ Correto:

```bash
terraform-docs markdown table --output-file README.md --output-mode inject modules/s3-bucket
```

❌ Errado:

```markdown
# s3-bucket

Cria um bucket. Veja o código para as variáveis.
```

### TF-MOD-011 [SHOULD NOT] Use null_resource ou local-exec para contornar o provider

**Por quê:** scripts em `local-exec` não têm plan, não são idempotentes e dependem da máquina que
roda o apply. Use o recurso nativo do provider ou `terraform_data` apenas para gatilhos.

✅ Correto:

```hcl
resource "aws_ssm_parameter" "endpoint" {
  name  = "/acme/prod/db/endpoint"
  type  = "String"
  value = aws_db_instance.this.address
}
```

❌ Errado:

```hcl
resource "null_resource" "param" {
  provisioner "local-exec" {
    command = "aws ssm put-parameter --name /acme/prod/db/endpoint --value ${aws_db_instance.this.address}"
  }
}
```
