// /llms.txt — the emerging convention for LLM-readable site map.
// Lists every doc with a one-line description so an LLM can decide what to fetch.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { formatEcosystemLlmsBlock } from "../../lib/ecosystem-llms-block";

export const dynamic = "force-static";

const ROOT = join(process.cwd(), "content", "docs");
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playbook.agentskit.io";

type Doc = { url: string; rawUrl: string; title: string; description: string };

const yamlScalar = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replace(/''/g, "'");
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1).replace(/\\"/g, '"');
  return trimmed;
};

const scriptDescription = (body: string): string | undefined => {
  const comments: string[] = [];
  for (const line of body.split("\n").slice(1)) {
    const match = line.match(/^\/\/\s*(.+)$/);
    if (!match) break;
    comments.push(match[1]);
  }
  return comments.join(" ").trim() || undefined;
};

async function collect(): Promise<Doc[]> {
  const docs: Doc[] = [];
  async function walk(dir: string, prefix: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const next = [...prefix, e.name];
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, next);
      } else if (e.name.endsWith(".md") || e.name.endsWith(".mdx") || e.name.endsWith(".mjs")) {
        const body = await readFile(full, "utf8");
        const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
        const title = yamlScalar(frontmatter.match(/^title:\s*(.+)$/m)?.[1]) ?? body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? e.name.replace(/\.(md|mdx|mjs)$/, "");
        const declaredDescription = yamlScalar(frontmatter.match(/^description:\s*(.+)$/m)?.[1]);
        const isScript = e.name.endsWith(".mjs");
        const firstPara = declaredDescription ?? (isScript ? scriptDescription(body) : undefined) ?? body
          .replace(/^---\r?\n[\s\S]*?\r?\n---/, "")
          .split("\n")
          .find((line) => line.trim() && !line.startsWith("#") && !line.startsWith(">") && !line.startsWith("//"))
          ?.replace(/^[*\-\s]+/, "")
          .trim() ?? "";
        const description = firstPara.length > 180 ? firstPara.slice(0, 177) + "…" : firstPara;
        const stem = isScript ? next.join("/") : next.map((s) => s.replace(/\.mdx?$/, "")).join("/");
        const cleanStem = stem
          .replace(/\/index$/, "")
          .replace(/\/README$/, "")
          .replace(/^(index|README)$/, "");
        docs.push({
          url: isScript ? `${SITE}/raw/${cleanStem}` : cleanStem ? `${SITE}/docs/${cleanStem}` : `${SITE}/docs`,
          rawUrl: isScript ? `${SITE}/raw/${cleanStem}` : cleanStem ? `${SITE}/raw/${cleanStem}.md` : `${SITE}/raw/index.md`,
          title,
          description,
        });
      }
    }
  }
  if (existsSync(ROOT)) await walk(ROOT, []);
  return docs;
}

/** Canonical seven-product mesh from ecosystem.json (shared template). */
function ecosystemBlock(): string {
  try {
    const raw = readFileSync(join(process.cwd(), "ecosystem.json"), "utf8");
    const eco = JSON.parse(raw) as {
      products: Array<{
        id: string;
        name: string;
        role?: string;
        promise: string;
        maturity?: string;
        surfaces: { home?: string; docs?: string; llms?: string };
        navigation: { order: number };
      }>;
    };
    const products = [...eco.products].sort(
      (left, right) => left.navigation.order - right.navigation.order,
    );
    return formatEcosystemLlmsBlock({
      products,
      currentProductId: "playbook",
      prefer: "docs",
    }).join("\n");
  } catch {
    return "";
  }
}

export async function GET() {
  const docs = await collect();
  docs.sort((a, b) => a.url.localeCompare(b.url));

  const header = `# Agents Playbook

> The gold-standard playbook for shipping production software with AI coding agents.
> Pillars, patterns, prompts, and gates earned from real production.
> Built by AgentsKit (https://www.agentskit.io) — the agent-native platform this playbook is distilled from.

- Site: ${SITE}
- Site map: ${SITE}/llms.txt
- Built by: https://www.agentskit.io
- Full bundle (single file, LLM-friendly): ${SITE}/llms-full.txt
- ZIP bundle: ${SITE}/playbook-bundle.zip
- Deterministic site config: ${SITE}/deterministic/site-config.json
- Deterministic knowledge: ${SITE}/deterministic/knowledge.json
- License: CC-BY-4.0

${ecosystemBlock()}## Docs index

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
