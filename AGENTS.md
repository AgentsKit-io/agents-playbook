# AGENTS.md

## Ownership

This repository owns the Agents Playbook corpus and its Next/Fumadocs host. The
Ask Playbook shell may configure corpus, endpoint, storage migration, branding,
and native slots. Chat state, lifecycle, streaming, memory, cancellation, and
portable components belong to AgentsKit and AgentsKit Chat and must not be
reimplemented here.

## doc-bridge

Route changes with `@agentskit/doc-bridge` before editing:

```bash
pnpm docs:bridge:index
pnpm docs:bridge:query ownership playbook --agent
pnpm docs:bridge:gate
```

MCP: `ak-docs mcp` exposes `handoff.resolve`, `doc.search`, and `doc.get`.
