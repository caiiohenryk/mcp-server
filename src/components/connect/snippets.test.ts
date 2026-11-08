import { describe, expect, it } from "vitest";
import { buildConnectionSnippets, exportTokenLine, mcpUrlFrom } from "./snippets";

describe("connection snippets", () => {
  const url = mcpUrlFrom("https://padroes.example.com/");
  const snippets = buildConnectionSnippets(url);

  it("builds the MCP URL without a double slash", () => {
    expect(url).toBe("https://padroes.example.com/api/mcp");
  });

  it("covers every supported tool", () => {
    expect(snippets.map((s) => s.id)).toEqual([
      "claude-code",
      "cursor",
      "vscode",
      "codex",
      "gemini",
      "stdio",
      "curl",
    ]);
  });

  it("never embeds a token value, only the env var or an input prompt", () => {
    for (const s of snippets) {
      expect(s.code).toContain(url);
      expect(s.code).not.toMatch(/pv1_[a-z0-9]/);
      expect(s.code).toMatch(/PV1_TOKEN|input:pv1-token/);
    }
  });

  it("produces valid JSON for JSON-based configs", () => {
    for (const id of ["cursor", "vscode", "gemini", "stdio"]) {
      const s = snippets.find((x) => x.id === id)!;
      expect(() => JSON.parse(s.code)).not.toThrow();
    }
  });

  it("renders the export line with or without a token", () => {
    expect(exportTokenLine()).toBe('export PV1_TOKEN="pv1_..."');
    expect(exportTokenLine("pv1_abc")).toBe('export PV1_TOKEN="pv1_abc"');
  });
});
