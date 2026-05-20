# agents-playbook

**The gold-standard playbook for shipping production software with AI coding agents.**

Distilled from ~1 year of agent-driven development on a multi-package TypeScript monorepo, this repo captures the rules, guardrails, prompts, gates, and review patterns that consistently produce trustworthy, shippable code from agents like Claude, Cursor, and Copilot.

**Live site:** https://playbook.agentskit.io (deploy via `pnpm install && pnpm dev`).

The repo is a Next.js + Fumadocs app rendering the playbook content under [`content/docs/`](./content/docs/). Each doc serves a raw `.md` at `/raw/<path>.md` and the full bundle at `/llms-full.txt` for agent retrieval.

**Status:** v0 — full content + fumadocs site. See [`content/docs/matrix.md`](./content/docs/matrix.md) for the content map.

## Who this is for

Two audiences, every doc:

- **Humans** — tech leads, founders, staff engineers deciding how to run an agent-augmented team. Read the **TL;DR** block at the top of every doc.
- **Agents** — Claude/Cursor/Copilot working inside a repo that follows this playbook. Read the **For agents** block; it's structured for RAG retrieval and system-prompt injection.

## How content is organized

Matrix of **6 pillars × 6 SDLC phases**. See [`matrix.md`](./content/docs/matrix.md) for the cross-reference.

```
pillars/
  architecture/        # ADR, RFC, modular monorepo, contracts, errors
  security/            # RBAC, vault, audit ledger, threat model
  ui-ux/               # design tokens, primitives, intl, a11y, motion
  quality/             # tests, gates, sanity, file-size budgets
  governance/          # PR intent, merge rules, change protocol
  ai-collaboration/    # CLAUDE.md, MEMORY, sub-agents, slash commands

phases/
  01-discover/   02-design/   03-build/
  04-test/       05-ship/     06-operate/

templates/    # copy-paste skeletons: ADR, RFC, PR-intent, CLAUDE.md, MEMORY.md
scripts/      # quality gates, sanity checks, structural-gates reference impls
prompts/      # system prompts, sub-agent recipes, slash commands
```

## Two scope levels

Every pillar has two layers:

1. **`universal.md`** — stack-agnostic principles. Apply to any language, any framework.
2. **`ts-concrete.md`** (or `<topic>-pattern.md`) — copy-paste recipes for a TypeScript / Node ≥22 / pnpm / Turbo / Zod / React stack.

Pick the layer that matches your codebase. The universal layer is the contract; the concrete layer is one valid implementation.

## Start here

| Goal | Read |
|---|---|
| Adopt this playbook in a new project | [`phases/01-discover/README.md`](./content/docs/phases/01-discover/README.md) → [`templates/CLAUDE.md.template.md`](./content/docs/templates/CLAUDE.md.template.md) |
| Set non-negotiables for agents | [`templates/CLAUDE.md.template.md`](./content/docs/templates/CLAUDE.md.template.md), [`pillars/governance/README.md`](./content/docs/pillars/governance/README.md) |
| Design a package boundary | [`pillars/architecture/universal.md`](./content/docs/pillars/architecture/universal.md) |
| Add an ADR or RFC | [`templates/ADR.template.md`](./content/docs/templates/ADR.template.md), [`templates/RFC.template.md`](./content/docs/templates/RFC.template.md) |
| Wire quality gates | [`pillars/quality/README.md`](./content/docs/pillars/quality/README.md), [`scripts/`](./content/docs/scripts/) |
| Train an agent on lessons | [`templates/MEMORY.md.template.md`](./content/docs/templates/MEMORY.md.template.md), [`prompts/`](./content/docs/prompts/) |
| Run a multi-agent merge | [`pillars/governance/README.md`](./content/docs/pillars/governance/README.md) (Agent Merge Rules) |

## The eight non-negotiables (gold-standard core)

The full canon lives across the pillars; this is the irreducible kernel. If an agent breaks one of these, fail the PR.

1. **Typed boundaries.** Every external input is parsed by a runtime schema (Zod, io-ts, Pydantic, JSON Schema). No `any`. No unchecked casts.
2. **Named exports only.** No `export default` outside framework-mandated files. Predictable refactors, predictable agent edits.
3. **Typed error hierarchy with stable codes.** `AppError` subclasses with `<NAMESPACE>_<CODE>` constants. Never `throw new Error('...')` at a boundary.
4. **Centralized logger.** `createLogger(tag)`. Never `console.log` in shipped code.
5. **ADR before architecture change. RFC before breaking a public contract.** Decisions are written down; the doc IS the change.
6. **Ship complete or don't ship.** No `TODO`/`FIXME`/`throw new Error('not implemented')`/disabled tabs in shipped surfaces. Stubs require a tracked issue + target release.
7. **Merges sum work, never subtract.** Every PR has an intent manifest; removing another author's exported symbol requires explicit `removes:` justification.
8. **Tokens, intl, primitives — no raw values in user-facing surfaces.** Design tokens for color/spacing, intl for every visible string, shared primitives instead of bare `<button>`/`<input>`.

Each is fully spec'd in the pillars and enforced by the gate scripts in [`scripts/`](./content/docs/scripts/).

## How this playbook was earned

Over the source codebase's lifetime, dozens of ADRs and RFCs accumulated to address recurring failure modes of agent-driven development. The most common ones:

- agents reimplementing upstream primitives instead of depending on them,
- agents nesting ternaries until the file was unreviewable,
- agents merging by `git checkout --theirs` and silently deleting peer work,
- agents marking screens "done" while half the tabs `throw new Error('not implemented')`,
- agents grinding on a stale branch while main turned red,
- agents losing context across sessions and repeating fixed mistakes,
- agents claiming duplication based on doc names instead of actual exported APIs.

Every rule, gate, and prompt pattern here is a **fix for a specific, reproducible failure**. Each is sourced — find the rationale in the linked ADR/RFC of the originating repo or in the corresponding pillar doc.

## License

[CC-BY-4.0](./LICENSE). Adapt freely. Attribution: link back to this repo.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). New patterns must come from real production lessons, not theory.
