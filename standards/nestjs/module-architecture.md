---
id: nestjs/module-architecture
title: Arquitetura de módulos NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Como organizar uma aplicação NestJS 11 em módulos de feature coesos, com camadas controller/service/repository, sem dependências circulares e com API pública explícita.
tags: [architecture, modules, dependency-injection, layering]
applies_to: ["src/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/controllers-and-dtos, nestjs/persistence, nestjs/configuration]
---

# Arquitetura de módulos NestJS

Define como dividir uma aplicação NestJS 11 em módulos e camadas. O objetivo é que cada feature
possa ser entendida, testada e removida isoladamente, e que o grafo de dependências seja acíclico.

## Módulos

### NEST-MOD-001 [MUST] Organize o código em módulos de feature

**Por quê:** módulos por camada técnica (`controllers/`, `services/`) espalham uma feature por
toda a árvore e tornam impossível saber o que depende de quê. Um módulo por feature de negócio
mantém coesão e fronteiras claras.

✅ Correto:

```
src/modules/orders/
  orders.module.ts
  orders.controller.ts
  orders.service.ts
  orders.repository.ts
  dto/create-order.dto.ts
  errors/order-not-found.error.ts
```

❌ Errado:

```
src/controllers/orders.controller.ts
src/services/orders.service.ts
src/repositories/orders.repository.ts
src/dtos/create-order.dto.ts
```

### NEST-MOD-002 [MUST] Exporte apenas o que outros módulos precisam

**Por quê:** `exports` é a API pública do módulo. Exportar repositories ou providers internos
permite que outro módulo pule as regras de negócio e acople-se à persistência.

✅ Correto:

```ts
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
```

❌ Errado:

```ts
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
```

### NEST-MOD-003 [MUST NOT] Use forwardRef para resolver dependência circular

**Por quê:** `forwardRef` esconde um ciclo no grafo de módulos, gera providers `undefined` em
tempo de execução e torna a ordem de inicialização frágil. Quebre o ciclo extraindo a parte
compartilhada para um terceiro módulo ou trocando a chamada direta por evento.

✅ Correto:

```ts
// payments emits an event; orders listens. No import from payments to orders.
@Injectable()
export class PaymentsService {
  constructor(private readonly events: EventEmitter2) {}

  async confirm(paymentId: string, orderId: string) {
    await this.events.emitAsync("payment.confirmed", { paymentId, orderId });
  }
}
```

❌ Errado:

```ts
@Module({
  imports: [forwardRef(() => PaymentsModule)],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

### NEST-MOD-004 [MUST] Mantenha o AppModule apenas como composição

**Por quê:** o `AppModule` é a raiz do grafo. Colocar providers de negócio nele cria um módulo
"deus" que todo mundo importa indiretamente.

✅ Correto:

```ts
@Module({
  imports: [AppConfigModule, LoggerModule, PrismaModule, HealthModule, OrdersModule, UsersModule],
})
export class AppModule {}
```

❌ Errado:

```ts
@Module({
  imports: [PrismaModule],
  controllers: [OrdersController, UsersController],
  providers: [OrdersService, UsersService, MailService],
})
export class AppModule {}
```

### NEST-MOD-005 [SHOULD NOT] Marque módulos de feature como @Global

**Por quê:** `@Global()` esconde dependências: o módulo consumidor não declara o que usa. Reserve
`@Global()` para infraestrutura realmente transversal e única (config, logger, Prisma).

✅ Correto:

```ts
@Module({
  imports: [UsersModule],
  providers: [OrdersService],
})
export class OrdersModule {}
```

❌ Errado:

```ts
@Global()
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

## Camadas

### NEST-MOD-006 [MUST] Separe controller, service e repository

**Por quê:** controller traduz HTTP, service aplica regras de negócio e repository fala com o
banco. Misturar as camadas impede testar regras sem HTTP ou sem banco.

✅ Correto:

```ts
@Injectable()
export class OrdersService {
  constructor(private readonly orders: OrdersRepository) {}

  async cancel(id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) throw new OrderNotFoundError(id);
    if (order.status === "SHIPPED") throw new OrderAlreadyShippedError(id);
    return this.orders.updateStatus(id, "CANCELLED");
  }
}
```

❌ Errado:

```ts
@Controller("orders")
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(":id/cancel")
  async cancel(@Param("id") id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (order?.status === "SHIPPED") throw new BadRequestException();
    return this.prisma.order.update({ where: { id }, data: { status: "CANCELLED" } });
  }
}
```

### NEST-MOD-007 [MUST] Injete dependências pelo construtor com readonly

**Por quê:** injeção pelo construtor deixa as dependências explícitas e permite substituí-las em
`Test.createTestingModule`. Instanciar com `new` dentro da classe impede o mock.

✅ Correto:

```ts
@Injectable()
export class InvoicesService {
  constructor(
    private readonly invoices: InvoicesRepository,
    private readonly mailer: MailerService,
  ) {}
}
```

❌ Errado:

```ts
@Injectable()
export class InvoicesService {
  private readonly mailer = new MailerService();
  @Inject() invoices!: InvoicesRepository;
}
```

### NEST-MOD-008 [SHOULD] Use tokens tipados para depender de abstrações

**Por quê:** integrações externas (e-mail, storage, gateways de pagamento) mudam e precisam de
fake em teste. Um token `Symbol` + interface desacopla o service da implementação concreta.

✅ Correto:

```ts
export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");
export interface PaymentGateway {
  charge(input: { amountCents: number; customerId: string }): Promise<{ chargeId: string }>;
}

@Module({
  providers: [{ provide: PAYMENT_GATEWAY, useClass: StripePaymentGateway }, PaymentsService],
})
export class PaymentsModule {}

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway) {}
}
```

❌ Errado:

```ts
@Injectable()
export class PaymentsService {
  constructor(private readonly stripe: StripeClient) {}
}
```

### NEST-MOD-009 [SHOULD NOT] Use escopo REQUEST em providers

**Por quê:** um provider `Scope.REQUEST` contamina toda a cadeia que depende dele, que passa a ser
recriada a cada requisição, com custo de performance. Para contexto por requisição (usuário,
correlation id), use `AsyncLocalStorage` (ex.: `nestjs-cls`) ou passe o valor como argumento.

✅ Correto:

```ts
@Get("me")
me(@CurrentUser() user: AuthUser) {
  return this.users.getProfile(user.id);
}
```

❌ Errado:

```ts
@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}
}
```

### NEST-MOD-010 [MAY] Use módulos dinâmicos para infraestrutura configurável

**Por quê:** `ConfigurableModuleBuilder` gera `forRoot`/`forRootAsync` tipados para módulos de
infraestrutura reutilizáveis (clientes HTTP, filas). Para módulos de feature, prefira módulos
estáticos.
