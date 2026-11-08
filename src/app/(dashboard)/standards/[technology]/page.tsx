import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StandardListItem } from "@/components/standards/meta";
import { StandardMarkdown } from "@/components/standards/standard-markdown";
import { PageHeader } from "@/components/ui/page-header";
import { extractRules } from "@/server/standards/rules";
import { getTechnology, listStandards, listTechnologies } from "@/server/standards/repository";

interface Props {
  params: Promise<{ technology: string }>;
}

export function generateStaticParams() {
  return listTechnologies().map((t) => ({ technology: t.technology }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { technology } = await params;
  return { title: getTechnology(technology)?.name ?? "Standards" };
}

export default async function TechnologyPage({ params }: Props) {
  const { technology } = await params;
  const tech = getTechnology(technology);
  if (!tech) notFound();

  const standards = listStandards({ technology, includeDeprecated: true }).sort(
    (a, b) => Number(a.status === "deprecated") - Number(b.status === "deprecated"),
  );
  const versions = Object.entries(tech.versions);

  return (
    <>
      <PageHeader title={tech.name} description={tech.description}>
        <nav aria-label="Trilha" className="text-pencil mb-2 text-sm">
          <Link href="/standards" className="underline-offset-4 hover:underline">
            Standards
          </Link>
        </nav>
      </PageHeader>

      <dl className="text-pencil -mt-4 mb-8 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {versions.length > 0 && (
          <div>
            <dt className="inline font-semibold">Versões-alvo: </dt>
            <dd className="text-ink inline">
              {versions.map(([pkg, v]) => `${pkg} ${v}`).join(", ")}
            </dd>
          </div>
        )}
        <div>
          <dt className="inline font-semibold">Responsáveis: </dt>
          <dd className="text-ink inline">{tech.owners.join(", ")}</dd>
        </div>
      </dl>

      {tech.body.trim() && (
        <div className="mb-10">
          <StandardMarkdown markdown={tech.body} />
        </div>
      )}

      <section aria-labelledby="lista">
        <h2 id="lista" className="text-lg font-bold tracking-tight">
          {standards.length === 1 ? "1 standard" : `${standards.length} standards`}
        </h2>
        {standards.length === 0 ? (
          <p className="text-pencil mt-3">Nenhum standard publicado para esta tecnologia ainda.</p>
        ) : (
          <ul className="mt-3">
            {standards.map((s) => (
              <StandardListItem key={s.id} standard={s} ruleCount={extractRules(s.body).length} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
