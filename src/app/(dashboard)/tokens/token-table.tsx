import { ConfirmAction } from "@/components/forms/confirm-action";
import { formatDate, formatDateTime, formatRelative } from "@/components/format/date";
import { ALL_STANDARDS_SCOPE } from "@/server/tokens/scopes";
import type { TokenSummary } from "@/server/tokens/service";
import { revokeTokenAction } from "./actions";
import type { TechnologyOption } from "./options";

const SOON_MS = 7 * 86_400_000;

function scopeLabel(scopes: string[], techs: TechnologyOption[]): string {
  if (scopes.includes(ALL_STANDARDS_SCOPE)) return "Todas as tecnologias";
  const names = scopes
    .map((s) => s.replace("standards:read:", ""))
    .filter((slug) => slug !== "shared")
    .map((slug) => techs.find((t) => t.slug === slug)?.name ?? slug);
  return names.length ? names.join(", ") : "Só transversais";
}

const STATUS_LABEL: Record<TokenSummary["status"], string> = {
  active: "Ativo",
  expired: "Expirado",
  revoked: "Revogado",
};

export function TokenTable({
  tokens,
  technologies,
  now,
  caption,
}: {
  tokens: TokenSummary[];
  technologies: TechnologyOption[];
  now: Date;
  caption: string;
}) {
  return (
    <div className="border-line bg-sheet overflow-x-auto rounded border">
      <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-line-strong text-pencil border-b">
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Nome
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Token
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Acesso
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Criado
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Expira
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Último uso
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-2.5">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => {
            const soon = t.status === "active" && t.expiresAt.getTime() - now.getTime() < SOON_MS;
            return (
              <tr key={t.id} className="border-line border-b last:border-b-0">
                <th scope="row" className="px-4 py-3 text-base font-semibold">
                  {t.name}
                </th>
                <td className="px-4 py-3 font-mono text-[0.8125rem] whitespace-nowrap">
                  {t.masked}
                </td>
                <td className="px-4 py-3">{scopeLabel(t.scopes, technologies)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <time dateTime={t.createdAt.toISOString()}>{formatDate(t.createdAt)}</time>
                </td>
                <td
                  className={`px-4 py-3 whitespace-nowrap ${soon ? "text-red font-semibold" : ""}`}
                >
                  <time dateTime={t.expiresAt.toISOString()} title={formatDateTime(t.expiresAt)}>
                    {t.status === "active"
                      ? formatRelative(t.expiresAt, now)
                      : formatDate(t.expiresAt)}
                  </time>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {t.lastUsedAt ? (
                    <time
                      dateTime={t.lastUsedAt.toISOString()}
                      title={formatDateTime(t.lastUsedAt)}
                    >
                      {formatRelative(t.lastUsedAt, now)}
                    </time>
                  ) : (
                    <span className="text-pencil">Nunca</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusLabel status={t.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {t.status === "active" && (
                    <ConfirmAction
                      action={revokeTokenAction}
                      fields={{ tokenId: t.id }}
                      triggerLabel="Revogar"
                      triggerAriaLabel={`Revogar o token ${t.name}`}
                      title={`Revogar o token "${t.name}"?`}
                      description={
                        <p>
                          Ferramentas que usam este token perdem o acesso na próxima chamada. Não dá
                          para desfazer; se precisar, crie um token novo.
                        </p>
                      }
                      confirmLabel="Revogar token"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusLabel({ status }: { status: TokenSummary["status"] }) {
  const tone = status === "active" ? "bg-green" : status === "revoked" ? "bg-red" : "bg-pencil";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`size-2 rounded-full ${tone}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
