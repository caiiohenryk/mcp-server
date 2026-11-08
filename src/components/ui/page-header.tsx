import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[62ch]">
        {children}
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-balance sm:text-3xl">{title}</h1>
        {description && <p className="text-pencil mt-2 text-base text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-titulo` : undefined;
  return (
    <section aria-labelledby={headingId} className="mt-10 first:mt-0">
      <h2 id={headingId} className="text-lg font-bold tracking-tight">
        {title}
      </h2>
      {description && <p className="text-pencil mt-1 max-w-[62ch] text-sm">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
