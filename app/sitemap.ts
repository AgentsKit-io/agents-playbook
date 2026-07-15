import type { MetadataRoute } from "next";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = join(process.cwd(), "content", "docs");
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playbook.agentskit.io";

async function collectDocs(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, prefix: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const next = [...prefix, e.name];
      if (e.isDirectory()) await walk(join(dir, e.name), next);
      else if (e.name.endsWith(".md") || e.name.endsWith(".mdx")) {
        const stem = next.map((s) => s.replace(/\.mdx?$/, "")).join("/");
        out.push(
          stem
            .replace(/\/index$/, "")
            .replace(/\/README$/, "")
            .replace(/^(index|README)$/, ""),
        );
      }
    }
  }
  if (existsSync(ROOT)) await walk(ROOT, []);
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await collectDocs();
  const now = new Date();
  return [
    { url: SITE, lastModified: now, priority: 1.0 },
    { url: `${SITE}/for-agents`, lastModified: now, priority: 0.9 },
    { url: `${SITE}/llms.txt`, lastModified: now },
    { url: `${SITE}/llms-full.txt`, lastModified: now },
    ...docs.map((d) => ({
      url: d ? `${SITE}/docs/${d}` : `${SITE}/docs`,
      lastModified: now,
      priority: d ? 0.7 : 0.8,
    })),
  ];
}
