// Raw markdown export.
// GET /raw/<...path> returns the underlying .md (or .mdx) source.
// Examples:
//   /raw/pillars/architecture/universal       → content/docs/pillars/architecture/universal.md
//   /raw/phases/03-build                       → content/docs/phases/03-build/README.md
//   /raw/matrix                                → content/docs/matrix.md

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, statSync } from "node:fs";

export const dynamic = "force-static";

const ROOT = join(process.cwd(), "content", "docs");

async function resolve(segments: string[]): Promise<string | null> {
  const base = join(ROOT, ...segments);
  const candidates = [
    `${base}.md`,
    `${base}.mdx`,
    join(base, "index.md"),
    join(base, "index.mdx"),
    join(base, "README.md"),
    join(base, "README.mdx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;

  // Strip trailing .md if present
  const segs = [...path];
  if (segs.length > 0) {
    const last = segs[segs.length - 1];
    if (last.endsWith(".md") || last.endsWith(".mdx")) {
      segs[segs.length - 1] = last.replace(/\.mdx?$/, "");
    }
  }

  const file = await resolve(segs);
  if (!file) return new Response("Not found", { status: 404 });

  const body = await readFile(file, "utf8");
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}

export async function generateStaticParams() {
  const out: { path: string[] }[] = [];
  async function walk(dir: string, prefix: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const next = [...prefix, e.name];
      if (e.isDirectory()) {
        await walk(join(dir, e.name), next);
      } else if (e.name.endsWith(".md") || e.name.endsWith(".mdx")) {
        const cleaned = next.map((s) => s.replace(/\.mdx?$/, ""));
        out.push({ path: cleaned });
      }
    }
  }
  if (existsSync(ROOT)) await walk(ROOT, []);
  return out;
}
