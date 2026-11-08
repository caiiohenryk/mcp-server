import Link from "next/link";
import type { Standard } from "@/server/standards/types";
import { RuleLevelMark } from "./rule-level";

export const STATUS_LABEL: Record<Standard["status"], string> = {
  draft: "Rascunho",
  stable: "Estável",
  deprecated: "Obsoleto",
};

export function standardSlug(s: Pick<Standard, "id">): string {
  return s.id.split("/")[1]!;
}

export function standardHref(s: Pick<Standard, "id">): string {
  return `/standards/${s.id}`;
}

/** Small status tag. Stable is the norm, so it is the quietest. */
export function StatusTag({ status }: { status: Standard["status"] }) {
  const tone =
    status === "stable"
      ? "border-line-strong text-pencil"
      : status === "draft"
        ? "border-dashed border-line-strong text-ink"
        : "border-red text-red";
  return (
    <span className={`inline-block rounded border px-1.5 py-px text-xs font-semibold ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** One row of a standards list: title, summary and the facts an engineer scans for. */
export function StandardListItem({
  standard,
  ruleCount,
}: {
  standard: Standard;
  ruleCount: number;
}) {
  return (
    <li className="border-line grid gap-x-6 gap-y-1 border-t py-4 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <Link
          href={standardHref(standard)}
          className={`text-base font-bold tracking-tight underline-offset-4 hover:underline ${standard.status === "deprecated" ? "text-pencil line-through" : ""}`}
        >
          {standard.title}
        </Link>
        <p className="text-pencil mt-1 max-w-[70ch] text-sm leading-relaxed">{standard.summary}</p>
      </div>
      <div className="flex items-start gap-3 text-sm sm:justify-end">
        <RuleLevelMark level={standard.severity} />
        <span className="text-pencil whitespace-nowrap">
          {ruleCount === 1 ? "1 regra" : `${ruleCount} regras`}
        </span>
        {standard.status !== "stable" && <StatusTag status={standard.status} />}
      </div>
    </li>
  );
}
