---
id: nextjs/data-fetching-and-caching
title: Busca de dados e cache no Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Onde e como buscar dados no App Router do Next.js 16, como usar `use cache`, cacheTag e cacheLife, e como invalidar o cache sem servir dados obsoletos.
tags: [data-fetching, cache, server-components, use-cache, revalidation, suspense]
applies_to: ["src/app/**", "src/server/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nextjs/server-actions-and-mutations, nextjs/performance, nextjs/project-structure]
---

# Busca de dados e cache no Next.js

Regras para leitura de dados no Next.js 16 com `cacheComponents: true` habilitado. Por padrão nada é
cacheado: dados são dinâmicos até que você marque explicitamente com `"use cache"`.

### NEXT-DF-001 [MUST] Busque dados em Server Components

**Por quê:** buscar no servidor elimina waterfalls no cliente, reduz o bundle e não expõe
credenciais ou endpoints internos.

✅ Correto:

```tsx
// src/app/products/page.tsx
import { listProducts } from "@/server/products/queries";

export default async function Page() {
  const products = await listProducts();
  return <ProductList products={products} />;
}
```

❌ Errado:

```tsx
"use client";
export default function Page() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts);
  }, []);
  return <ProductList products={products} />;
}
```

### NEXT-DF-002 [MUST NOT] Crie Route Handlers só para servir dados aos próprios Server Components

**Por quê:** chamar a própria API via HTTP a partir do servidor adiciona latência, perde tipos e
duplica autenticação. Chame a função de `src/server` diretamente. Route Handlers são para
consumidores externos (webhooks, apps mobile).

✅ Correto:

```tsx
const user = await getCurrentUser();
const orders = await listOrders(user.id);
```

❌ Errado:

```tsx
const res = await fetch(`${process.env.APP_URL}/api/orders`, { headers: await headers() });
const orders = await res.json();
```

### NEXT-DF-003 [MUST] Busque em paralelo dados independentes

**Por quê:** `await` sequencial cria waterfall no servidor; o tempo total vira a soma das
latências.

✅ Correto:

```tsx
const [user, orders] = await Promise.all([getUser(id), listOrders(id)]);
```

❌ Errado:

```tsx
const user = await getUser(id);
const orders = await listOrders(id); // não depende de user
```

### NEXT-DF-004 [SHOULD] Envolva partes lentas em `Suspense` para streaming

**Por quê:** o shell da página é enviado imediatamente e cada trecho lento aparece quando fica
pronto, em vez de bloquear a página inteira.

✅ Correto:

```tsx
export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>
    </>
  );
}
```

❌ Errado:

```tsx
export default async function Page() {
  const recommendations = await getRecommendations(); // 2s bloqueando tudo
  return (
    <>
      <Header />
      <RecommendationsList items={recommendations} />
    </>
  );
}
```

### NEXT-DF-005 [MUST] Marque dados cacheáveis com `"use cache"`, `cacheTag` e `cacheLife`

**Por quê:** com Cache Components o cache é explícito. Toda função cacheada MUST declarar uma tag
para invalidação e um perfil de vida, senão o dado fica obsoleto ou nunca é reaproveitado.

✅ Correto:

```ts
import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export async function getProduct(id: string) {
  "use cache";
  cacheTag(`product:${id}`, "products");
  cacheLife("hours");
  return db.query.products.findFirst({ where: (p, { eq }) => eq(p.id, id) });
}
```

❌ Errado:

```ts
export const getProduct = unstable_cache(async (id: string) => fetchProduct(id)); // API legada, sem tag

export async function getProductRaw(id: string) {
  "use cache"; // sem tag: impossível invalidar após uma mutação
  return fetchProduct(id);
}
```

### NEXT-DF-006 [MUST NOT] Leia cookies, headers ou dados do usuário dentro de `"use cache"`

**Por quê:** o resultado cacheado é compartilhado entre requisições; ler dados da requisição dentro
dele mistura dados de usuários diferentes. Leia fora e passe como argumento (o argumento entra na
chave do cache).

✅ Correto:

```tsx
export default async function Page() {
  const session = await getSession(); // fora do cache
  return <Cart userId={session.userId} />;
}

async function getCart(userId: string) {
  "use cache";
  cacheTag(`cart:${userId}`);
  return fetchCart(userId);
}
```

❌ Errado:

```ts
async function getCart() {
  "use cache";
  const session = (await cookies()).get("session"); // erro: dado da requisição dentro do cache
  return fetchCart(session!.value);
}
```

### NEXT-DF-007 [MUST] Invalide por tag após mutações

**Por quê:** `updateTag` em Server Actions expira o cache imediatamente e garante que o usuário leia
o que acabou de escrever. `revalidateTag(tag, "max")` serve stale-while-revalidate para eventos
externos (webhooks). Invalidar por caminho é frágil e amplo demais.

✅ Correto:

```ts
"use server";
import { updateTag } from "next/cache";

export async function renameProduct(input: unknown) {
  // auth + validação (ver nextjs/server-actions-and-mutations)
  await db.update(products).set({ name }).where(eq(products.id, id));
  updateTag(`product:${id}`);
}
```

❌ Errado:

```ts
"use server";
export async function renameProduct(input: unknown) {
  await db.update(products).set({ name }).where(eq(products.id, id));
  revalidatePath("/", "layout"); // invalida a aplicação inteira
}
```

### NEXT-DF-008 [SHOULD] Deduplique leituras por requisição com `React.cache`

**Por quê:** layout, página e metadata frequentemente leem o mesmo dado. `cache` do React memoiza
por requisição sem compartilhar entre usuários.

✅ Correto:

```ts
import "server-only";
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  return session
    ? db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, session.userId) })
    : null;
});
```

❌ Errado:

```ts
// cada chamada em layout, page e generateMetadata faz uma nova query
export async function getCurrentUser() {
  const session = await getSession();
  return db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, session!.userId) });
}
```

### NEXT-DF-009 [SHOULD] Use `connection()` para marcar rotas explicitamente dinâmicas

**Por quê:** valores como `Date.now()` ou `Math.random()` precisam de um ponto claro que diga ao
Next.js que o trecho depende da requisição, em vez de serem congelados no prerender.

✅ Correto:

```tsx
import { connection } from "next/server";

async function ServerTime() {
  await connection();
  return <time>{new Date().toISOString()}</time>;
}
```

❌ Errado:

```tsx
export const dynamic = "force-dynamic"; // força a página inteira a ser dinâmica
export default function Page() {
  return <time>{new Date().toISOString()}</time>;
}
```

### NEXT-DF-010 [MAY] Pré-gere rotas com `generateStaticParams`

**Por quê:** para catálogos com conjunto conhecido de slugs, pré-gerar as páginas mais acessadas no
build reduz latência; os demais slugs são gerados sob demanda.
