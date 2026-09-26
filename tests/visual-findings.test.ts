import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isNonPageHref } from "@/lib/links";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("visual check findings", () => {
  it("keeps white text on the accent gradient at WCAG AA", () => {
    const css = read("app/globals.css");
    const block = css.match(/@utility bg-accent-gradient \{[^}]*\}/)?.[0] ?? "";
    const hover = css.match(/@utility bg-accent-gradient-hover \{[^}]*\}/)?.[0] ?? "";
    for (const rule of [block, hover]) {
      const lightness = [...rule.matchAll(/oklch\(([\d.]+) /g)].map((m) => Number(m[1]));
      expect(lightness.length).toBe(2);
      // oklch L <= 0.58 at chroma ~0.18, hue 295 stays >= 4.5:1 against #fff.
      for (const l of lightness) expect(l).toBeLessThanOrEqual(0.58);
    }
  });

  it("does not offer a theme toggle on the dark-only docs", () => {
    expect(read("app/docs/layout.tsx")).toContain("themeSwitch={{ enabled: false }}");
  });

  it("renders non-page files as plain anchors so Next does not prefetch them", () => {
    expect(isNonPageHref("/playbook-bundle.zip")).toBe(true);
    expect(isNonPageHref("/llms-full.txt")).toBe(true);
    expect(isNonPageHref("/raw/index.md")).toBe(true);
    expect(isNonPageHref("/docs/matrix")).toBe(false);
    expect(isNonPageHref("https://example.com/a.zip")).toBe(false);
    expect(read("app/page.tsx")).not.toMatch(/<Link\s+href="\/llms/);
  });
});
