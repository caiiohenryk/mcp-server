---
id: nestjs/configuration
title: Configuração e variáveis de ambiente no NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Como carregar, validar e injetar configuração em NestJS 11 com @nestjs/config, namespaces registerAs tipados, validação no boot e segredos fora do código.
tags: [configuration, env, secrets, nestjs-config]
applies_to: ["src/config/**", "src/main.ts", ".env.example"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/module-architecture, nestjs/security, shared/security-baseline]
---

# Configuração e variáveis de ambiente no NestJS

Toda configuração vem de variáveis de ambiente, é validada no boot e é consumida por injeção
tipada. O código MUST falhar rápido quando uma variável obrigatória estiver ausente ou inválida.

### NEST-CFG-001 [MUST] Valide as variáveis de ambiente no boot

**Por quê:** uma variável ausente descoberta na primeira requisição vira incidente em produção.
`ConfigModule.forRoot({ validate })` aborta a inicialização com mensagem clara.

✅ Correto:

```ts
class EnvironmentVariables {
  @IsEnum(["development", "test", "production"])
  NODE_ENV!: "development" | "test" | "production";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT: number = 3000;

  @IsUrl({ protocols: ["postgresql"], require_tld: false })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) throw new Error(`Invalid environment: ${errors.toString()}`);
  return env;
}

ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv });
```

❌ Errado:

```ts
ConfigModule.forRoot({ isGlobal: true });
// DATABASE_URL undefined only explodes on first query
```

### NEST-CFG-002 [MUST NOT] Leia process.env fora de src/config

**Por quê:** `process.env` espalhado pelo código não é validado, não é tipado e impede saber
quais variáveis o serviço usa. Só os arquivos de `src/config/` leem o ambiente.

✅ Correto:

```ts
@Injectable()
export class TokenService {
  constructor(@Inject(authConfig.KEY) private readonly auth: ConfigType<typeof authConfig>) {}

  ttl() {
    return this.auth.accessTokenTtlSeconds;
  }
}
```

❌ Errado:

```ts
@Injectable()
export class TokenService {
  ttl() {
    return Number(process.env.ACCESS_TOKEN_TTL ?? 900);
  }
}
```

### NEST-CFG-003 [MUST] Agrupe configuração em namespaces com registerAs

**Por quê:** `registerAs` cria um objeto tipado por domínio (`database`, `auth`) que é injetado
com `ConfigType<typeof x>`, sem strings mágicas como `config.get("DB_HOST")`.

✅ Correto:

```ts
// src/config/auth.config.ts
export const authConfig = registerAs("auth", () => ({
  jwtSecret: process.env.JWT_SECRET!,
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL ?? 900),
}));

// app-config.module.ts
ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv, load: [authConfig] });
```

❌ Errado:

```ts
const secret = this.config.get("JWT_SECRET");
const ttl = this.config.get("ACCESS_TOKEN_TTL");
```

### NEST-CFG-004 [MUST] Documente toda variável em .env.example

**Por quê:** `.env.example` é a lista oficial de variáveis para quem sobe o projeto e para o
pipeline. Toda variável nova no schema de validação MUST aparecer nele, com valor fictício.

✅ Correto:

```bash
# .env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://app:app@localhost:5432/app
JWT_SECRET=change-me-to-a-32-char-random-string
```

❌ Errado:

```bash
# .env.example
PORT=3000
# DATABASE_URL and JWT_SECRET only exist in someone's local .env
```

### NEST-CFG-005 [MUST NOT] Commite segredos ou valores reais de produção

**Por quê:** segredos no Git ficam no histórico para sempre. Em produção, segredos vêm do
gerenciador de segredos da nuvem injetado como variável de ambiente; `.env` está no `.gitignore`.

✅ Correto:

```bash
# .gitignore
.env
.env.*
!.env.example
```

❌ Errado:

```ts
export const authConfig = registerAs("auth", () => ({
  jwtSecret: process.env.JWT_SECRET ?? "s3cr3t-prod-key",
}));
```

### NEST-CFG-006 [SHOULD NOT] Ramifique comportamento por NODE_ENV

**Por quê:** `if (NODE_ENV === "production")` espalhado cria caminhos de código que só rodam em
produção e nunca são testados. Use flags de configuração explícitas com nome de comportamento.

✅ Correto:

```ts
export const docsConfig = registerAs("docs", () => ({
  swaggerEnabled: process.env.SWAGGER_ENABLED === "true",
}));

if (docs.swaggerEnabled) SwaggerModule.setup("docs", app, document);
```

❌ Errado:

```ts
if (process.env.NODE_ENV !== "production") SwaggerModule.setup("docs", app, document);
```

### NEST-CFG-007 [SHOULD] Use ConfigService.getOrThrow em código de bootstrap

**Por quê:** no `main.ts` não há injeção por namespace; `getOrThrow` falha com mensagem clara em
vez de devolver `undefined` silenciosamente.

✅ Correto:

```ts
const config = app.get(ConfigService);
await app.listen(config.getOrThrow<number>("PORT"));
```

❌ Errado:

```ts
await app.listen(process.env.PORT || 3000);
```
