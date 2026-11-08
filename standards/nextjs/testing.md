---
id: nextjs/testing
title: Testes em aplicações Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Como testar aplicações Next.js 16 — Vitest para lógica de servidor e Server Actions, Testing Library para Client Components e Playwright para fluxos E2E.
tags: [testing, vitest, testing-library, playwright, e2e, server-actions]
applies_to: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/e2e/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [shared/testing-strategy, nextjs/server-actions-and-mutations, nextjs/project-structure]
---

# Testes em aplicações Next.js

A pirâmide é: muitos testes Vitest de `src/server` (rápidos, sem navegador), testes de componentes
cliente com Testing Library e poucos testes Playwright cobrindo os fluxos críticos de ponta a ponta.
Server Components assíncronos são cobertos por E2E, não por testes unitários.

### NEXT-TEST-001 [MUST] Teste a lógica de `src/server` com Vitest ao lado do arquivo

**Por quê:** regras de negócio isoladas do Next.js testam em milissegundos. Teste ao lado do arquivo
(`*.test.ts`) torna óbvio o que está sem cobertura.

✅ Correto:

```ts
// src/server/orders/pricing.test.ts
import { describe, expect, it } from "vitest";
import { calculateTotal } from "./pricing";

describe("calculateTotal", () => {
  it("applies the coupon before shipping", () => {
    expect(calculateTotal({ items: [{ price: 100, qty: 2 }], coupon: 0.1, shipping: 15 })).toBe(
      195,
    );
  });
});
```

❌ Errado:

```
tests/
  everything.test.ts   # um arquivo gigante distante do código
```

### NEXT-TEST-002 [MUST] Teste Server Actions cobrindo sem sessão, entrada inválida e sucesso

**Por quê:** actions são endpoints públicos. Os três casos garantem que autorização e validação
não regridem.

✅ Correto:

```ts
vi.mock("@/server/auth", () => ({ requireUser: vi.fn() }));

it("rejects unauthenticated calls", async () => {
  vi.mocked(requireUser).mockRejectedValue(new AuthError("UNAUTHENTICATED"));
  await expect(deleteProject({ projectId: "p1" })).rejects.toThrow(AuthError);
});

it("rejects invalid input", async () => {
  vi.mocked(requireUser).mockResolvedValue(user);
  await expect(deleteProject({ projectId: 42 })).rejects.toThrow();
});
```

❌ Errado:

```ts
it("works", async () => {
  await deleteProject({ projectId: "p1" }); // só caminho feliz
});
```

### NEXT-TEST-003 [MUST] Teste Client Components pelo comportamento visível ao usuário

**Por quê:** consultas por papel e texto acessível refletem como o usuário usa a tela e não quebram
em refatorações internas.

✅ Correto:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("shows validation error", async () => {
  render(<TaskForm />);
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Título obrigatório");
});
```

❌ Errado:

```tsx
const { container } = render(<TaskForm />);
container.querySelector(".btn-primary")!.dispatchEvent(new MouseEvent("click"));
expect(container.querySelector(".error-text")).not.toBeNull();
```

### NEXT-TEST-004 [MUST] Cubra fluxos críticos com Playwright contra o build de produção

**Por quê:** só o build real exercita Server Components, cache, proxy e streaming juntos. Rodar
contra `next dev` esconde problemas de prerender.

✅ Correto:

```ts
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

❌ Errado:

```ts
export default defineConfig({
  webServer: { command: "pnpm dev", url: "http://localhost:3000" },
});
```

### NEXT-TEST-005 [MUST] Use seletores acessíveis e asserções com espera automática no Playwright

**Por quê:** `getByRole` com `expect(...).toBeVisible()` espera o elemento aparecer e evita testes
instáveis. `waitForTimeout` mascara condições de corrida.

✅ Correto:

```ts
test("user creates a task", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Título").fill("Revisar PR");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Revisar PR" })).toBeVisible();
});
```

❌ Errado:

```ts
await page.click("#app > div:nth-child(3) button");
await page.waitForTimeout(3000);
expect(await page.$(".task-item")).toBeTruthy();
```

### NEXT-TEST-006 [SHOULD] Isole dados de teste por execução

**Por quê:** testes que dependem de dados compartilhados falham em paralelo e dependem de ordem.
Crie os dados no próprio teste ou em fixture, com identificadores únicos.

✅ Correto:

```ts
// tests/e2e/fixtures.ts cria registros direto no banco de teste
test("edits own project", async ({ page, seed }) => {
  const project = await seed.project({ name: `p-${crypto.randomUUID()}` });
  await page.goto(`/projects/${project.id}`);
});
```

❌ Errado:

```ts
test("edits project", async ({ page }) => {
  await page.goto("/projects/1"); // depende de seed manual e de outro teste não apagar
});
```

### NEXT-TEST-007 [SHOULD NOT] Faça snapshot de árvores de componentes inteiras

**Por quê:** snapshots grandes são aprovados sem leitura e quebram a cada mudança de markup sem
indicar regressão real.

✅ Correto:

```tsx
expect(screen.getByRole("heading", { name: "Pedido #123" })).toBeVisible();
```

❌ Errado:

```tsx
expect(render(<OrderPage order={order} />).container).toMatchSnapshot();
```
