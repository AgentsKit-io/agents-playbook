---
title: 'Phase 03 — Build'
description: 'Where most of the agent-augmented work happens. Discipline shifts from ''writing code'' to ''stating intent, then verifying output against it''.'
---

# Phase 03 — Build

Where most of the agent-augmented work happens. Discipline shifts from "writing code" to "stating intent, then verifying output against it".

## TL;DR (human)

Build is a loop, not a sprint. One sub-unit per session. PR intent declared up front; gates green before merge; tests + docs in the same PR. The conventions land in Design; Build phase enforces them.

## For agents

### The build loop

1. **Pick a sub-unit.** One discrete, shippable change. Defined up front.
2. **State intent.** PR-intent manifest in the PR description (or `pr-intent.yaml`). `adds:`, `changes:`, `removes:`, `tests:`, `docs:`, `gates:`.
3. **Verify state.** `git fetch`; recheck issue state; look for in-flight peer PRs on the same paths.
4. **Plan.** If the change is non-trivial, delegate to a `subagent-plan` (see [`../../prompts/subagent-plan.md`](/docs/prompts/subagent-plan)).
5. **Implement.** Tests in the same PR. Hermetic over E2E. Tests assert on codes.
6. **Self-review.** Run `pnpm check:quality-gates`. Read your own diff as a reviewer.
7. **Open PR.** Manifest in description. Link issue, ADR/RFC, related PRs.
8. **Address review per comment.** No wholesale rewrites in response to one comment.
9. **Merge clean.** Phased PRs: `gh pr merge --merge --admin` after gates green. Delete branch.

### Per pillar — Build-phase discipline

**Architecture**
- [ ] If a change crosses an unclear boundary: STOP. Draft an ADR; resume after acceptance.
- [ ] New schemas land in the contract package, never in a feature package.
- [ ] New error codes append to the central codes file.
- [ ] Named exports only. No `any` at boundaries.

**Security**
- [ ] Every new method declares `requireAuth: true` (or explicit `false` reviewed in PR).
- [ ] Tenancy comes from session, never from body.
- [ ] Privileged ops audit-log before execute.
- [ ] Outbound fetch goes through `safeFetch`.
- [ ] Secrets are vault refs.
- [ ] No stack traces or internal IDs in wire-serialized errors.

**UI-UX**
- [ ] Tokens for all visual values (no hex / rgb / arbitrary class).
- [ ] Shared primitives only (no native `\<button\>` / `\<input\>` / etc.).
- [ ] `useT()` for every user-visible string.
- [ ] `\<Skeleton\>` for content loading; spinners only for inline actions.
- [ ] `\<EmptyState\>` with cause-typed variants.
- [ ] Keyboard reachable; focus visible; aria labels.

**Quality**
- [ ] Tests in the same PR (no "tests next PR").
- [ ] Tests assert on codes / `byRole`, not on rendered text.
- [ ] File-size budgets honoured; extract on overflow.
- [ ] `pnpm check:quality-gates` green before merge.

**Governance**
- [ ] PR intent declared; `removes:` justified.
- [ ] `merge-override:` annotation if conflict resolution dropped a side.
- [ ] One sub-unit per PR.
- [ ] Verify-first close: `gh issue view \<n\>` before "fixing".

**AI-collaboration**
- [ ] One sub-unit per session.
- [ ] Honest reporting: failures quoted, skipped steps stated.
- [ ] Persistent memory updated when a non-obvious lesson lands.
- [ ] Sub-agents for fan-out (search, plan, review).
- [ ] Concurrent-agent awareness: peer PRs read before starting.

### Common failure modes

- **"While I'm here" scope creep.** PR balloons; review gets lost. → File the side issue; do not pursue.
- **Tests deferred.** "Tests in a follow-up PR" — follow-up never lands. → Same PR or no PR.
- **`--no-verify` push to skip the hook.** Bypasses the safety net. → Justify in PR; investigate the hook's slowness.
- **Renaming as delete + add.** Looks like a remove in the diff; manifest is misleading. → State explicitly: "renamed X → Y" in `changes:`.
- **PR description that does not match the diff.** Reviewer cannot verify. → Manifest IS the contract.

### Sub-unit examples

Good sub-units (one PR each):

- "Add `users.invite` method with email validation + audit log + test."
- "Refactor `flow-editor` to extract `parts/properties-panel.tsx` (file-size budget)."
- "Add `consent.grant` UI surface; wires existing backend method."

Bad sub-units (split these):

- "Add user invitations + workspace switching" (two features).
- "Refactor X and fix Y" (two intents).
- "Phase 1 + Phase 2 of \<epic\>" (chain into separate PRs).

### Exit criteria

Build is a loop, not a phase that exits. The codebase is "in Build" for most of its life. Each cycle through the loop completes when:

1. PR merged.
2. Gates green on main.
3. Issue closed; sub-unit tracker updated.
4. Memory updated if a lesson landed.

### See also

- [`../../pillars/governance/pr-intent-pattern.md`](/docs/pillars/governance/pr-intent-pattern)
- [`../../pillars/ai-collaboration/universal.md`](/docs/pillars/ai-collaboration/universal)
- [`../../prompts/system-implementer.md`](/docs/prompts/system-implementer)
- [`../../templates/PR-intent.template.md`](/docs/templates/PR-intent.template)
