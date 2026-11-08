import type { Metadata } from "next";
import Link from "next/link";
import {
  buildConnectionSnippets,
  exportTokenLine,
  mcpUrlFrom,
  TOKEN_ENV_VAR,
} from "@/components/connect/snippets";
import { SnippetTabs } from "@/components/connect/snippet-tabs";
import { CodeBlock } from "@/components/ui/code-block";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { env } from "@/env";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Conectar" };

const FIRST_PROMPT = `Antes de escrever código neste projeto, use o MCP padroes-pv1:
1. chame get_usage_contract e siga as instruções;
2. chame get_project_bootstrap para a stack deste repositório;
3. consulte os standards relevantes antes de cada mudança e cite os IDs das regras que aplicar.`;

export default async function ConnectPage() {
  await requireUser();
  const mcpUrl = mcpUrlFrom(env().AUTH_URL);
  const snippets = buildConnectionSnippets(mcpUrl);

  return (
    <>
      <PageHeader
        title="Conectar sua ferramenta"
        description="Três passos: gerar um token, guardar numa variável de ambiente e registrar o servidor MCP na sua ferramenta de IA."
      />

      <ol className="max-w-3xl space-y-12">
        <Step n={1} title="Gere um token">
          <p>
            Crie um token em{" "}
            <Link href="/tokens" className="text-pen underline underline-offset-4">
              Tokens
            </Link>
            . Ele aparece só uma vez; logo após a criação a página já mostra estes mesmos snippets.
          </p>
        </Step>

        <Step n={2} title="Guarde o token numa variável de ambiente">
          <p>
            Nunca cole o token em arquivos do repositório. Adicione esta linha ao seu{" "}
            <code className="font-mono text-[0.9em]">~/.zshrc</code> ou{" "}
            <code className="font-mono text-[0.9em]">~/.bashrc</code> e abra um novo terminal. Os
            exemplos abaixo leem <code className="font-mono text-[0.9em]">${TOKEN_ENV_VAR}</code>.
          </p>
          <div className="mt-4">
            <CodeBlock code={exportTokenLine()} caption="Shell" />
          </div>
        </Step>

        <Step n={3} title="Registre o servidor MCP">
          <dl className="border-line bg-sheet grid gap-x-6 gap-y-3 rounded border p-4 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-pencil font-semibold">URL</dt>
            <dd className="flex flex-wrap items-center gap-3">
              <code className="font-mono break-all">{mcpUrl}</code>
              <CopyButton value={mcpUrl} label="Copiar URL" />
            </dd>
            <dt className="text-pencil font-semibold">Transporte</dt>
            <dd>HTTP (Streamable HTTP)</dd>
            <dt className="text-pencil font-semibold">Cabeçalho</dt>
            <dd>
              <code className="font-mono break-all">Authorization: Bearer &lt;seu token&gt;</code>
            </dd>
          </dl>
          <div className="mt-6">
            <SnippetTabs snippets={snippets} />
          </div>
        </Step>

        <Step n={4} title="Diga ao agente por onde começar">
          <p>
            O servidor expõe ferramentas para o agente descobrir os padrões sozinho. O primeiro
            passo recomendado é chamar{" "}
            <code className="font-mono text-[0.9em]">get_usage_contract</code>, que explica como
            usar o servidor, e <code className="font-mono text-[0.9em]">get_project_bootstrap</code>
            , que devolve os standards essenciais para a stack do projeto. Coloque uma instrução
            assim no <code className="font-mono text-[0.9em]">AGENTS.md</code> ou{" "}
            <code className="font-mono text-[0.9em]">CLAUDE.md</code> do repositório:
          </p>
          <div className="mt-4">
            <CodeBlock code={FIRST_PROMPT} caption="AGENTS.md" />
          </div>
        </Step>
      </ol>

      <aside className="border-line text-pencil mt-14 max-w-3xl border-t pt-6 text-sm">
        <h2 className="text-ink font-bold">Se algo não funcionar</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">401</strong>: token ausente, digitado errado, expirado ou
            revogado. Confira com <code className="font-mono">echo ${TOKEN_ENV_VAR}</code> e crie um
            novo se preciso.
          </li>
          <li>
            O agente diz que não tem acesso a uma tecnologia: o token não a inclui. Crie um token
            com o acesso certo.
          </li>
          <li>
            <strong className="text-ink">429</strong>: muitas chamadas em pouco tempo. Espere um
            minuto e tente de novo.
          </li>
          <li>
            A ferramenta não acha a variável? Ela precisa ter sido aberta depois do{" "}
            <code className="font-mono">export</code>. Reinicie o editor pelo terminal.
          </li>
        </ul>
      </aside>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-4 sm:grid-cols-[2.5rem_1fr]">
      <span
        aria-hidden
        className="border-line-strong text-pencil flex size-8 items-center justify-center rounded-full border text-sm font-bold sm:size-9"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="pt-1 text-lg font-bold tracking-tight">
          <span className="sr-only">Passo {n}: </span>
          {title}
        </h2>
        <div className="mt-2 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}
