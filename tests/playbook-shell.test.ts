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
  });

  it("adopts AgentsKit shell v1 without listing the Playbook as a product", () => {
    const shell = read("lib/shell.ts");
    expect(shell).toContain("NEXT_PUBLIC_AGENTSKIT_SHELL_ORIGIN");
    expect(shell).toContain("/shell/v1.js");
    expect(shell).toContain("/shell/v1.css");
    expect(shell).toContain('SHELL_CURRENT = "playbook"');
    expect(shell).toContain('SHELL_CURRENT_REPO = "AgentsKit-io/agents-playbook"');

    const components = read("components/agentskit-shell.tsx");
    expect(components).toContain("data-current={SHELL_CURRENT}");
    expect(components).toContain("data-current-repo={SHELL_CURRENT_REPO}");
    expect(components).toContain('"agentskit-aurora"');
    expect(components).toContain('"agentskit-footer"');
    expect(components).toContain("sharedNavProducts.map");

    const layout = read("app/layout.tsx");
    for (const part of ["<AgentsKitShellStylesheet />", "<AgentsKitAurora />", "<AgentsKitFooter />", "<AgentsKitShellScript />"]) {
      expect(layout).toContain(part);
    }
  });

  it("uses the shared wordmark and leaves Star/GitHub to the shell bar", () => {
    expect(read("components/product-wordmark.tsx")).toContain("ak-product-wordmark__product");
    const docs = read("app/docs/layout.tsx");
    expect(docs).toContain("<ProductWordmark />");
    expect(docs).not.toContain("githubUrl");
    const page = read("app/page.tsx");
    expect(page).toContain("<ProductWordmark />");
    expect(page).not.toContain("Star on GitHub");
    expect(page).not.toContain("SiteFooter");
    expect(read("components/ecosystem-showcase.tsx")).toContain('"data-visual": "agentskit-home"');
  });
});
