// /llms.txt — the emerging convention for LLM-readable site map.
// Lists every doc with a one-line description so an LLM can decide what to fetch.

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const dynamic = "force-static";

const ROOT = join(process.cwd(), "content", "docs");
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playbook.agentskit.io";

type Doc = { url: string; rawUrl: string; title: string; description: string };

async function collect(): Promise<Doc[]> {
  const docs: Doc[] = [];
  async function walk(dir: string, prefix: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const next = [...prefix, e.name];
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, next);
      } else if (e.name.endsWith(".md") || e.name.endsWith(".mdx")) {
        const body = await readFile(full, "utf8");
        const titleMatch = body.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : e.name.replace(/\.(md|mdx)$/, "");
        const firstPara = body
          .split("\n")
          .find((line) => line.trim() && !line.startsWith("#") && !line.startsWith(">"))
          ?.replace(/^[*\-\s]+/, "")
          .trim() ?? "";
        const description = firstPara.length > 180 ? firstPara.slice(0, 177) + "…" : firstPara;
        const stem = next.map((s) => s.replace(/\.mdx?$/, "")).join("/");
        const cleanStem = stem
          .replace(/\/index$/, "")
          .replace(/\/README$/, "");
        docs.push({
          url: `${SITE}/docs/${cleanStem}`,
          rawUrl: `${SITE}/raw/${cleanStem}.md`,
          title,
          description,
        });
      }
    }
  }
  if (existsSync(ROOT)) await walk(ROOT, []);
  return docs;
}

export async function GET() {
  const docs = await collect();
  docs.sort((a, b) => a.url.localeCompare(b.url));

  const header = `# Agents Playbook

> The gold-standard playbook for shipping production software with AI coding agents.
> Pillars, patterns, prompts, and gates earned from real production.

- Site: ${SITE}
- Full bundle (single file, LLM-friendly): ${SITE}/llms-full.txt
- ZIP bundle: ${SITE}/playbook-bundle.zip
- License: CC-BY-4.0

## Docs index

`;

  const lines = docs
    .map((d) => `- [${d.title}](${d.url}) — ${d.description}\n  Raw: ${d.rawUrl}`)
    .join("\n");

  return new Response(header + lines + "\n", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}
