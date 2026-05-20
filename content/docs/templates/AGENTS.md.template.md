# AGENTS.md template

Drop at repo root. The routing table that answers "which package owns X?" before an agent makes the wrong edit.

```markdown
# AGENTS.md — Orientation for AI coding agents

You're working inside <PROJECT NAME>, a monorepo of <N> packages and <M> apps. Read this file first when making changes — it answers "which package owns X?" so you don't reinvent existing utilities.

Per-package deep references live in `docs/for-agents/packages/*.md`. **Start at [`docs/for-agents/INDEX.md`](./docs/for-agents/INDEX.md)** — it's the one-page jump table to every package, screen, and flow recipe. When AGENTS.md routes you to a package, open its for-agents doc before editing.

## TL;DR philosophy

1. `<core-package>` is the contract layer. Schemas + error model. Under <N> KB gzipped.
2. Never duplicate upstream. Depend on it.
3. No `any`. Schema parse at every boundary. Named exports only.
4. ADR before architecture changes. RFC before breaking contracts.

## Mental map (4–7 groups)

| Group | Packages | Concern |
|---|---|---|
| **Contracts + Core** | core, contracts, log, storage | Schemas, errors, registry, logger, persistence |
| **Runtime** | runtime, … | Execution layer |
| **Security** | security, audit, … | RBAC, vault, ledger |
| **Product** | ui, desktop, web, … | Surfaces shipped to users |
| **<your group>** | … | … |

## Which package do I touch?

| I want to change… | Edit… |
|---|---|
| A schema, contract, or error code | `packages/core/src/` (codes: `errors/codes.ts`) |
| The error class hierarchy | `packages/core/src/errors/app-error.ts` |
| Method contract registry / dispatcher | `packages/contracts/src/` |
| <feature area> | `packages/<pkg>/src/` |
| Desktop screen/panel | `packages/desktop/src/` |
| Web marketing/docs site | `apps/web/app/` |
| Cloud HTTP route | `apps/cloud/src/api/` |
| Anything cross-cutting | First read `docs/for-agents/conventions.md` |

## Workflow

1. **Verify first.** `git fetch`, recheck issue state, look at other in-flight PRs.
2. **Pick one sub-unit.** No scope creep.
3. **State intent.** PR-intent manifest in description.
4. **Implement.** Hermetic tests, named exports, typed errors.
5. **Self-review.** `pnpm check:quality-gates`.
6. **Open PR.** Reviewers verify diff against intent.

## When something is unclear

1. Read the relevant `docs/for-agents/packages/<pkg>.md`.
2. Read the related ADR/RFC.
3. Read the code.
4. If still unclear: open an issue with `discuss:` label. Do not guess.
```

## Customisation checklist

- [ ] Replace `\<PROJECT NAME\>`, `\<N\>`, `\<M\>`, `\<core-package\>` placeholders.
- [ ] Replace the mental-map table with your real logical groups.
- [ ] Replace the routing rows with your real packages + apps.
- [ ] Adjust workflow numbers to match your release process.
