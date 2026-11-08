---
id: nextjs/server-actions-and-mutations
title: Server Actions e mutações no Next.js
technology: nextjs
version: 1
status: stable
severity: MUST
summary: Como escrever Server Actions seguras no Next.js 16 — autorização na primeira linha, validação com zod, retorno tipado, invalidação de cache e formulários com useActionState.
tags: [server-actions, mutations, forms, zod, authorization, use-action-state]
applies_to: ["src/**/actions.ts", "src/app/**"]
owners: ["@caiiohenryk"]
updated_at: 2026-11-08
related: [nextjs/data-fetching-and-caching, nextjs/security, nextjs/error-handling]
---

# Server Actions e mutações no Next.js

Server Actions são endpoints HTTP públicos: qualquer pessoa pode chamá-las com qualquer payload,
mesmo que o botão não apareça na UI. Estas regras tratam cada action como uma API.

### NEXT-SA-001 [MUST] Autorize na primeira linha de toda Server Action

**Por quê:** a action pode ser invocada diretamente via POST. Esconder o botão na UI não protege
nada; checar sessão e permissão antes de qualquer outra coisa sim.

✅ Correto:

```ts
"use server";
import { requireUser } from "@/server/auth";

export async function deleteProject(input: unknown) {
  const user = await requireUser();
  const { projectId } = deleteProjectSchema.parse(input);
  await assertCanManageProject(user, projectId);
  await removeProject(projectId);
}
```

❌ Errado:

```ts
"use server";
export async function deleteProject(projectId: string) {
  await removeProject(projectId); // qualquer um apaga qualquer projeto
}
```

### NEXT-SA-002 [MUST] Valide a entrada com zod e trate argumentos como `unknown`

**Por quê:** tipos TypeScript não existem em runtime. O payload vem do cliente e pode ter qualquer
forma.

✅ Correto:

```ts
"use server";
import { z } from "zod";

const schema = z.object({ title: z.string().trim().min(1).max(200) });

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse({ title: formData.get("title") });
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
  await insertTask(user.id, parsed.data);
  return { ok: true };
}
```

❌ Errado:

```ts
"use server";
export async function createTask(data: { title: string }) {
  await db.insert(tasks).values(data); // aceita qualquer campo, inclusive ownerId
}
```

### NEXT-SA-003 [MUST] Retorne erros esperados como dados, não como exceções

**Por quê:** exceções em actions viram a mensagem genérica do `error.tsx` mais próximo e perdem o
contexto do formulário. Erros de validação e regra de negócio são parte do contrato.

✅ Correto:

```ts
export type ActionState =
  { ok: true } | { ok: false; message?: string; errors?: Record<string, string[] | undefined> };

if (await emailTaken(email)) return { ok: false, errors: { email: ["E-mail já cadastrado"] } };
```

❌ Errado:

```ts
if (await emailTaken(email)) throw new Error("E-mail já cadastrado");
```

### NEXT-SA-004 [MUST] Mantenha actions finas e delegue para `src/server`

**Por quê:** a action só adapta entrada (auth, parse, invalidação). A regra de negócio em
`src/server` é testável sem Next.js e reutilizável por Route Handlers.

✅ Correto:

```ts
"use server";
export async function approveInvoice(input: unknown) {
  const user = await requireUser();
  const { invoiceId } = approveSchema.parse(input);
  await invoices.approve(db, user, invoiceId);
  updateTag(`invoice:${invoiceId}`);
}
```

❌ Errado:

```ts
"use server";
export async function approveInvoice(invoiceId: string) {
  const invoice = await db.query.invoices.findFirst(/* ... */);
  if (invoice.total > 10000 && !invoice.secondApprover) {
    /* 60 linhas de regra de negócio dentro da action */
  }
}
```

### NEXT-SA-005 [MUST] Invalide o cache afetado após a escrita

**Por quê:** sem invalidação o usuário vê o dado antigo depois de salvar. Use `updateTag` para
leitura imediata da própria escrita; `refresh()` quando só a rota atual precisa ser recarregada.

✅ Correto:

```ts
await tasks.complete(db, user, taskId);
updateTag(`tasks:${user.id}`);
```

❌ Errado:

```ts
await tasks.complete(db, user, taskId);
// sem invalidação: lista continua mostrando a tarefa como pendente
```

### NEXT-SA-006 [SHOULD] Use `useActionState` e `useFormStatus` para estado de formulário

**Por quê:** os hooks do React 19 dão estado pendente, resultado e progressive enhancement sem
`useState`/`fetch` manuais.

✅ Correto:

```tsx
"use client";
import { useActionState } from "react";

export function TaskForm() {
  const [state, formAction, pending] = useActionState(createTask, { ok: true });
  return (
    <form action={formAction}>
      <input name="title" aria-invalid={!state.ok} />
      {!state.ok && <p role="alert">{state.errors?.title?.[0]}</p>}
      <button disabled={pending}>Salvar</button>
    </form>
  );
}
```

❌ Errado:

```tsx
"use client";
export function TaskForm() {
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/tasks", { method: "POST", body: new FormData(e.currentTarget) });
    setLoading(false);
  }
  return <form onSubmit={onSubmit}>{/* ... */}</form>;
}
```

### NEXT-SA-007 [MUST NOT] Aceite ids de dono ou papéis vindos do cliente

**Por quê:** `userId`, `tenantId` ou `role` no payload permitem escalonamento de privilégio. A
identidade vem sempre da sessão no servidor.

✅ Correto:

```ts
const user = await requireUser();
await insertComment({ authorId: user.id, body: parsed.data.body });
```

❌ Errado:

```ts
await insertComment({ authorId: formData.get("authorId") as string, body });
```

### NEXT-SA-008 [SHOULD NOT] Use Server Actions para leitura de dados

**Por quê:** actions rodam em sequência, usam POST e não participam do cache. Leia em Server
Components e passe os dados por props.

✅ Correto:

```tsx
export default async function Page() {
  const tasks = await listTasks();
  return <TaskList tasks={tasks} />;
}
```

❌ Errado:

```tsx
"use client";
useEffect(() => {
  getTasksAction().then(setTasks); // action usada como GET
}, []);
```

### NEXT-SA-009 [MUST] Chame `redirect` fora de `try/catch`

**Por quê:** `redirect()` e `notFound()` funcionam lançando um erro de controle. Capturá-lo impede
a navegação.

✅ Correto:

```ts
let id: string;
try {
  id = await projects.create(db, user, data);
} catch (e) {
  return { ok: false, message: "Não foi possível criar o projeto" };
}
redirect(`/projects/${id}`);
```

❌ Errado:

```ts
try {
  const id = await projects.create(db, user, data);
  redirect(`/projects/${id}`); // capturado pelo catch abaixo
} catch {
  return { ok: false, message: "Erro" };
}
```
