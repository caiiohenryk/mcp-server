"use server";

import { signOut } from "@/server/auth/config";
import { requireUser } from "@/server/auth/session";

export async function signOutAction(): Promise<void> {
  await requireUser();
  await signOut({ redirectTo: "/login" });
}
