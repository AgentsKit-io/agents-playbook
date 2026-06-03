---
title: 'CLAUDE.md template'
description: 'Drop this at the repo root as `CLAUDE.md` (or `AGENTS.md` for tool-neutral). Customise the marked sections. Keep it under 200 lines; agents read the whole thing every session.'
---

# CLAUDE.md template

Drop this at the repo root as `CLAUDE.md` (or `AGENTS.md` for tool-neutral). Customise the marked sections. Keep it under 200 lines; agents read the whole thing every session.

```markdown
# CLAUDE.md

Convention-named entry point for Claude Code, Cursor, Copilot, and any agent that resolves project guidance by filename. Mirrors the non-negotiables so an agent can act safely before fetching anything else.

The canonical orientation doc is `AGENTS.md` — read it first when you don't know which package to touch.

## Repo at a glance

<one paragraph: what is this codebase, what stack, what's the topology>

Example:
> Monorepo of <N> packages and <M> apps. pnpm workspaces, Turbo, Node ≥22. Strict TypeScript, no `any`, named exports only, Zod at every boundary.

## Non-negotiables (read before editing)

1. **No `any`.** Runtime schema parses every boundary (HTTP, JSON-RPC, IPC, file IO).
2. **Named exports only.** Framework-mandated default-export files are exempt (e.g. Next.js `page.tsx`, `tailwind.config.ts`).
3. **Use typed `AppError` subclasses with `<NS>_<CODE>` codes.** Never `throw new Error(...)` at a boundary.
4. **Use `createLogger(tag)`.** Never `console.log` in shipped code.
5. **Never duplicate upstream primitives — depend on them.**
6. **ADR before architecture change. RFC before breaking a public contract.**
7. **No hidden mocks in production source.** `MOCK_*`, fake data, sidecar `unknown` casts — all blocked by quality gates.
8. **Every PR ships:** types + tests + docs + changeset.
9. **UI only via shared primitives.** No native `<button>`, `<input>`, `<select>`, `<dialog>`, `<form>`, `<table>`, `<a href>` in shipped surfaces. Escape hatch: `// allow-native: <ref>`.
10. **Every user-visible string is intl.** No JSX literals, hardcoded `aria-label`, `title`, `placeholder`, `alt`.
11. **Every visual primitive resolves through design tokens.** No hex / rgb / hsl literals, no arbitrary class values, no inline color styles.
12. **Merges sum work, never subtract.** PR intent manifest required. Removing exported symbols of another author needs `removes:` entry + justification. Agents must not run `git checkout --theirs/--ours` without `merge-override: <reason>` annotation.
13. **Ship complete or don't ship.** No `TODO`/`FIXME`/`throw new Error('not implemented')`/disabled tabs/empty exported bodies. Per-screen completeness contract enforced. Stubs require tracked issue + target release.

## Before you ship

\```bash
pnpm --filter <pkg> lint && pnpm --filter <pkg> test
pnpm check:quality-gates    # fast structural gates
pnpm check:all              # full pre-release sweep
\```

`pre-push` runs quality gates + ADR/RFC checks + build + typecheck. It does **not** run the full test suite — run `pnpm check:all` before a release.

## Where to look next

| You want to… | Read |
|---|---|
| Map a change to a package | `AGENTS.md` routing table |
| Understand philosophy | `MANIFESTO.md` (if you have one), `docs/adr/0001-*.md` |
| Contribute a PR | `CONTRIBUTING.md` |
| Find an ADR / RFC | `docs/adr/`, `docs/rfc/` |
| Report a vulnerability | `SECURITY.md` — never a public issue |

## When a doc contradicts the code

The code wins. Update or remove the doc. Tombstoned plans are kept for audit trail — recover from `git log` if needed.
```

## Customisation checklist

When you adopt this template, fill in:

- [ ] Repo-at-a-glance paragraph (stack, package count, app count).
- [ ] Non-negotiables — keep the ones that apply, delete (or replace) the ones that don't.
- [ ] Build commands (`pnpm` / `npm` / `yarn` / `bun`; per-package vs whole-repo).
- [ ] `AGENTS.md`, `MANIFESTO.md`, `CONTRIBUTING.md`, `SECURITY.md` links — match your actual filenames.

## See also

- [`AGENTS.md.template.md`](/docs/templates/AGENTS.md.template) — routing table to ship alongside this.
- [`MEMORY.md.template.md`](/docs/templates/MEMORY.md.template) — persistent memory pattern.
- [`../pillars/ai-collaboration/README.md`](/docs/pillars/ai-collaboration) — full pillar rationale.
