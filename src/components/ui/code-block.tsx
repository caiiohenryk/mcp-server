import { CopyButton } from "./copy-button";

/** A copyable block of code, with an optional caption (file path, "Terminal"…). */
export function CodeBlock({
  code,
  caption,
  copyLabel = "Copiar",
}: {
  code: string;
  caption?: string;
  copyLabel?: string;
}) {
  return (
    <figure className="border-line bg-code overflow-hidden rounded border">
      <div className="border-line flex items-center justify-between gap-3 border-b px-3 py-1.5">
        <figcaption className="text-pencil truncate text-sm">{caption ?? ""}</figcaption>
        <CopyButton value={code} label={copyLabel} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-relaxed">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
