import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/server/db/client";
import { getActiveAllowedUser, type Role } from "./allowlist";
import { auth } from "./config";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
}

/**
 * Authoritative check for every dashboard request/server action:
 * a valid session AND an active allowlist entry. Removing someone from the
 * allowlist therefore takes effect on their very next request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email) return null;
  const allowed = await getActiveAllowedUser(getDb(), email);
  if (!allowed) return null;
  return {
    id: session.user.id,
    email: allowed.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: allowed.role,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/tokens");
  return user;
}
