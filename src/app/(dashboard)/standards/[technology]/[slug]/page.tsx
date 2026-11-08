import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatIsoDay } from "@/components/format/date";
import { STATUS_LABEL, standardHref, standardSlug, StatusTag } from "@/components/standards/meta";
import { RuleLevelMark } from "@/components/standards/rule-level";
import { ruleAnchor, StandardMarkdown } from "@/components/standards/standard-markdown";
import { extractRules, type RuleLevel } from "@/server/standards/rules";
import { getStandard, getTechnology, listStandards } from "@/server/standards/repository";

export function generateStaticParams() {
  return listStandards({ includeDeprecated: true }).map((s) => ({
    technology: s.technology,
    slug: standardSlug(s),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { technology, slug } = await params;
  const s = getStandard(`${technology}/${slug}`);
  return { title: s?.title ?? "Standard", description: s?.summary };
}

interface Props {
  params: Promise<{ technology: string; slug: string }>;
}

const LEVEL_ORDER: RuleLevel[] = ["MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY"];

export default async function StandardPage({ params }: Props) {
  const { technology, slug } = await params;
  const standard = getStandard(`${technology}/${slug}`);
  if (!standard) notFound();

  const tech = getTechnology(standard.technology);
  const rules = extractRules(standard.body);
  const counts = LEVEL_ORDER.map((level) => ({
    level,
    n: rules.filter((r) => r.level === level).length,
  })).filter((c) => c.n > 0);
  const related = standard.related.map((id) => ({ id, s: getStandard(id) }));

  return (
    <article>
      <header className="mb-10 max-w-[72ch]">
        <nav aria-label="Trilha" className="text-pencil mb-3 text-sm">
          <ol className="flex flex-wrap gap-x-2">
            <li>
              <Link href="/standards" className="underline-offset-4 hover:underline">
                Standards
              </Link>
              <span aria-hidden className="ml-2">
                /
              </span>
            </li>
            <li>
              <Link
                href={`/standards/${standard.technology}`}
                className="underline-offset-4 hover:underline"
              >
                {tech?.name ?? standard.technology}
              </Link>
            </li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-balance sm:text-3xl">
          {standard.title}
        </h1>
        <p className="text-pencil mt-3 text-lg leading-relaxed text-pretty">{standard.summary}</p>

        {standard.status === "deprecated" && (
          <p className="border-red bg-red-soft text-red mt-5 rounded border-l-4 px-3 py-2 text-sm font-semibold">
            Este standard está obsoleto. Não use como referência para código novo.
          </p>
        )}

        <dl className="border-line mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-pencil">Exigência máxima</dt>
            <dd className="mt-1">
              <RuleLevelMark level={standard.severity} />
            </dd>
          </div>
          <div>
            <dt className="text-pencil">Status</dt>
            <dd className="mt-1">
              <StatusTag status={standard.status} />
              <span className="sr-only"> ({STATUS_LABEL[standard.status]})</span>
            </dd>
          </div>
          <div>
            <dt className="text-pencil">Versão</dt>
            <dd className="mt-1 font-semibold">v{standard.version}</dd>
          </div>
          <div>
            <dt className="text-pencil">Atualizado em</dt>
            <dd className="mt-1 font-semibold">
              <time dateTime={standard.updated_at}>{formatIsoDay(standard.updated_at)}</time>
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,72ch)_minmax(14rem,1fr)]">
        <div className="min-w-0 lg:order-1">
          <StandardMarkdown markdown={standard.body} />
        </div>

        <aside className="space-y-8 text-sm lg:order-2">
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
            {rules.length > 0 && (
              <nav aria-labelledby="indice-regras">
                <h2 id="indice-regras" className="font-bold">
                  {rules.length === 1 ? "1 regra" : `${rules.length} regras`}
                </h2>
                <p className="text-pencil mt-1">
                  {counts.map((c, i) => (
                    <span key={c.level}>
                      {i > 0 && ", "}
                      {c.n} {c.level}
                    </span>
                  ))}
                </p>
                <ol className="mt-3 space-y-2">
                  {rules.map((r) => (
                    <li key={r.id}>
                      <a
                        href={`#${ruleAnchor(r.id)}`}
                        className="group hover:text-pen grid grid-cols-[auto_1fr] gap-x-2 leading-snug"
                      >
                        <RuleLevelMark level={r.level} className="self-start text-[0.7rem]" />
                        <span className="group-hover:underline">{r.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            {related.length > 0 && (
              <section aria-labelledby="relacionados" className="mt-8">
                <h2 id="relacionados" className="font-bold">
                  Relacionados
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {related.map(({ id, s }) => (
                    <li key={id}>
                      {s ? (
                        <Link
                          href={standardHref(s)}
                          className="text-pen underline-offset-4 hover:underline"
                        >
                          {s.title}
                        </Link>
                      ) : (
                        <span className="text-pencil font-mono">{id}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <dl className="border-line text-pencil mt-8 space-y-2 border-t pt-4">
              <div>
                <dt className="inline">Responsáveis: </dt>
                <dd className="text-ink inline">{standard.owners.join(", ")}</dd>
              </div>
              {standard.tags.length > 0 && (
                <div>
                  <dt className="inline">Tags: </dt>
                  <dd className="text-ink inline">{standard.tags.join(", ")}</dd>
                </div>
              )}
              {standard.applies_to.length > 0 && (
                <div>
                  <dt className="inline">Vale para: </dt>
                  <dd className="text-ink inline">{standard.applies_to.join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className="inline">ID no MCP: </dt>
                <dd className="text-ink inline font-mono">{standard.id}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </article>
  );
}
