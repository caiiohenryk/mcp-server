"use client";

import { useEffect } from "react";
import { buttonClass } from "./button";

/** Shared body for error.tsx boundaries. Never shows raw error messages. */
export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <div role="alert" className="max-w-xl py-10">
      <h1 className="text-2xl font-bold tracking-[-0.02em]">
        Não foi possível carregar esta página
      </h1>
      <p className="text-pencil mt-3">
        Tente de novo. Se o erro continuar, avise um admin da plataforma
        {digest ? (
          <>
            {" "}
            informando o código <code className="font-mono text-sm">{digest}</code>
          </>
        ) : null}
        .
      </p>
      <button type="button" onClick={() => retry()} className={buttonClass({ className: "mt-6" })}>
        Tentar de novo
      </button>
    </div>
  );
}
