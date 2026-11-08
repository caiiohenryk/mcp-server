import { beforeEach, describe, expect, it } from "vitest";
import { fixtureIndex } from "@/server/mcp/test-fixtures";
import { __setStandardsIndexForTests } from "./repository";
import { searchStandards, StandardsSearch } from "./search";

describe("standards search", () => {
  beforeEach(() => {
    __setStandardsIndexForTests(fixtureIndex);
  });

  it("ranks title/tag matches first and returns metadata", () => {
    const results = searchStandards("cache");
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.id)).toContain("nextjs/caching");
    const first = results[0]!;
    expect(first).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      technology: expect.any(String),
      severity: expect.stringMatching(/^(MUST|SHOULD|MAY)$/),
      summary: expect.any(String),
    });
    expect(first.score).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it("supports accent-insensitive, fuzzy and prefix matching", () => {
    expect(searchStandards("revalidacao").map((r) => r.id)).toContain("nextjs/data-fetching");
    expect(searchStandards("conventinal commits")[0]?.id).toBe("shared/git-workflow");
    expect(searchStandards("terra")[0]?.id).toBe("terraform/state");
  });

  it("returns matching rule ids", () => {
    const [hit] = searchStandards("useEffect");
    expect(hit?.id).toBe("nextjs/data-fetching");
    expect(hit?.matchingRules).toEqual(["NEXT-DF-002"]);
  });

  it("puts the standard owning an exact rule id first", () => {
    const [hit] = searchStandards("TF-ST-001");
    expect(hit?.id).toBe("terraform/state");
    expect(hit?.matchingRules).toContain("TF-ST-001");
  });

  it("filters by technology and by allowed technologies", () => {
    expect(
      searchStandards("cache", { technology: "nextjs" }).every((r) => r.technology === "nextjs"),
    ).toBe(true);
    const allowed = new Set(["shared", "nextjs"]);
    const results = searchStandards("state cache git", { allowedTechnologies: allowed });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.technology === "terraform")).toBe(false);
  });

  it("excludes deprecated standards, honours limit and ignores blank queries", () => {
    expect(searchStandards("Pages Router legado").map((r) => r.id)).not.toContain(
      "nextjs/legacy-pages",
    );
    expect(searchStandards("cache", { limit: 1 })).toHaveLength(1);
    expect(searchStandards("   ")).toEqual([]);
  });

  it("rebuilds the index when the standards change", () => {
    expect(searchStandards("kubernetes")).toEqual([]);
    __setStandardsIndexForTests({
      ...fixtureIndex,
      standards: [
        ...fixtureIndex.standards,
        { ...fixtureIndex.standards[0]!, id: "nextjs/k8s", title: "Deploy em Kubernetes" },
      ],
    });
    expect(searchStandards("kubernetes")[0]?.id).toBe("nextjs/k8s");
  });

  it("can be used directly over an arbitrary list", () => {
    const s = new StandardsSearch(
      fixtureIndex.standards.filter((x) => x.id === "nextjs/data-fetching"),
    );
    expect(s.search("cache").map((r) => r.id)).toEqual(["nextjs/data-fetching"]);
  });
});
