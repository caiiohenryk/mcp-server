import { z } from "zod";
import { technologySlug } from "@/server/tokens/scopes";

/**
 * Contract for every file in `standards/<technology>/*.md`.
 * Shared by: the content linter (scripts/lint-standards.ts), the index builder,
 * the MCP server and the dashboard catalog. Changing it requires an ADR.
 */
export const severitySchema = z.enum(["MUST", "SHOULD", "MAY"]);
export const statusSchema = z.enum(["draft", "stable", "deprecated"]);

export const standardFrontmatterSchema = z
  .object({
    /** `<technology>/<slug>` — must match the file path without `.md`. */
    id: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
    title: z.string().min(5).max(120),
    technology: technologySlug,
    /** Integer, bumped on every content change (enforced in review). */
    version: z.number().int().positive(),
    status: statusSchema,
    /** Highest severity of the rules inside the document. */
    severity: severitySchema,
    summary: z.string().min(20).max(300),
    tags: z
      .array(z.string().regex(/^[a-z0-9-]+$/))
      .min(1)
      .max(12),
    applies_to: z.array(z.string()).default([]),
    owners: z.array(z.string()).min(1),
    updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Ids of related standards (`<technology>/<slug>`). */
    related: z.array(z.string()).default([]),
  })
  .strict();

export type StandardFrontmatter = z.infer<typeof standardFrontmatterSchema>;

/** Technology descriptor: `standards/<technology>/_technology.md` frontmatter. */
export const technologyFrontmatterSchema = z
  .object({
    technology: technologySlug,
    name: z.string().min(2),
    description: z.string().min(20).max(300),
    /** Pinned major versions this guidance targets, e.g. { next: "16", react: "19" } */
    versions: z.record(z.string(), z.string()).default({}),
    owners: z.array(z.string()).min(1),
  })
  .strict();

export type TechnologyFrontmatter = z.infer<typeof technologyFrontmatterSchema>;

/** Limits that keep each document small enough for any LLM context window. */
export const STANDARD_MAX_BYTES = 24_000;
