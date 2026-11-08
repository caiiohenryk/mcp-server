---
id: nextjs/styling
title: Estilização com Tailwind CSS no Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Como estilizar aplicações Next.js 16 com Tailwind CSS v4 — tokens com @theme, composição de classes, variantes, fontes com next/font e acessibilidade visual.
tags: [styling, tailwind, css, design-tokens, fonts, accessibility]
applies_to: ["src/app/globals.css", "src/components/**", "src/features/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nextjs/components-and-client-boundaries, nextjs/performance]
---

# Estilização com Tailwind CSS no Next.js

Tailwind CSS v4 é a única solução de estilo. A configuração vive em CSS (`@theme`), não em
`tailwind.config.js`. Bibliotecas CSS-in-JS em runtime não são usadas porque não funcionam em
Server Components.

### NEXT-STY-001 [MUST] Defina design tokens com `@theme` em `globals.css`

**Por quê:** tokens centralizados geram utilitários consistentes (`bg-brand`, `text-muted`) e
permitem trocar tema sem caçar valores mágicos.

✅ Correto:

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.55 0.2 260);
  --color-muted: oklch(0.6 0.02 260);
  --font-sans: var(--font-inter);
  --radius-card: 0.75rem;
}
```

❌ Errado:

```tsx
<div className="rounded-[12px] bg-[#3b5bdb] text-[#868e96]">...</div>
```

### NEXT-STY-002 [MUST NOT] Use CSS-in-JS com runtime

**Por quê:** styled-components e Emotion exigem Client Components, adicionam JavaScript e quebram
o streaming de Server Components.

✅ Correto:

```tsx
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card bg-white p-4 shadow-sm">{children}</div>;
}
```

❌ Errado:

```tsx
"use client";
import styled from "styled-components";
export const Card = styled.div`
  border-radius: 12px;
  padding: 16px;
`;
```

### NEXT-STY-003 [MUST] Combine classes condicionais com um helper `cn`

**Por quê:** concatenação manual gera espaços duplicados e conflitos (`p-2 p-4`). Um helper com
`clsx` + `tailwind-merge` resolve conflitos de forma determinística.

✅ Correto:

```tsx
import { cn } from "@/lib/cn";

<button className={cn("rounded px-4 py-2", variant === "danger" && "bg-red-600", className)} />;
```

❌ Errado:

```tsx
<button
  className={"rounded px-4 py-2 " + (variant === "danger" ? "bg-red-600" : "") + " " + className}
/>
```

### NEXT-STY-004 [MUST NOT] Monte nomes de classe dinamicamente por interpolação

**Por quê:** o Tailwind gera CSS a partir de strings literais encontradas no código. Classes
montadas em runtime não existem no CSS final.

✅ Correto:

```tsx
const colors = { success: "bg-green-600", error: "bg-red-600" } as const;
<span className={colors[status]} />;
```

❌ Errado:

```tsx
<span className={`bg-${status === "success" ? "green" : "red"}-600`} />
```

### NEXT-STY-005 [SHOULD] Defina variantes de componentes em um mapa tipado

**Por quê:** variantes explícitas documentam a API do componente e impedem combinações inválidas.

✅ Correto:

```tsx
const variants = {
  primary: "bg-brand text-white hover:bg-brand/90",
  ghost: "bg-transparent hover:bg-muted/10",
} as const;

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn("rounded px-4 py-2", variants[variant], className)} {...props} />;
}
```

❌ Errado:

```tsx
export function Button({ isPrimary, isGhost, isLarge, isRed, ...props }: Props) {
  /* booleanos que se contradizem */
}
```

### NEXT-STY-006 [MUST] Carregue fontes com `next/font`

**Por quê:** `next/font` hospeda a fonte localmente, elimina requisições externas e evita layout
shift com `size-adjust` automático.

✅ Correto:

```tsx
// src/app/layout.tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

❌ Errado:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />
```

### NEXT-STY-007 [MUST] Garanta foco visível e contraste mínimo AA

**Por quê:** remover o outline sem substituto torna a aplicação inutilizável por teclado. Contraste
abaixo de 4.5:1 em texto normal reprova WCAG 2.2 AA.

✅ Correto:

```tsx
<button className="focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
  Salvar
</button>
```

❌ Errado:

```tsx
<button className="bg-white text-gray-300 outline-none">Salvar</button>
```

### NEXT-STY-008 [SHOULD] Implemente dark mode com variáveis CSS, não com classes duplicadas

**Por quê:** redefinir tokens no tema escuro evita `dark:` em cada elemento e mantém um único
ponto de mudança.

✅ Correto:

```css
@theme {
  --color-surface: oklch(1 0 0);
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: oklch(0.2 0 0);
  }
}
```

❌ Errado:

```tsx
<div className="border-gray-200 bg-white text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
```
