import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { env } from "@/env";
import { audit } from "@/server/audit/log";
import { getDb } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";
import { getActiveAllowedUser } from "./allowlist";

function buildProviders(): Provider[] {
  const e = env();
  const providers: Provider[] = [];
  if (e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        authorization: e.AUTH_GOOGLE_HOSTED_DOMAIN
          ? { params: { hd: e.AUTH_GOOGLE_HOSTED_DOMAIN, prompt: "select_account" } }
          : { params: { prompt: "select_account" } },
      }),
    );
  }
  if (e.AUTH_MICROSOFT_ENTRA_ID_ID && e.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
    providers.push(MicrosoftEntraID({ issuer: e.AUTH_MICROSOFT_ENTRA_ID_ISSUER }));
  }
  if (e.AUTH_GITHUB_ID && e.AUTH_GITHUB_SECRET) providers.push(GitHub);
  return providers;
}

/** Provider ids + names, for rendering the sign-in page. */
export function enabledProviders(): { id: string; name: string }[] {
  return buildProviders().map((p) => {
    const cfg = typeof p === "function" ? p() : p;
    return { id: cfg.id, name: cfg.name };
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  const config: NextAuthConfig = {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: "database", maxAge: 60 * 60 * 8 }, // 8h
    providers: buildProviders(),
    pages: { signIn: "/login", error: "/login" },
    trustHost: true,
    callbacks: {
      /** Allowlist gate: anyone not explicitly allowed is rejected before a session exists. */
      async signIn({ user, profile }) {
        const email = (user.email ?? profile?.email ?? "").toLowerCase();
        const allowed = email ? await getActiveAllowedUser(db, email) : null;
        if (!allowed) {
          await audit(db, { action: "auth.sign_in_denied", actorEmail: email || null });
          return "/login?error=AccessDenied";
        }
        return true;
      },
      async session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
    events: {
      async signIn({ user }) {
        await audit(db, { action: "auth.sign_in", actorUserId: user.id, actorEmail: user.email });
      },
    },
  };
  return config;
});
