import { describe, expect, it } from "vitest";
import { ecosystemPeers } from "../../lib/ecosystem";
import { GET } from "./route";

describe("llms.txt", () => {
  it("is a concise map with all six canonical sibling routes", async () => {
    const response = await GET();
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(Buffer.byteLength(body)).toBeLessThan(12_000);
    expect(body).toContain("https://playbook.agentskit.io/for-agents");
    expect(body).toContain("https://playbook.agentskit.io/llms-full.txt");
    expect(body).toContain("https://playbook.agentskit.io/raw/index.md");
    for (const route of [
      "/docs/phases/01-discover",
      "/docs/phases/02-design",
      "/docs/phases/03-build",
      "/docs/phases/04-test",
      "/docs/phases/05-ship",
      "/docs/phases/06-operate",
      "/docs/templates",
      "/docs/prompts",
      "/docs/scripts",
    ]) {
      expect(body).toContain(`https://playbook.agentskit.io${route}`);
    }
    for (const product of ecosystemPeers("playbook")) {
      expect(body).toContain(product.surfaces.docs);
      expect(body).toContain(product.surfaces.llms);
    }
  });
});
