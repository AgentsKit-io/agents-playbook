import { describe, expect, it } from "vitest";
import { GET } from "./route";

const ecosystem = [
  ["AgentsKit", "https://www.agentskit.io/llms.txt"],
  ["AgentsKit Registry", "https://registry.agentskit.io/llms.txt"],
  ["AgentsKit Chat", "https://chat.agentskit.io/llms.txt"],
  ["Doc Bridge", "https://doc-bridge.agentskit.io/llms.txt"],
  ["AgentsKit Code Review", "https://code-review.agentskit.io/llms.txt"],
  ["AgentsKit Harness", "https://harness.agentskit.io/llms.txt"],
] as const;

describe("Playbook llms.txt ecosystem discovery", () => {
  it("links all public products through their machine-readable routes", async () => {
    const body = await (await GET()).text();

    for (const [name, llms] of ecosystem) {
      expect(body, `missing ${name}`).toContain(llms);
    }
    expect(new Set(ecosystem.map(([, llms]) => llms)).size).toBe(6);
    expect(body).toContain("[AgentsKit Chat](https://chat.agentskit.io/docs)");
    expect(body).toContain("[Doc Bridge](https://doc-bridge.agentskit.io/)");
    expect(body).not.toContain("[AgentsKit Chat](https://github.com/AgentsKit-io/agentskit-chat)");
    expect(body).not.toContain("[Doc Bridge](https://github.com/AgentsKit-io/doc-bridge)");
    expect(body).not.toContain("code-review-cli");
    expect(body).not.toContain("[Agents Playbook](");
    expect(body.toLowerCase()).not.toContain("akos");
    expect(body).not.toContain("AgentsKit OS");
  });
});
