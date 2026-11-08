"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CodeBlock } from "@/components/ui/code-block";
import type { ConnectionSnippet } from "./snippets";

/** WAI-ARIA tabs (automatic activation, arrow/Home/End keys) over connection snippets. */
export function SnippetTabs({ snippets }: { snippets: ConnectionSnippet[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = snippets.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  const current = snippets[active]!;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Ferramenta de IA"
        className="border-line -mx-1 flex gap-1 overflow-x-auto border-b px-1"
      >
        {snippets.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${baseId}-tab-${s.id}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap ${
              i === active ? "border-pen text-ink" : "text-pencil hover:text-ink border-transparent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
        className="pt-4"
      >
        <p className="text-pencil mb-3 text-sm">{current.hint}</p>
        <CodeBlock code={current.code} caption={current.location} />
      </div>
    </div>
  );
}
