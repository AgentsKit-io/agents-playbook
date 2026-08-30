import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/source", () => ({
  source: {
    getPages: () => [
      {
        path: "pillars/architecture/index.md",
        url: "/docs/pillars/architecture",
        data: {
          title: "Architecture",
          description: "Keep coding-agent changes inside explicit boundaries.",
          structuredData: {
            headings: [{ id: "contracts", content: "Architecture contracts" }],
            contents: [
              {
                heading: "contracts",
                content: "Use executable gates to protect module boundaries.",
              },
            ],
          },
        },
      },
    ],
  },
}));

import { GET } from "./route";

describe("Playbook search API", () => {
  it("returns indexed documentation matches", async () => {
    const response = await GET(
      new Request("http://localhost/api/search?query=architecture"),
    );

    expect(response.status).toBe(200);
    const results: unknown = await response.json();
    expect(Array.isArray(results)).toBe(true);
    expect(JSON.stringify(results)).toContain("Architecture");
  });

  it("returns an empty list when the query is missing", async () => {
    const response = await GET(new Request("http://localhost/api/search"));

    expect(await response.json()).toEqual([]);
  });
});
