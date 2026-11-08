---
id: nestjs/persistence
title: Persistência com Prisma no NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Como acessar PostgreSQL com Prisma ORM 6 em NestJS 11 — PrismaService, repositories por feature, transações, migrações, consultas eficientes e dinheiro/datas.
tags: [database, prisma, postgres, migrations, transactions, repository]
applies_to: ["src/infra/prisma/**", "src/modules/**/*.repository.ts", "prisma/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/module-architecture, nestjs/testing, nestjs/error-handling]
---

# Persistência com Prisma no NestJS

A opinião deste guia para NestJS é PostgreSQL + Prisma ORM 6. Não introduza um segundo ORM no
mesmo serviço. As regras abaixo valem para todo código que lê ou grava no banco.

## Acesso ao banco

### NEST-DB-001 [MUST] Exponha o Prisma por um único PrismaService global

**Por quê:** cada `new PrismaClient()` abre um pool de conexões. Um service único, registrado em
um módulo `@Global()` de infraestrutura, garante um pool por processo e conexão no boot.

✅ Correto:

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

❌ Errado:

```ts
@Injectable()
export class OrdersRepository {
  private readonly prisma = new PrismaClient();
}
```

### NEST-DB-002 [MUST] Acesse o Prisma somente dentro de repositories

**Por quê:** concentrar as queries de uma feature no repository permite revisar índices, trocar
consultas e mockar a persistência nos testes do service. Services MUST NOT importar
`PrismaService`.

✅ Correto:

```ts
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.order.findUnique({ where: { id }, include: { items: true } });
  }
}
```

❌ Errado:

```ts
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  getById(id: string) {
    return this.prisma.order.findUnique({ where: { id } });
  }
}
```

### NEST-DB-003 [MUST] Selecione apenas os campos necessários em listagens

**Por quê:** `findMany` sem `select` traz todas as colunas (inclusive blobs e dados sensíveis) e
aumenta tráfego e memória. Em listagens, declare o `select`.

✅ Correto:

```ts
listSummaries(limit: number, cursor?: string) {
  return this.prisma.order.findMany({
    take: limit,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
    orderBy: { id: "asc" },
    select: { id: true, status: true, totalCents: true, createdAt: true },
  });
}
```

❌ Errado:

```ts
listSummaries() {
  return this.prisma.order.findMany({ include: { items: true, customer: true } });
}
```

### NEST-DB-004 [MUST NOT] Faça queries dentro de loops

**Por quê:** uma query por item (N+1) multiplica a latência pelo tamanho da lista. Busque em lote
com `in` ou use `include`.

✅ Correto:

```ts
const products = await this.prisma.product.findMany({ where: { sku: { in: skus } } });
const bySku = new Map(products.map((p) => [p.sku, p]));
```

❌ Errado:

```ts
const products = [];
for (const sku of skus) {
  products.push(await this.prisma.product.findUnique({ where: { sku } }));
}
```

## Migrações

### NEST-DB-005 [MUST NOT] Edite migrações já aplicadas

**Por quê:** o Prisma guarda o checksum de cada migração. Editar uma migração aplicada quebra
`prisma migrate deploy` em outros ambientes e deixa bancos divergentes. Corrija criando uma nova
migração.

✅ Correto:

```bash
# altere prisma/schema.prisma e gere uma nova migração
pnpm prisma migrate dev --name add_order_cancelled_at
```

❌ Errado:

```bash
vim prisma/migrations/20261001120000_create_orders/migration.sql
```

### NEST-DB-006 [MUST] Aplique migrações com migrate deploy em pipeline, nunca no boot

**Por quê:** rodar migração no `main.ts` com várias réplicas causa corrida e deixa a aplicação
subir parcialmente migrada. `prisma migrate deploy` roda uma vez, como etapa do deploy, antes da
nova versão receber tráfego. `migrate dev` e `db push` são só para desenvolvimento local.

✅ Correto:

```yaml
# deploy pipeline step, before rolling out the new image
- run: pnpm prisma migrate deploy
```

❌ Errado:

```ts
async function bootstrap() {
  execSync("npx prisma db push --accept-data-loss");
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
```

### NEST-DB-007 [SHOULD] Faça mudanças de schema compatíveis com a versão anterior

**Por quê:** durante o rollout, versões antiga e nova rodam juntas. Renomear ou remover colunas em
um passo quebra a versão antiga. Use expand/contract: adicione, migre dados, troque o código e só
depois remova.

✅ Correto:

```sql
-- release 1: expand
ALTER TABLE "Order" ADD COLUMN "total_cents" BIGINT;
-- release 2 (after code reads/writes total_cents): contract
ALTER TABLE "Order" DROP COLUMN "total";
```

❌ Errado:

```sql
ALTER TABLE "Order" RENAME COLUMN "total" TO "total_cents";
```

## Transações e tipos

### NEST-DB-008 [MUST] Agrupe escritas dependentes em uma transação

**Por quê:** gravar pedido e baixar estoque em chamadas separadas deixa o banco inconsistente se a
segunda falhar. Use `$transaction` interativa e passe o client transacional para os repositories.

✅ Correto:

```ts
await this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: { customerId, status: "PENDING" } });
  await tx.stock.update({
    where: { sku },
    data: { available: { decrement: qty } },
  });
  return order;
});
```

❌ Errado:

```ts
const order = await this.prisma.order.create({ data: { customerId, status: "PENDING" } });
await this.prisma.stock.update({ where: { sku }, data: { available: { decrement: qty } } });
```

### NEST-DB-009 [MUST NOT] Chame serviços externos dentro de uma transação

**Por quê:** chamadas HTTP dentro da transação seguram conexões e locks pelo tempo da rede e não
são revertidas no rollback. Faça a chamada externa antes ou depois (com outbox para garantia).

✅ Correto:

```ts
const order = await this.prisma.$transaction(async (tx) => {
  const created = await tx.order.create({ data });
  await tx.outboxEvent.create({ data: { type: "order.created", payload: { id: created.id } } });
  return created;
});
```

❌ Errado:

```ts
await this.prisma.$transaction(async (tx) => {
  const created = await tx.order.create({ data });
  await this.paymentGateway.charge({ orderId: created.id, amountCents: created.totalCents });
});
```

### NEST-DB-010 [MUST] Armazene dinheiro como inteiro em centavos ou Decimal

**Por quê:** `Float` tem erro de arredondamento binário (`0.1 + 0.2 !== 0.3`). Valores monetários
MUST usar `Int`/`BigInt` em centavos ou `Decimal`.

✅ Correto:

```prisma
model Order {
  id         String   @id @default(uuid())
  totalCents Int
  createdAt  DateTime @default(now()) @db.Timestamptz(3)
}
```

❌ Errado:

```prisma
model Order {
  id        String   @id @default(uuid())
  total     Float
  createdAt DateTime @default(now())
}
```

### NEST-DB-011 [SHOULD] Declare índices para toda coluna usada em filtro ou ordenação

**Por quê:** o Prisma não cria índices para colunas filtradas automaticamente (exceto `@id` e
`@unique`). Consultas por chave estrangeira ou status sem índice degradam com o volume.

✅ Correto:

```prisma
model Order {
  id         String @id @default(uuid())
  customerId String
  status     String

  @@index([customerId])
  @@index([status, createdAt])
}
```

❌ Errado:

```prisma
model Order {
  id         String @id @default(uuid())
  customerId String
  status     String
}
```
