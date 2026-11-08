---
id: shared/security-baseline
title: Baseline de segurança
technology: shared
version: 1
status: stable
severity: MUST
summary: Controles mínimos de segurança para qualquer projeto — segredos, validação de entrada, dependências, autorização, criptografia e dados pessoais (LGPD).
tags: [security, secrets, owasp, dependencies, lgpd, authorization]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [shared/observability, shared/code-review, shared/ai-assisted-development]
---

# Baseline de segurança

Controles obrigatórios em todo projeto, independente de tecnologia. Os standards de cada
tecnologia detalham a implementação (ex.: `nextjs/security`, `nestjs/security`,
`terraform/security`); este documento define o mínimo comum, alinhado ao OWASP Top 10 e à LGPD.

### SHARED-SEC-001 [MUST NOT] Commite segredos no repositório

**Por quê:** qualquer segredo que entra no Git deve ser considerado vazado, mesmo após remoção,
porque permanece no histórico e em clones. Segredos vivem em um secret manager (AWS Secrets
Manager, GCP Secret Manager, Vault) ou nas variáveis protegidas do CI. O repositório MUST ter
`.env*` no `.gitignore`, um `.env.example` sem valores reais e varredura de segredos (ex.:
gitleaks) no pre-commit e no CI. Segredo vazado MUST ser rotacionado imediatamente.

✅ Correto:

```bash
# .env.example (commitado)
DATABASE_URL=postgres://user:password@localhost:5432/app
STRIPE_SECRET_KEY=

# .gitignore
.env
.env.*
!.env.example
```

❌ Errado:

```ts
const stripe = new Stripe("sk_live_51Hx9...realkey");
```

### SHARED-SEC-002 [MUST] Valide toda entrada externa na fronteira com schema

**Por quê:** corpo de requisição, query string, headers, mensagens de fila, webhooks e respostas de
APIs de terceiros são não confiáveis. Valide com schema declarativo (zod, class-validator) na
fronteira, rejeitando campos desconhecidos, e trabalhe só com o valor validado.

✅ Correto:

```ts
const CreateUser = z.object({ email: z.email(), name: z.string().min(1).max(100) }).strict();

export async function createUser(raw: unknown) {
  const input = CreateUser.parse(raw);
  return repo.insert(input);
}
```

❌ Errado:

```ts
export async function createUser(body: any) {
  return repo.insert(body); // aceita isAdmin: true vindo do cliente
}
```

### SHARED-SEC-003 [MUST] Use consultas parametrizadas e nunca concatene entrada em comandos

**Por quê:** concatenar entrada em SQL, shell, LDAP ou caminhos de arquivo é a origem de injeção.
Use o query builder/ORM ou parâmetros posicionais; para shell, passe argumentos como array sem
`shell: true`.

✅ Correto:

```ts
await sql`select * from users where email = ${email}`;
execFile("convert", [inputPath, "-resize", "200x200", outputPath]);
```

❌ Errado:

```ts
await db.query(`select * from users where email = '${email}'`);
exec(`convert ${req.query.file} -resize 200x200 out.png`);
```

### SHARED-SEC-004 [MUST] Autorize cada acesso a recurso no servidor

**Por quê:** autenticação diz quem é; autorização diz se pode. Toda operação MUST verificar no
servidor que o usuário tem permissão sobre aquele recurso específico (evita IDOR). Esconder botão
na UI não é controle de acesso. Negue por padrão.

✅ Correto:

```ts
const order = await orders.findById(id);
if (!order || order.ownerId !== user.id) throw new NotFoundError("order");
return order;
```

❌ Errado:

```ts
// qualquer usuário autenticado lê o pedido de qualquer outro trocando o id na URL
return orders.findById(req.params.id);
```

### SHARED-SEC-005 [MUST] Justifique e audite toda dependência nova

**Por quê:** cada dependência é código de terceiros executando com seus privilégios. Antes de
adicionar, verifique manutenção (release nos últimos 12 meses), licença compatível (MIT, Apache-2.0,
BSD, ISC; GPL/AGPL exige aprovação) e se a funcionalidade já existe na stack. Lockfile MUST ser
commitado e o CI MUST rodar auditoria (`pnpm audit`, Dependabot/Renovate) bloqueando
vulnerabilidades altas e críticas.

✅ Correto:

```text
PR: build(deps): add date-fns 4.1.0
Motivo: formatação de datas com timezone; Intl não cobre o caso X.
Licença: MIT · Último release: 2 meses · Tamanho: tree-shakeable
```

❌ Errado:

```bash
npm install left-pad is-odd moment request   # sem justificativa, libs abandonadas
```

### SHARED-SEC-006 [MUST] Armazene senhas com hash adaptativo

**Por quê:** hashes rápidos (MD5, SHA-1, SHA-256 puro) são quebrados por força bruta em GPU. Use
Argon2id (preferencial) ou bcrypt com custo ≥ 12. Tokens de API e de sessão MUST ser gerados com
CSPRNG e armazenados apenas como hash.

✅ Correto:

```ts
import { hash, verify } from "@node-rs/argon2";

const passwordHash = await hash(password); // Argon2id por padrão
const ok = await verify(passwordHash, attempt);
```

❌ Errado:

```ts
const passwordHash = createHash("md5").update(password).digest("hex");
const token = Math.random().toString(36).slice(2);
```

### SHARED-SEC-007 [MUST] Use TLS em trânsito e criptografia em repouso

**Por quê:** todo tráfego externo e entre serviços MUST usar TLS 1.2+; bancos, buckets e backups
MUST ter criptografia em repouso habilitada (KMS do provedor). HTTP puro só é aceito em
`localhost`.

✅ Correto:

```ts
const client = postgres(env.DATABASE_URL, { ssl: "require" });
```

❌ Errado:

```ts
const client = postgres(env.DATABASE_URL, { ssl: false });
fetch("http://payments.internal/charge", { method: "POST", body });
```

### SHARED-SEC-008 [MUST] Minimize e proteja dados pessoais (LGPD)

**Por quê:** a LGPD exige finalidade, necessidade e segurança. Colete só o necessário, não exponha
dados pessoais em URLs, logs ou mensagens de erro, e defina retenção. Respostas de API MUST usar
DTOs explícitos em vez de serializar entidades inteiras.

✅ Correto:

```ts
return { id: user.id, name: user.name }; // DTO explícito
```

❌ Errado:

```ts
return user; // inclui cpf, passwordHash, birthDate
redirect(`/welcome?email=${user.email}&cpf=${user.cpf}`);
```

### SHARED-SEC-009 [SHOULD] Aplique menor privilégio a credenciais e papéis

**Por quê:** credenciais com escopo amplo transformam um vazamento pequeno em incidente grande.
Cada serviço SHOULD ter credencial própria, com permissões mínimas e prazo de expiração; prefira
identidade federada (OIDC, IAM roles) a chaves estáticas.

✅ Correto:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::app-uploads-prod/*"
}
```

❌ Errado:

```json
{ "Effect": "Allow", "Action": "*", "Resource": "*" }
```

### SHARED-SEC-010 [MUST NOT] Exponha detalhes internos em respostas de erro

**Por quê:** stack traces, SQL e versões de bibliotecas ajudam o atacante. Retorne mensagem
genérica com um identificador de correlação; o detalhe vai para o log.

✅ Correto:

```json
{ "error": "internal_error", "message": "Erro inesperado.", "requestId": "01JC7Y3K2M" }
```

❌ Errado:

```json
{ "error": "QueryFailedError: relation \"users\" does not exist at PostgresDriver.query (...)" }
```
