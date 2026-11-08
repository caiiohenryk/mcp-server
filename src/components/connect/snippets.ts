/**
 * Connection snippets for each supported AI tool. Pure: no secrets are embedded;
 * every snippet reads the token from the PV1_TOKEN environment variable
 * (or a prompt, for VS Code).
 */
export const SERVER_NAME = "padroes-pv1";
export const TOKEN_ENV_VAR = "PV1_TOKEN";

export interface ConnectionSnippet {
  id: string;
  /** Tab label. */
  label: string;
  /** Where the snippet goes (file path or "Terminal"). */
  location: string;
  /** One-sentence instruction shown above the code. */
  hint: string;
  code: string;
}

export function mcpUrlFrom(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/mcp`;
}

/** `export PV1_TOKEN=...` line; with no token, a placeholder. */
export function exportTokenLine(token?: string): string {
  return `export ${TOKEN_ENV_VAR}="${token ?? "pv1_..."}"`;
}

export function buildConnectionSnippets(mcpUrl: string): ConnectionSnippet[] {
  const v = TOKEN_ENV_VAR;
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      location: "Terminal",
      hint: "Registra o servidor para o seu usuário, em todos os projetos.",
      code: `claude mcp add --transport http --scope user ${SERVER_NAME} ${mcpUrl} \\\n  --header "Authorization: Bearer $${v}"`,
    },
    {
      id: "cursor",
      label: "Cursor",
      location: ".cursor/mcp.json",
      hint: "Na raiz do projeto, ou em ~/.cursor/mcp.json para valer em todos.",
      code: JSON.stringify(
        {
          mcpServers: {
            [SERVER_NAME]: {
              url: mcpUrl,
              headers: { Authorization: `Bearer \${env:${v}}` },
            },
          },
        },
        null,
        2,
      ),
    },
    {
      id: "vscode",
      label: "VS Code (Copilot)",
      location: ".vscode/mcp.json",
      hint: "O VS Code pede o token na primeira conexão e guarda de forma segura.",
      code: JSON.stringify(
        {
          inputs: [
            {
              type: "promptString",
              id: "pv1-token",
              description: "Token pessoal dos Padrões PV1 (pv1_...)",
              password: true,
            },
          ],
          servers: {
            [SERVER_NAME]: {
              type: "http",
              url: mcpUrl,
              headers: { Authorization: "Bearer ${input:pv1-token}" },
            },
          },
        },
        null,
        2,
      ),
    },
    {
      id: "codex",
      label: "Codex CLI",
      location: "~/.codex/config.toml",
      hint: "O Codex lê o token direto da variável de ambiente.",
      code: `[mcp_servers.${SERVER_NAME}]\nurl = "${mcpUrl}"\nbearer_token_env_var = "${v}"`,
    },
    {
      id: "gemini",
      label: "Gemini CLI",
      location: "~/.gemini/settings.json",
      hint: "O Gemini CLI expande variáveis de ambiente dentro do settings.json.",
      code: JSON.stringify(
        {
          mcpServers: {
            [SERVER_NAME]: {
              httpUrl: mcpUrl,
              headers: { Authorization: `Bearer $${v}` },
            },
          },
        },
        null,
        2,
      ),
    },
    {
      id: "stdio",
      label: "Outras (stdio)",
      location: "Configuração MCP da ferramenta",
      hint: "Para ferramentas que só aceitam servidores locais: o mcp-remote faz a ponte para HTTP.",
      code: JSON.stringify(
        {
          mcpServers: {
            [SERVER_NAME]: {
              command: "npx",
              args: ["-y", "mcp-remote", mcpUrl, "--header", `Authorization:Bearer \${${v}}`],
            },
          },
        },
        null,
        2,
      ),
    },
    {
      id: "curl",
      label: "curl",
      location: "Terminal",
      hint: "Teste rápido: deve responder com os dados do servidor. 401 indica token inválido.",
      code: [
        `curl -sS ${mcpUrl} \\`,
        `  -H "Authorization: Bearer $${v}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -H "Accept: application/json, text/event-stream" \\`,
        `  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'`,
      ].join("\n"),
    },
  ];
}
