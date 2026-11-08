---
id: nextjs/project-structure
title: Estrutura de projeto Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Como organizar pastas, rotas, código de servidor e configuração em projetos Next.js 16 com App Router.
tags: [structure, app-router, folders, configuration, typescript]
applies_to: ["src/**", "next.config.ts", "proxy.ts"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nextjs/components-and-client-boundaries, nextjs/security, shared/code-review]
---

# Estrutura de projeto Next.js

Define o layout de pastas e as convenções de arquivos para aplicações Next.js 16 com App Router,
React 19 e TypeScript strict. O objetivo é que qualquer pessoa ou agente encontre o código no mesmo
lugar em todos os projetos.

### NEXT-PS-001 [MUST] Use o App Router dentro de `src/app`

**Por quê:** o Pages Router não recebe novos recursos (Server Components, Server Actions, `use cache`).
Manter tudo em `src/` separa código de configuração na raiz.

✅ Correto:

```
src/app/layout.tsx
src/app/page.tsx
src/app/(marketing)/pricing/page.tsx
src/app/api/webhooks/stripe/route.ts
```

❌ Errado:

```
pages/index.tsx
pages/api/webhooks.ts
app/page.tsx        # misturado com pages/
```

### NEXT-PS-002 [MUST] Isole a lógica de servidor em `src/server` com `server-only`

**Por quê:** rotas e componentes devem só orquestrar. Regras de negócio e acesso a dados em um
único lugar são testáveis e não vazam para o bundle do cliente.

✅ Correto:

```ts
// src/server/orders/queries.ts
import "server-only";
import { db } from "@/server/db";

export async function listOrders(userId: string) {
  return db.query.orders.findMany({ where: (o, { eq }) => eq(o.userId, userId) });
}
```

❌ Errado:

```tsx
// src/app/orders/page.tsx
import { db } from "@/server/db";

export default async function Page() {
  const orders = await db.execute("select * from orders"); // SQL direto na rota
  return <OrderList orders={orders} />;
}
```

### NEXT-PS-003 [SHOULD] Agrupe código por funcionalidade em `src/features`

**Por quê:** colocar componentes, actions e schemas de uma funcionalidade juntos reduz o acoplamento
e facilita remover ou mover a funcionalidade inteira.

✅ Correto:

```
src/features/checkout/
  checkout-form.tsx
  actions.ts
  schemas.ts
  checkout-form.test.tsx
```

❌ Errado:

```
src/components/CheckoutForm.tsx
src/actions/checkout.ts
src/schemas/checkout.ts
src/tests/checkout.test.tsx
```

### NEXT-PS-004 [MUST] Aguarde `params` e `searchParams` como Promise

**Por quê:** no Next.js 16 `params`, `searchParams`, `cookies()`, `headers()` e `draftMode()` são
assíncronos. O acesso síncrono foi removido e quebra em build.

✅ Correto:

```tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page = "1" } = await searchParams;
  return <Post slug={slug} page={Number(page)} />;
}
```

❌ Errado:

```tsx
export default function Page({ params }: { params: { slug: string } }) {
  return <Post slug={params.slug} />;
}
```

### NEXT-PS-005 [MUST] Valide variáveis de ambiente em um único módulo

**Por quê:** falhar no boot com mensagem clara é melhor que `undefined` em produção. Um único
`src/env.ts` documenta tudo o que a aplicação precisa.

✅ Correto:

```ts
// src/env.ts
import "server-only";
import { z } from "zod";

export const env = z
  .object({
    DATABASE_URL: z.url(),
    AUTH_SECRET: z.string().min(32),
  })
  .parse(process.env);
```

❌ Errado:

```ts
const url = process.env.DATABASE_URL!; // espalhado pelo código, sem validação
```

### NEXT-PS-006 [MUST] Use `proxy.ts` em vez de `middleware.ts`

**Por quê:** no Next.js 16 `middleware.ts` foi renomeado para `proxy.ts` e roda no runtime Node.js.
O nome antigo está depreciado.

✅ Correto:

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!request.cookies.has("session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
```

❌ Errado:

```ts
// middleware.ts
export function middleware(request: NextRequest) {
  /* ... */
}
```

### NEXT-PS-007 [SHOULD] Use route groups e arquivos privados para organizar rotas

**Por quê:** `(grupo)` permite layouts diferentes sem afetar a URL, e pastas `_privadas` deixam
claro que não são rotas.

✅ Correto:

```
src/app/(auth)/login/page.tsx
src/app/(dashboard)/layout.tsx
src/app/(dashboard)/settings/page.tsx
src/app/(dashboard)/settings/_components/profile-card.tsx
```

❌ Errado:

```
src/app/dashboard-layout-wrapper/settings/page.tsx
src/app/settings/components/profile-card.tsx   # vira segmento de rota acidental se tiver page
```

### NEXT-PS-008 [MUST NOT] Use `export default` fora dos arquivos que o Next.js exige

**Por quê:** exports nomeados têm refatoração e auto-import confiáveis. `default` só é necessário
em `page`, `layout`, `template`, `loading`, `error`, `not-found` e arquivos de configuração.

✅ Correto:

```tsx
// src/components/ui/button.tsx
export function Button(props: React.ComponentProps<"button">) {
  return <button {...props} />;
}
```

❌ Errado:

```tsx
// src/components/ui/button.tsx
export default function Button(props: React.ComponentProps<"button">) {
  return <button {...props} />;
}
```

### NEXT-PS-009 [MUST] Configure o Next.js em `next.config.ts` tipado

**Por quê:** a configuração tipada pega erros de opção em tempo de compilação. Turbopack é o
bundler padrão no Next.js 16; não adicione configuração de webpack sem necessidade comprovada.

✅ Correto:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  typedRoutes: true,
};

export default nextConfig;
```

❌ Errado:

```js
// next.config.js
module.exports = {
  webpack: (config) => config, // customização sem motivo
};
```
