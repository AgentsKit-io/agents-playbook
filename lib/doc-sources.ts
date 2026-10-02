// content/docs sources (*.md, *.mdx, *.mjs) as { rel, body }, rel posix-relative to content/docs.
// Reads the files on disk (Vercel / next build); on Cloudflare Workers (OpenNext, no filesystem)
// it falls back to the build-time index written by scripts/build-raw-index.mjs.
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type DocSource = { rel: string; body: string };

const ROOT = join(process.cwd(), "content", "docs");
const isDoc = (name: string) => name.endsWith(".md") || name.endsWith(".mdx") || name.endsWith(".mjs");

export async function readDocSources(): Promise<DocSource[]> {
  if (existsSync(ROOT)) {
    const out: DocSource[] = [];
    const walk = async (dir: string, prefix: string[]): Promise<void> => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const next = [...prefix, e.name];
        if (e.isDirectory()) await walk(join(dir, e.name), next);
        else if (isDoc(e.name)) out.push({ rel: next.join("/"), body: await readFile(join(dir, e.name), "utf8") });
      }
    };
    await walk(ROOT, []);
    return out;
  }
  const { default: files } = await import("@/lib/raw-index.generated.json");
  return Object.entries(files)
    .filter(([rel]) => isDoc(rel))
    .map(([rel, body]) => ({ rel, body }));
}
