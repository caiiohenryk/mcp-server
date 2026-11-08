"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import {
  addAllowedUser,
  deactivateAllowedUser,
  emailSchema,
  setAllowedUserRole,
} from "@/server/auth/allowlist";
import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

const roleSchema = z.enum(["admin", "member"], { message: "Escolha um papel." });
/** Parses an email form field; null when invalid (so the caller can attach a field error). */
function parseEmail(value: FormDataEntryValue | null): string | null {
  const r = emailSchema.pipe(z.string().max(254)).safeParse(value);
  return r.success ? r.data : null;
}

const ROLE_LABEL = { admin: "admin", member: "membro" } as const;

function invalidEmail(): ActionState {
  return {
    status: "error",
    message: "Confira os campos destacados.",
    fieldErrors: { email: "Informe um e-mail válido, como nome@example.com." },
  };
}

export async function addUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const target = parseEmail(formData.get("email"));
  const role = roleSchema.safeParse(formData.get("role"));
  if (!target) return invalidEmail();
  if (!role.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: { role: "Escolha um papel." },
    };
  }

  await addAllowedUser(
    getDb(),
    { userId: admin.id, email: admin.email },
    { email: target, role: role.data },
  );
  revalidatePath("/admin/users");
  return { status: "success", message: `${target} pode entrar como ${ROLE_LABEL[role.data]}.` };
}

export async function changeRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const target = parseEmail(formData.get("email"));
  const role = roleSchema.safeParse(formData.get("role"));
  if (!target || !role.success) {
    return { status: "error", message: "Não foi possível ler os dados do formulário." };
  }
  if (target === admin.email && role.data !== "admin") {
    return {
      status: "error",
      message: "Você não pode tirar o próprio acesso de admin. Peça a outro admin.",
    };
  }
  await setAllowedUserRole(getDb(), { userId: admin.id, email: admin.email }, target, role.data);
  revalidatePath("/admin/users");
  return { status: "success", message: `${target} agora é ${ROLE_LABEL[role.data]}.` };
}

export async function deactivateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const target = parseEmail(formData.get("email"));
  if (!target) {
    return { status: "error", message: "Não foi possível ler os dados do formulário." };
  }
  if (target === admin.email) {
    return { status: "error", message: "Você não pode remover o próprio acesso." };
  }
  await deactivateAllowedUser(getDb(), { userId: admin.id, email: admin.email }, target);
  revalidatePath("/admin/users");
  return {
    status: "success",
    message: `Acesso de ${target} removido. Tokens revogados e sessões encerradas.`,
  };
}
