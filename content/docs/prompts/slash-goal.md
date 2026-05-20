---
title: "Slash Command — /goal"
description: "Set a session goal with an explicit exit condition. Stops only when condition holds."
---

# Slash Command — /goal

Set a session goal with an explicit exit condition. Stops only when condition holds.

## Trigger

```
/goal <condition>
```

## Args

- `\<condition\>` — the success state. Imperative phrasing. Examples:
  - `tests green for package X on a fresh clone`
  - `PR open with intent manifest and gates passing`
  - `ADR-NNNN drafted, reviewed, and accepted`

## Body

```
A session goal has been set. The session does not end until the condition holds:

    <condition>

Rules:

1. WORK TOWARD THE CONDITION
   - Every action contributes to the goal or is justified as a prerequisite.
   - Do not stop because the turn "feels complete" — only when the condition is verifiably met.

2. ASSESS PROGRESS HONESTLY
   - At the end of each work block, state where you are vs the condition.
   - "Halfway" or "blocked on X" is acceptable; "done" without verification is not.

3. VERIFY THE EXIT
   - The condition is met when:
     - Gates / tests / `gh issue view` (whatever applies) confirms it.
     - The verification is reproducible — you describe how to re-check it.
   - State the verification in the final message.

4. UNBLOCK
   - If you cannot make progress: state why explicitly.
   - Pick the smallest unblock action (file an issue, ask a question, run a diagnostic).
   - Do not spin.

5. SCOPE GUARD
   - Do not expand the goal. New work discovered along the way → file an issue, do not pursue.
   - If the original goal is wrong (impossible / poorly defined), STOP and ask for an updated goal.

6. ON EXIT
   - State the goal again.
   - State the verification (how you know it holds).
   - Summarize the work that got there (bullet list).

Hard rules:
- No optimistic reporting. If gates failed, gates failed.
- No "should be done" — only "verified done" or "blocked on X".
```

## Combining with other commands

`/goal` typically sits at the session opening. Inside it, the agent may delegate to sub-agents (`subagent-explore`, `subagent-plan`, `subagent-code-reviewer`) or invoke other slash commands (`/sanity`, `/review`).

## Common failure modes

- **Ambiguous condition.** "Make it better." — not verifiable. → Re-state until verifiable.
- **Agent declares done without verification.** → Body's Rule 3 mandates a verification step.
- **Goal scope creep.** → Body's Rule 5 mandates new work goes to an issue.
- **Infinite loop on a blocked task.** → Body's Rule 4 mandates explicit unblock or stop.

## See also

- [`../pillars/ai-collaboration/universal.md`](../pillars/ai-collaboration/universal.md) — Rule 7 (explicit goal + exit).
- [`slash-loop.md`](./slash-loop.md) — for self-paced or recurring runs.
