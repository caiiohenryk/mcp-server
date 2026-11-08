"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { idleState, type ActionState } from "./action-state";
import { FormMessage } from "./form-message";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A destructive action behind a native <dialog> confirmation.
 * The dialog closes on success; errors stay visible inside it.
 */
export function ConfirmAction({
  action,
  fields,
  triggerLabel,
  triggerAriaLabel,
  title,
  description,
  confirmLabel,
}: {
  action: Action;
  fields: Record<string, string>;
  triggerLabel: string;
  /** Accessible name when the trigger label alone is ambiguous in a table row. */
  triggerAriaLabel?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (state.status === "success") dialog.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        className={buttonClass({ variant: "danger", size: "sm" })}
        onClick={() => dialog.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="border-line-strong bg-sheet text-ink m-auto w-[min(32rem,calc(100vw-2rem))] rounded border p-0 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] backdrop:bg-black/40"
      >
        <form action={formAction} className="space-y-4 p-6">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={titleId} className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          <div id={descId} className="text-pencil space-y-2 text-base">
            {description}
          </div>
          <FormMessage state={state.status === "error" ? state : idleState} />
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              className={buttonClass({ variant: "secondary" })}
              onClick={() => dialog.current?.close()}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className={buttonClass({ variant: "danger-solid" })}
            >
              {pending ? "Aguarde…" : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
      <span className="sr-only" role="status" aria-live="polite">
        {state.status === "success" ? state.message : ""}
      </span>
    </>
  );
}
