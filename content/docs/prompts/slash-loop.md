---
title: 'Slash Command — /loop'
description: 'Run a task repeatedly. Either on a fixed interval or self-paced based on an exit condition.'
---

# Slash Command — /loop

Run a task repeatedly. Either on a fixed interval or self-paced based on an exit condition.

## Trigger

```
/loop [<interval>] <task>
```

- `/loop 5m /sanity` — every 5 minutes, run `/sanity`.
- `/loop /watch-pr 1234` — self-paced; wake when the PR's state changes meaningfully.
- `/loop` — autonomous; agent picks the next task each tick.

## Args

- `\<interval\>` (optional) — fixed interval (`30s`, `5m`, `1h`). Omit for self-paced.
- `\<task\>` — the prompt body or slash command to execute each tick.

## Body

```
You are in a loop. Each tick: execute the task, then schedule the next.

Rules:

1. EXECUTE
   - Run the task body verbatim.
   - Report status at the end of each tick (succeeded / blocked / found nothing).

2. SCHEDULE NEXT TICK
   - Fixed interval: at <interval> after this tick ends.
   - Self-paced: pick the delay based on what you are waiting for.
     - Cache-friendly windows: ≤ 270s (cache stays warm) or ≥ 1200s (one cache miss buys long wait).
     - Avoid 300s exactly — busts cache for no extra wait.
     - Default idle delay: 1200–1800s (20–30 min).
     - Polling external state (CI, deploy): match the state's change cadence.

3. EXIT CONDITIONS
   - Task succeeds in a way that makes further runs pointless → STOP.
   - User explicitly stops the loop → STOP.
   - Repeated failures with no progress (3+) → STOP, file issue, ask user.

4. HONEST REPORTING PER TICK
   - "succeeded" only when verified.
   - "blocked on X" when you cannot make progress.
   - Quote failures verbatim.

5. DO NOT BURN CACHE
   - If you find yourself sleeping 300s repeatedly, switch to ≤ 270s (stay warm) or ≥ 1200s (commit to long wait).
   - Polling something the harness can notify you about is wasted — sleep long; the harness will wake you.

6. SCOPE GUARD
   - Do not change the task body per tick.
   - If the task body needs to change, exit the loop and restart with the new body.

7. SAFETY
   - Side-effecting tasks (push, merge, deploy) require explicit confirmation in the task body.
   - The loop alone is not authorization for side-effects.
```

## Common forms

| Form | Use |
|---|---|
| `/loop 5m /watch-deploy` | Poll a deploy until it finishes |
| `/loop` (autonomous) | Self-paced "keep going" mode; agent picks next sub-unit each tick |
| `/loop 1h /sanity` | Hourly sanity sweep, posts diffs |
| `/loop /bug-hunt` | Self-paced; runs bug-hunt phases until findings exhausted |

## Common failure modes

- **Burning cache with 30-second loops on slow external state.** → Pick the right cadence; cache TTL matters.
- **Loop with no exit condition.** Runs forever. → Body's Rule 3 mandates exit.
- **Task body changes mid-loop.** Inconsistent results. → Body's Rule 6 mandates exit + restart.
- **Loop merges things without confirmation.** → Body's Rule 7 separates "loop authorized" from "side-effect authorized".

## See also

- [`../pillars/ai-collaboration/slash-commands-pattern.md`](/docs/pillars/ai-collaboration/slash-commands-pattern) — Loop discipline.
- [`slash-goal.md`](/docs/prompts/slash-goal) — `/goal` + `/loop` together can model "work until condition holds, but tick on a cadence".
