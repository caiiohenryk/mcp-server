---
id: shared/testing-strategy
title: Estratégia de testes
technology: shared
version: 1
status: stable
severity: MUST
summary: Que tipos de teste escrever, onde colocá-los, como mantê-los determinísticos e quando o CI deve bloquear — base comum para qualquer stack.
tags: [testing, unit-tests, integration-tests, e2e, ci, coverage]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [shared/code-review, shared/ai-assisted-development]
---

# Estratégia de testes

Testes existem para permitir mudar o código com segurança. Este documento define o mínimo comum;
cada tecnologia detalha ferramentas em seu próprio standard (`nextjs/testing`, `nestjs/testing`,
`terraform/testing`).

### SHARED-TEST-001 [SHOULD] Siga o formato de troféu: maioria de testes de integração

**Por quê:** testes de integração (módulo real + banco real em container/memória, rede externa
simulada) pegam a maior parte dos bugs com custo moderado. Unitários puros SHOULD cobrir lógica de
domínio e funções puras; E2E SHOULD cobrir apenas os fluxos críticos de negócio (login, checkout,
cadastro).

✅ Correto:

```text
domain/pricing.test.ts        unit         regras de desconto (puro)
orders/orders.service.test.ts integration  serviço + Postgres em container
e2e/checkout.spec.ts          e2e          fluxo de compra completo
```

❌ Errado:

```text
orders.service.test.ts  mocka repository, mocka mapper, mocka logger, mocka config
                        e só verifica que repository.save foi chamado
```

### SHARED-TEST-002 [MUST] Coloque testes ao lado do código que testam

**Por quê:** proximidade torna óbvio o que está sem teste e mantém o teste atualizado no mesmo
diff. Use o sufixo `*.test.ts` (ou o padrão da linguagem). Só E2E e testes de carga ficam em pasta
própria.

✅ Correto:

```text
src/billing/invoice.ts
src/billing/invoice.test.ts
e2e/billing.spec.ts
```

❌ Errado:

```text
src/billing/invoice.ts
test/unit/services/billing/invoice/invoiceTest.ts
```

### SHARED-TEST-003 [MUST] Escreva testes determinísticos e isolados

**Por quê:** teste intermitente (flaky) destrói a confiança no CI. Testes MUST NOT depender de
relógio real, ordem de execução, rede externa ou estado deixado por outro teste. Controle tempo e
aleatoriedade, e crie os dados de que o teste precisa.

✅ Correto:

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
});

it("expires the token after 15 minutes", () => {
  const token = issueToken();
  vi.advanceTimersByTime(15 * 60_000 + 1);
  expect(isExpired(token)).toBe(true);
});
```

❌ Errado:

```ts
it("expires the token", async () => {
  const token = issueToken();
  await new Promise((r) => setTimeout(r, 2000)); // lento e sensível à carga
  expect(isExpired(token)).toBe(true);
});
```

### SHARED-TEST-004 [MUST] Acompanhe toda correção de bug com um teste que falhava antes

**Por quê:** o teste de regressão prova que o bug foi entendido e impede que volte. O PR de
correção MUST conter o teste; rode-o antes da correção para confirmar que falha.

✅ Correto:

```ts
// fix(billing): round totals half-even (#231)
it("rounds 2.675 to 2.68 using half-even on cents (#231)", () => {
  expect(roundMoney(2.675)).toBe(2.68);
});
```

❌ Errado:

```text
fix(billing): ajusta arredondamento
  src/billing/round.ts | 2 +-
  (nenhum teste alterado)
```

### SHARED-TEST-005 [MUST] Teste comportamento observável, não detalhes de implementação

**Por quê:** testes acoplados à implementação quebram em toda refatoração sem achar bugs. Verifique
saídas, efeitos persistidos e respostas, não chamadas internas nem estado privado.

✅ Correto:

```ts
await service.cancel(order.id);
expect(await repo.findById(order.id)).toMatchObject({ status: "cancelled" });
```

❌ Errado:

```ts
await service.cancel(order.id);
expect(repo.update).toHaveBeenCalledWith(order.id, { status: "cancelled" });
expect(service["internalCache"].size).toBe(0);
```

### SHARED-TEST-006 [SHOULD] Simule apenas fronteiras externas

**Por quê:** mocks substituem código que você não controla (APIs de terceiros, e-mail, filas
gerenciadas). Simular seus próprios módulos esconde erros de integração. Para HTTP, intercepte na
rede (MSW, nock) em vez de mockar o cliente.

✅ Correto:

```ts
server.use(
  http.post("https://api.payments.example/charges", () =>
    HttpResponse.json({ id: "ch_1", status: "succeeded" }),
  ),
);
```

❌ Errado:

```ts
vi.mock("../orders/orders.repository");
vi.mock("../orders/pricing");
vi.mock("../orders/orders.mapper");
```

### SHARED-TEST-007 [MUST] Bloqueie o merge quando testes falharem no CI

**Por quê:** teste que não bloqueia é ignorado. O pipeline MUST rodar lint, typecheck e testes em
todo PR como check obrigatório. Teste instável MUST ser corrigido ou removido com issue vinculada,
nunca marcado como "permitido falhar".

✅ Correto:

```yaml
jobs:
  check:
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test
```

❌ Errado:

```yaml
- run: pnpm test
  continue-on-error: true
```

### SHARED-TEST-008 [SHOULD] Use cobertura como alarme, não como meta

**Por quê:** cobertura alta não garante bons testes, mas queda de cobertura indica código novo sem
teste. Configure limite mínimo (SHOULD ser ≥ 80% de linhas no código de domínio/serviço) que falha
o CI, e não escreva testes sem asserções só para subir o número.

✅ Correto:

```ts
coverage: {
  include: ["src/server/**"],
  thresholds: { lines: 80, functions: 80, branches: 75 },
}
```

❌ Errado:

```ts
it("covers the module", () => {
  createInvoice(fakeInput); // nenhuma asserção
});
```

### SHARED-TEST-009 [SHOULD] Nomeie testes pelo comportamento esperado

**Por quê:** o nome do teste é a mensagem que aparece quando ele falha. Descreva cenário e
resultado; agrupe por unidade com `describe`.

✅ Correto:

```ts
describe("cancelOrder", () => {
  it("refunds the payment when the order was paid", async () => {});
  it("rejects cancellation after shipment", async () => {});
});
```

❌ Errado:

```ts
it("test 1", async () => {});
it("works", async () => {});
```
