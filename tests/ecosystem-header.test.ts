import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("shared ecosystem header", () => {
  it("leaves mobile flow and touch targets to the canonical artifact", () => {
    expect(globals).not.toMatch(/#ak-eco\s*\{[^}]*display:\s*grid/s);
    expect(globals).not.toMatch(/#ak-eco\s*\{[^}]*overflow:\s*visible/s);
    expect(globals).not.toMatch(/#ak-eco\s+\.ak-eco-brand\s*\{[^}]*display:\s*none/s);
  });
});
