"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  buildConnectionSnippets,
  exportTokenLine,
  TOKEN_ENV_VAR,
} from "@/components/connect/snippets";
import { SnippetTabs } from "@/components/connect/snippet-tabs";
import { idleState } from "@/components/forms/action-state";
import { fieldError, FormMessage } from "@/components/forms/form-message";
import { buttonClass, inputClass } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { CopyButton } from "@/components/ui/copy-button";
import { createTokenAction } from "./actions";
import {
  DEFAULT_EXPIRATION,
  EXPIRATION_OPTIONS,
  type CreateTokenState,
  type TechnologyOption,
} from "./options";

export function CreateTokenForm({
  technologies,
  mcpUrl,
  atLimit,
}: {
  technologies: TechnologyOption[];
  mcpUrl: string;
  atLimit: boolean;
}) {
  const [state, formAction, pending] = useActionState<CreateTokenState, FormData>(
    createTokenAction,
    idleState,
  );
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  // Controlled fields: React resets uncontrolled ones after every action, which would
  // wipe the user's input when validation fails.
  const [name, setName] = useState("");
  const [scopeMode, setScopeMode] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<number>(DEFAULT_EXPIRATION);

  if (state.status === "created" && state.token !== dismissedToken) {
    return (
      <TokenReveal
        name={state.name}
        token={state.token}
        mcpUrl={mcpUrl}
        onDone={() => {
          setDismissedToken(state.token);
          setName("");
        }}
      />
    );
  }

  const formState = state.status === "created" ? idleState : state;
  const nameError = fieldError(formState, "name");
  const techError = fieldError(formState, "technologies");
  const expError = fieldError(formState, "expiresInDays");

  return (
    <form
      action={formAction}
      noValidate
      className="max-w-2xl space-y-6"
      aria-describedby="criar-status"
    >
      <div>
        <label htmlFor="token-name" className="block font-semibold">
          Nome
        </label>
        <p id="token-name-hint" className="text-pencil mt-0.5 text-sm">
          Para lembrar onde o token está em uso. Ex.: notebook-cursor.
        </p>
        <input
          id="token-name"
          name="name"
          required
          maxLength={64}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={`token-name-hint${nameError ? " token-name-error" : ""}`}
          className={`${inputClass} mt-2 max-w-sm`}
        />
        {nameError && (
          <p id="token-name-error" className="text-red mt-1.5 text-sm font-medium">
            {nameError}
          </p>
        )}
      </div>

      <fieldset aria-describedby={techError ? "token-tech-error" : undefined}>
        <legend className="font-semibold">Acesso</legend>
        <p className="text-pencil mt-0.5 text-sm">
          Os padrões transversais (Git, segurança, testes) valem para todo token.
        </p>
        {technologies.length === 0 ? (
          <>
            <input type="hidden" name="scopeMode" value="all" />
            <p className="mt-2 text-sm">
              O token terá acesso a todas as tecnologias publicadas no catálogo.
            </p>
          </>
        ) : (
          <div className="mt-3 space-y-2">
            <RadioOption
              name="scopeMode"
              value="all"
              checked={scopeMode === "all"}
              onChange={() => setScopeMode("all")}
              label="Todas as tecnologias"
              hint="Inclui as que forem adicionadas depois."
            />
            <RadioOption
              name="scopeMode"
              value="some"
              checked={scopeMode === "some"}
              onChange={() => setScopeMode("some")}
              label="Só algumas"
            />
            {scopeMode === "some" && (
              <ul className="border-line ml-7 grid gap-2 border-l pl-4 sm:grid-cols-2">
                {technologies.map((t) => (
                  <li key={t.slug}>
                    <label className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="technologies"
                        value={t.slug}
                        checked={selected.includes(t.slug)}
                        onChange={(e) =>
                          setSelected((cur) =>
                            e.target.checked ? [...cur, t.slug] : cur.filter((s) => s !== t.slug),
                          )
                        }
                        className="accent-pen size-4"
                      />
                      {t.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {techError && (
          <p id="token-tech-error" className="text-red mt-1.5 text-sm font-medium">
            {techError}
          </p>
        )}
      </fieldset>

      <fieldset aria-describedby={expError ? "token-exp-error" : undefined}>
        <legend className="font-semibold">Validade</legend>
        <div className="mt-2 inline-flex flex-wrap gap-2">
          {EXPIRATION_OPTIONS.map((days) => (
            <label
              key={days}
              className="border-line-strong bg-sheet has-[:checked]:border-pen has-[:checked]:text-pen has-[:focus-visible]:outline-pen relative cursor-pointer rounded-md border px-3.5 py-2 text-sm font-semibold has-[:checked]:shadow-[inset_0_0_0_1px_var(--pen)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <input
                type="radio"
                name="expiresInDays"
                value={days}
                checked={days === expiresInDays}
                onChange={() => setExpiresInDays(days)}
                className="sr-only"
              />
              {days} dias
            </label>
          ))}
        </div>
        {expError && (
          <p id="token-exp-error" className="text-red mt-1.5 text-sm font-medium">
            {expError}
          </p>
        )}
      </fieldset>

      <div className="space-y-3">
        <FormMessage state={formState} id="criar-status" />
        <button type="submit" disabled={pending || atLimit} className={buttonClass()}>
          {pending ? "Criando…" : "Criar token"}
        </button>
        {atLimit && (
          <p className="text-pencil text-sm">
            Você atingiu o limite de tokens ativos. Revogue um para criar outro.
          </p>
        )}
      </div>
    </form>
  );
}

function RadioOption({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="accent-pen mt-1 size-4"
      />
      <span>
        {label}
        {hint && <span className="text-pencil block text-sm">{hint}</span>}
      </span>
    </label>
  );
}

export function TokenReveal({
  name,
  token,
  mcpUrl,
  onDone,
}: {
  name: string;
  token: string;
  mcpUrl: string;
  onDone: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h3
          ref={heading}
          tabIndex={-1}
          className="text-lg font-bold tracking-tight focus:outline-none"
        >
          Token &ldquo;{name}&rdquo; criado. Copie agora.
        </h3>
        <p className="text-pencil mt-1 max-w-[60ch] text-sm">
          Esta é a única vez que o token aparece. Guardamos só uma impressão dele, então não dá para
          mostrar de novo. Se perder, revogue e crie outro.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code
            aria-label="Seu novo token"
            className="mark mark-must px-2 py-1 font-mono text-sm font-medium break-all select-all"
          >
            {token}
          </code>
          <CopyButton value={token} label="Copiar token" variant="primary" />
        </div>
      </div>

      <div>
        <h4 className="font-semibold">1. Guarde numa variável de ambiente</h4>
        <p className="text-pencil mt-0.5 mb-3 text-sm">
          Assim o token não vai parar em arquivos do projeto. Adicione ao seu{" "}
          <code className="font-mono">~/.zshrc</code> ou{" "}
          <code className="font-mono">~/.bashrc</code> e abra um novo terminal.
        </p>
        <CodeBlock code={exportTokenLine(token)} caption="Shell" />
      </div>

      <div>
        <h4 className="font-semibold">2. Conecte sua ferramenta</h4>
        <p className="text-pencil mt-0.5 mb-3 text-sm">
          Os exemplos leem <code className="font-mono">${TOKEN_ENV_VAR}</code>.
        </p>
        <SnippetTabs snippets={buildConnectionSnippets(mcpUrl)} />
      </div>

      <button type="button" onClick={onDone} className={buttonClass({ variant: "secondary" })}>
        Já copiei, fechar
      </button>
    </div>
  );
}
