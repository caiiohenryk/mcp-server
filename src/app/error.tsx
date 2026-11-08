"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <ErrorState error={error} retry={retry} />
    </main>
  );
}
