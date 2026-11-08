"use client";

import { useActionState, useState } from "react";
import { idleState } from "@/components/forms/action-state";
import { fieldError, FormMessage } from "@/components/forms/form-message";
import { buttonClass, inputClass } from "@/components/ui/button";
import { addUserAction, changeRoleAction } from "./actions";

type Role = "admin" | "member";

export function AddUserForm() {
  const [state, formAction, pending] = useActionState(addUserAction, idleState);
  // Controlled: keep the typed email when validation fails; clear it after success.
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.status === "success") setEmail("");
  }
  const emailError = fieldError(state, "email");

  return (
    <form action={formAction} noValidate className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="new-user-email" className="block font-semibold">
            E-mail
          </label>
          <input
            id="new-user-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="nome@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "new-user-email-error" : undefined}
            className={`${inputClass} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor="new-user-role" className="block font-semibold">
            Papel
          </label>
          <select
            id="new-user-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={`${inputClass} mt-1.5 w-auto pr-8`}
          >
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" disabled={pending} className={buttonClass()}>
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
      {emailError && (
        <p id="new-user-email-error" className="text-red text-sm font-medium">
          {emailError}
        </p>
      )}
      <FormMessage state={state} />
    </form>
  );
}

export function RoleForm({ email, role, isSelf }: { email: string; role: Role; isSelf: boolean }) {
  const [state, formAction, pending] = useActionState(changeRoleAction, idleState);
  const [value, setValue] = useState<Role>(role);
  const id = `role-${email}`;

  if (isSelf) {
    return (
      <span>
        {role === "admin" ? "Admin" : "Membro"} <span className="text-pencil">(você)</span>
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <label htmlFor={id} className="sr-only">
        Papel de {email}
      </label>
      <select
        id={id}
        name="role"
        value={value}
        onChange={(e) => setValue(e.target.value as Role)}
        className={`${inputClass} h-8 w-auto py-0 pr-8 text-sm`}
      >
        <option value="member">Membro</option>
        <option value="admin">Admin</option>
      </select>
      {value !== role && (
        <button type="submit" disabled={pending} className={buttonClass({ size: "sm" })}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      )}
      <span
        role="status"
        aria-live="polite"
        className={state.status === "error" ? "text-red text-xs" : "sr-only"}
      >
        {state.status === "idle" ? "" : state.message}
      </span>
    </form>
  );
}

export function ReactivateForm({ email, role }: { email: string; role: Role }) {
  const [state, formAction, pending] = useActionState(addUserAction, idleState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="role" value={role} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Reativar acesso de ${email}`}
        className={buttonClass({ variant: "secondary", size: "sm" })}
      >
        {pending ? "Reativando…" : "Reativar"}
      </button>
      <span
        role="status"
        aria-live="polite"
        className={state.status === "error" ? "text-red text-xs" : "sr-only"}
      >
        {state.status === "idle" ? "" : state.message}
      </span>
    </form>
  );
}
