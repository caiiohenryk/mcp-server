import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-pencil font-mono text-sm">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em]">Esta página não existe</h1>
      <p className="text-pencil mt-3">
        O endereço pode ter mudado ou o standard foi removido do catálogo.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/standards" className={buttonClass()}>
          Ver standards
        </Link>
        <Link href="/tokens" className={buttonClass({ variant: "secondary" })}>
          Ir para tokens
        </Link>
      </div>
    </main>
  );
}
