---
title: 'Slash Command — /clear'
description: 'Reset session context cleanly without losing persistent memory.'
---

# Slash Command — /clear

Reset session context cleanly without losing persistent memory.

## Trigger

```
/clear
```

## Body

```
Reset session context. Persistent memory is preserved; ephemeral chat history is dropped.

What happens:

1. The agent's working context (current task, recent file reads, conversation history) is cleared.
2. The next message starts fresh.
3. Bootstrap docs (CLAUDE.md, AGENTS.md) reload on next read.
4. MEMORY.md index reloads on next session start.

What does NOT happen:

- Persistent memory files (`.agent-memory/*.md`) are NOT deleted.
- Repo state is NOT touched (no `git reset`, no `git checkout`).
- Open files in the editor are NOT closed.

When to use:

- The agent's context drifted (started a different task; reasoning about stale state).
- Context window is full and the current task is unrelated to past chat.
- Starting a new session after a long break.

When NOT to use:

- Mid-implementation of a sub-unit — losing the implementation context is wasteful.
- To "fix" a problem by clearing context — the problem will recur. Fix the root cause.

Compared to other resets:

- `/clear` — chat only.
- `git reset --hard origin/main` — discards uncommitted work; explicit destructive action.
- New session entirely (close + reopen) — equivalent to /clear in most toolchains.

Rules:

- /clear is reversible only if the toolchain preserves transcripts. Treat as one-way.
- After /clear, re-read CLAUDE.md and the issue/task description before resuming.
```

## See also

- [`../pillars/ai-collaboration/memory-pattern.md`](../pillars/ai-collaboration/memory-pattern.md) — memory survives.
- [`../pillars/ai-collaboration/bootstrap-doc-pattern.md`](../pillars/ai-collaboration/bootstrap-doc-pattern.md) — bootstrap reload on next session.
