---
id: nestjs/error-handling
title: Tratamento de erros no NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Como modelar erros de domínio, convertê-los em respostas HTTP por um exception filter global, padronizar o corpo de erro (RFC 9457) e não vazar detalhes internos em NestJS 11.
tags: [errors, exceptions, filters, http, problem-details]
applies_to: ["src/common/filters/**", "src/modules/**/errors/**", "src/modules/**/*.service.ts"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/controllers-and-dtos, nestjs/observability, nestjs/persistence]
---

# Tratamento de erros no NestJS

Services lançam erros de domínio; um único filtro global traduz para HTTP. Todo erro de resposta
segue o formato Problem Details (RFC 9457) com `code` estável que o cliente pode tratar.

### NEST-EH-001 [MUST] Lance erros de domínio nos services, não HttpException

**Por quê:** services são chamados por HTTP, filas e cron. `NotFoundException` acopla a regra ao
HTTP. Erros de domínio carregam um `code` estável e são mapeados para status no filtro.

✅ Correto:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class OrderNotFoundError extends DomainError {
  readonly code = "ORDER_NOT_FOUND";
  constructor(readonly orderId: string) {
    super(`Order ${orderId} not found`);
  }
}

async getById(id: string) {
  const order = await this.orders.findById(id);
  if (!order) throw new OrderNotFoundError(id);
  return order;
}
```

❌ Errado:

```ts
async getById(id: string) {
  const order = await this.orders.findById(id);
  if (!order) throw new NotFoundException("not found");
  return order;
}
```

### NEST-EH-002 [MUST] Registre um exception filter global que mapeia erros para HTTP

**Por quê:** um único ponto de tradução garante status e formato consistentes em todos os
endpoints. Registre com `APP_FILTER` para que o filtro participe da injeção de dependências.

✅ Correto:

```ts
const STATUS_BY_CODE: Record<string, HttpStatus> = {
  ORDER_NOT_FOUND: HttpStatus.NOT_FOUND,
  ORDER_ALREADY_SHIPPED: HttpStatus.CONFLICT,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_CODE[error.code] ?? HttpStatus.UNPROCESSABLE_ENTITY;
    res
      .status(status)
      .type("application/problem+json")
      .json({
        type: `https://errors.example.com/${error.code}`,
        title: error.message,
        status,
        code: error.code,
      });
  }
}

@Module({ providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }] })
export class CommonModule {}
```

❌ Errado:

```ts
@Get(":id")
async findOne(@Param("id") id: string) {
  try {
    return await this.orders.getById(id);
  } catch (e) {
    throw new HttpException((e as Error).message, 404);
  }
}
```

### NEST-EH-003 [MUST NOT] Exponha stack trace ou mensagem interna ao cliente

**Por quê:** stack traces e mensagens de driver revelam estrutura interna, versões e queries. Erros
não mapeados MUST virar 500 com corpo genérico; o detalhe vai só para o log.

✅ Correto:

```ts
@Catch()
export class UnhandledErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(error: unknown, host: ArgumentsHost) {
    if (error instanceof HttpException) {
      const res = host.switchToHttp().getResponse<Response>();
      res.status(error.getStatus()).json(error.getResponse());
      return;
    }
    this.logger.error({ err: error }, "unhandled error");
    host.switchToHttp().getResponse<Response>().status(500).json({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      code: "INTERNAL_ERROR",
    });
  }
}
```

❌ Errado:

```ts
catch(error: Error, host: ArgumentsHost) {
  host.switchToHttp().getResponse<Response>().status(500).json({
    message: error.message,
    stack: error.stack,
  });
}
```

### NEST-EH-004 [MUST] Traduza erros conhecidos do Prisma no repository

**Por quê:** `PrismaClientKnownRequestError` com `P2002` (unique) ou `P2025` (registro não
encontrado) são situações de negócio previsíveis. Deixá-las subir vira 500.

✅ Correto:

```ts
async create(data: CreateUserData) {
  try {
    return await this.prisma.user.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new EmailAlreadyInUseError(data.email);
    }
    throw e;
  }
}
```

❌ Errado:

```ts
async create(data: CreateUserData) {
  return this.prisma.user.create({ data });
}
```

### NEST-EH-005 [MUST NOT] Engula exceções silenciosamente

**Por quê:** `catch {}` vazio ou que só retorna `null` esconde falhas e corrompe estado. Trate o
erro de forma específica ou relance; se registrar, registre com contexto.

✅ Correto:

```ts
try {
  await this.mailer.sendWelcome(user.email);
} catch (err) {
  this.logger.warn({ err, userId: user.id }, "welcome email failed; will retry via queue");
  await this.retryQueue.add("welcome-email", { userId: user.id });
}
```

❌ Errado:

```ts
try {
  await this.mailer.sendWelcome(user.email);
} catch {}
```

### NEST-EH-006 [SHOULD] Retorne erros de validação com lista de campos

**Por quê:** clientes precisam saber qual campo falhou. Configure `exceptionFactory` no
`ValidationPipe` para emitir Problem Details com `errors[]` em vez de strings soltas.

✅ Correto:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      type: "about:blank",
      title: "Validation failed",
      status: 400,
      code: "VALIDATION_FAILED",
      errors: errors.map((e) => ({
        field: e.property,
        messages: Object.values(e.constraints ?? {}),
      })),
    }),
});
```

❌ Errado:

```ts
new ValidationPipe({ disableErrorMessages: true });
```

### NEST-EH-007 [MUST] Trate erros em código assíncrono fora do ciclo de requisição

**Por quê:** promises soltas (`void promise` sem `catch`) em listeners e jobs geram
`unhandledRejection` e, no Node 22, derrubam o processo.

✅ Correto:

```ts
@OnEvent("order.created", { async: true })
async handleOrderCreated(event: OrderCreatedEvent) {
  try {
    await this.notifications.notifyCustomer(event.orderId);
  } catch (err) {
    this.logger.error({ err, orderId: event.orderId }, "order.created handler failed");
  }
}
```

❌ Errado:

```ts
@OnEvent("order.created")
handleOrderCreated(event: OrderCreatedEvent) {
  this.notifications.notifyCustomer(event.orderId);
}
```
