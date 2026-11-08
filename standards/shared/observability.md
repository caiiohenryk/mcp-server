---
id: shared/observability
title: Observabilidade — logs, métricas e traces
technology: shared
version: 1
status: stable
severity: MUST
summary: Como emitir logs estruturados, métricas e traces com OpenTelemetry, propagar correlação, proteger dados sensíveis e expor health checks em qualquer serviço.
tags: [observability, logging, metrics, tracing, opentelemetry, health-check]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [shared/security-baseline]
---

# Observabilidade — logs, métricas e traces

Todo serviço em produção MUST permitir responder "o que aconteceu com esta requisição?" sem acesso
à máquina. O padrão é OpenTelemetry (OTLP) para traces e métricas e logs JSON em `stdout`
correlacionados por `trace_id`. Implementações por tecnologia: `nestjs/observability`,
`nextjs/error-handling`.

### SHARED-OBS-001 [MUST] Emita logs estruturados em JSON para stdout

**Por quê:** logs em JSON são indexáveis e filtráveis por campo; texto livre exige regex frágil. A
aplicação MUST escrever em `stdout` e deixar a coleta para a plataforma (container, agente). Use
uma biblioteca de log (pino em Node), nunca `console.log` em código de produção.

✅ Correto:

```ts
logger.info({ orderId: order.id, amountCents: order.total }, "order.created");
// {"level":30,"time":"2026-11-08T13:00:00.000Z","msg":"order.created","orderId":"ord_1","amountCents":4990,"trace_id":"4bf9..."}
```

❌ Errado:

```ts
console.log("Pedido criado: " + JSON.stringify(order));
fs.appendFileSync("/var/log/app.log", `order ${order.id} created\n`);
```

### SHARED-OBS-002 [MUST] Use níveis de log com significado fixo

**Por quê:** níveis consistentes permitem alertar sobre `error` e filtrar ruído. `error`: falha que
exige ação ou afetou o usuário; `warn`: anomalia tratada; `info`: eventos de negócio e ciclo de
vida; `debug`: diagnóstico, desligado em produção. Produção MUST rodar em `info`.

✅ Correto:

```ts
logger.warn({ attempt, provider: "stripe" }, "payment.retry");
logger.error({ err, orderId }, "payment.failed");
```

❌ Errado:

```ts
logger.error("entrou na função calculateTotal");
logger.info({ err }, "falha ao cobrar"); // erro real logado como info
```

### SHARED-OBS-003 [MUST NOT] Registre segredos ou dados pessoais em logs, métricas ou traces

**Por quê:** logs são replicados para vários sistemas com controles de acesso mais fracos que o
banco. Senhas, tokens, headers `Authorization`/`Cookie`, CPF, e-mail, telefone e cartão MUST NOT
aparecer. Configure redação no logger como defesa adicional, e registre identificadores opacos.

✅ Correto:

```ts
const logger = pino({
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.cpf"],
});
logger.info({ userId: user.id }, "user.login");
```

❌ Errado:

```ts
logger.info({ body: req.body, headers: req.headers }, "login attempt");
logger.debug(`token=${token} email=${user.email}`);
```

### SHARED-OBS-004 [MUST] Propague correlação entre serviços com W3C Trace Context

**Por quê:** sem um identificador comum não é possível seguir uma requisição entre API, fila e
worker. Use o SDK OpenTelemetry com propagação `traceparent` e inclua `trace_id`/`span_id` em todo
log. Retorne o id ao cliente no header de resposta para suporte.

✅ Correto:

```ts
// instrumentation.ts — carregado antes da aplicação
const sdk = new NodeSDK({
  serviceName: "orders-api",
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
```

❌ Errado:

```ts
// cada serviço gera o próprio id e não repassa adiante
const requestId = Math.random().toString(36);
await fetch(paymentsUrl, { method: "POST", body });
```

### SHARED-OBS-005 [SHOULD] Meça os sinais RED de toda interface pública

**Por quê:** Rate, Errors e Duration por rota/operação respondem se o serviço está saudável e
alimentam SLOs. Use histogramas para latência (não médias) e rótulos de baixa cardinalidade.

✅ Correto:

```ts
const duration = meter.createHistogram("http.server.request.duration", { unit: "s" });
duration.record(elapsed, { "http.route": "/orders/:id", "http.response.status_code": 200 });
```

❌ Errado:

```ts
// id do usuário como rótulo: cardinalidade ilimitada derruba o backend de métricas
counter.add(1, { route: req.url, userId: user.id });
```

### SHARED-OBS-006 [MUST] Exponha health checks de liveness e readiness separados

**Por quê:** o orquestrador precisa distinguir "processo travado, reinicie" de "ainda não pronto,
não envie tráfego". Liveness MUST NOT verificar dependências externas (evita reinícios em cascata);
readiness MUST verificar as dependências essenciais (banco, cache).

✅ Correto:

```text
GET /health/live   → 200 se o processo responde
GET /health/ready  → 200 se banco e cache respondem; 503 caso contrário
```

❌ Errado:

```text
GET /health → consulta banco, Redis, API de pagamento e S3; usado como liveness
```

### SHARED-OBS-007 [SHOULD] Defina alertas por sintomas ligados a SLO

**Por quê:** alertar sobre causas (CPU 80%) gera ruído; alertar sobre sintomas que o usuário sente
(taxa de erro, latência p95 acima do SLO) gera ação. Todo alerta SHOULD ter dono, severidade e link
para runbook.

✅ Correto:

```yaml
- alert: OrdersApiHighErrorRate
  expr:
    sum(rate(http_server_request_duration_seconds_count{service="orders-api",status=~"5.."}[5m]))
    / sum(rate(http_server_request_duration_seconds_count{service="orders-api"}[5m])) > 0.02
  for: 10m
  labels: { severity: page, team: orders }
  annotations: { runbook: "https://runbooks.example.com/orders-api/high-error-rate" }
```

❌ Errado:

```yaml
- alert: HighCPU
  expr: cpu_usage > 0.8
  for: 1m
```

### SHARED-OBS-008 [SHOULD] Registre eventos com nomes estáveis e contexto de negócio

**Por quê:** mensagens no formato `dominio.evento` (`order.created`, `payment.failed`) funcionam
como contrato para dashboards e buscas; texto livre muda a cada refatoração.

✅ Correto:

```ts
logger.info({ orderId, previousStatus, nextStatus }, "order.status_changed");
```

❌ Errado:

```ts
logger.info(`Mudou o status do pedido ${orderId} de ${previousStatus} pra ${nextStatus}!!`);
```
