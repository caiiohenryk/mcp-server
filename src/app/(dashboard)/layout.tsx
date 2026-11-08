import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NavLinks, type NavItem } from "@/components/nav/nav-links";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { signOutAction } from "./actions";
import { PageSkeleton } from "./page-skeleton";

const MEMBER_NAV: NavItem[] = [
  { href: "/tokens", label: "Tokens" },
  { href: "/connect", label: "Conectar" },
  { href: "/standards", label: "Standards" },
];
const ADMIN_NAV: NavItem[] = [
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/audit", label: "Auditoria" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="bg-pen text-pen-ink sr-only z-50 rounded px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <header className="border-line bg-sheet sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 sm:px-6">
          <Link href="/tokens" className="py-3 text-base font-extrabold tracking-[-0.01em]">
            Padrões PV1
          </Link>
          <Suspense fallback={<div className="h-11 flex-1" aria-hidden />}>
            <UserNav />
          </Suspense>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<PageSkeleton />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </div>
  );
}

/** Authoritative check (session + active allowlist entry) before any page renders. */
async function AuthGate({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}

async function UserNav() {
  const user = await requireUser();
  const items = user.role === "admin" ? [...MEMBER_NAV, ...ADMIN_NAV] : MEMBER_NAV;
  return (
    <>
      <nav
        aria-label="Principal"
        className="order-last -mx-2 w-full sm:order-none sm:mx-0 sm:w-auto sm:flex-1"
      >
        <NavLinks items={items} />
      </nav>
      <div className="ml-auto flex items-center gap-3 py-2 sm:ml-0">
        <span
          className="text-pencil hidden max-w-[16rem] truncate text-sm md:inline"
          title={user.email}
        >
          {user.email}
        </span>
        <form action={signOutAction}>
          <button type="submit" className={buttonClass({ variant: "secondary", size: "sm" })}>
            Sair
          </button>
        </form>
      </div>
    </>
  );
}
