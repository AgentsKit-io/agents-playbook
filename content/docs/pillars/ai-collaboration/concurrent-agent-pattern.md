# Concurrent Agent Pattern

How to survive — and benefit from — multiple agents working in the same repo at the same time.

## TL;DR (human)

Your branch is not the only branch. Issues you plan to fix may be fixed concurrently. Main moves under your feet. Defensive practices: verify-first at session start, rebase not merge, stash-verify red before "fixing" CI, never `--theirs`/`--ours` without justification.

## For agents

### The hazards

When N agents work in one repo, the rate of one specific class of waste goes up linearly:

| Hazard | Symptom |
|---|---|
| Duplicate work | Two agents fix the same issue in parallel; one PR gets closed as duplicate |
| Stale issue | Agent grinds on an issue that was closed by a peer mid-session |
| Conflict storm | Agent rebases and finds the file they were editing was deleted |
| Silent revert | Agent uses `--theirs` to resolve a conflict; peer's work is dropped |
| False red | Agent "fixes" a CI failure that was actually pre-existing on main |
| Doc drift | Agent updates a doc that another agent just rewrote |

### Defensive checklist (session start)

Run this every session, not just the first session in a sprint:

1. `git fetch origin --prune`
2. `git status` — clean tree expected; if dirty, stash with a tag.
3. `git log origin/main..HEAD` and `git log HEAD..origin/main` — see what diverged.
4. `gh issue view <n> --json state` for every issue you plan to touch.
5. `gh pr list --search "is:open touch-path:<your-paths>"` — peer PRs touching your files.
6. If you find peer activity in your path: read those PRs before starting; you may be redundant.

This costs ~30 seconds. It prevents hours of wasted work.

### Defensive checklist (before push)

1. `git fetch origin`
2. Rebase onto fresh `origin/main`. Resolve conflicts (see "Conflict policy" below).
3. Re-run quality gates on the rebased branch.
4. `gh issue view <n> --json state` again — the issue may have closed while you worked.
5. If the issue closed: do **not** push a dup PR. Comment on the closing PR if your work has additional value; otherwise drop the branch.

### Conflict policy

Conflicts surface where your work meets peer work. Two failure modes:

1. **`git checkout --theirs` / `--ours`.** Drops one side's work entirely. Almost never the right answer. → If you must use this, the PR-intent manifest must include `merge-override: <reason>`. The reviewer verifies the override is justified.
2. **Hand-merged conflict that quietly mis-orders things.** Diff looks clean; behavior is broken. → After any conflict resolution, re-run the affected tests. Always.

Default: **rebase, resolve hunk-by-hunk, keep both sides where they coexist.** Merges should sum.

### Stash-verify-red

Before "fixing" a CI failure:

1. Stash your changes.
2. Check out fresh `origin/main`.
3. Re-run the failing job.
4. If it fails on clean `origin/main`: the failure is pre-existing. **Do not blame your branch.** File an issue; either pick up the fix yourself in a separate PR, or revert your stash and continue on your sub-unit.
5. If it passes on clean `origin/main`: the failure is yours. Apply the stash and fix.

This prevents agents grinding on imaginary failures and prevents peer pressure to "make the red go away" without diagnosing.

### Worktrees for parallel work

If you run multiple sessions or multiple agents on one machine:

- One worktree per branch (`git worktree add ../<repo>-<branch> <branch>`).
- Each worktree is fully independent — separate `node_modules`, separate `dist`, separate everything that lives in `.gitignore`.
- Never edit the same file in two worktrees. The second edit will conflict at push.

Worktrees minimize "stash-restore" thrash. A cheap defensive practice.

### Verify-first before close-out

Before closing an issue you "fixed":

1. `gh issue view <n> --json state` — confirm still open.
2. Read the issue body again — confirm the DoD is what you fixed.
3. Cross-check your PR against the DoD line-by-line.
4. Look at peer-closed PRs that reference the issue — maybe they already closed it and your work is redundant.

This was the single highest-yield discipline in production: catching dup work *after* an agent finished implementing it (because the issue closed mid-session) is wasteful but recoverable; catching it before the PR is open saves the entire impl cost.

### Memory updates from concurrent-agent events

When concurrent work surprises you, write a memory:

- The path that had peer activity (so next session you check it).
- The issue you found closed (so next session you do not pick it up).
- The conflict resolution pattern that worked (so next session you reuse it).

See [`memory-pattern.md`](./memory-pattern.md).

### Common failure modes

- **Agent picks high-contention issue from a popular epic.** Maximises duplicate-work probability. → Prefer low-parallelism issues; avoid hot epics unless explicitly assigned.
- **Agent assumes main is stable.** Pushes; CI red because peer landed a refactor 10 min ago. → Always `git fetch` before push.
- **Agent uses `--theirs` to "win" a conflict.** Drops the other agent's work silently. → Lint / gate the PR-intent manifest to require `merge-override:` annotation when these flags appear in the diff.
- **Agent grinds on a pre-existing red.** Wastes hours "fixing" a failure that was never theirs. → Stash-verify-red protocol.

### See also

- [`../governance/README.md`](../governance/README.md) — merge rules + PR-intent removes-list.
- [`universal.md`](./universal.md) — Rule 9.
- [`memory-pattern.md`](./memory-pattern.md) — log what surprised you.
