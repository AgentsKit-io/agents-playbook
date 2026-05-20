# Phased PR Pattern

How to ship initiatives too big for one PR without ending up with a long-lived branch hell.

## TL;DR (human)

Split big initiatives into phases. Each phase is independently shippable: passes gates, is reviewable end-to-end, can ship without later phases. Merge each phase before opening the next. Fork the next phase from fresh main, not from the previous phase's branch.

## For agents

### Why phase

A mega-PR fails three ways:

1. **Unreviewable.** Past ~500 LOC of meaningful change, reviewers either skim or punt.
2. **Long-lived conflicts.** Every day the branch is open, main moves and conflicts compound.
3. **All-or-nothing.** If phase 3 of the plan turns out to be wrong, you cannot land phases 1 and 2 cleanly.

Phasing solves all three at once.

### Splitting strategy

Three good axes for splitting:

1. **By layer.** Phase 1: schemas + types. Phase 2: stores. Phase 3: handlers. Phase 4: UI. Each phase compiles on its own with stub adapters at the next layer.
2. **By surface.** One package per phase. Cross-cutting refactor → one PR per affected package.
3. **By risk.** Phase 1: low-risk foundation. Phase N: the controversial change.

Pick the axis that minimises cross-phase coupling. If phases need each other to compile, you split wrong.

### Per-phase rules

Each phase:

- Is one PR.
- Has its own PR-intent manifest (sub-unit references the same parent issue with `· phase N` suffix).
- Passes gates independently. The repo is shippable after each merge.
- Forks from **current main** at PR-open time, not from the previous phase's branch.
- Lands behind a feature flag if the partial state is not yet user-facing.

### Tracker issue

The parent issue lists all phases with status:

```markdown
- [x] Phase 1 — schemas + types — PR #1234
- [x] Phase 2 — stores — PR #1245
- [ ] Phase 3 — handlers
- [ ] Phase 4 — UI
- [ ] Phase 5 — feature-flag flip
```

Update the parent issue at the start and end of each phase. This is the canonical "where are we" doc.

### Merge cadence

Default: merge each phase with `gh pr merge --merge --admin` (or your equivalent) **after gates pass on the rebased branch**. Then delete the branch. Then fork the next phase off fresh main.

Why `--admin`: phased work often has tight dependencies between phases; you do not want the next phase blocked on a slow reviewer pinging an approval into a now-stale branch. Admin merge is appropriate **when gates are green** — never as an override of failing gates.

Why fresh main each phase: the previous phase's branch carries baggage (its commits, its conflict-resolution state). Forking from main resets the slate, avoiding cumulative drift.

### Feature flags

If a partial-state phase is observable to users, gate the new behavior behind a flag, default off. Phases 1–N add the behavior; the final phase flips the default. Two benefits:

- Each phase is shippable to production without exposing half-built UX.
- The flag flip is itself a trivial PR, reversible if something goes wrong.

### Cross-phase dependencies

Sometimes phase N+1 needs a change to a contract introduced in phase N. Handle by:

1. Land phase N. The new contract is available.
2. Open phase N+1 against current main (which now has the new contract).

Never open phase N+1 while phase N is still in review. The merge order matters.

### When phasing goes wrong

- **Phases are too small.** A 30-line PR per phase + 20 phases = review overhead dominates the work. → Merge adjacent phases when they share a reviewer.
- **Phases are too big.** Each phase is 1500 LOC. → Re-split. The axis was wrong.
- **Phase N+1 cannot ship without phase N+2.** → Phases are coupled; you did not split well. Re-plan.
- **Branch sits open for a week between phases.** → Cadence too slow; conflicts compound. Aim for one phase per session.

### Long-lived parent branches

Some teams use a long-lived `epic/<name>` branch with phase PRs merging into it, then a final mega-merge to main. **Do not do this.** Reasons:

- The mega-merge is unreviewable again.
- The epic branch conflicts with main as main moves.
- You lose the gate-per-phase discipline.

Phases merge directly to main. Each phase carries its own gate signal.

### Common failure modes

- **Phase 2 opened while phase 1 still under review.** Conflict storm when phase 1 lands. → Strict serial: merge, then open next.
- **No feature flag on a half-built UI surface.** Users see broken state in prod. → Flag mid-build; flip in the final phase.
- **Parent issue not updated.** Reviewers can't tell which phase is current. → Update parent issue at every phase start + end.
- **Phases not independently testable.** Phase 1 has no behavior without phase 3; can't write a meaningful test. → Phase contract is "the system still compiles + existing tests still pass". Adding tests for the new behavior happens in the phase that adds the behavior.

### See also

- [`universal.md`](./universal.md) — Rule 8.
- [`../ai-collaboration/universal.md`](../ai-collaboration/universal.md) — Rule 5 (one sub-unit per session).
- [`merge-rules-pattern.md`](./merge-rules-pattern.md) — for the rebase-each-phase step.
