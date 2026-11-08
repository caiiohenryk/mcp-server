import matter from "gray-matter";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  STANDARD_MAX_BYTES,
  standardFrontmatterSchema,
  technologyFrontmatterSchema,
  type StandardFrontmatter,
  type TechnologyFrontmatter,
} from "./schema";

/**
 * Pure filesystem parsing of `standards/`. No "server-only" import because it
 * is also used by build scripts (tsx). Runtime code reads the generated index instead.
 */

export interface ParsedStandard {
  meta: StandardFrontmatter;
  body: string;
  file: string; // repo-relative path
  bytes: number;
}

export interface ParsedTechnology {
  meta: TechnologyFrontmatter;
  body: string;
  file: string;
}

export interface ParseIssue {
  file: string;
  message: string;
}

export interface ParseResult {
  technologies: ParsedTechnology[];
  standards: ParsedStandard[];
  issues: ParseIssue[];
}

const IGNORED_DIRS = new Set(["_meta"]);

function normalizeFrontmatter(data: Record<string, unknown>) {
  // gray-matter parses YAML dates into Date objects; we keep ISO date strings.
  const out: Record<string, unknown> = { ...data };
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) out[k] = v.toISOString().slice(0, 10);
  }
  return out;
}

export async function parseStandardsDir(rootDir: string): Promise<ParseResult> {
  const result: ParseResult = { technologies: [], standards: [], issues: [] };
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const dir of entries) {
    if (!dir.isDirectory() || IGNORED_DIRS.has(dir.name)) continue;
    const techDir = path.join(rootDir, dir.name);
    const files = (await readdir(techDir)).filter((f) => f.endsWith(".md")).sort();

    if (!files.includes("_technology.md")) {
      result.issues.push({
        file: path.join("standards", dir.name),
        message: "missing _technology.md",
      });
    }

    for (const f of files) {
      const abs = path.join(techDir, f);
      const rel = path.join("standards", dir.name, f);
      const raw = await readFile(abs, "utf8");
      let parsed: matter.GrayMatterFile<string>;
      try {
        parsed = matter(raw);
      } catch (e) {
        result.issues.push({
          file: rel,
          message: `invalid frontmatter YAML: ${(e as Error).message}`,
        });
        continue;
      }
      const data = normalizeFrontmatter(parsed.data);

      if (f === "_technology.md") {
        const t = technologyFrontmatterSchema.safeParse(data);
        if (!t.success) {
          for (const i of t.error.issues)
            result.issues.push({ file: rel, message: `${i.path.join(".")}: ${i.message}` });
          continue;
        }
        if (t.data.technology !== dir.name) {
          result.issues.push({
            file: rel,
            message: `technology "${t.data.technology}" must equal folder "${dir.name}"`,
          });
        }
        result.technologies.push({ meta: t.data, body: parsed.content.trim(), file: rel });
        continue;
      }

      const s = standardFrontmatterSchema.safeParse(data);
      if (!s.success) {
        for (const i of s.error.issues)
          result.issues.push({ file: rel, message: `${i.path.join(".")}: ${i.message}` });
        continue;
      }
      const expectedId = `${dir.name}/${f.replace(/\.md$/, "")}`;
      if (s.data.id !== expectedId) {
        result.issues.push({ file: rel, message: `id "${s.data.id}" must equal "${expectedId}"` });
      }
      if (s.data.technology !== dir.name) {
        result.issues.push({ file: rel, message: `technology must equal folder "${dir.name}"` });
      }
      const bytes = Buffer.byteLength(raw, "utf8");
      if (bytes > STANDARD_MAX_BYTES) {
        result.issues.push({
          file: rel,
          message: `file has ${bytes} bytes; max is ${STANDARD_MAX_BYTES}`,
        });
      }
      result.standards.push({ meta: s.data, body: parsed.content.trim(), file: rel, bytes });
    }
  }

  const ids = new Map<string, string>();
  for (const s of result.standards) {
    const prev = ids.get(s.meta.id);
    if (prev)
      result.issues.push({
        file: s.file,
        message: `duplicate id "${s.meta.id}" (also in ${prev})`,
      });
    ids.set(s.meta.id, s.file);
  }
  for (const s of result.standards) {
    for (const r of s.meta.related) {
      if (!ids.has(r))
        result.issues.push({ file: s.file, message: `related "${r}" does not exist` });
    }
  }

  return result;
}
