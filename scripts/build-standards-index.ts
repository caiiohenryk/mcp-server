/**
 * Builds src/generated/standards-index.json from standards/**.md.
 * Runs before `next build`. Fails (exit 1) on any parse issue.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseStandardsDir } from "../src/server/standards/parse";
import type { StandardsIndex } from "../src/server/standards/types";

async function main() {
  const root = path.resolve(process.cwd(), "standards");
  const { technologies, standards, issues } = await parseStandardsDir(root);

  if (issues.length) {
    console.error("standards: invalid content, run `pnpm standards:lint` for details");
    for (const i of issues) console.error(`  ${i.file}: ${i.message}`);
    process.exit(1);
  }

  const index: StandardsIndex = {
    technologies: technologies
      .map((t) => ({ ...t.meta, body: t.body }))
      .sort((a, b) => a.technology.localeCompare(b.technology)),
    standards: standards
      .map((s) => ({
        ...s.meta,
        body: s.body,
        hash: createHash("sha256").update(s.body).digest("hex").slice(0, 12),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };

  const out = path.resolve(process.cwd(), "src/generated/standards-index.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(index, null, 2) + "\n");
  console.log(
    `standards: indexed ${index.standards.length} documents across ${index.technologies.length} technologies`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
