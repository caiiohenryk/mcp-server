---
id: nextjs/performance
title: Performance em aplicações Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Como manter Core Web Vitals saudáveis no Next.js 16 — imagens, scripts de terceiros, bundle do cliente, streaming, Partial Prerendering e trabalho pós-resposta com after().
tags: [performance, core-web-vitals, images, bundle, streaming, lcp, cls]
applies_to: ["src/app/**", "src/components/**", "next.config.ts"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nextjs/data-fetching-and-caching, nextjs/components-and-client-boundaries, nextjs/styling]
---

# Performance em aplicações Next.js

Metas para páginas públicas no p75 de usuários reais: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. A maior
alavanca é enviar menos JavaScript e não bloquear a renderização com dados lentos.

### NEXT-PERF-001 [MUST] Use `next/image` com dimensões ou `sizes` para todas as imagens de conteúdo

**Por quê:** o componente gera formatos modernos, tamanhos responsivos e reserva espaço, evitando
CLS. `<img>` cru baixa a imagem original em todos os dispositivos.

✅ Correto:

```tsx
import Image from "next/image";

<Image
  src={product.imageUrl}
  alt={product.name}
  width={640}
  height={480}
  sizes="(max-width: 768px) 100vw, 640px"
/>;
```

❌ Errado:

```tsx
<img src={product.imageUrl} />
```

### NEXT-PERF-002 [MUST NOT] Carregue lazy a imagem de LCP

**Por quê:** a imagem principal acima da dobra precisa começar a baixar imediatamente; lazy load
atrasa o LCP.

✅ Correto:

```tsx
<Image src={hero} alt="Painel de vendas" loading="eager" fetchPriority="high" sizes="100vw" />
```

❌ Errado:

```tsx
<Image src={hero} alt="Painel de vendas" loading="lazy" />
```

### NEXT-PERF-003 [MUST] Carregue scripts de terceiros com `next/script` e estratégia explícita

**Por quê:** tags de analytics e chat bloqueiam a thread principal e pioram o INP. `afterInteractive`
ou `lazyOnload` adiam o custo.

✅ Correto:

```tsx
import Script from "next/script";
<Script src="https://widget.example.com/chat.js" strategy="lazyOnload" />;
```

❌ Errado:

```tsx
<head>
  <script src="https://widget.example.com/chat.js"></script>
</head>
```

### NEXT-PERF-004 [SHOULD] Carregue sob demanda componentes cliente pesados

**Por quê:** editores, gráficos e mapas podem ter centenas de KB. `next/dynamic` tira o código do
bundle inicial até ser necessário.

✅ Correto:

```tsx
"use client";
import dynamic from "next/dynamic";

const RichEditor = dynamic(() => import("./rich-editor").then((m) => m.RichEditor), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
```

❌ Errado:

```tsx
"use client";
import { RichEditor } from "./rich-editor"; // 400 KB no bundle de toda página que importa este arquivo
```

### NEXT-PERF-005 [SHOULD NOT] Importe bibliotecas inteiras quando só uma função é usada

**Por quê:** importações de barril ou do pacote inteiro trazem código morto ao bundle. Prefira
imports por caminho ou bibliotecas modulares e configure `optimizePackageImports` quando necessário.

✅ Correto:

```ts
import { format } from "date-fns/format";
import debounce from "lodash-es/debounce";
```

❌ Errado:

```ts
import _ from "lodash";
import * as dateFns from "date-fns";
```

### NEXT-PERF-006 [MUST] Use `after()` para trabalho que não afeta a resposta

**Por quê:** registrar analytics, enviar e-mail ou auditar dentro do fluxo principal aumenta o
tempo de resposta. `after` executa depois que a resposta foi enviada.

✅ Correto:

```ts
"use server";
import { after } from "next/server";

export async function checkout(input: unknown) {
  const user = await requireUser();
  const order = await orders.create(db, user, checkoutSchema.parse(input));
  after(() => analytics.track("checkout.completed", { orderId: order.id }));
  return { ok: true, orderId: order.id };
}
```

❌ Errado:

```ts
const order = await orders.create(db, user, data);
await analytics.track("checkout.completed", { orderId: order.id }); // usuário espera o analytics
await sendReceiptEmail(order); // e o e-mail
```

### NEXT-PERF-007 [SHOULD] Mantenha o shell estático e isole partes dinâmicas em `Suspense`

**Por quê:** com Cache Components o Next.js faz Partial Prerendering: o shell estático vem do
cache instantaneamente e só os buracos dinâmicos são renderizados por requisição.

✅ Correto:

```tsx
export default function Page() {
  return (
    <>
      <StaticHero />
      <Suspense fallback={<PriceSkeleton />}>
        <PersonalizedPrice />
      </Suspense>
    </>
  );
}
```

❌ Errado:

```tsx
export default async function Page() {
  const session = await getSession(); // torna a página inteira dinâmica
  return (
    <>
      <StaticHero />
      <PersonalizedPrice userId={session.userId} />
    </>
  );
}
```

### NEXT-PERF-008 [SHOULD] Meça Web Vitals reais com `useReportWebVitals`

**Por quê:** Lighthouse local não representa usuários reais. Envie as métricas de campo para a
ferramenta de observabilidade e acompanhe o p75.

✅ Correto:

```tsx
"use client";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    navigator.sendBeacon(
      "/api/vitals",
      JSON.stringify({ name: metric.name, value: metric.value, id: metric.id }),
    );
  });
  return null;
}
```

❌ Errado:

```tsx
// nenhuma medição em produção; performance avaliada só no notebook do dev
```

### NEXT-PERF-009 [MAY] Analise o bundle antes de otimizar

**Por quê:** antes de otimizar, descubra o que realmente pesa. Use o analisador de bundle oficial
do Next.js ao investigar regressões de tamanho e registre o antes/depois no PR.
