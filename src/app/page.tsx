import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

/** `/` is only a router: the dashboard for signed-in people, the login otherwise. */
export const instant = false;

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/tokens" : "/login");
}
