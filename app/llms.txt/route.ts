// /llms.txt — the emerging convention for LLM-readable site map.
// Curates the entry points an LLM needs to choose what to fetch next.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { ecosystemPeers } from "../../lib/ecosystem";

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

function ecosystemBlock(): string {
  const lines = ecosystemPeers("playbook")
    .map(
      (product) =>
        `- [${product.name}](${product.surfaces.docs}) — ${product.promise} llms.txt: ${product.surfaces.llms}`,
    )
    .join("\n");
  return `## The AgentsKit ecosystem\n\n${lines}\n\n`;
}

const CORE_ROUTES = new Set([
  `${SITE}/docs`,
  `${SITE}/docs/getting-started`,
  `${SITE}/docs/for-agents`,
  `${SITE}/docs/discovery`,
  `${SITE}/docs/agentskit-chat`,
  `${SITE}/docs/onboard-your-agent`,
  `${SITE}/docs/matrix`,
  `${SITE}/docs/pillars/architecture`,
  `${SITE}/docs/pillars/security`,
  `${SITE}/docs/pillars/ui-ux`,
  `${SITE}/docs/pillars/quality`,
  `${SITE}/docs/pillars/governance`,
  `${SITE}/docs/pillars/ai-collaboration`,
  `${SITE}/docs/phases/01-discover`,
  `${SITE}/docs/phases/02-design`,
  `${SITE}/docs/phases/03-build`,
  `${SITE}/docs/phases/04-test`,
  `${SITE}/docs/phases/05-ship`,
  `${SITE}/docs/phases/06-operate`,
  `${SITE}/docs/templates`,
  `${SITE}/docs/prompts`,
  `${SITE}/docs/scripts`,
  `${SITE}/docs/contributing`,
  `${SITE}/docs/glossary`,
]);

export async function GET() {
  const docs = await collect();
  docs.sort((a, b) => a.url.localeCompare(b.url));

  const header = `# Agents Playbook

> The gold-standard playbook for shipping production software with AI coding agents.
> Pillars, patterns, prompts, and gates earned from real production.
> Built by AgentsKit (https://www.agentskit.io) — the agent-native platform this playbook is distilled from.

- Site: ${SITE}
- Agent entry point: ${SITE}/for-agents
- Built by: https://www.agentskit.io
- Full bundle (single file, LLM-friendly): ${SITE}/llms-full.txt
- ZIP bundle: ${SITE}/playbook-bundle.zip
- Deterministic site config: ${SITE}/deterministic/site-config.json
- Deterministic knowledge: ${SITE}/deterministic/knowledge.json
- License: CC-BY-4.0

${ecosystemBlock()}## Core docs

`;

  const lines = docs
    .filter((doc) => CORE_ROUTES.has(doc.url))
    .map((d) => `- [${d.title}](${d.url}) — ${d.description}\n  Raw: ${d.rawUrl}`)
    .join("\n");

  const footer = `\n\n## Complete corpus\n\n- Full text: ${SITE}/llms-full.txt\n- ZIP: ${SITE}/playbook-bundle.zip\n- Focused source: replace /docs/<path> with /raw/<path>.md\n`;

  return new Response(header + lines + footer, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}
