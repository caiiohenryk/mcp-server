---
id: terraform/security
title: Segurança em Terraform
technology: terraform
version: 1
status: stable
severity: MUST
summary: Como manter segredos fora do código e do plan, aplicar menor privilégio em IAM, criptografar por padrão e barrar configurações inseguras com trivy ou checkov no CI.
tags: [terraform, opentofu, security, secrets, iam, encryption, trivy, checkov]
applies_to: ["**/*.tf", "**/*.tfvars"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [terraform/state-and-backends, terraform/ci-cd, shared/security-baseline]
---

# Segurança em Terraform

Infraestrutura insegura raramente vem de um ataque sofisticado: vem de um bucket público, de uma
política `*` ou de uma senha no `tfvars`. Estas regras complementam `shared/security-baseline`.

### TF-SEC-001 [MUST NOT] Escreva segredos em .tf, .tfvars ou defaults de variáveis

**Por quê:** tudo que está no repositório vaza com o repositório. Segredos MUST vir de um secret
manager (lidos por data source) ou ser gerados pelo próprio Terraform e gravados no secret manager.

✅ Correto:

```hcl
data "aws_secretsmanager_secret_version" "stripe" {
  secret_id = "acme/prod/stripe-api-key"
}

resource "aws_db_instance" "this" {
  manage_master_user_password = true # senha criada e rotacionada pelo Secrets Manager
}
```

❌ Errado:

```hcl
variable "db_password" {
  default = "Sup3rS3cret!"
}
```

### TF-SEC-002 [MUST] Marque como sensitive toda variável e output que carregue segredo

**Por quê:** sem `sensitive = true` o valor aparece no plan, que fica no log do CI e no comentário
do PR.

✅ Correto:

```hcl
variable "api_token" {
  description = "Token injected by the pipeline from the secret manager."
  type        = string
  sensitive   = true
}
```

❌ Errado:

```hcl
variable "api_token" {
  type = string
}
```

### TF-SEC-003 [MUST] Conceda IAM com menor privilégio, sem curinga em actions e resources

**Por quê:** `"Action": "*"` ou `"Resource": "*"` transforma qualquer vazamento de credencial em
comprometimento total da conta. Liste ações e ARNs explícitos e use `aws_iam_policy_document`.

✅ Correto:

```hcl
data "aws_iam_policy_document" "app" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
}
```

❌ Errado:

```hcl
policy = jsonencode({
  Version   = "2012-10-17"
  Statement = [{ Effect = "Allow", Action = "*", Resource = "*" }]
})
```

### TF-SEC-004 [MUST] Criptografe armazenamento em repouso e exija TLS em trânsito

**Por quê:** criptografia é barata e muitas normas (LGPD, PCI) a exigem. Habilite em buckets,
volumes, bancos, filas e logs; negue requisições sem TLS.

✅ Correto:

```hcl
resource "aws_db_instance" "this" {
  storage_encrypted = true
  kms_key_id        = aws_kms_key.data.arn
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
  }
}
```

❌ Errado:

```hcl
resource "aws_db_instance" "this" {
  storage_encrypted = false
}
```

### TF-SEC-005 [MUST NOT] Exponha portas administrativas ou bancos para 0.0.0.0/0

**Por quê:** SSH, RDP e portas de banco abertas para a internet são varridas em minutos. Acesso
administrativo passa por SSM Session Manager ou VPN; bancos ficam em subnets privadas.

✅ Correto:

```hcl
resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
```

❌ Errado:

```hcl
ingress {
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
}
```

### TF-SEC-006 [MUST] Bloqueie acesso público em buckets por padrão

**Por quê:** buckets públicos acidentais são a causa mais comum de vazamento em nuvem. Conteúdo
público é servido via CDN com Origin Access Control, nunca pelo bucket aberto.

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
resource "aws_s3_bucket_acl" "this" {
  bucket = aws_s3_bucket.this.id
  acl    = "public-read"
}
```

### TF-SEC-007 [MUST] Rode trivy ou checkov no CI e bloqueie achados HIGH e CRITICAL

**Por quê:** revisão humana não pega toda configuração insegura. Scanners estáticos rodam em
segundos. Exceções MUST ser pontuais, no recurso, com justificativa.

✅ Correto:

```bash
trivy config --severity HIGH,CRITICAL --exit-code 1 .
```

```hcl
resource "aws_s3_bucket" "public_site" {
  #checkov:skip=CKV_AWS_18:Access logs disabled for static marketing site, approved in ADR-0012
  bucket = "acme-prod-site"
}
```

❌ Errado:

```bash
checkov -d . --soft-fail   # nunca falha o pipeline
```

### TF-SEC-008 [SHOULD] Proteja recursos com dados contra destruição acidental

**Por quê:** um rename sem `moved` ou um erro de `for_each` pode destruir um banco de produção.
`prevent_destroy` e `deletion_protection` obrigam uma mudança explícita antes da destruição.

✅ Correto:

```hcl
resource "aws_db_instance" "this" {
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-final"
  lifecycle {
    prevent_destroy = true
  }
}
```

❌ Errado:

```hcl
resource "aws_db_instance" "this" {
  deletion_protection = false
  skip_final_snapshot = true
}
```

### TF-SEC-009 [SHOULD] Habilite logs de auditoria e de acesso nos recursos críticos

**Por quê:** sem CloudTrail, VPC Flow Logs e access logs não há como investigar um incidente.
Envie os logs para uma conta/bucket de log separado e imutável.

✅ Correto:

```hcl
resource "aws_flow_log" "this" {
  vpc_id               = aws_vpc.this.id
  traffic_type         = "ALL"
  log_destination_type = "s3"
  log_destination      = var.central_log_bucket_arn
}
```

❌ Errado:

```hcl
resource "aws_vpc" "this" {
  cidr_block = "10.0.0.0/16"
  # sem flow logs
}
```
