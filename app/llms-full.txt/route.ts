// /llms-full.txt — single-file dump of every doc, separated by clear delimiters.
// Optimised for one-shot RAG indexing by an LLM agent.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const dynamic = "force-static";

const ROOT = join(process.cwd(), "content", "docs");
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playbook.agentskit.io";

async function collect(): Promise<{ path: string; body: string }[]> {
  const out: { path: string; body: string }[] = [];
  async function walk(dir: string, prefix: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const next = [...prefix, e.name];
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, next);
      } else if (e.name.endsWith(".md") || e.name.endsWith(".mdx")) {
        const body = await readFile(full, "utf8");
        const stem = next.map((s) => s.replace(/\.mdx?$/, "")).join("/");
        const cleaned = stem.replace(/\/index$/, "").replace(/\/README$/, "");
        out.push({ path: `/docs/${cleaned}`, body });
      }
    }
  }
  if (existsSync(ROOT)) await walk(ROOT, []);
  return out;
}

export async function GET() {
  const docs = await collect();
  docs.sort((a, b) => a.path.localeCompare(b.path));

  const header = `# Agents Playbook — Full Bundle

Single-file dump of every doc. Documents are separated by lines starting with "==== ".
Each section begins with the canonical URL at ${SITE}.

Generated automatically; treat as the canonical reference snapshot.

`;

  const body = docs
    .map(
      (d) =>
        `==== ${SITE}${d.path}\n\n${d.body.trim()}\n`,
    )
    .join("\n");

  return new Response(header + body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}
