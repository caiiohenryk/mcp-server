---
id: nextjs/components-and-client-boundaries
title: Componentes e fronteiras de cliente no Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Quando usar Server ou Client Components no React 19, onde colocar "use client", o que pode cruzar a fronteira e como compor componentes sem inflar o bundle.
tags: [components, server-components, client-components, use-client, react-19, composition]
applies_to: ["src/app/**", "src/components/**", "src/features/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nextjs/data-fetching-and-caching, nextjs/performance, nextjs/security]
---

# Componentes e fronteiras de cliente no Next.js

No App Router todo componente é Server Component por padrão. `"use client"` marca uma fronteira:
o arquivo e tudo o que ele importa vão para o bundle do navegador. Estas regras mantêm essa
fronteira pequena e segura.

### NEXT-CB-001 [MUST] Mantenha componentes como Server Components por padrão

**Por quê:** Server Components não enviam JavaScript ao cliente, acessam dados diretamente e
mantêm segredos no servidor. Use `"use client"` só para estado, efeitos, event handlers ou APIs do
navegador.

✅ Correto:

```tsx
// src/components/product-card.tsx (Server Component)
export function ProductCard({ product }: { product: Product }) {
  return (
    <article>
      <h2>{product.name}</h2>
      <AddToCartButton productId={product.id} />
    </article>
  );
}
```

❌ Errado:

```tsx
"use client"; // sem estado nem eventos: só aumenta o bundle
export function ProductCard({ product }: { product: Product }) {
  return (
    <article>
      <h2>{product.name}</h2>
    </article>
  );
}
```

### NEXT-CB-002 [MUST] Coloque `"use client"` no menor componente folha possível

**Por quê:** a diretiva no topo de uma página transforma toda a árvore importada em código de
cliente. Extraia só a parte interativa.

✅ Correto:

```tsx
// src/features/cart/add-to-cart-button.tsx
"use client";
export function AddToCartButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button disabled={pending} onClick={() => startTransition(() => addToCart(productId))}>
      Adicionar
    </button>
  );
}
```

❌ Errado:

```tsx
// src/app/products/[id]/page.tsx
"use client";
export default function Page() {
  /* página inteira no cliente por causa de um botão */
}
```

### NEXT-CB-003 [MUST NOT] Passe objetos completos com dados sensíveis para Client Components

**Por quê:** tudo que vai como prop para um Client Component é serializado no HTML/RSC payload e
fica visível no navegador. Passe apenas os campos necessários (DTO).

✅ Correto:

```tsx
<UserMenu user={{ name: user.name, avatarUrl: user.avatarUrl }} />
```

❌ Errado:

```tsx
<UserMenu user={user} /> // inclui passwordHash, email, flags internas
```

### NEXT-CB-004 [MUST] Passe Server Components para Client Components via `children`

**Por quê:** um Client Component não pode importar um Server Component, mas pode recebê-lo como
`children` ou prop. Isso mantém o conteúdo renderizado no servidor.

✅ Correto:

```tsx
// page.tsx (server)
<Tabs>
  <ServerRenderedReport />
</Tabs>;

// tabs.tsx
("use client");
export function Tabs({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return open ? <div>{children}</div> : null;
}
```

❌ Errado:

```tsx
"use client";
import { ServerRenderedReport } from "./report"; // vira Client Component e perde acesso a dados
```

### NEXT-CB-005 [MUST] Passe somente valores serializáveis pela fronteira

**Por quê:** props de Server para Client Component são serializadas. Funções (exceto Server
Actions), classes e instâncias quebram em runtime.

✅ Correto:

```tsx
<PriceTag amountInCents={product.priceInCents} currency="BRL" onBuy={buyAction} />
```

❌ Errado:

```tsx
<PriceTag price={new Money(product.price)} format={(v) => v.toFixed(2)} />
```

### NEXT-CB-006 [SHOULD] Use `use()` para consumir Promises iniciadas no servidor

**Por quê:** iniciar a busca no Server Component e passar a Promise permite streaming sem
bloquear a renderização do pai e sem `useEffect`.

✅ Correto:

```tsx
// page.tsx
const commentsPromise = listComments(postId);
return (
  <Suspense fallback={<CommentsSkeleton />}>
    <Comments commentsPromise={commentsPromise} />
  </Suspense>
);

// comments.tsx
("use client");
export function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);
  return (
    <ul>
      {comments.map((c) => (
        <li key={c.id}>{c.body}</li>
      ))}
    </ul>
  );
}
```

❌ Errado:

```tsx
"use client";
export function Comments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  useEffect(
    () =>
      void fetch(`/api/posts/${postId}/comments`)
        .then((r) => r.json())
        .then(setComments),
    [postId],
  );
  return <ul>{/* ... */}</ul>;
}
```

### NEXT-CB-007 [SHOULD NOT] Use `useEffect` para derivar estado ou sincronizar props

**Por quê:** efeitos para cálculo causam renderizações extras e bugs de sincronização. Calcule
durante a renderização.

✅ Correto:

```tsx
const visible = items.filter((i) => i.name.includes(query));
```

❌ Errado:

```tsx
const [visible, setVisible] = useState(items);
useEffect(() => setVisible(items.filter((i) => i.name.includes(query))), [items, query]);
```

### NEXT-CB-008 [MUST] Envolva providers de contexto em um Client Component dedicado

**Por quê:** Context não funciona em Server Components. Um `providers.tsx` com `"use client"`
permite que o layout continue sendo Server Component.

✅ Correto:

```tsx
// src/app/providers.tsx
"use client";
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// src/app/layout.tsx
<body>
  <Providers>{children}</Providers>
</body>;
```

❌ Errado:

```tsx
// src/app/layout.tsx
"use client"; // layout raiz inteiro no cliente
```

### NEXT-CB-009 [MAY] Use o React Compiler em vez de `useMemo`/`useCallback` manuais

**Por quê:** com `reactCompiler: true` no `next.config.ts`, a memoização é automática e a
memoização manual vira ruído. Avalie o custo de build antes de habilitar.
