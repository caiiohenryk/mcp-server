---
id: nextjs/security
title: Segurança em aplicações Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Controles de segurança obrigatórios para Next.js 16 — server-only, variáveis NEXT_PUBLIC, autorização na camada de dados, CSP, headers, taint e proteção de Route Handlers.
tags: [security, server-only, csp, authorization, secrets, headers, taint]
applies_to: ["src/**", "proxy.ts", "next.config.ts"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related:
  [
    shared/security-baseline,
    nextjs/server-actions-and-mutations,
    nextjs/components-and-client-boundaries,
  ]
---

# Segurança em aplicações Next.js

Complementa `shared/security-baseline` com controles específicos do App Router. A premissa: o
navegador é hostil, toda Server Action e Route Handler é uma API pública e todo dado que cruza para
o cliente é visível.

### NEXT-SEC-001 [MUST] Importe `"server-only"` em módulos com segredos ou acesso a dados

**Por quê:** se um Client Component importar o módulo por engano, o build falha em vez de enviar
credenciais e queries ao navegador.

✅ Correto:

```ts
// src/server/payments/client.ts
import "server-only";
import { env } from "@/env";

export const payments = new PaymentsClient({ apiKey: env.PAYMENTS_API_KEY });
```

❌ Errado:

```ts
// src/lib/payments.ts — importável de qualquer lugar
export const payments = new PaymentsClient({ apiKey: process.env.PAYMENTS_API_KEY! });
```

### NEXT-SEC-002 [MUST NOT] Coloque segredos em variáveis `NEXT_PUBLIC_*`

**Por quê:** variáveis com esse prefixo são embutidas no JavaScript do cliente no build. Só valores
públicos por natureza (URL pública, chave publicável) podem usá-lo.

✅ Correto:

```bash
NEXT_PUBLIC_SITE_URL=https://app.example.com
STRIPE_SECRET_KEY=sk_live_...        # só servidor
```

❌ Errado:

```bash
NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_DATABASE_URL=postgres://...
```

### NEXT-SEC-003 [MUST] Autorize na camada de dados, não só no `proxy.ts`

**Por quê:** o `proxy.ts` serve para redirecionamentos otimistas; ele não cobre Server Actions
chamadas diretamente nem garante permissão por recurso. Cada função de dados verifica quem pode
acessar o quê.

✅ Correto:

```ts
import "server-only";
export async function getInvoice(invoiceId: string) {
  const user = await requireUser();
  const invoice = await db.query.invoices.findFirst({ where: (i, { eq }) => eq(i.id, invoiceId) });
  if (!invoice || invoice.tenantId !== user.tenantId) return null;
  return toInvoiceDto(invoice);
}
```

❌ Errado:

```ts
// proxy.ts verificou que existe cookie de sessão, então...
export async function getInvoice(invoiceId: string) {
  return db.query.invoices.findFirst({ where: (i, { eq }) => eq(i.id, invoiceId) }); // IDOR
}
```

### NEXT-SEC-004 [MUST] Defina Content-Security-Policy com nonce

**Por quê:** CSP restringe scripts injetados (XSS). Com nonce por requisição gerado no `proxy.ts`,
o Next.js aplica o nonce aos próprios scripts automaticamente.

✅ Correto:

```ts
// proxy.ts
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
```

❌ Errado:

```ts
response.headers.set("Content-Security-Policy", "script-src * 'unsafe-inline' 'unsafe-eval'");
```

### NEXT-SEC-005 [MUST] Envie headers de segurança em todas as respostas

**Por quê:** HSTS, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy` fecham
classes inteiras de ataque com custo zero.

✅ Correto:

```ts
// next.config.ts
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
```

❌ Errado:

```ts
const nextConfig: NextConfig = {}; // sem headers, X-Powered-By exposto
```

### NEXT-SEC-006 [MUST NOT] Use `dangerouslySetInnerHTML` com conteúdo não sanitizado

**Por quê:** HTML vindo de usuário, CMS ou Markdown pode conter scripts. Renderize como texto ou
sanitize com allowlist no servidor.

✅ Correto:

```tsx
import ReactMarkdown from "react-markdown";
<ReactMarkdown>{comment.body}</ReactMarkdown>; // não renderiza HTML bruto por padrão
```

❌ Errado:

```tsx
<div dangerouslySetInnerHTML={{ __html: comment.body }} />
```

### NEXT-SEC-007 [SHOULD] Use as APIs de taint do React para objetos sensíveis

**Por quê:** com `experimental.taint: true`, `taintObjectReference` e `taintUniqueValue` fazem o
React lançar erro se o objeto ou valor marcado for passado a um Client Component.

✅ Correto:

```ts
import "server-only";
import { experimental_taintObjectReference, experimental_taintUniqueValue } from "react";

export async function getUserRecord(id: string) {
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, id) });
  experimental_taintObjectReference("Não passe o registro de usuário ao cliente", user!);
  experimental_taintUniqueValue("Não passe o token ao cliente", user!, user!.apiToken);
  return user;
}
```

❌ Errado:

```ts
export async function getUserRecord(id: string) {
  return db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, id) }); // nada impede vazar
}
```

### NEXT-SEC-008 [MUST] Verifique assinatura e origem em Route Handlers públicos

**Por quê:** webhooks e endpoints sem sessão aceitam requisições de qualquer origem. Sem
verificação de assinatura, qualquer pessoa forja eventos.

✅ Correto:

```ts
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  if (!verifyHmac(payload, signature, env.WEBHOOK_SECRET)) {
    return Response.json({ error: { code: "INVALID_SIGNATURE" } }, { status: 401 });
  }
  await handleEvent(JSON.parse(payload));
  return new Response(null, { status: 204 });
}
```

❌ Errado:

```ts
export async function POST(request: Request) {
  await handleEvent(await request.json()); // aceita qualquer payload
  return Response.json({ ok: true });
}
```

### NEXT-SEC-009 [MUST] Restrinja hosts de imagens remotas

**Por quê:** `remotePatterns` amplo transforma o otimizador de imagens em proxy aberto, usado para
abuso de banda e SSRF.

✅ Correto:

```ts
images: {
  remotePatterns: [{ protocol: "https", hostname: "cdn.example.com", pathname: "/uploads/**" }],
},
```

❌ Errado:

```ts
images: {
  remotePatterns: [{ protocol: "https", hostname: "**" }],
},
```
