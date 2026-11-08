import "server-only";
import generated from "@/generated/standards-index.json";
import type { Standard, StandardsIndex, Technology } from "./types";

/**
 * Read-only access to the standards index generated at build time
 * (`pnpm standards:index`). This is the ONLY runtime entry point to standards
 * content — used by the MCP server and the dashboard alike.
 */
let index: StandardsIndex = generated as unknown as StandardsIndex;

/** Test-only: replace the index with fixtures. */
export function __setStandardsIndexForTests(next: StandardsIndex) {
  index = next;
}

export function listTechnologies(): Technology[] {
  return index.technologies;
}

export function getTechnology(slug: string): Technology | undefined {
  return index.technologies.find((t) => t.technology === slug);
}

export function listStandards(filter?: {
  technology?: string;
  includeDeprecated?: boolean;
}): Standard[] {
  return index.standards.filter(
    (s) =>
      (!filter?.technology || s.technology === filter.technology) &&
      (filter?.includeDeprecated || s.status !== "deprecated"),
  );
}

export function getStandard(id: string): Standard | undefined {
  return index.standards.find((s) => s.id === id);
}
