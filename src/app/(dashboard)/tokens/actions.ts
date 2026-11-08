"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listTechnologies } from "@/server/standards/repository";
import { ALL_STANDARDS_SCOPE, scopeForTechnology } from "@/server/tokens/scopes";
import { createToken, revokeToken, TokenError } from "@/server/tokens/service";
import { EXPIRATION_OPTIONS, type CreateTokenState } from "./options";

const createSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao token.").max(64, "Use no máximo 64 caracteres."),
  scopeMode: z.enum(["all", "some"], { message: "Escolha o acesso do token." }),
  technologies: z.array(z.string().max(64)).max(32).default([]),
  expiresInDays: z.coerce
    .number()
    .refine((v) => (EXPIRATION_OPTIONS as readonly number[]).includes(v), {
      message: "Escolha uma das validades da lista.",
    }),
});

export async function createTokenAction(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const user = await requireUser();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    scopeMode: formData.get("scopeMode"),
    technologies: formData.getAll("technologies"),
    expiresInDays: formData.get("expiresInDays"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Confira os campos destacados.", fieldErrors };
  }
  const input = parsed.data;

  let scopes: string[];
  if (input.scopeMode === "all") {
    scopes = [ALL_STANDARDS_SCOPE];
  } else {
    const known = new Set(
      listTechnologies()
        .map((t) => t.technology)
        .filter((t) => t !== "shared"),
    );
    const selected = [...new Set(input.technologies)].filter((t) => known.has(t));
    if (selected.length === 0) {
      return {
        status: "error",
        message: "Confira os campos destacados.",
        fieldErrors: { technologies: "Escolha ao menos uma tecnologia." },
      };
    }
    scopes = selected.map(scopeForTechnology);
  }

  try {
    const { token } = await createToken(
      getDb(),
      { userId: user.id, email: user.email },
      { name: input.name, scopes, expiresInDays: input.expiresInDays },
    );
    revalidatePath("/tokens");
    return {
      status: "created",
      message: `Token "${input.name}" criado.`,
      token,
      name: input.name,
    };
  } catch (e) {
    if (e instanceof TokenError) {
      return {
        status: "error",
        message:
          e.code === "limit_reached"
            ? e.message
            : "Não foi possível criar o token com esses dados. Revise e tente de novo.",
      };
    }
    throw e;
  }
}

const revokeSchema = z.object({ tokenId: z.string().uuid() });

export async function revokeTokenAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = revokeSchema.safeParse({ tokenId: formData.get("tokenId") });
  if (!parsed.success) return { status: "error", message: "Token inválido." };

  try {
    await revokeToken(getDb(), { userId: user.id, email: user.email }, parsed.data.tokenId);
  } catch (e) {
    if (e instanceof TokenError && e.code === "not_found") {
      return { status: "error", message: "Este token já foi revogado ou não existe mais." };
    }
    throw e;
  }
  revalidatePath("/tokens");
  return {
    status: "success",
    message: "Token revogado. Ferramentas que o usavam perdem o acesso agora.",
  };
}
