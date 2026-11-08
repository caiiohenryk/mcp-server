---
id: nestjs/controllers-and-dtos
title: Controllers e DTOs no NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Como escrever controllers finos e DTOs validados com class-validator e ValidationPipe global no NestJS 11, incluindo DTOs de resposta, paginação, versionamento e documentação OpenAPI.
tags: [http, controllers, dto, validation, openapi, rest]
applies_to: ["src/modules/**/*.controller.ts", "src/modules/**/dto/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/module-architecture, nestjs/error-handling, nestjs/security]
---

# Controllers e DTOs no NestJS

Regras para a camada HTTP. A opinião deste guia: validação com `class-validator` +
`class-transformer` via `ValidationPipe` global. Não misture com zod no mesmo projeto.

## Validação

### NEST-API-001 [MUST] Configure o ValidationPipe global com whitelist e transform

**Por quê:** sem `whitelist` e `forbidNonWhitelisted`, campos extras chegam ao service (mass
assignment). Sem `transform`, os parâmetros chegam como string e os DTOs não são instâncias.

✅ Correto:

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  }),
);
```

❌ Errado:

```ts
app.useGlobalPipes(new ValidationPipe());
```

### NEST-API-002 [MUST] Receba todo body, query e params por DTO validado

**Por quê:** `any`, `Record<string, unknown>` ou interfaces TypeScript não existem em tempo de
execução: nada é validado. Toda entrada externa MUST ser uma classe com decorators.

✅ Correto:

```ts
export class CreateOrderDto {
  @IsUUID()
  customerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

@Post()
create(@Body() dto: CreateOrderDto) {
  return this.orders.create(dto);
}
```

❌ Errado:

```ts
interface CreateOrderBody {
  customerId: string;
  items: { sku: string; qty: number }[];
}

@Post()
create(@Body() body: CreateOrderBody) {
  return this.orders.create(body);
}
```

### NEST-API-003 [MUST] Use pipes de parse para parâmetros de rota

**Por quê:** ids inválidos devem falhar com 400 antes de chegar ao banco, e não com 500 vindo de
um erro de driver.

✅ Correto:

```ts
@Get(":id")
findOne(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
  return this.orders.findById(id);
}
```

❌ Errado:

```ts
@Get(":id")
findOne(@Param("id") id: string) {
  return this.orders.findById(id);
}
```

## Respostas

### NEST-API-004 [MUST NOT] Retorne entidades do banco diretamente

**Por quê:** devolver o model do Prisma expõe colunas internas (hash de senha, flags, chaves
estrangeiras) e acopla o contrato da API ao schema do banco. Mapeie para um DTO de resposta.

✅ Correto:

```ts
export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;

  static from(user: User): UserResponseDto {
    return { id: user.id, name: user.name, email: user.email };
  }
}

@Get(":id")
async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponseDto> {
  return UserResponseDto.from(await this.users.getById(id));
}
```

❌ Errado:

```ts
@Get(":id")
findOne(@Param("id") id: string) {
  return this.prisma.user.findUnique({ where: { id } });
}
```

### NEST-API-005 [MUST] Mantenha o controller sem regra de negócio

**Por quê:** o controller só escolhe rota, status, DTO e chama um método do service. Regras no
controller não são reutilizáveis (filas, cron, CLI) e exigem HTTP para testar.

✅ Correto:

```ts
@Post(":id/cancel")
@HttpCode(HttpStatus.OK)
async cancel(@Param("id", ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
  return OrderResponseDto.from(await this.orders.cancel(id));
}
```

❌ Errado:

```ts
@Post(":id/cancel")
async cancel(@Param("id") id: string) {
  const order = await this.orders.findById(id);
  if (order.status === "SHIPPED") throw new BadRequestException("already shipped");
  if (Date.now() - order.createdAt.getTime() > 7 * 86_400_000) throw new BadRequestException();
  return this.orders.save({ ...order, status: "CANCELLED" });
}
```

### NEST-API-006 [MUST NOT] Use @Res() para enviar respostas

**Por quê:** `@Res()` desliga interceptors, serialização e o tratamento padrão de resposta do
Nest. Use o retorno do método, `@HttpCode` e `@Header`. Use `@Res({ passthrough: true })` apenas
para definir cookies.

✅ Correto:

```ts
@Post()
@HttpCode(HttpStatus.CREATED)
create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
  return this.orders.create(dto).then(OrderResponseDto.from);
}
```

❌ Errado:

```ts
@Post()
async create(@Body() dto: CreateOrderDto, @Res() res: Response) {
  const order = await this.orders.create(dto);
  res.status(201).json(order);
}
```

### NEST-API-007 [MUST] Pagine listagens com limite máximo

**Por quê:** listagens sem limite derrubam banco e memória quando a tabela cresce. Todo endpoint
de coleção MUST aceitar paginação e impor um teto.

✅ Correto:

```ts
export class PageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}

@Get()
list(@Query() query: PageQueryDto) {
  return this.orders.list(query);
}
```

❌ Errado:

```ts
@Get()
list() {
  return this.orders.findAll();
}
```

## Contrato

### NEST-API-008 [SHOULD] Documente endpoints com @nestjs/swagger

**Por quê:** o OpenAPI gerado é o contrato consumido por front-ends e outros serviços. Com o
plugin CLI do `@nestjs/swagger` habilitado em `nest-cli.json`, os DTOs são documentados
automaticamente; complemente com `@ApiOkResponse`/`@ApiTags`.

✅ Correto:

```ts
@ApiTags("orders")
@Controller({ path: "orders", version: "1" })
export class OrdersController {
  @Get(":id")
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse()
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
    return this.orders.getById(id).then(OrderResponseDto.from);
  }
}
```

❌ Errado:

```ts
@Controller("orders")
export class OrdersController {
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.orders.getById(id);
  }
}
```

### NEST-API-009 [SHOULD] Versione a API por URI

**Por quê:** clientes móveis e integrações não atualizam juntos. `enableVersioning` com
`VersioningType.URI` permite manter `/v1` enquanto `/v2` evolui.

✅ Correto:

```ts
app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

@Controller({ path: "orders", version: "2" })
export class OrdersV2Controller {}
```

❌ Errado:

```ts
@Controller("v2-orders")
export class OrdersV2Controller {}
```

### NEST-API-010 [SHOULD] Use PartialType e PickType para derivar DTOs

**Por quê:** reescrever o DTO de update à mão duplica decorators e diverge com o tempo. Os
helpers de `@nestjs/swagger` (ou `@nestjs/mapped-types`) herdam validação e metadados.

✅ Correto:

```ts
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ["customerId"] as const),
) {}
```

❌ Errado:

```ts
export class UpdateOrderDto {
  @IsOptional()
  items?: OrderItemDto[];
}
```
