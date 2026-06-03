---
title: 'Concurrent Agent Pattern'
description: 'How to survive — and benefit from — multiple agents working in the same repo at the same time.'
---

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
4. `gh issue view \<n\> --json state` for every issue you plan to touch.
5. `gh pr list --search "is:open touch-path:\<your-paths\>"` — peer PRs touching your files.
6. If you find peer activity in your path: read those PRs before starting; you may be redundant.

This costs ~30 seconds. It prevents hours of wasted work.

### Defensive checklist (before push)

1. `git fetch origin`
2. Rebase onto fresh `origin/main`. Resolve conflicts (see "Conflict policy" below).
3. Re-run quality gates on the rebased branch.
4. `gh issue view \<n\> --json state` again — the issue may have closed while you worked.
5. If the issue closed: do **not** push a dup PR. Comment on the closing PR if your work has additional value; otherwise drop the branch.

### Conflict policy

Conflicts surface where your work meets peer work. Two failure modes:

1. **`git checkout --theirs` / `--ours`.** Drops one side's work entirely. Almost never the right answer. → If you must use this, the PR-intent manifest must include `merge-override: \<reason\>`. The reviewer verifies the override is justified.
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

- One worktree per branch (`git worktree add ../\<repo\>-\<branch\> \<branch\>`).
- Each worktree is fully independent — separate `node_modules`, separate `dist`, separate everything that lives in `.gitignore`.
- Never edit the same file in two worktrees. The second edit will conflict at push.

Worktrees minimize "stash-restore" thrash. A cheap defensive practice.

### Verify-first before close-out

Before closing an issue you "fixed":

1. `gh issue view \<n\> --json state` — confirm still open.
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

### Rebase hazards on a fast-moving main (hard-won)

These four bite specifically when `main` advances several times during one session — the high-parallelism case. They are subtle because each leaves a *clean-looking* tree.

1. **Rebase silently reverts a peer's files into your commit.** Repeated rebases against a fast-moving main can fold peer changes into your diff as *anti-changes* — your branch now "removes" work you never touched. A per-file review of your own paths will not catch it, because the contaminated files are not yours.
   → Before every push, diff the **full** changed-file set against the merge base, not just your paths:
   ```bash
   git diff --name-only origin/main...HEAD     # every file your branch touches
   ```
   For any file you did not intend to change, restore it: `git checkout origin/main -- <file>`.

2. **`git push | tail` (or any pipe) masks the push exit code.** A pipeline's exit status is the *last* command's, so a rejected push reads as success.
   → Check the push result explicitly (`git push …; echo "exit=$?"`), or read the unpiped output. Never trust a piped push.

3. **A rebase that pulls in new packages leaves your installed deps stale.** New workspace packages on main are not in your `node_modules`; builds and type-checks then fail with "cannot find module @scope/new-pkg" — a phantom error that is really a stale install.
   → After any rebase that touches the dependency graph, reinstall before building: `<pm> install`, then build the dependency *closure* of the package you are working in, not just the package itself.

4. **A contaminated shared checkout poisons every push.** If the working checkout has accumulated foreign WIP, pushing from it risks shipping anti-changes (hazard 1).
   → Push from an **isolated worktree off a fresh base**: `git worktree add --detach ../clean origin/main`, re-apply your sub-unit, install, gate, push `HEAD:refs/heads/<branch>`. Worktrees also need `BASE_REF=origin/main` for any deletion/intent gate that diffs against the base (see [`../governance/pr-intent-pattern.md`](../governance/pr-intent-pattern.md)).

> Do not bypass a failing gate to escape these (`--no-verify`, skip flags). The gate is catching real contamination. Fix the contamination, or escape to a clean worktree if the shared checkout is the problem.

### Concurrency vs. machine memory

Parallel agents (and parallel gates) share one machine's RAM. Cap the **number of concurrent workers** against total RAM — never cap per-process memory on RAM-hungry tools (type-checkers, bundlers); a per-process cap there produces phantom out-of-memory failures that look like real errors. Budget against total RAM; scale worker count down to stay inside it. Freezing the machine is never acceptable.

### Common failure modes

- **Agent picks high-contention issue from a popular epic.** Maximises duplicate-work probability. → Prefer low-parallelism issues; avoid hot epics unless explicitly assigned.
- **Agent assumes main is stable.** Pushes; CI red because peer landed a refactor 10 min ago. → Always `git fetch` before push.
- **Agent uses `--theirs` to "win" a conflict.** Drops the other agent's work silently. → Lint / gate the PR-intent manifest to require `merge-override:` annotation when these flags appear in the diff.
- **Agent grinds on a pre-existing red.** Wastes hours "fixing" a failure that was never theirs. → Stash-verify-red protocol.

### See also

- [`../governance/README.md`](../governance/README.md) — merge rules + PR-intent removes-list.
- [`universal.md`](./universal.md) — Rule 9.
- [`memory-pattern.md`](./memory-pattern.md) — log what surprised you.
