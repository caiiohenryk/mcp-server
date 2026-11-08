import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/standards/nextjs")).toBe("/standards/nextjs");
    expect(safeNextPath("/admin/audit?page=2")).toBe("/admin/audit?page=2");
  });

  it.each([
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/login",
    "/api/mcp",
    "/tokens\r\nSet-Cookie: x",
  ])("falls back for %s", (value) => {
    expect(safeNextPath(value)).toBe("/tokens");
  });
});
