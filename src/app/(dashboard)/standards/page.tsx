import type { Metadata } from "next";
import Link from "next/link";
import { StandardListItem } from "@/components/standards/meta";
import { PageHeader } from "@/components/ui/page-header";
import { extractRules } from "@/server/standards/rules";
import { listStandards, listTechnologies } from "@/server/standards/repository";

export const metadata: Metadata = { title: "Standards" };

export default function StandardsCatalogPage() {
  // Cross-cutting standards first: they apply to every project.
  const technologies = [...listTechnologies()].sort((a, b) =>
    a.technology === "shared" ? -1 : b.technology === "shared" ? 1 : a.name.localeCompare(b.name),
  );

  return (
    <>
      <PageHeader
        title="Standards"
        description="O que as ferramentas de IA conectadas leem antes de escrever código. Cada documento reúne regras numeradas com o nível de exigência da RFC 2119."
      />

      {technologies.length === 0 ? (
        <p className="border-line-strong text-pencil rounded border border-dashed px-5 py-8">
          O catálogo ainda está vazio. Os standards ficam em{" "}
          <code className="font-mono">standards/</code> no repositório.
        </p>
      ) : (
        <div className="space-y-14">
          {technologies.map((tech) => {
            const standards = listStandards({ technology: tech.technology });
            const versions = Object.entries(tech.versions);
            return (
              <section key={tech.technology} aria-labelledby={`tech-${tech.technology}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2
                    id={`tech-${tech.technology}`}
                    className="text-xl font-bold tracking-[-0.015em]"
                  >
                    <Link
                      href={`/standards/${tech.technology}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {tech.name}
                    </Link>
                  </h2>
                  {versions.length > 0 && (
                    <p className="text-pencil text-sm">
                      Para{" "}
                      {versions.map(([pkg, v], i) => (
                        <span key={pkg}>
                          {i > 0 && ", "}
                          {pkg} {v}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <p className="text-pencil mt-1 max-w-[70ch]">{tech.description}</p>
                {standards.length === 0 ? (
                  <p className="border-line text-pencil mt-4 border-t pt-4 text-sm">
                    Nenhum standard publicado ainda.
                  </p>
                ) : (
                  <ul className="mt-4">
                    {standards.map((s) => (
                      <StandardListItem
                        key={s.id}
                        standard={s}
                        ruleCount={extractRules(s.body).length}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
