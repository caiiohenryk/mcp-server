---
id: terraform/testing
title: Testes de infraestrutura Terraform
technology: terraform
version: 1
status: stable
severity: MUST
summary: Como testar módulos com terraform test (arquivos .tftest.hcl), mock providers, asserts em plan e apply, e quando recorrer a Terratest ou checks de pós-condição.
tags: [terraform, opentofu, testing, tftest, mock-provider, terratest]
applies_to: ["modules/**/tests/*.tftest.hcl", "modules/**/*.tf"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [terraform/modules, terraform/ci-cd, shared/testing-strategy]
---

# Testes de infraestrutura Terraform

O framework nativo `terraform test` (Terraform ≥ 1.6, `tofu test` no OpenTofu ≥ 1.6) é o padrão
para módulos. Mock providers exigem Terraform ≥ 1.7 ou OpenTofu ≥ 1.8. Estratégia geral de testes
em `shared/testing-strategy`.

### TF-TEST-001 [MUST] Teste todo módulo reutilizável com arquivos .tftest.hcl

**Por quê:** módulos são consumidos por vários ambientes; uma regressão quebra todos. Os testes
ficam em `modules/<module>/tests/` e rodam com `terraform test` no diretório do módulo.

✅ Correto:

```text
modules/s3-bucket/
  main.tf variables.tf outputs.tf versions.tf
  tests/
    defaults.tftest.hcl
    validation.tftest.hcl
```

❌ Errado:

```text
modules/s3-bucket/
  main.tf variables.tf outputs.tf   # "testado" aplicando em dev manualmente
```

### TF-TEST-002 [MUST] Use command = plan e mock_provider nos testes unitários

**Por quê:** testes com `plan` e provider mockado rodam em segundos, sem credenciais nem custo, e
podem rodar em todo PR.

✅ Correto:

```hcl
# modules/s3-bucket/tests/defaults.tftest.hcl
mock_provider "aws" {}

variables {
  name = "acme-dev-app-logs"
}

run "blocks_public_access_by_default" {
  command = plan

  assert {
    condition     = aws_s3_bucket_public_access_block.this.block_public_acls == true
    error_message = "Public ACLs must be blocked by default."
  }
}
```

❌ Errado:

```hcl
run "creates_bucket" {
  # sem mock e sem command: aplica de verdade numa conta a cada PR
  assert {
    condition     = true
    error_message = "never fails"
  }
}
```

### TF-TEST-003 [MUST] Teste as validações de variáveis com expect_failures

**Por quê:** validações protegem contra entradas erradas; se pararem de rejeitar o valor inválido,
ninguém percebe. `expect_failures` falha o teste se a validação não disparar.

✅ Correto:

```hcl
mock_provider "aws" {}

run "rejects_invalid_environment" {
  command = plan
  variables {
    environment = "producao"
  }
  expect_failures = [var.environment]
}
```

❌ Errado:

```hcl
run "valid_input_only" {
  command = plan
  variables {
    environment = "dev"
  }
}
```

### TF-TEST-004 [MUST] Escreva asserts sobre comportamento, não sobre valores repetidos do código

**Por quê:** um assert que só copia o literal do recurso não protege nada. Teste regras derivadas:
nomes calculados, tags aplicadas, condicionais, contagens de `for_each`.

✅ Correto:

```hcl
run "creates_one_subnet_per_az" {
  command = plan
  variables {
    azs = ["us-east-1a", "us-east-1b", "us-east-1c"]
  }
  assert {
    condition     = length(aws_subnet.private) == 3
    error_message = "Expected one private subnet per AZ."
  }
}
```

❌ Errado:

```hcl
run "bucket_name" {
  command = plan
  assert {
    condition     = aws_s3_bucket.this.bucket == aws_s3_bucket.this.bucket
    error_message = "tautology"
  }
}
```

### TF-TEST-005 [MUST] Rode terraform test no CI para todo módulo alterado

**Por quê:** teste que não roda no pipeline apodrece. O job falha o PR quando qualquer `run` falha.

✅ Correto:

```yaml
- run: terraform -chdir=modules/s3-bucket init -backend=false
- run: terraform -chdir=modules/s3-bucket test
```

❌ Errado:

```yaml
- run: terraform -chdir=modules/s3-bucket test || echo "tests failed, continuing"
```

### TF-TEST-006 [SHOULD] Declare invariantes com precondition, postcondition e check

**Por quê:** condições no próprio código valem em todo plan/apply de todo ambiente, não só no
teste. `precondition` valida entradas combinadas; `postcondition` valida o resultado do provedor.

✅ Correto:

```hcl
resource "aws_db_instance" "this" {
  lifecycle {
    precondition {
      condition     = var.environment != "prod" || var.multi_az
      error_message = "Production databases must be Multi-AZ."
    }
  }
}
```

❌ Errado:

```hcl
# comentário: "lembre de ligar multi_az em prod"
resource "aws_db_instance" "this" {
  multi_az = var.multi_az
}
```

### TF-TEST-007 [SHOULD] Faça testes de integração com command = apply em conta sandbox

**Por quê:** mocks não pegam erros da API real (permissões, quotas, combinações inválidas). Para
módulos críticos, rode `apply` numa conta sandbox isolada; o `terraform test` destrói os recursos
ao final.

✅ Correto:

```hcl
# tests/integration.tftest.hcl — executado só no job agendado, conta sandbox
provider "aws" {
  region = "us-east-1"
}

run "bucket_is_created" {
  command = apply
  assert {
    condition     = startswith(aws_s3_bucket.this.arn, "arn:aws:s3:::")
    error_message = "Bucket ARN not returned by AWS."
  }
}
```

❌ Errado:

```hcl
provider "aws" {
  region  = "us-east-1"
  profile = "prod" # teste de integração apontando para produção
}
```

### TF-TEST-008 [MAY] Use Terratest para cenários end-to-end que exigem código

**Por quê:** quando o teste precisa chamar a aplicação provisionada (HTTP, SQL) ou orquestrar vários
módulos, Terratest (Go) oferece mais flexibilidade que `.tftest.hcl`. Mantenha-o fora do caminho
crítico do PR e rode em conta sandbox.
