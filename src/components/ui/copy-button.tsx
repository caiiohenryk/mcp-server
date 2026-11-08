"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "./button";

/** Copies `value` to the clipboard and announces the result to screen readers. */
export function CopyButton({
  value,
  label = "Copiar",
  variant = "secondary",
  className = "",
}: {
  value: string;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={buttonClass({ variant, size: "sm", className })}
      >
        {state === "copied" ? "Copiado" : state === "failed" ? "Selecione e copie" : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Copiado para a área de transferência" : ""}
        {state === "failed"
          ? "Não foi possível copiar. Selecione o texto e copie manualmente."
          : ""}
      </span>
    </>
  );
}
