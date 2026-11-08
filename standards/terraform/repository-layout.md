---
id: terraform/repository-layout
title: Layout de repositório Terraform
technology: terraform
version: 1
status: stable
severity: MUST
summary: Como organizar um repositório de infraestrutura em modules/ e live/<env>/<component>, isolar ambientes por diretório e versionar lock files e arquivos padrão.
tags: [terraform, opentofu, repository, layout, environments]
applies_to: ["**/*.tf", "**/*.tfvars"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [terraform/modules, terraform/state-and-backends, terraform/ci-cd]
---

# Layout de repositório Terraform

Define a estrutura de diretórios de qualquer repositório de infraestrutura com Terraform ≥ 1.9 ou
OpenTofu ≥ 1.8. O objetivo é que cada `plan` tenha raio de impacto pequeno e previsível e que
qualquer pessoa (ou agente) saiba onde cada recurso vive.

### TF-REPO-001 [MUST] Separe módulos reutilizáveis de root modules em modules/ e live/

**Por quê:** módulos reutilizáveis não podem conhecer backend, conta ou ambiente; root modules são
os únicos lugares onde `terraform init/plan/apply` rodam. Misturar os dois gera módulos acoplados a
um ambiente e estados difíceis de mover.

✅ Correto:

```text
modules/
  vpc/
  rds-postgres/
live/
  dev/network/
  dev/database/
  prod/network/
  prod/database/
```

❌ Errado:

```text
main.tf          # tudo no mesmo diretório, todos os ambientes
vpc.tf
rds.tf
dev.tfvars
prod.tfvars
```

### TF-REPO-002 [MUST] Isole ambientes por diretório, não por workspaces

**Por quê:** workspaces compartilham código, backend e credenciais; um `terraform workspace select`
esquecido aplica em produção. Diretórios por ambiente tornam o alvo explícito no caminho, no
pipeline e na revisão, e permitem contas de nuvem diferentes por ambiente.

✅ Correto:

```bash
terraform -chdir=live/prod/database plan -out=tfplan
```

❌ Errado:

```bash
terraform workspace select prod
terraform plan -var-file=prod.tfvars
```

### TF-REPO-003 [MUST] Commite o .terraform.lock.hcl de todo root module

**Por quê:** o lock file fixa versão e hashes dos providers. Sem ele, cada `init` pode baixar uma
versão diferente e o plan do CI deixa de ser reprodutível. Gere hashes para todas as plataformas
usadas (macOS e Linux).

✅ Correto:

```bash
terraform -chdir=live/dev/network providers lock \
  -platform=linux_amd64 -platform=darwin_arm64
git add live/dev/network/.terraform.lock.hcl
```

❌ Errado:

```gitignore
.terraform.lock.hcl
```

### TF-REPO-004 [MUST] Ignore estado, planos e diretórios de cache no Git

**Por quê:** `*.tfstate` e `*.tfplan` contêm segredos em texto puro; `.terraform/` contém binários
de providers. Nada disso pode ir para o repositório.

✅ Correto:

```gitignore
.terraform/
*.tfstate
*.tfstate.*
*.tfplan
tfplan
crash.log
override.tf
*_override.tf
```

❌ Errado:

```bash
git add live/prod/database/terraform.tfstate
```

### TF-REPO-005 [MUST] Divida cada root module por componente com ciclo de vida próprio

**Por quê:** um único estado com rede, banco e aplicação faz cada plan tocar centenas de recursos,
aumenta o tempo de lock e o risco de destruir algo não relacionado. Separe por ritmo de mudança e
dono: rede, dados, computação, DNS.

✅ Correto:

```text
live/prod/network/      # VPC, subnets, NAT — muda raramente
live/prod/database/     # RDS, parâmetros
live/prod/app/          # ECS/EKS, ALB — muda a cada release
```

❌ Errado:

```text
live/prod/main.tf       # 400 recursos de todos os domínios num só estado
```

### TF-REPO-006 [MUST] Use os nomes de arquivo padrão em cada módulo

**Por quê:** nomes previsíveis permitem que pessoas, agentes e ferramentas encontrem entradas,
saídas e versões sem ler o módulo inteiro.

✅ Correto:

```text
versions.tf    # terraform { required_version, required_providers }
providers.tf   # só em root modules
backend.tf     # só em root modules
main.tf        # recursos (ou arquivos por domínio: iam.tf, sg.tf)
variables.tf
outputs.tf
locals.tf
```

❌ Errado:

```text
stuff.tf       # variables, outputs e recursos misturados
vars-new.tf
```

### TF-REPO-007 [SHOULD] Passe valores por ambiente em terraform.tfvars do próprio diretório

**Por quê:** com um `terraform.tfvars` dentro de `live/<env>/<component>` o valor é carregado
automaticamente e não depende de lembrar um `-var-file`. Segredos nunca entram nesse arquivo.

✅ Correto:

```hcl
# live/prod/database/terraform.tfvars
instance_class    = "db.r6g.large"
allocated_storage = 200
multi_az          = true
```

❌ Errado:

```bash
terraform plan -var="instance_class=db.r6g.large" -var="multi_az=true"
```

### TF-REPO-008 [SHOULD] Compartilhe dados entre componentes por outputs lidos com data sources

**Por quê:** ler o estado de outro componente acopla ambos ao formato interno do estado e exige
permissão de leitura ao bucket inteiro. Prefira consultar o recurso por tags/nome com data source
ou publicar valores no SSM Parameter Store.

✅ Correto:

```hcl
data "aws_vpc" "main" {
  tags = { Name = "acme-prod-main" }
}
```

❌ Errado:

```hcl
data "terraform_remote_state" "network" {
  backend = "s3"
  config  = { bucket = "acme-tfstate", key = "prod/network/terraform.tfstate", region = "us-east-1" }
}
```

### TF-REPO-009 [MAY] Use um wrapper como Terragrunt para reduzir repetição de backend

**Por quê:** com muitos componentes, a configuração de backend e provider se repete. Um wrapper é
aceitável desde que o layout `live/<env>/<component>` e as demais regras continuem valendo e a
escolha esteja registrada em ADR.
