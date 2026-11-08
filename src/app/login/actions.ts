"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { enabledProviders, signIn } from "@/server/auth/config";
import { safeNextPath } from "./safe-next";

const signInInput = z.object({
  provider: z.string().trim().min(1).max(64),
  next: z.string().max(2048).optional(),
});

/**
 * Starts the OAuth flow. Public by design (it is the login), so there is no
 * requireUser(); the allowlist is enforced in the Auth.js `signIn` callback.
 */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const parsed = signInInput.safeParse({
    provider: formData.get("provider"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success || !enabledProviders().some((p) => p.id === parsed.data.provider)) {
    redirect("/login?error=Configuration");
  }
  await signIn(parsed.data.provider, { redirectTo: safeNextPath(parsed.data.next) });
}
