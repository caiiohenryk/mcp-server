import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function StandardNotFound() {
  return (
    <div className="max-w-xl py-6">
      <p className="text-pencil font-mono text-sm">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em]">Standard não encontrado</h1>
      <p className="text-pencil mt-3">
        Ele pode ter sido renomeado ou removido. O catálogo mostra tudo o que está publicado.
      </p>
      <Link href="/standards" className={buttonClass({ className: "mt-6" })}>
        Ver o catálogo
      </Link>
    </div>
  );
}
