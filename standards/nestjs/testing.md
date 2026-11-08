---
id: nestjs/testing
title: Testes em aplicações NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Como testar aplicações NestJS 11 com Jest, Test.createTestingModule, testes e2e com supertest e banco PostgreSQL real via Testcontainers, sem mocks frágeis.
tags: [testing, jest, e2e, supertest, testcontainers]
applies_to: ["src/**/*.spec.ts", "test/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/persistence, nestjs/module-architecture, shared/testing-strategy]
---

# Testes em aplicações NestJS

Ferramentas padrão: Jest (o runner do Nest CLI), `@nestjs/testing`, supertest e Testcontainers.
Testes unitários ficam ao lado do código (`*.spec.ts`); e2e em `test/` (`*.e2e-spec.ts`).

### NEST-TEST-001 [MUST] Teste services com Test.createTestingModule e dependências substituídas

**Por quê:** montar o service pelo container do Nest valida a injeção real; substituir só as
fronteiras (repository, gateways) mantém o teste rápido e focado na regra de negócio.

✅ Correto:

```ts
describe("OrdersService", () => {
  let service: OrdersService;
  const repo = { findById: jest.fn(), updateStatus: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: OrdersRepository, useValue: repo }],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it("rejects cancelling a shipped order", async () => {
    repo.findById.mockResolvedValue({ id: "o1", status: "SHIPPED" });
    await expect(service.cancel("o1")).rejects.toBeInstanceOf(OrderAlreadyShippedError);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});
```

❌ Errado:

```ts
it("cancels", async () => {
  const service = new OrdersService(new OrdersRepository(new PrismaService()));
  await service.cancel("some-id-that-exists-in-my-local-db");
});
```

### NEST-TEST-002 [MUST] Escreva teste e2e para cada endpoint novo

**Por quê:** só o e2e exercita pipes, guards, filtros e serialização juntos. Todo endpoint MUST ter
ao menos um caso de sucesso, um de validação (400) e um de autorização (401/403).

✅ Correto:

```ts
describe("POST /v1/orders", () => {
  it("returns 400 for unknown fields", async () => {
    await request(app.getHttpServer())
      .post("/v1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId: randomUUID(), items: [], isAdmin: true })
      .expect(400);
  });

  it("returns 401 without token", async () => {
    await request(app.getHttpServer()).post("/v1/orders").send({}).expect(401);
  });
});
```

❌ Errado:

```ts
it("controller calls service", async () => {
  const controller = new OrdersController(service);
  await controller.create({ customerId: "x", items: [] });
  expect(service.create).toHaveBeenCalled();
});
```

### NEST-TEST-003 [MUST] Configure o app de teste igual ao main.ts

**Por quê:** se o teste e2e não aplica os mesmos pipes, versionamento e filtros do `main.ts`, ele
passa enquanto produção falha. Extraia a configuração para uma função compartilhada.

✅ Correto:

```ts
// src/setup-app.ts
export function setupApp(app: INestApplication) {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  return app;
}

// test/app.e2e-spec.ts
app = setupApp(moduleRef.createNestApplication());
await app.init();
```

❌ Errado:

```ts
app = moduleRef.createNestApplication();
await app.init(); // no ValidationPipe, no versioning: tests diverge from production
```

### NEST-TEST-004 [MUST] Use PostgreSQL real via Testcontainers nos testes de integração

**Por quê:** SQLite ou mocks do Prisma não reproduzem constraints, tipos e transações do
PostgreSQL. Testcontainers sobe o mesmo banco da produção, isolado por execução.

✅ Correto:

```ts
let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync("pnpm prisma migrate deploy", { env: process.env });
}, 60_000);

afterAll(async () => {
  await container.stop();
});
```

❌ Errado:

```ts
const prismaMock = { order: { create: jest.fn().mockResolvedValue({ id: "1" }) } };
// repository "tested" against a mock that accepts anything
```

### NEST-TEST-005 [MUST] Isole o estado do banco entre testes

**Por quê:** testes que dependem de dados criados por outros quebram quando rodam em outra ordem
ou em paralelo. Limpe as tabelas antes de cada teste ou crie dados com ids únicos.

✅ Correto:

```ts
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "OrderItem", "Order", "User" RESTART IDENTITY CASCADE',
  );
});
```

❌ Errado:

```ts
it("creates order", async () => {
  // relies on user "u1" created by a previous test in another file
  await request(server).post("/v1/orders").send({ customerId: "u1", items }).expect(201);
});
```

### NEST-TEST-006 [SHOULD] Use overrideProvider para fronteiras externas no e2e

**Por quê:** e2e deve usar o grafo real, trocando apenas o que sai do processo (gateway de
pagamento, e-mail). `overrideProvider` faz isso sem duplicar módulos.

✅ Correto:

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(PAYMENT_GATEWAY)
  .useValue(new FakePaymentGateway())
  .compile();
```

❌ Errado:

```ts
const moduleRef = await Test.createTestingModule({
  controllers: [OrdersController],
  providers: [{ provide: OrdersService, useValue: { create: jest.fn() } }],
}).compile();
```

### NEST-TEST-007 [SHOULD NOT] Teste detalhes de implementação

**Por quê:** asserts sobre chamadas internas (`toHaveBeenCalledTimes` em métodos privados) quebram
a cada refatoração sem indicar bug. Verifique resultado e efeitos observáveis.

✅ Correto:

```ts
const order = await service.create(dto);
expect(order.status).toBe("PENDING");
expect(await repo.findById(order.id)).toMatchObject({ totalCents: 2500 });
```

❌ Errado:

```ts
await service.create(dto);
expect(service["calculateTotal"]).toHaveBeenCalledTimes(1);
```

### NEST-TEST-008 [MUST] Feche a aplicação e conexões ao final da suíte

**Por quê:** app e Prisma abertos deixam handles pendentes; o Jest não encerra ou mascara
vazamentos com `--forceExit`.

✅ Correto:

```ts
afterAll(async () => {
  await app.close();
});
```

❌ Errado:

```json
{ "scripts": { "test:e2e": "jest --config test/jest-e2e.json --forceExit" } }
```
