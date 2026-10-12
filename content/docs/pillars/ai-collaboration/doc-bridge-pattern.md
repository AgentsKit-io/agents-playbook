---
type: Playbook Pattern
title: 'Doc Bridge Pattern'
description: 'Make repository documentation agent-first: plain knowledge files, self-describing indexes, per-task handoffs, and a draft-only path from agent memory back into the docs.'
---

# Doc Bridge Pattern

Make repository documentation usable as routing: what an agent reads first, where it may edit, which checks prove the change, and which human guide explains the same area.

## TL;DR (human)

Agents guess ownership when repository docs are written only for people. The Doc Bridge pattern uses three linked artifacts: the knowledge itself as markdown with YAML frontmatter, self-describing outputs an agent can discover (an index, an optional `llms.txt`, a capability map), and a per-task **AgentHandoff** that names the start file, the editable roots, the checks, and the human guide. Lessons that agents record in memory flow back only as reviewed drafts: a safety scan, a human decision, and a draft pull request that nobody merges automatically. The reference implementation is [`@agentskit/doc-bridge`](https://www.npmjs.com/package/@agentskit/doc-bridge), with the `ak-docs` CLI. Its core is deterministic and needs no LLM or API key.

## For agents

### The trilogy

| Artifact | Role | Produced by |
|---|---|---|
| **Open knowledge** | Repository knowledge as markdown with YAML frontmatter, one concept per file, following the [Open Knowledge Format pattern](/docs/pillars/ai-collaboration/open-knowledge-format-pattern). An agent corpus (for example `docs/for-agents/`) holds the dense version. | Written and reviewed like code. Config `corpus.agent.okf.requireType` and the `okf-type` gate can require a `type` field. |
| **Self-describing artifacts** | A `DocBridgeIndex` with a `contentHash`, an optional root `llms.txt`, and a capability map at `.doc-bridge/capabilities.json` by default. Discovery stays separate from the knowledge itself, as in the [Self-Describe pattern](/docs/pillars/ai-collaboration/self-describe-pattern). | `ak-docs index`. Rebuild after every documentation change. |
| **AgentHandoff** | Per-task routing: `startHere`, `editRoots`, `checks`, `humanDoc`, and `bridge`. | `ak-docs query package <id> --agent`, or the MCP tool `handoff.resolve`. |

The index and handoff schema versions stay at 1 in 2.0. A handoff is a routing contract, not a copy of the documentation.

### Loops

| Loop | Command | Result |
|---|---|---|
| **Act** | `ak-docs query package <id> --agent` | Agent edits only `editRoots`, after reading `startHere` |
| **Bridge** | `ak-docs bootstrap agent-docs` | Drafts missing agent docs from the human site; never overwrites existing files |
| **Learn** | `ak-docs memory ingest` → `classify` → `promote` | Reviewable documentation draft from agent notes |
| **Verify** | `ak-docs diff --base <snapshot.json> --root <repo>` | Deterministic findings between two revisions; reports never approve a correction |
| **Explain** | `ak-docs ask "<question>"` | Ownership match and handoff preview, without an LLM |

### Memory promotion is a draft-only feedback loop

Agent memory is private working state. This pattern adds one reviewed route from that state into shared docs:

1. Record one fact per file in `.agent-memory/`, with the why and how to apply it ([memory pattern](/docs/pillars/ai-collaboration/memory-pattern)).
2. `ak-docs memory ingest` reads `.agent-memory/**/*.{md,mdc}` and `.cursor/rules/**/*.{md,mdc}` into normalized candidates.
3. `ak-docs memory classify` routes each candidate to `agent`, `human`, `playbook`, or `discard`. The routing is deterministic.
4. `ak-docs memory promote` builds a draft body after a safety scan. It never writes the canonical corpus.
5. `ak-docs memory promote --pr --dry-run` prints the `gh` commands. `ak-docs memory promote --pr` opens a **draft** pull request. A human reviews and merges it.

The loop is draft-only, safety-scanned, and human-reviewed. The MCP tool `memory.promoteDraft` returns the same draft body; it does not merge anything.

### Generic example

The names below are invented. A repository has a `ledger` package at `packages/ledger`.

Agent doc at `docs/for-agents/packages/ledger.md`:

```md
---
type: Package Guide
package: ledger
editRoot: packages/ledger
checks: [pnpm --filter @example/ledger test]
---
```

Handoff returned for an edit to the package:

```json
{
  "type": "agent-handoff",
  "startHere": "docs/for-agents/packages/ledger.md",
  "editRoots": ["packages/ledger"],
  "checks": ["pnpm --filter @example/ledger test"],
  "humanDoc": "/docs/guides/ledger",
  "bridge": { "humanDoc": "linked" }
}
```

Agent memory note at `.agent-memory/ledger-rounding.md`:

```md
Rounding happens once, at settlement, never per line item.
Why: per-line rounding made totals differ from the settled amount.
How to apply: keep amounts in minor units until settlement, then round once.
```

After `ak-docs memory classify` routes this note to `human` or `agent`, `ak-docs memory promote --pr` opens a draft pull request. The reviewer decides whether the rule belongs in `docs/for-agents/packages/ledger.md`.

### How to apply

1. Install the package and look at the output first: `npm i -D @agentskit/doc-bridge`, then `npx ak-docs demo --text`.
2. Configure `schemaVersion: 1` and `corpus.agent.root`. Run `npx ak-docs init`, then `npx ak-docs index`.
3. Declare ownership. Either use `routing.options.ownership` in the config, or put `package`, `editRoot`, and `checks` in the frontmatter of each agent doc.
4. Link human guides through a `corpus.human` adapter (Fumadocs, Docusaurus, VitePress, Starlight, Nextra, or plain markdown). Run `ak-docs bootstrap agent-docs` for any package without a human guide.
5. Connect agents with `ak-docs mcp install --cursor` or `ak-docs mcp install --claude`. In the bootstrap doc, tell the agent to call `handoff.resolve`, open `startHere`, stay inside `editRoots`, and run `checks` before it reports done.
6. Run the gates in CI. See the [Gate and CI guide](https://github.com/AgentsKit-io/doc-bridge/blob/main/docs/guides/gate-ci.md).

### Gate

`ak-docs index` followed by `ak-docs gate run` fails when the committed index is stale (`index-freshness`), when a configured human-guide link is broken (`human-guide-links`), or when `okf-type` is required and an agent doc has no `type`. `ak-docs doctor` reports handoff and human-bridge coverage. Coverage is a number to track, not a proof that the documentation is correct.

### Escape hatch

Skip the pattern when the repository has no real ownership boundaries. A single-package repository with one `AGENTS.md` may be enough. Doc Bridge is routing and a documentation bridge, not a hosted chat over your docs.

Limits to state plainly:

- The deterministic core does not judge natural-language correctness. Those findings stay `not-analyzed` until a configured agent or human review evaluates them.
- The measured results cover documentation findings on the project's own fixtures and historical cases. See the [Layer-1 benchmark results](https://github.com/AgentsKit-io/doc-bridge/blob/main/docs/bench/layer1-results-v2.md). They do not measure agent efficiency.

### Common failure modes

- **Handoff without a human guide.** `bridge.humanDoc` is `missing`. → Run `ak-docs bootstrap agent-docs`, then link the guide.
- **Stale index after a doc edit.** Agents route from old ownership. → Rebuild with `ak-docs index`; the freshness gate catches it.
- **Memory copied straight into docs.** Unreviewed agent notes become project truth. → Use `memory promote --pr` and a human review.
- **Routing duplicated across tools.** Each agent file lists different edit roots. → Keep one ownership source; point the other agent files at it ([agent compatibility](/docs/pillars/ai-collaboration/agent-compatibility-pattern)).
- **Reading a clean report as prose correctness.** → The report covers references, facts, and ownership. Review the prose separately.

### See also

- [`open-knowledge-format-pattern.md`](/docs/pillars/ai-collaboration/open-knowledge-format-pattern) — the knowledge layer of the trilogy.
- [`self-describe-pattern.md`](/docs/pillars/ai-collaboration/self-describe-pattern) — the discovery artifacts, kept separate from knowledge.
- [`memory-pattern.md`](/docs/pillars/ai-collaboration/memory-pattern) — the private notes that feed the promotion loop.
- [`agent-compatibility-pattern.md`](/docs/pillars/ai-collaboration/agent-compatibility-pattern) — one routing source for every agent.
- [`bootstrap-doc-pattern.md`](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) — where the handoff rules live for agents inside the repo.
- Package: [`@agentskit/doc-bridge` on npm](https://www.npmjs.com/package/@agentskit/doc-bridge). Source: [AgentsKit-io/doc-bridge](https://github.com/AgentsKit-io/doc-bridge). Getting started: [guide](https://github.com/AgentsKit-io/doc-bridge/blob/main/docs/getting-started.md). MCP setup: [guide](https://github.com/AgentsKit-io/doc-bridge/blob/main/docs/mcp.md). Examples: [configurations](https://github.com/AgentsKit-io/doc-bridge/blob/main/docs/examples.md). Upgrade notes: [1.x to 2.0](https://github.com/AgentsKit-io/doc-bridge/blob/main/docs/migration/1.x-to-2.0.md). Landing: [doc-bridge.agentskit.io](https://doc-bridge.agentskit.io/).
