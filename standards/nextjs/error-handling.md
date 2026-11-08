---
id: nextjs/error-handling
title: Tratamento de erros no Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Como tratar erros esperados e inesperados no App Router do Next.js 16 — error.tsx, global-error.tsx, notFound, erros tipados, Route Handlers e registro de exceções.
tags: [errors, error-boundary, not-found, route-handlers, logging, resilience]
applies_to: ["src/app/**", "src/server/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nextjs/server-actions-and-mutations, shared/observability]
---

# Tratamento de erros no Next.js

Separe **erros esperados** (validação, recurso inexistente, sem permissão), que são parte do
contrato e retornam como dados ou status HTTP, de **erros inesperados** (bugs, falhas de
infraestrutura), que sobem até um error boundary e são registrados.

### NEXT-EH-001 [MUST] Tenha `error.tsx` em cada segmento principal e `global-error.tsx` na raiz

**Por quê:** sem boundary, um erro derruba a página inteira com a tela padrão. `error.tsx` MUST ser
Client Component; `global-error.tsx` substitui o layout raiz e MUST renderizar `<html>` e `<body>`.

✅ Correto:

```tsx
// src/app/(dashboard)/error.tsx
"use client";
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert">
      <p>Algo deu errado. Código: {error.digest}</p>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  );
}
```

❌ Errado:

```tsx
// src/app/(dashboard)/error.tsx — sem "use client" e exibindo detalhes internos
export default function Error({ error }: { error: Error }) {
  return <pre>{error.stack}</pre>;
}
```

### NEXT-EH-002 [MUST] Chame `notFound()` para recursos inexistentes

**Por quê:** renderiza o `not-found.tsx` mais próximo com status 404, em vez de uma página vazia
com 200 ou um erro 500.

✅ Correto:

```tsx
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  return <OrderDetails order={order} />;
}
```

❌ Errado:

```tsx
const order = await getOrder(id);
return order ? <OrderDetails order={order} /> : <p>Não encontrado</p>; // status 200
```

### NEXT-EH-003 [MUST] Use classes de erro com `code` para erros de domínio

**Por quê:** comparar mensagens é frágil e quebra com tradução. Um `code` estável permite mapear o
erro para HTTP, mensagem de UI e métrica.

✅ Correto:

```ts
export class DomainError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

throw new DomainError("CONFLICT", "Slug já em uso");
```

❌ Errado:

```ts
throw "slug already used";
// ...
if (e.message.includes("already")) {
  /* ... */
}
```

### NEXT-EH-004 [MUST NOT] Exponha stack trace, SQL ou mensagens internas ao usuário

**Por quê:** detalhes internos ajudam atacantes e confundem usuários. Mostre mensagem genérica e
o `digest`, que correlaciona com o log do servidor.

✅ Correto:

```ts
} catch (e) {
  logger.error({ err: e, orderId }, "order.create.failed");
  return { ok: false, message: "Não foi possível criar o pedido. Tente novamente." };
}
```

❌ Errado:

```ts
} catch (e) {
  return { ok: false, message: (e as Error).message }; // "duplicate key value violates unique constraint..."
}
```

### NEXT-EH-005 [MUST] Retorne status HTTP corretos e corpo padronizado em Route Handlers

**Por quê:** consumidores externos dependem do status para decidir retry e tratamento. Um formato
único de erro simplifica clientes.

✅ Correto:

```ts
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "INVALID_INPUT", issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  const result = await createWebhook(parsed.data);
  return Response.json(result, { status: 201 });
}
```

❌ Errado:

```ts
export async function POST(request: Request) {
  try {
    const data = await request.json();
    return Response.json(await createWebhook(data));
  } catch (e) {
    return Response.json({ success: false, error: String(e) }); // 200 com erro
  }
}
```

### NEXT-EH-006 [MUST] Registre exceções inesperadas com `onRequestError`

**Por quê:** o hook `onRequestError` em `instrumentation.ts` captura erros de Server Components,
Route Handlers e Server Actions em um único ponto, com contexto da rota.

✅ Correto:

```ts
// instrumentation.ts
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { reportError } = await import("@/server/observability");
  await reportError(err, { path: request.path, method: request.method, route: context.routePath });
};
```

❌ Errado:

```ts
// try/catch com console.log copiado em cada página
try {
  /* ... */
} catch (e) {
  console.log(e);
}
```

### NEXT-EH-007 [SHOULD NOT] Envolva todo Server Component em `try/catch`

**Por quê:** capturar e esconder erros impede o boundary de agir e mascara falhas. Trate só erros
esperados e deixe o resto subir para `error.tsx`.

✅ Correto:

```tsx
export default async function Page() {
  const report = await getReport(); // falha inesperada sobe para error.tsx
  return <Report data={report} />;
}
```

❌ Errado:

```tsx
export default async function Page() {
  try {
    const report = await getReport();
    return <Report data={report} />;
  } catch {
    return null; // página em branco, sem log
  }
}
```
