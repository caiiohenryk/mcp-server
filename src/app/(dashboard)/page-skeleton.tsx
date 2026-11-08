/** Neutral placeholder while a dashboard page streams in. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Carregando…</span>
      <div className="bg-line h-9 w-64 rounded" />
      <div className="bg-line/70 mt-3 h-4 w-96 max-w-full rounded" />
      <div className="mt-10 space-y-3">
        <div className="bg-line/60 h-12 rounded" />
        <div className="bg-line/50 h-12 rounded" />
        <div className="bg-line/40 h-12 rounded" />
      </div>
    </div>
  );
}
