# Phase 03 — Build

Where most of the agent-augmented work happens. The discipline shifted from "writing code" to "stating intent, then reviewing output against it".

## Status

◐ Scoped, not yet detailed.

## The build loop

1. **Pick a sub-unit.** One discrete, shippable change. Defined up front. No scope creep.
2. **State intent.** Write the PR-intent manifest first. Include `adds:`, `changes:`, `removes:`, `tests:`, `docs:`, `gates:`.
3. **Verify state.** `git fetch`, recheck issue state, ensure no other agent is mid-flight on the same paths.
4. **Implement.** Agent works in a focused worktree. Hermetic tests over E2E. Verify-first close.
5. **Self-review.** Run `pnpm check:quality-gates`. Run targeted tests. Read the diff as if you were the reviewer.
6. **Open PR.** Intent manifest in the description.
7. **Address review.** Per-comment, per-commit. No "wholesale rewrite" in response to a single comment.
8. **Merge clean.** Phased PRs use `gh pr merge --merge --admin` after gates pass.

## Per pillar

| Pillar | What to do in Build |
|---|---|
| Architecture | Live by the boundaries; if a change crosses an unclear line, stop and add an ADR |
| Security | Audit-trail every privileged op as you build it; do not bolt on later |
| UI-UX | Tokens + primitives + intl from line 1 of every new screen |
| Quality | Tests in the same PR; gates green before merge |
| Governance | PR intent in every PR; verify-first close |
| AI-collaboration | One sub-unit per session; honest reporting; persistent memory updated when a lesson lands |

## See also

- [`../../templates/PR-intent.template.md`](../../templates/PR-intent.template.md)
- [`../../pillars/ai-collaboration/README.md`](../../pillars/ai-collaboration/README.md)
