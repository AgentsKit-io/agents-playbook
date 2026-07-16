import { describe, expect, it } from "vitest";
import { GET } from "./route";

const ecosystem = [
  ["AgentsKit", "https://www.agentskit.io/llms.txt"],
  ["AgentsKit Registry", "https://registry.agentskit.io/llms.txt"],
  ["AgentsKit Chat", "https://chat.agentskit.io/llms.txt"],
  ["Agents Playbook", "https://playbook.agentskit.io/llms.txt"],
  ["Doc Bridge", "https://agentskit-io.github.io/doc-bridge/llms.txt"],
  ["Code Review CLI", "https://raw.githubusercontent.com/AgentsKit-io/code-review-cli/main/llms.txt"],
  ["AgentsKit OS", "https://akos.agentskit.io/llms.txt"],
] as const;

describe("Playbook llms.txt ecosystem discovery", () => {
  it("links all seven canonical products through their machine-readable routes", async () => {
    const body = await (await GET()).text();

    for (const [name, llms] of ecosystem) {
      expect(body, `missing ${name}`).toContain(llms);
    }
    expect(new Set(ecosystem.map(([, llms]) => llms)).size).toBe(7);
    expect(body).toContain("[AgentsKit Chat](https://chat.agentskit.io/docs)");
    expect(body).toContain("[Doc Bridge](https://agentskit-io.github.io/doc-bridge/)");
    expect(body).not.toContain("[AgentsKit Chat](https://github.com/AgentsKit-io/agentskit-chat)");
    expect(body).not.toContain("[Doc Bridge](https://github.com/AgentsKit-io/doc-bridge)");
  });
});
