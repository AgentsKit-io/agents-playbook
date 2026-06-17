---
type: Playbook Pattern
title: 'Merge Rules Pattern'
description: 'How to resolve conflicts so the merge sums work instead of subtracting it.'
---

# Merge Rules Pattern

How to resolve conflicts so the merge sums work instead of subtracting it.

## TL;DR (human)

Default: rebase, resolve hunk-by-hunk, keep both sides where they coexist. `git checkout --theirs/--ours` is almost never the right answer; when it is, document why with `merge-override:` in the PR-intent manifest. After any conflict resolution, re-run the affected tests — diffs that look clean can hide reordering bugs.

## For agents

### The hazards

Conflicts happen where your work meets peer work. Two ways they go wrong:

1. **Silent subtraction.** You drop one side's change without noticing.
2. **Reordering bug.** The diff looks plausible; the runtime behavior is wrong because two changes had a dependency you missed.

The merge-rules pattern targets both.

### Default protocol

1. **Rebase, do not merge.** `git rebase origin/main`, not `git merge main`. Linear history is easier to read; reviewers can see exactly what diverged.
2. **Resolve hunk-by-hunk.** For each conflict, read both sides. Decide:
   - Both contributions are needed → merge by hand, keeping both.
   - One is strictly newer / better → keep that one; the other was a partial step.
   - They are incompatible → stop and ask. Do not pick blindly.
3. **Run tests on every step of a multi-commit rebase.** Not just at the end. A reordered commit can pass at the tip and fail in the middle, which breaks `git bisect` later.
4. **Open the diff against `origin/main` and re-read.** Confirm the diff is what you expect.

### `--theirs` / `--ours` policy

Almost never the right answer. Their semantics:

- `--ours` keeps the side currently checked out. During a rebase, that is **the upstream** (because you're replaying yours onto theirs).
- `--theirs` keeps the incoming side. During a rebase, that is **your work**.

The flipped semantics during rebase trip up agents repeatedly. Avoid both unless you can clearly state which side wins and why.

When you do use them, the PR-intent manifest must have:

```yaml
merge-override: "Explanation: which side was dropped, why dropping it was safe, what compensating change (if any) was needed."
```

The gate fails the PR if these flags appear in the diff (detectable via `git rerere` cache or by analysing the commit message) without the annotation.

### Removes-list discipline

When the merge involves a delete-vs-edit conflict:

- If the delete wins → the manifest needs a `removes:` entry naming the symbol or file.
- If the edit wins → the manifest needs nothing extra, but the reviewer must verify the edit is still needed.

Pattern that recurs in production: agent A renames a symbol; agent B edits the old name; merge result keeps the old name **and** the rename in different files. The build breaks. → After any rename conflict, search-and-verify all references are updated consistently.

### Conflict patterns and resolutions

| Pattern | Right move |
|---|---|
| Both sides added independent lines in the same file | Keep both, order them sensibly |
| Both sides modified the same line | Read both; pick the union if both intents matter; pick the newer one if it supersedes |
| One side deleted a file the other side edited | Read why each side did it; usually the delete wins after the edit is migrated elsewhere |
| Both sides renamed the same file to different names | Stop; this is a design conflict, not a merge conflict |
| One side reformatted; the other side changed behavior | Reformatting wins for the lines it touched; behavior wins for the lines it touched; manual merge per hunk |
| Auto-generated file conflict (lockfile, codegen) | Regenerate from scratch on the resolved state; do not hand-merge |

### After the resolution

1. **Tests.** Run them. All of them in scope. Conflicts can pass the build and fail behavior tests.
2. **Lint + structural gates.** Run them. Conflicts can break invariants without producing syntax errors.
3. **`git diff origin/main`.** Read it. Confirm it matches your manifest claims.
4. **PR description.** Update if scope changed. Mention the conflict resolution in a comment if it was non-trivial.

### Common failure modes

- **Used `--theirs` without thinking about what "theirs" means during rebase.** Dropped your own work. → Slow down; rebase semantics are inverted from merge semantics.
- **Hand-merged a lockfile.** Now `pnpm install` fails for everyone. → Regenerate; never hand-merge generated files.
- **Resolved by accepting peer's whole file.** Discarded valid local changes. → Accept-by-file is an emergency tool, not a strategy.
- **Pushed without re-running tests.** CI red; reviewer's time burned. → Always re-run after conflict resolution.
- **No `merge-override:` annotation when one was needed.** PR-intent gate fails; restart resolution. → Annotate at the moment you use the flag; do not "add it later".

### See also

- [`universal.md`](/docs/pillars/governance/universal) — Rule 2.
- [`pr-intent-pattern.md`](/docs/pillars/governance/pr-intent-pattern) — `merge-override:` field.
- [`../ai-collaboration/concurrent-agent-pattern.md`](/docs/pillars/ai-collaboration/concurrent-agent-pattern) — defensive checklists.
