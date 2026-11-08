# Como escrever um standard

Este guia define o formato de todo arquivo em `standards/<tecnologia>/*.md`. O conteúdo é servido
pelo MCP para LLMs externos (Claude, GPT, Gemini, Cursor…) e lido por pessoas no painel. Trate-o
como código: muda só via PR aprovado por CODEOWNERS e precisa passar em `pnpm standards:lint`.

Contrato formal: `src/server/standards/schema.ts` (frontmatter) e `src/server/standards/rules.ts`
(formato das regras). Decisão: [ADR-0003](../../docs/adr/0003-standards-content-format.md).
Ponto de partida copiável: [TEMPLATE.md](./TEMPLATE.md).

## Estrutura de pastas

```
standards/
  _meta/                 guias de autoria (ignorado pelo parser e pelo MCP)
  <tecnologia>/
    _technology.md       descritor + AGENTS.md canônico da tecnologia
    <slug>.md            um documento de standard por tópico
```

- `<tecnologia>` e `<slug>` em inglês, `kebab-case` (`nextjs/data-fetching-and-caching`).
- O corpo é escrito em **pt-BR**. Identificadores, código e comentários de código em inglês.

## Frontmatter do standard

| Campo        | Obrigatório | Regra                                                                      |
| ------------ | ----------- | -------------------------------------------------------------------------- |
| `id`         | sim         | `<tecnologia>/<slug>`, idêntico ao caminho do arquivo sem `.md`.           |
| `title`      | sim         | 5–120 caracteres. O único H1 do corpo MUST ser idêntico ao `title`.        |
| `technology` | sim         | Igual ao nome da pasta.                                                    |
| `version`    | sim         | Inteiro positivo. Incrementado a cada mudança de conteúdo.                 |
| `status`     | sim         | `draft`, `stable` ou `deprecated`.                                         |
| `severity`   | sim         | `MUST`, `SHOULD` ou `MAY`: o nível mais alto entre as regras do documento. |
| `summary`    | sim         | 20–300 caracteres. Uma frase que diz quando consultar o documento.         |
| `tags`       | sim         | 1–12 tags `kebab-case`, usadas na busca.                                   |
| `applies_to` | não         | Globs ou contextos onde o documento se aplica (ex.: `"src/app/**"`).       |
| `owners`     | sim         | Times/pessoas responsáveis (ex.: `"@caiiohenryk"`).                |
| `updated_at` | sim         | Data `AAAA-MM-DD` (UTC) da última mudança.                                 |
| `related`    | não         | Ids de outros standards (`<tecnologia>/<slug>`) que MUST existir.          |

Campos desconhecidos são rejeitados (schema `strict`). O arquivo inteiro MUST ter no máximo 24 KB.

Mapeamento de `severity`: `MUST`/`MUST NOT` → `MUST`; `SHOULD`/`SHOULD NOT` → `SHOULD`; `MAY` → `MAY`.

## Corpo do documento

1. Um único H1 igual ao `title`.
2. Um parágrafo curto de contexto: objetivo e escopo do documento.
3. Seções H2 opcionais para agrupar regras (ex.: `## Leitura de dados`).
4. Regras em H3, cada uma com justificativa e exemplos.

### Formato da regra

Toda linha que começa com `### ` MUST seguir exatamente este formato (o linter rejeita qualquer
outro H3):

```
### <TECH>-<AREA>-<NNN> [MUST|MUST NOT|SHOULD|SHOULD NOT|MAY] <título imperativo>
```

- `<TECH>`: prefixo único da tecnologia, igual em todos os documentos dela (`SHARED`, `NEXT`,
  `NEST`, `TF`).
- `<AREA>`: sigla curta do documento (ex.: `DF` para data fetching, `SEC` para segurança).
- `<NNN>`: três dígitos sequenciais dentro da área.
- O id é **globalmente único e nunca reutilizado**, nem depois que a regra é removida. LLMs e
  pessoas citam regras pelo id em PRs e revisões.
- Nível conforme RFC 2119. Use `MUST NOT`/`SHOULD NOT` para proibições, em vez de negar o título.
- Título no imperativo, sem ponto final: "Busque dados em Server Components".

O corpo da regra vai até o próximo H2/H3 e MUST conter, nesta ordem:

1. **Por quê**: a justificativa em 1–3 frases (o problema que a regra evita).
2. **✅** seguido de um bloco de código com o jeito certo.
3. **❌** seguido de um bloco de código com o erro que a regra proíbe.

Regras `MAY` podem omitir os exemplos; todas as outras MUST ter os dois. Exemplo completo:

````markdown
### NEXT-DF-001 [MUST] Busque dados em Server Components

**Por quê:** buscar no servidor elimina waterfalls no cliente e não expõe credenciais.

✅ Correto:

```tsx
export default async function Page() {
  const posts = await getPosts();
  return <PostList posts={posts} />;
}
```

❌ Errado:

```tsx
"use client";
export default function Page() {
  const [posts, setPosts] = useState([]);
  useEffect(
    () =>
      void fetch("/api/posts")
        .then((r) => r.json())
        .then(setPosts),
    [],
  );
  return <PostList posts={posts} />;
}
```
````

## Estilo de escrita para LLMs

O leitor principal é um modelo que vai gerar código a partir do texto. Escreva para não deixar
espaço de interpretação:

- **Imperativo e direto.** "Use", "Valide", "Não exporte". Nada de "talvez", "em geral", "pode ser
  interessante", "depende".
- **Sem ambiguidade.** Se há exceção, nomeie-a explicitamente na própria regra ("exceto em
  `route.ts` de webhooks").
- **Versões concretas.** "Next.js 16", "NestJS 11", "Terraform ≥ 1.9", nunca "versão recente".
- **Exemplos mínimos e compiláveis.** Mostre só o necessário para a regra; sem `...` no meio de
  código que mude o significado.
- **Um tópico por documento**, 5–12 regras. Se passar disso ou de 24 KB, divida em dois documentos
  e ligue-os por `related`.
- **Referências entre standards** pelo id em código (`nextjs/security`) e pelo campo `related`.
  Links Markdown relativos são permitidos, mas MUST apontar para arquivos existentes; o consumidor
  via MCP não segue links, então o id é o que importa.
- **Sem texto provisório.** Placeholders como TODO, TBD, FIXME ou lorem ipsum fora de blocos de
  código reprovam o lint.
- Não inclua segredos reais, URLs internas ou dados pessoais em exemplos.

## Versionamento

- Toda mudança de conteúdo (inclusive correção de exemplo) MUST incrementar `version` em 1 e
  atualizar `updated_at`.
- Mudança só de formatação (Prettier) não exige bump.
- Mudar o significado de uma regra existente MUST ser descrito no PR. Se a mudança inverte a
  orientação, crie uma regra nova com id novo e remova a antiga.
- Novos documentos começam com `status: draft` até a primeira revisão de CODEOWNERS; depois
  `stable`.

## Depreciação

1. Marque o documento com `status: deprecated` e incremente `version`.
2. Logo após o H1, adicione um parágrafo **Depreciado:** com o motivo e o id do substituto.
3. Adicione o substituto em `related`.
4. Mantenha o arquivo por pelo menos um ciclo de release antes de removê-lo; ao remover, apague o
   id de todo `related` e de `## Standards relacionados` no `_technology.md`.

Ids de regras de documentos removidos nunca são reutilizados.

## Contrato do `_technology.md`

Frontmatter (schema `technologyFrontmatterSchema`):

```yaml
---
technology: nextjs # igual à pasta
name: Next.js # nome de exibição
description: Uma frase de 20–300 caracteres sobre o escopo da tecnologia.
versions: { next: "16", react: "19" } # majors que as regras assumem
owners: ["@caiiohenryk"]
---
```

O corpo é o **AGENTS.md canônico** que um projeto daquela tecnologia copia para a raiz do
repositório. O tool MCP `get_project_bootstrap` devolve esse corpo literalmente. Por isso ele MUST:

- ser agnóstico de LLM/ferramenta (vale para Claude, GPT/Codex, Gemini, Cursor, Copilot…);
- usar `<placeholders>` somente onde o valor é específico do projeto (nome, comandos extras);
- conter estas seções H2, com estes títulos exatos:

| Seção                       | Conteúdo                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `## Como usar este arquivo` | Instrui qualquer agente a consultar o servidor MCP (`list_standards`, `get_standard`, `search_standards`) antes de escrever código e a obedecer regras MUST. |
| `## Stack e versões`        | Tabela com as versões fixadas.                                                                                                                               |
| `## Comandos`               | Comandos de dev, lint, typecheck, teste e build.                                                                                                             |
| `## Estrutura de pastas`    | Árvore de diretórios esperada e limites de camada.                                                                                                           |
| `## Regras invioláveis`     | As regras MUST/MUST NOT mais críticas, citando ids.                                                                                                          |
| `## Definition of Done`     | Checklist objetivo para considerar uma tarefa concluída.                                                                                                     |
| `## Standards relacionados` | Lista com **todos** os ids de standards da tecnologia (em código, ex.: `` `nextjs/security` ``) e os de `shared` relevantes.                                 |

O linter verifica a presença das seções, a menção aos três tools MCP e que a lista de standards
relacionados contém todos os documentos da tecnologia e apenas ids existentes.

## Checklist do PR de conteúdo

- [ ] `pnpm standards:lint` e `pnpm standards:index` passam.
- [ ] `version` incrementado e `updated_at` atualizado em cada documento alterado.
- [ ] Ids de regra novos são únicos e seguem a sequência da área.
- [ ] Documento novo listado em `## Standards relacionados` do `_technology.md`.
- [ ] `pnpm exec prettier --write standards` aplicado.
