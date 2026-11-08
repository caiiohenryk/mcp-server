---
id: nestjs/security
title: Segurança em APIs NestJS
technology: nestjs
version: 1
status: stable
severity: MUST
summary: Controles de segurança obrigatórios para APIs NestJS 11 — guard global de autenticação, autorização por recurso, JWT, helmet, CORS, rate limiting, hash de senha e uploads.
tags: [security, auth, jwt, guards, helmet, cors, rate-limiting]
applies_to: ["src/main.ts", "src/common/guards/**", "src/modules/auth/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nestjs/controllers-and-dtos, nestjs/configuration, shared/security-baseline]
---

# Segurança em APIs NestJS

Complementa `shared/security-baseline` com controles específicos do NestJS 11. Todo endpoint é
privado por padrão; exceções são explícitas e revisadas.

## Autenticação e autorização

### NEST-SEC-001 [MUST] Proteja todas as rotas com um guard global e marque exceções com @Public()

**Por quê:** guard aplicado rota a rota falha por esquecimento. Registrado via `APP_GUARD`, ele
cobre tudo; rotas públicas são marcadas e ficam visíveis em revisão.

✅ Correto:

```ts
export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) throw new UnauthorizedException();
    req.user = await this.jwt.verifyAsync<AuthUser>(token).catch(() => {
      throw new UnauthorizedException();
    });
    return true;
  }
}

@Module({ providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }] })
export class AuthModule {}
```

❌ Errado:

```ts
@Controller("orders")
export class OrdersController {
  @UseGuards(JwtAuthGuard)
  @Get()
  list() {}

  @Delete(":id") // guard forgotten: endpoint is public
  remove(@Param("id") id: string) {}
}
```

### NEST-SEC-002 [MUST] Verifique a posse do recurso, não só o papel

**Por quê:** um guard de papel (`@Roles("customer")`) não impede que um cliente leia o pedido de
outro (IDOR). O service MUST filtrar pelo dono ou verificar a posse.

✅ Correto:

```ts
async getForUser(orderId: string, user: AuthUser) {
  const order = await this.orders.findByIdAndCustomer(orderId, user.id);
  if (!order) throw new OrderNotFoundError(orderId);
  return order;
}
```

❌ Errado:

```ts
@Roles("customer")
@Get(":id")
findOne(@Param("id", ParseUUIDPipe) id: string) {
  return this.orders.getById(id);
}
```

### NEST-SEC-003 [MUST] Assine JWT com segredo forte e expiração curta

**Por quê:** tokens sem `expiresIn` valem para sempre se vazarem. Access tokens MUST expirar em até
15 minutos; renovação via refresh token rotativo. O algoritmo MUST ser fixado na verificação.

✅ Correto:

```ts
JwtModule.registerAsync({
  inject: [authConfig.KEY],
  useFactory: (auth: ConfigType<typeof authConfig>) => ({
    secret: auth.jwtSecret,
    signOptions: { expiresIn: "15m", algorithm: "HS256", issuer: "orders-api" },
    verifyOptions: { algorithms: ["HS256"], issuer: "orders-api" },
  }),
});
```

❌ Errado:

```ts
JwtModule.register({ secret: "secret" });
```

### NEST-SEC-004 [MUST] Armazene senhas com argon2id

**Por quê:** hashes rápidos (MD5, SHA-256) são quebrados por força bruta. argon2id é o padrão
recomendado pela OWASP; bcrypt é aceitável apenas em sistemas legados.

✅ Correto:

```ts
import { hash, verify } from "@node-rs/argon2";

const passwordHash = await hash(password);
const ok = await verify(user.passwordHash, password);
```

❌ Errado:

```ts
const passwordHash = createHash("sha256").update(password).digest("hex");
```

## Borda HTTP

### NEST-SEC-005 [MUST] Ative helmet e CORS com origens explícitas

**Por quê:** `helmet` define cabeçalhos de segurança; CORS com `origin: true` ou `*` combinado com
credenciais permite que qualquer site chame a API em nome do usuário.

✅ Correto:

```ts
app.use(helmet());
app.enableCors({
  origin: config.getOrThrow<string>("CORS_ORIGINS").split(","),
  credentials: true,
});
```

❌ Errado:

```ts
app.enableCors({ origin: true, credentials: true });
```

### NEST-SEC-006 [MUST] Aplique rate limiting global com limites mais rígidos em autenticação

**Por quê:** sem limite, login e recuperação de senha sofrem força bruta. Use `@nestjs/throttler`
global e `@Throttle` mais restritivo nas rotas de credenciais.

✅ Correto:

```ts
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

@Public()
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post("login")
login(@Body() dto: LoginDto) {
  return this.auth.login(dto);
}
```

❌ Errado:

```ts
@Public()
@Post("login")
login(@Body() dto: LoginDto) {
  return this.auth.login(dto);
}
```

### NEST-SEC-007 [MUST NOT] Interpole input do usuário em SQL bruto

**Por quê:** `$queryRawUnsafe` com template string concatenada é injeção de SQL. Use
`$queryRaw` com tagged template, que parametriza os valores.

✅ Correto:

```ts
const rows = await this.prisma.$queryRaw<OrderRow[]>`
  SELECT id, status FROM "Order" WHERE "customerId" = ${customerId} LIMIT ${limit}`;
```

❌ Errado:

```ts
const rows = await this.prisma.$queryRawUnsafe(
  `SELECT id, status FROM "Order" WHERE "customerId" = '${customerId}'`,
);
```

### NEST-SEC-008 [MUST] Limite tamanho e tipo de uploads e do body

**Por quê:** bodies e arquivos sem limite permitem esgotar memória e disco. Defina limites no
parser e valide o arquivo com `ParseFilePipe`.

✅ Correto:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
app.useBodyParser("json", { limit: "1mb" });

@Post("avatar")
@UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
upload(
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
        new FileTypeValidator({ fileType: /^image\/(png|jpeg|webp)$/ }),
      ],
    }),
  )
  file: Express.Multer.File,
) {
  return this.users.setAvatar(file);
}
```

❌ Errado:

```ts
@Post("avatar")
@UseInterceptors(FileInterceptor("file"))
upload(@UploadedFile() file: Express.Multer.File) {
  return this.users.setAvatar(file);
}
```

### NEST-SEC-009 [SHOULD] Desabilite o Swagger público em produção

**Por quê:** a documentação expõe todos os endpoints e schemas. Em produção, desligue por flag de
configuração ou proteja com autenticação.

✅ Correto:

```ts
if (docs.swaggerEnabled) {
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));
}
```

❌ Errado:

```ts
SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));
```
