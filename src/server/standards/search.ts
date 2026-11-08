import "server-only";
import MiniSearch, { type SearchResult as MiniSearchResult } from "minisearch";
import { listStandards } from "./repository";
import { extractRules, RULE_HEADING_REGEX } from "./rules";
import type { Standard } from "./types";

export interface StandardSearchResult {
  id: string;
  title: string;
  technology: string;
  severity: Standard["severity"];
  summary: string;
  version: number;
  score: number;
  /** Ids of rules inside the standard whose id/title/body matched the query. */
  matchingRules: string[];
}

export interface SearchOptions {
  /** Restrict results to a single technology. */
  technology?: string;
  /** Restrict results to this set of technologies (e.g. what a token may read). */
  allowedTechnologies?: ReadonlySet<string>;
  /** Max results (default 10). */
  limit?: number;
}

interface IndexedDoc {
  id: string;
  title: string;
  technology: string;
  severity: Standard["severity"];
  summary: string;
  version: number;
  tags: string;
  body: string;
  rules: string;
}

const RULE_ID_IN_QUERY = /\b[A-Z0-9]+-[A-Z0-9]+-\d{3}\b/gi;
const tokenize = MiniSearch.getDefault("tokenize") as (text: string) => string[];

/** Lower-cases and strips diacritics so "revalidação" matches "revalidacao". */
function normalizeTerm(term: string): string {
  return term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function termsOf(text: string): Set<string> {
  return new Set(tokenize(text).map(normalizeTerm).filter(Boolean));
}

/**
 * Full-text search over a fixed set of standards. Build once per index
 * version; searching is synchronous and in-memory.
 */
export class StandardsSearch {
  private readonly mini: MiniSearch<IndexedDoc>;
  private readonly ruleTerms = new Map<string, { id: string; terms: Set<string> }[]>();

  constructor(standards: readonly Standard[]) {
    this.mini = new MiniSearch<IndexedDoc>({
      idField: "id",
      fields: ["id", "title", "summary", "tags", "rules", "body"],
      storeFields: ["id", "title", "technology", "severity", "summary", "version"],
      processTerm: (term) => normalizeTerm(term) || null,
      searchOptions: {
        boost: { title: 3, tags: 2.5, rules: 2, id: 2, summary: 1.5, body: 1 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: "OR",
      },
    });

    const docs: IndexedDoc[] = standards.map((s) => {
      const rules = extractRules(s.body);
      this.ruleTerms.set(
        s.id,
        rules.map((r) => ({ id: r.id, terms: termsOf(`${r.id} ${r.title} ${r.body}`) })),
      );
      return {
        id: s.id,
        title: s.title,
        technology: s.technology,
        severity: s.severity,
        summary: s.summary,
        version: s.version,
        tags: s.tags.join(" "),
        // Rule headings are indexed separately (higher boost) from the free text.
        rules: rules.map((r) => `${r.id} ${r.title}`).join("\n"),
        body: s.body
          .split("\n")
          .filter((l) => !RULE_HEADING_REGEX.test(l))
          .join("\n"),
      };
    });
    this.mini.addAll(docs);
  }

  search(query: string, options: SearchOptions = {}): StandardSearchResult[] {
    const q = query.trim();
    if (!q) return [];
    const limit = options.limit ?? 10;
    const { technology, allowedTechnologies } = options;

    const hits = this.mini.search(q, {
      filter: (r) =>
        (!technology || r.technology === technology) &&
        (!allowedTechnologies || allowedTechnologies.has(r.technology as string)),
    });

    const exactRuleIds = new Set((q.match(RULE_ID_IN_QUERY) ?? []).map((id) => id.toUpperCase()));

    const results = hits.map((hit) => this.toResult(hit, exactRuleIds));
    // A standard that contains a rule id typed verbatim in the query always ranks first.
    results.sort((a, b) => {
      const ea = a.matchingRules.some((id) => exactRuleIds.has(id)) ? 1 : 0;
      const eb = b.matchingRules.some((id) => exactRuleIds.has(id)) ? 1 : 0;
      return eb - ea || b.score - a.score;
    });
    return results.slice(0, limit);
  }

  private toResult(hit: MiniSearchResult, exactRuleIds: ReadonlySet<string>): StandardSearchResult {
    const matched = new Set(hit.terms);
    const matchingRules = (this.ruleTerms.get(hit.id as string) ?? [])
      .filter((r) => exactRuleIds.has(r.id) || [...r.terms].some((t) => matched.has(t)))
      .map((r) => r.id);
    return {
      id: hit.id as string,
      title: hit.title as string,
      technology: hit.technology as string,
      severity: hit.severity as Standard["severity"],
      summary: hit.summary as string,
      version: hit.version as number,
      score: Math.round(hit.score * 1000) / 1000,
      matchingRules,
    };
  }
}

let cached: { signature: string; search: StandardsSearch } | undefined;

/**
 * Searches the current (non-deprecated) standards index. The MiniSearch index
 * is built lazily and rebuilt only when the underlying index changes.
 */
export function searchStandards(query: string, options?: SearchOptions): StandardSearchResult[] {
  const standards = listStandards();
  const signature = standards.map((s) => `${s.id}@${s.hash}`).join("|");
  if (!cached || cached.signature !== signature) {
    cached = { signature, search: new StandardsSearch(standards) };
  }
  return cached.search.search(query, options);
}
