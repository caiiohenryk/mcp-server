import type { Metadata } from "next";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { formatDate } from "@/components/format/date";
import { PageHeader, Section } from "@/components/ui/page-header";
import { listAllowedUsers } from "@/server/auth/allowlist";
import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { deactivateUserAction } from "./actions";
import { AddUserForm, ReactivateForm, RoleForm } from "./user-forms";

export const metadata: Metadata = { title: "Usuários" };

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await listAllowedUsers(getDb());
  const active = users.filter((u) => u.active);
  const inactive = users.filter((u) => !u.active);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Só quem está nesta lista consegue entrar no painel e usar tokens. Admins também gerenciam a lista e veem a auditoria."
      />

      <Section id="adicionar" title="Dar acesso">
        <div className="border-line bg-sheet max-w-3xl rounded border p-5 sm:p-6">
          <AddUserForm />
        </div>
      </Section>

      <Section
        id="lista"
        title="Com acesso"
        description={`${active.length} ${active.length === 1 ? "pessoa" : "pessoas"}.`}
      >
        {active.length === 0 ? (
          <p className="border-line-strong text-pencil rounded border border-dashed px-5 py-8">
            Ninguém na lista ainda. Os e-mails de <code className="font-mono">ADMIN_EMAILS</code>{" "}
            entram como admin no primeiro login.
          </p>
        ) : (
          <div className="border-line bg-sheet overflow-x-auto rounded border">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <caption className="sr-only">Pessoas com acesso</caption>
              <thead>
                <tr className="border-line-strong text-pencil border-b">
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    E-mail
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Papel
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Adicionado por
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Desde
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((u) => {
                  const isSelf = u.email === admin.email;
                  return (
                    <tr key={u.email} className="border-line border-b last:border-b-0">
                      <th scope="row" className="px-4 py-3 font-semibold break-all">
                        {u.email}
                      </th>
                      <td className="px-4 py-3">
                        <RoleForm email={u.email} role={u.role} isSelf={isSelf} />
                      </td>
                      <td className="text-pencil px-4 py-3">
                        {u.addedBy ?? "Configuração inicial"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <time dateTime={u.createdAt.toISOString()}>{formatDate(u.createdAt)}</time>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isSelf && (
                          <ConfirmAction
                            action={deactivateUserAction}
                            fields={{ email: u.email }}
                            triggerLabel="Remover acesso"
                            triggerAriaLabel={`Remover acesso de ${u.email}`}
                            title={`Remover o acesso de ${u.email}?`}
                            description={
                              <>
                                <p>Isso vale na hora:</p>
                                <ul className="list-disc space-y-1 pl-5">
                                  <li>todos os tokens da pessoa são revogados;</li>
                                  <li>as sessões abertas no painel são encerradas;</li>
                                  <li>ela não consegue mais entrar.</li>
                                </ul>
                                <p>
                                  Para devolver o acesso, use Reativar. Tokens revogados não voltam.
                                </p>
                              </>
                            }
                            confirmLabel="Remover acesso"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {inactive.length > 0 && (
        <Section
          id="removidos"
          title="Sem acesso"
          description="Pessoas removidas. Reativar devolve o acesso com o mesmo papel; ela precisará criar tokens novos."
        >
          <ul className="border-line bg-sheet divide-line max-w-3xl divide-y rounded border">
            {inactive.map((u) => (
              <li
                key={u.email}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-pencil break-all">
                  {u.email}
                  <span className="ml-2 text-xs">
                    removido em{" "}
                    <time dateTime={u.updatedAt.toISOString()}>{formatDate(u.updatedAt)}</time>
                  </span>
                </span>
                <ReactivateForm email={u.email} role={u.role} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
