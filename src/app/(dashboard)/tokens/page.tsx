import type { Metadata } from "next";
import Link from "next/link";
import { mcpUrlFrom } from "@/components/connect/snippets";
import { PageHeader, Section } from "@/components/ui/page-header";
import { env } from "@/env";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listTechnologies } from "@/server/standards/repository";
import { listTokens, MAX_ACTIVE_TOKENS_PER_USER } from "@/server/tokens/service";
import { CreateTokenForm } from "./create-token-form";
import type { TechnologyOption } from "./options";
import { TokenTable } from "./token-table";

export const metadata: Metadata = { title: "Tokens" };

export default async function TokensPage() {
  const user = await requireUser();
  const tokens = await listTokens(getDb(), user.id);
  const now = new Date();

  const technologies: TechnologyOption[] = listTechnologies()
    .filter((t) => t.technology !== "shared")
    .map((t) => ({ slug: t.technology, name: t.name }));

  const active = tokens.filter((t) => t.status === "active");
  const inactive = tokens.filter((t) => t.status !== "active");

  return (
    <>
      <PageHeader
        title="Tokens"
        description={
          <>
            Cada token dá à sua ferramenta de IA acesso de leitura aos standards pelo MCP. Use um
            token por ferramenta ou máquina. Depois de criar, veja{" "}
            <Link href="/connect" className="text-pen underline underline-offset-4">
              como conectar
            </Link>
            .
          </>
        }
      />

      <Section id="criar" title="Criar token">
        <div className="border-line bg-sheet rounded border p-5 sm:p-6">
          <CreateTokenForm
            technologies={technologies}
            mcpUrl={mcpUrlFrom(env().AUTH_URL)}
            atLimit={active.length >= MAX_ACTIVE_TOKENS_PER_USER}
          />
        </div>
      </Section>

      <Section
        id="ativos"
        title="Seus tokens"
        description={`${active.length} de ${MAX_ACTIVE_TOKENS_PER_USER} tokens ativos.`}
      >
        {active.length === 0 ? (
          <p className="border-line-strong text-pencil rounded border border-dashed px-5 py-8">
            Você ainda não tem tokens ativos. Crie o primeiro acima para conectar sua ferramenta.
          </p>
        ) : (
          <TokenTable
            tokens={active}
            technologies={technologies}
            now={now}
            caption="Tokens ativos"
          />
        )}
      </Section>

      {inactive.length > 0 && (
        <details className="group mt-8">
          <summary className="text-pencil hover:text-ink cursor-pointer text-sm font-semibold">
            Revogados e expirados ({inactive.length})
          </summary>
          <div className="mt-4">
            <TokenTable
              tokens={inactive}
              technologies={technologies}
              now={now}
              caption="Tokens revogados e expirados"
            />
          </div>
        </details>
      )}
    </>
  );
}
