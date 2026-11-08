import { z } from "zod";

/** Technology slug as used in `standards/<slug>/` and in frontmatter `technology`. */
export const technologySlug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "invalid technology slug");

export const ALL_STANDARDS_SCOPE = "standards:read:*" as const;

export const scopeSchema = z.union([
  z.literal(ALL_STANDARDS_SCOPE),
  z.string().regex(/^standards:read:[a-z0-9]+(-[a-z0-9]+)*$/, "invalid scope"),
]);

export type Scope = z.infer<typeof scopeSchema>;

export function scopeForTechnology(slug: string): Scope {
  return `standards:read:${technologySlug.parse(slug)}`;
}

/** `shared` standards are always readable by any valid token. */
export function canReadTechnology(scopes: readonly string[], technology: string): boolean {
  if (technology === "shared") return true;
  return scopes.includes(ALL_STANDARDS_SCOPE) || scopes.includes(`standards:read:${technology}`);
}
