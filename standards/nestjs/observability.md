---
id: nestjs/observability
title: Observabilidade em aplicações NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Como instrumentar aplicações NestJS 11 com logs JSON via nestjs-pino, tracing OpenTelemetry, health checks com @nestjs/terminus e graceful shutdown.
tags: [observability, logging, pino, opentelemetry, health-check, shutdown]
applies_to: ["src/main.ts", "src/instrumentation.ts", "src/health/**", "src/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/error-handling, nestjs/configuration, shared/observability]
---

# Observabilidade em aplicações NestJS

Complementa `shared/observability`. Toda aplicação NestJS emite logs JSON estruturados, traces
OpenTelemetry e expõe health checks de liveness e readiness.

### NEST-OBS-001 [MUST] Use nestjs-pino como logger da aplicação

**Por quê:** o `ConsoleLogger` padrão escreve texto livre, difícil de indexar. `nestjs-pino`
emite JSON com request id e loga cada requisição automaticamente.

✅ Correto:

```ts
// app.module.ts
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? "info",
    genReqId: (req) => (req.headers["x-request-id"] as string) ?? randomUUID(),
    redact: ["req.headers.authorization", "req.headers.cookie"],
  },
});

// main.ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

❌ Errado:

```ts
const app = await NestFactory.create(AppModule);
console.log("order created", order);
```

### NEST-OBS-002 [MUST] Logue com objeto de contexto e mensagem fixa

**Por quê:** mensagem constante + campos estruturados permitem agregar e filtrar (`orderId`,
`err`). Interpolar valores na string impede buscas e agrupamento.

✅ Correto:

```ts
@Injectable()
export class OrdersService {
  constructor(@InjectPinoLogger(OrdersService.name) private readonly logger: PinoLogger) {}

  async cancel(id: string) {
    this.logger.info({ orderId: id }, "order cancelled");
  }
}
```

❌ Errado:

```ts
this.logger.info(`order ${id} cancelled by ${JSON.stringify(user)}`);
```

### NEST-OBS-003 [MUST] Inicialize o OpenTelemetry antes de importar o Nest

**Por quê:** a auto-instrumentação de HTTP, Express e Prisma precisa aplicar patches antes que os
módulos sejam carregados. Carregue `instrumentation.ts` com `node --import` ou como primeira linha
do `main.ts`.

✅ Correto:

```ts
// src/instrumentation.ts
const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME,
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()],
});
sdk.start();

// src/main.ts
import "./instrumentation";
import { NestFactory } from "@nestjs/core";
```

❌ Errado:

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  new NodeSDK({ instrumentations: [getNodeAutoInstrumentations()] }).start();
  await app.listen(3000);
}
```

### NEST-OBS-004 [MUST NOT] Logue segredos, tokens ou dados pessoais

**Por quê:** logs são replicados para ferramentas com acesso amplo e retenção longa. Senhas,
tokens, documentos e e-mails MUST NOT aparecer; use `redact` do pino e logue apenas ids.

✅ Correto:

```ts
this.logger.info({ userId: user.id }, "user logged in");
```

❌ Errado:

```ts
this.logger.info({ email: dto.email, password: dto.password, token }, "user logged in");
```

### NEST-OBS-005 [MUST] Exponha health checks de liveness e readiness com @nestjs/terminus

**Por quê:** o orquestrador precisa distinguir "processo travado" (reiniciar) de "dependência
indisponível" (tirar do balanceador). Liveness não verifica dependências; readiness verifica.

✅ Correto:

```ts
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get("live")
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Public()
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prismaHealth.pingCheck("database", this.prisma)]);
  }
}
```

❌ Errado:

```ts
@Get("health")
health() {
  return "ok";
}
```

### NEST-OBS-006 [MUST] Habilite graceful shutdown

**Por quê:** sem `enableShutdownHooks`, o `SIGTERM` do orquestrador mata requisições em andamento e
não fecha o pool do banco. Com ele, `onModuleDestroy`/`beforeApplicationShutdown` executam.

✅ Correto:

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.enableShutdownHooks();
await app.listen(port);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

❌ Errado:

```ts
process.on("SIGTERM", () => process.exit(0));
```

### NEST-OBS-007 [SHOULD] Propague o request id para chamadas externas e respostas

**Por quê:** o mesmo id no log de todos os serviços permite reconstruir uma requisição ponta a
ponta. Devolva o id no cabeçalho `x-request-id` para o cliente reportar problemas.

✅ Correto:

```ts
LoggerModule.forRoot({
  pinoHttp: {
    genReqId: (req, res) => {
      const id = (req.headers["x-request-id"] as string) ?? randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
  },
});
```

❌ Errado:

```ts
LoggerModule.forRoot({ pinoHttp: {} });
// each service generates its own unrelated id
```

### NEST-OBS-008 [SHOULD] Registre métricas de negócio como métricas, não como logs

**Por quê:** contar eventos por busca em log é caro e impreciso. Use contadores/histogramas do
OpenTelemetry para volume de pedidos, falhas de pagamento e latências de negócio.

✅ Correto:

```ts
const meter = metrics.getMeter("orders");
const ordersCreated = meter.createCounter("orders_created_total");

ordersCreated.add(1, { channel: dto.channel });
```

❌ Errado:

```ts
this.logger.info({ metric: "orders_created", value: 1 }, "metric");
```
