import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/components/format/date";
import { buttonClass, inputClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { listAuditActions, queryAuditLog } from "@/server/audit/query";
import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Auditoria" };

type SearchParams = Record<string, string | string[] | undefined>;

const ACTION_LABEL: Record<string, string> = {
  "auth.sign_in": "Login",
  "auth.sign_in_denied": "Login negado",
  "token.created": "Token criado",
  "token.revoked": "Token revogado",
  "token.auth_failed": "Token recusado",
  "mcp.tool_call": "Chamada MCP",
  "mcp.rate_limited": "Limite de chamadas",
  "allowlist.added": "Acesso concedido",
  "allowlist.updated": "Papel alterado",
  "allowlist.removed": "Acesso removido",
};

/** Actions worth noticing when scanning the log. */
const ALERT_ACTIONS = new Set([
  "auth.sign_in_denied",
  "token.auth_failed",
  "mcp.rate_limited",
  "allowlist.removed",
]);

function label(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function formatMetadata(meta: Record<string, unknown>): string {
  return Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  const db = getDb();
  const [result, actions] = await Promise.all([
    queryAuditLog(db, { action: one(params.action), page: Number(one(params.page) ?? 1) }),
    listAuditActions(db),
  ]);

  const pageHref = (page: number) => {
    const q = new URLSearchParams();
    if (result.action) q.set("action", result.action);
    if (page > 1) q.set("page", String(page));
    const s = q.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Logins, tokens, chamadas ao MCP e mudanças de acesso, do mais recente para o mais antigo."
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="audit-action" className="block text-sm font-semibold">
            Evento
          </label>
          <select
            id="audit-action"
            name="action"
            defaultValue={result.action ?? ""}
            className={`${inputClass} mt-1.5 w-auto pr-8`}
          >
            <option value="">Todos</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {label(a)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass({ variant: "secondary" })}>
          Filtrar
        </button>
        {result.action && (
          <Link href="/admin/audit" className={buttonClass({ variant: "ghost" })}>
            Limpar filtro
          </Link>
        )}
      </form>

      <p className="text-pencil mb-3 text-sm" aria-live="polite">
        {result.total === 0
          ? "Nenhum evento."
          : `${result.total} ${result.total === 1 ? "evento" : "eventos"}${result.action ? ` de "${label(result.action)}"` : ""}. Página ${result.page} de ${result.totalPages}.`}
      </p>

      {result.entries.length === 0 ? (
        <p className="border-line-strong text-pencil rounded border border-dashed px-5 py-8">
          {result.action
            ? "Nenhum evento deste tipo ainda."
            : "O log está vazio. Os eventos aparecem aqui a partir do primeiro login."}
        </p>
      ) : (
        <div className="border-line bg-sheet overflow-x-auto rounded border">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <caption className="sr-only">Eventos de auditoria</caption>
            <thead>
              <tr className="border-line-strong text-pencil border-b">
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Quando
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Evento
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Quem
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Token
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((e) => (
                <tr key={e.id} className="border-line border-b align-top last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <time dateTime={e.createdAt.toISOString()}>{formatDateTime(e.createdAt)}</time>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={
                        ALERT_ACTIONS.has(e.action) ? "text-red font-semibold" : "font-semibold"
                      }
                    >
                      {label(e.action)}
                    </span>
                    <span className="text-pencil block font-mono text-xs">{e.action}</span>
                  </td>
                  <td className="px-4 py-3 break-all">
                    {e.actorEmail ?? <span className="text-pencil">Desconhecido</span>}
                  </td>
                  <td className="text-pencil px-4 py-3 font-mono text-xs">
                    {e.tokenId ? <span title={e.tokenId}>{e.tokenId.slice(0, 8)}</span> : ""}
                  </td>
                  <td className="px-4 py-3">
                    {Object.keys(e.metadata).length > 0 && (
                      <pre className="text-pencil max-w-md font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
                        {formatMetadata(e.metadata)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-3">
          {result.page > 1 ? (
            <Link
              href={pageHref(result.page - 1)}
              className={buttonClass({ variant: "secondary" })}
            >
              Mais recentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-pencil text-sm">
            Página {result.page} de {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={pageHref(result.page + 1)}
              className={buttonClass({ variant: "secondary" })}
            >
              Mais antigos
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
