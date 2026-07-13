import { decodeAssistantContent } from "@agentskit/chat-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAskAdapter, createAskSessionMemory, decodeAskEvents, projectAskEvent } from "./ask-adapter";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Playbook Ask AgentsKit Chat adapter", () => {
  it("validates NDJSON records and keeps malformed or unknown records inert", () => {
    const decoded = decodeAskEvents([
      JSON.stringify({ type: "text", delta: "hello" }),
      "not-json",
      JSON.stringify({ type: "tool", id: "x", name: "unknown", args: {} }),
      "",
    ].join("\n"));
    expect(decoded.events).toHaveLength(2);
    expect(projectAskEvent(decoded.events[1]!)).toBeUndefined();
  });

  it("rejects unsafe citation URLs and bounds portable source-list fields", () => {
    const projected = projectAskEvent({
      type: "tool",
      id: "sources id",
      name: "cite",
      args: { sources: [
        { title: "Runtime", path: "/docs/runtime", anchor: "run" },
        { title: "unsafe", path: "javascript:alert(1)" },
        { title: "x".repeat(2_000), path: "https://example.com/page" },
      ] },
    });
    expect(projected?.kind).toBe("component");
    if (projected?.kind !== "component") return;
    expect(projected.frame.instanceId).toBe("sources-id");
    expect(projected.frame.props).toMatchObject({ sources: [
      { title: "Runtime", url: "/docs/runtime#run" },
      { url: "https://example.com/page" },
    ] });
    expect(projected.frame.fallback.summary.length).toBeLessThanOrEqual(4_096);
  });

  it("streams text and citations as one canonical ordered assistant message", async () => {
    const response = [
      JSON.stringify({ type: "text", delta: "Grounded answer." }),
      JSON.stringify({ type: "tool", id: "sources", name: "cite", args: { sources: [{ title: "Pillars", path: "/docs/pillars" }] } }),
      JSON.stringify({ type: "done", model: "test" }),
      "",
    ].join("\n");
    const fetchMock = vi.fn(async () => new Response(response, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const source = createAskAdapter({ endpoint: "/v1/ask?persona=guide", corpus: "playbook" }).createSource({
      messages: [{ id: "user", role: "user", content: "How?", status: "complete", createdAt: new Date() }],
    });
    let content = "";
    for await (const chunk of source.stream()) if (chunk.type === "text") content += chunk.content ?? "";
    const decoded = decodeAssistantContent(content);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.parts).toMatchObject([
      { kind: "text", text: "Grounded answer." },
      { kind: "component", frame: { componentKey: "source-list" } },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/v1/ask?persona=guide&corpus=playbook", expect.objectContaining({ method: "POST" }));
  });

  it("migrates the legacy Playbook record into AgentsKit ChatMemory", async () => {
    const values = new Map<string, string>([["ak:ask-thread-v2:playbook", JSON.stringify([
      { role: "user", content: "What is a gate?" },
      { role: "assistant", content: "A deterministic check." },
    ])]]);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const memory = createAskSessionMemory({ key: "ak:ask-thread-v3:playbook", legacyKeys: ["ak:ask-thread-v2:playbook"] });
    await expect(memory.load()).resolves.toMatchObject([
      { role: "user", content: "What is a gate?" },
      { role: "assistant", content: "A deterministic check." },
    ]);
    expect(values.has("ak:ask-thread-v2:playbook")).toBe(false);
    expect(values.has("ak:ask-thread-v3:playbook")).toBe(true);
  });

  it("propagates abort through the public adapter source", async () => {
    let observedSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;
      throw new DOMException("aborted", "AbortError");
    }));
    const source = createAskAdapter({ corpus: "playbook" }).createSource({ messages: [] });
    source.abort?.();
    const chunks = [];
    for await (const chunk of source.stream()) chunks.push(chunk);
    expect(observedSignal?.aborted).toBe(true);
    expect(chunks).toEqual([]);
  });
});
