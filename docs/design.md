# Design do painel: "especificação marcada"

Painel interno onde engenheiros e tech leads geram um token pessoal (`pv1_…`) e conectam
suas ferramentas de IA ao servidor MCP de standards. O que o produto entrega é um **texto normativo**:
regras com níveis RFC 2119 (MUST, SHOULD, MAY) que todos os agentes leem igual. O design parte
daí: o painel parece uma especificação impressa que alguém revisou com marca-texto e caneta.

- **Público:** engenheiros e tech leads. Leem código o dia todo, querem copiar um comando e voltar ao
  trabalho. Não é preciso convencê-los de nada.
- **Função principal:** gerar um token, copiar o snippet certo para a ferramenta e, de vez em quando,
  ler um standard.
- **Idioma:** pt-BR, frase em caixa normal, verbos diretos ("Criar token", "Revogar", "Copiar").

## 1ª passada (descartada)

| Eixo     | Proposta inicial                                                           |
| -------- | -------------------------------------------------------------------------- |
| Cor      | Fundo quase preto `#0B0B0B`, cartões cinza, um acento azul elétrico        |
| Tipo     | Inter na interface, mono em todos os rótulos pequenos                      |
| Layout   | Sidebar fixa, conteúdo em grade de cartões arredondados com a mesma sombra |
| Destaque | Gradiente atrás do título "Conecte sua IA"                                 |

**Revisão contra o briefing.** Essa é a resposta que eu daria para _qualquer_ painel de dev tools: o
kit de cartões SaaS, o quase-preto genérico, mono como decoração. Nada nela fala de _standards_. O
assunto tem um vocabulário visual próprio (documento normativo, níveis de exigência, revisão), e a
2ª passada usa esse vocabulário:

- Cor: em vez de "escuro + um acento", papel frio + tinta + **marca-texto**. O amarelo do marca-texto
  aparece só onde algo é obrigatório ou precisa da atenção da pessoa agora.
- Tipo: Inter → **Schibsted Grotesk** (grotesca de jornal, robusta, com bom negrito para rótulos de
  regra). Mono só para o que é código de verdade: tokens, comandos, IDs de regra.
- Layout: sidebar → barra superior (são só 4–6 destinos). Listas viram **tabelas** e **listas com
  régua**, não cartões. Raio pequeno e com hierarquia (controles 6px, painéis 4px, marcas 2–8px
  irregulares).
- Destaque: o gradiente decorativo sai; entra a marca-texto como único elemento memorável.

## Tokens

### Cor (5 bases + 2 de estado)

| Nome            | Claro     | Escuro    | Uso                                                                    |
| --------------- | --------- | --------- | ---------------------------------------------------------------------- |
| Papel           | `#F2F3F5` | `#16181D` | Fundo da página                                                        |
| Folha           | `#FFFFFF` | `#1E2128` | Superfícies (tabelas, painéis, código)                                 |
| Grafite         | `#1C1F26` | `#E6E8ED` | Texto principal                                                        |
| Lápis           | `#585E6C` | `#A0A6B4` | Texto secundário, réguas (`line` deriva dele)                          |
| Caneta azul     | `#2445C4` | `#93A8FF` | Links, ação primária, foco                                             |
| Marca-texto     | `#FFD84D` | `#FFD84D` | MUST, token recém-criado, "atenção agora" (texto sempre Grafite claro) |
| Caneta vermelha | `#B3261E` | `#FF8E86` | Ação destrutiva, MUST NOT, erros                                       |

Marcas por nível RFC 2119 (fundo de marca-texto, texto sempre `#1C1F26`, contraste ≥ 9:1):

| Nível      | Marca                                           |
| ---------- | ----------------------------------------------- |
| MUST       | `#FFD84D` amarelo                               |
| MUST NOT   | `#FFB3AD` rosa-correção                         |
| SHOULD     | `#BCD0FF` azul-claro                            |
| SHOULD NOT | `#D9C8FF` lilás                                 |
| MAY        | sem preenchimento, contorno pontilhado em Lápis |

Contraste conferido (WCAG AA, calculado): Grafite/Papel 14.9:1, Lápis/Papel 5.9:1, Caneta azul/Folha 7.7:1,
Caneta vermelha/Folha 6.5:1, Lápis escuro/Papel escuro 7.3:1, Caneta azul escuro/Folha escura 7.1:1,
Grafite/marca amarela 11.9:1, Grafite/marca azul 10.7:1.

### Tipo

- **Schibsted Grotesk** (variável, 400–800): tudo na interface. Títulos com tracking levemente
  negativo (-0.02em) e peso 700; corpo 16px/1.6; meta 14px.
- **JetBrains Mono**: somente código, tokens, comandos e IDs de regra (`NEXT-DF-001`).
- Escala (razão ~1.25): 13 · 14 · 16 · 20 · 25 · 31 · 39 · 49px. Linha de leitura ≤ 72ch nos
  standards.
- Sem caixa-alta em rótulos. A única caixa-alta é a do próprio conteúdo: as palavras-chave RFC
  (MUST, SHOULD), que são texto normativo, não decoração.

### Layout

Conteúdo alinhado à esquerda, coluna máxima de 72rem; leitura de standards em coluna de 72ch com o
índice de regras na margem direita, fixo ao rolar (desktop), ou depois do texto (mobile).

Login (desktop): duas colunas. À esquerda, entrar. À direita, o "espécime": uma regra real do
catálogo, renderizada como aparece no standard, com o nível marcado.

```
┌──────────────────────────────┬─────────────────────────────────────┐
│ Padrões PV1               │  ┌ papel ───────────────────────────┐│
│                              │  │ NEXT-DF-001                      ││
│ Um só jeito de escrever      │  │ ▓MUST▓ Busque dados em Server    ││
│ código, para todo agente.    │  │ Components                       ││
│                              │  │ texto da regra…                  ││
│ [ Entrar com Google       ]  │  └──────────────────────────────────┘│
│ [ Entrar com GitHub       ]  │  Claude Code, Cursor, Codex, Gemini  │
│                              │  CLI e VS Code leem esta mesma regra.│
│ (aviso de acesso negado)     │                                      │
└──────────────────────────────┴─────────────────────────────────────┘
```

Login (mobile): uma coluna, entrar primeiro, espécime abaixo.

Painel:

```
┌────────────────────────────────────────────────────────────────────┐
│ Padrões PV1  Tokens  Conectar  Standards  Usuários  Auditoria   │
│                                              ana@example  [Sair]    │
├────────────────────────────────────────────────────────────────────┤
│ Tokens                                                             │
│ Cada token dá acesso de leitura aos standards pelo MCP.            │
│                                                                    │
│ ┌ Criar token ───────────────┐                                     │
│ │ nome · escopo · validade   │  (após criar: faixa marca-texto     │
│ └────────────────────────────┘   com o token, copiar, snippet)    │
│                                                                    │
│ nome      token            escopos    criado  expira  uso  status  │
│ ──────────────────────────────────────────────────────────────────│
│ notebook  pv1_abcd…••••    todas      …       …       …   ativo [Revogar]
└────────────────────────────────────────────────────────────────────┘
```

Standard:

```
Standards / Next.js / Data fetching
Título do standard                         ┌ Regras ─────────────┐
v3   stable   MUST   atualizado 2026-11-01 │ NEXT-DF-001 ▓MUST▓  │
resumo                                     │ NEXT-DF-002 ▒SHOULD▒│
───────────────────────────────            │ …                   │
corpo markdown…                            └─────────────────────┘
│NEXT-DF-001                                Relacionados
│▓MUST▓ Busque dados em Server Components   - …
│ corpo da regra
```

Regras ganham uma régua vertical à esquerda na cor do nível, para que o olho encontre as regras
ao rolar um documento longo.

### Princípios

1. **A marca-texto é o único gesto ousado.** Amarelo aparece só em MUST e no token que precisa ser
   copiado agora. Se tudo for marcado, nada é.
2. **Documento, não dashboard.** Tabelas com réguas finas, títulos fortes, sem cartões repetidos nem
   sombras decorativas.
3. **Mono significa "isto é para colar".** Se está em JetBrains Mono, é código, token ou ID.
4. **Erros dizem o que fazer.** "Seu e-mail não está na lista de acesso. Peça a um admin para
   incluir você." Nada de "Ops!".
5. **Movimento só responde a ação**, com uma exceção: a marca passa uma vez sobre o MUST do espécime
   no login. Desligado com `prefers-reduced-motion`.

## Qualidade mínima

- Tema claro/escuro por `prefers-color-scheme`, variáveis em `src/app/globals.css` (`@theme inline`).
- Foco visível: contorno 2px Caneta azul com offset 2px em todo elemento interativo.
- Formulários com `<label>`, erros ligados por `aria-describedby` e anunciados por `aria-live`.
- Responsivo até 360px; tabelas largas rolam dentro do próprio contêiner, nunca a página.
- Link "Pular para o conteúdo".
