import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { enabledProviders } from "@/server/auth/config";
import { getCurrentUser } from "@/server/auth/session";
import { signInWithProvider } from "./actions";
import { safeNextPath } from "./safe-next";
import { RuleSpecimen } from "./specimen";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Record<string, string | string[] | undefined>;

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

const ERRORS: Record<string, { title: string; body: string }> = {
  AccessDenied: {
    title: "Seu e-mail não está na lista de acesso",
    body: "Só pessoas cadastradas podem entrar. Peça a um admin da plataforma (time de Arquitetura ou seu tech lead) para incluir o e-mail que você usou e tente de novo.",
  },
  OAuthAccountNotLinked: {
    title: "Este e-mail já entrou por outro provedor",
    body: "Use o mesmo provedor do seu primeiro acesso.",
  },
  Configuration: {
    title: "Não foi possível iniciar o login",
    body: "O provedor escolhido não está disponível. Tente outro ou avise um admin da plataforma.",
  },
};
const DEFAULT_ERROR = {
  title: "O login não foi concluído",
  body: "Tente de novo. Se continuar, avise um admin da plataforma.",
};

export default function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <main className="flex flex-col px-4 py-10 sm:px-10 lg:px-16 lg:py-14">
        <p className="text-base font-extrabold tracking-[-0.01em]">Padrões PV1</p>
        <div className="my-auto max-w-[26rem] pt-14 pb-10 lg:pt-0">
          <h1 className="text-2xl leading-[1.15] font-bold tracking-[-0.02em] text-balance sm:text-3xl">
            Um só jeito de escrever código, para todo agente.
          </h1>
          <p className="text-pencil mt-4 text-base leading-relaxed text-pretty">
            Entre para gerar seu token e conectar sua ferramenta de IA aos standards de engenharia
            do time.
          </p>
          <div className="mt-8">
            <Suspense fallback={<ProvidersFallback />}>
              <SignInPanel searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
        <p className="text-pencil text-sm">Acesso restrito a pessoas cadastradas.</p>
      </main>
      <aside
        aria-label="Exemplo de regra"
        className="border-line bg-sheet flex items-center border-t px-4 py-12 sm:px-10 lg:border-t-0 lg:border-l lg:px-16"
      >
        <RuleSpecimen />
      </aside>
    </div>
  );
}

function ProvidersFallback() {
  return <div className="bg-line/60 h-10 w-full animate-pulse rounded-md" aria-hidden />;
}

async function SignInPanel({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNextPath(one(params.next));
  const errorCode = one(params.error);

  // Already signed in? Skip the page. Only touches the DB when a session cookie exists.
  const jar = await cookies();
  if (SESSION_COOKIES.some((c) => jar.has(c))) {
    const user = await getCurrentUser().catch(() => null);
    if (user) redirect(next);
  }

  const providers = enabledProviders();
  const error = errorCode ? (ERRORS[errorCode] ?? DEFAULT_ERROR) : null;

  return (
    <div className="space-y-6">
      <div id="login-alert" role="alert" aria-live="assertive">
        {error && (
          <div className="border-red bg-red-soft rounded border-l-4 px-4 py-3">
            <p className="text-red font-bold">{error.title}</p>
            <p className="text-ink mt-1 text-sm leading-relaxed">{error.body}</p>
          </div>
        )}
      </div>

      {providers.length === 0 ? (
        <div className="border-line-strong rounded border border-dashed px-4 py-4">
          <p className="font-bold">Nenhum provedor de login configurado</p>
          <p className="text-pencil mt-1 text-sm leading-relaxed">
            Defina <code className="font-mono text-[0.9em]">AUTH_GOOGLE_ID</code> e{" "}
            <code className="font-mono text-[0.9em]">AUTH_GOOGLE_SECRET</code> (ou Microsoft Entra
            ID, ou GitHub) no ambiente e reinicie o servidor.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {providers.map((p, i) => (
            <li key={p.id}>
              <form action={signInWithProvider}>
                <input type="hidden" name="provider" value={p.id} />
                <input type="hidden" name="next" value={next} />
                <button
                  type="submit"
                  className={buttonClass({
                    variant: i === 0 ? "primary" : "secondary",
                    className: "h-11 w-full",
                  })}
                >
                  Entrar com {p.name}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
