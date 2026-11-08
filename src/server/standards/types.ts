import type { StandardFrontmatter, TechnologyFrontmatter } from "./schema";

export type Technology = TechnologyFrontmatter & { body: string };
export type Standard = StandardFrontmatter & { body: string; hash: string };

export interface StandardsIndex {
  technologies: Technology[];
  standards: Standard[];
}
