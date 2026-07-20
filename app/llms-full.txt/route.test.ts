import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { GET } from "./route";

const ROOT = join(process.cwd(), "content", "docs");

function sourceSections(dir = ROOT): Map<string, string> {
  const sections = new Map<string, string>();
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(md|mdx|mjs)$/.test(entry.name)) continue;
      const source = relative(ROOT, path).split(sep).join("/");
      let url: string;
      if (source.endsWith(".mjs")) {
        url = `https://playbook.agentskit.io/raw/${source}`;
      } else {
        const stem = source
          .replace(/\.mdx?$/, "")
          .replace(/\/index$/, "")
          .replace(/\/README$/, "")
          .replace(/^(index|README)$/, "");
        url = `https://playbook.agentskit.io${stem ? `/docs/${stem}` : "/docs"}`;
      }
      sections.set(url, readFileSync(path, "utf8").trim());
    }
  };
  walk(dir);
  return sections;
}

function bundledSections(body: string): Map<string, string> {
  return new Map(body.split(/^==== /m).slice(1).map((section) => {
    const newline = section.indexOf("\n");
    return [section.slice(0, newline), section.slice(newline + 1).trim()];
  }));
}

describe("llms-full.txt", () => {
  it("uses canonical documentation paths and exposes agent discovery", async () => {
    const response = await GET();
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("Agent entry point: https://playbook.agentskit.io/for-agents");
    expect(body).toContain("==== https://playbook.agentskit.io/docs\n");
    expect(body).not.toContain("==== https://playbook.agentskit.io/docs/index\n");
    expect(body).toContain("==== https://playbook.agentskit.io/docs/for-agents\n");
    const delimiters = [...body.matchAll(/^==== (.+)$/gm)].map((match) => match[1]).sort();
    const expectedSections = sourceSections();
    const expected = [...expectedSections.keys()].sort();
    expect(delimiters).toEqual(expected);
    expect(new Set(delimiters)).toHaveLength(expected.length);
    expect(bundledSections(body)).toEqual(expectedSections);
  });
});
