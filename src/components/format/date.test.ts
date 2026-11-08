import { describe, expect, it } from "vitest";
import { formatIsoDay, formatRelative } from "./date";

describe("formatRelative", () => {
  const now = new Date("2026-11-08T12:00:00Z");

  it("formats past and future distances in pt-BR", () => {
    expect(formatRelative(new Date("2026-11-05T12:00:00Z"), now)).toBe("há 3 dias");
    expect(formatRelative(new Date("2027-02-06T12:00:00Z"), now)).toBe("em 3 meses");
  });

  it("says 'agora' for less than a minute", () => {
    expect(formatRelative(new Date("2026-11-08T12:00:20Z"), now)).toBe("agora");
  });
});

describe("formatIsoDay", () => {
  it("keeps the calendar day regardless of time zone", () => {
    expect(formatIsoDay("2026-11-01")).toMatch(/01/);
  });
});
