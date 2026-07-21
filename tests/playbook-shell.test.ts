import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Playbook public shell", () => {
  it("exposes a real search endpoint and landing trigger", () => {
    expect(read("app/api/search/route.ts")).toContain(
      "createFromSource(source)",
    );
    expect(read("app/page.tsx")).toContain("<SiteSearchTrigger />");
    expect(read("components/site-search-trigger.tsx")).toContain(
      'aria-label="Search the Playbook"',
    );
  });

  it("uses the canonical harness narrative in social metadata", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain(
      "Agents Playbook — Open Engineering Harness for Coding Agents",
    );
    expect(layout).toContain("train repeatable behavior, not model weights");
  });

  it("keeps the landing subheader and controls on the shared size rhythm", () => {
    const page = read("app/page.tsx");
    expect(page).toContain('sticky top-0 z-30 h-14');
    expect(page).toContain("min-h-11");
    expect(read("app/globals.css")).toMatch(
      /#ak-eco\s*\{[^}]*min-height:\s*56px/s,
    );
    expect(read("components/shared-ecosystem-bar.tsx")).toContain("min-h-14");
  });

  it("labels aggregate social proof without the ambiguous ecosystem suffix", () => {
    const stars = read("components/ecosystem-stars.tsx");
    expect(stars).toContain("GitHub stars across AgentsKit projects");
    expect(stars).not.toContain(">ecosystem</span>");
  });
});
