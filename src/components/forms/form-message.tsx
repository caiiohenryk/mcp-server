import type { ActionState } from "./action-state";

/**
 * Live region for a form's result. Always rendered (empty when idle) so screen
 * readers pick up changes.
 */
export function FormMessage({ state, id }: { state: ActionState; id?: string }) {
  const tone =
    state.status === "error"
      ? "border-red bg-red-soft text-red"
      : state.status === "success"
        ? "border-green bg-green-soft text-green"
        : "";
  return (
    <div id={id} role="status" aria-live="polite" aria-atomic="true">
      {state.status !== "idle" && (
        <p className={`rounded border-l-4 px-3 py-2 text-sm font-medium ${tone}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}

export function fieldError(state: ActionState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}
