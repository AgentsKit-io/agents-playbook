---
type: Playbook Pattern
title: 'Agent Harness Pattern'
description: 'How to make coding-agent delivery evidence-backed instead of trust-based.'
---

# Agent Harness Pattern

How to make coding-agent delivery evidence-backed instead of trust-based.

## TL;DR

Use `@agentskit/harness` (`ak-harness`) to freeze a human-approved task contract, resolve ambiguities before implementation, run every applicable check, record structured evidence, and refuse `COMPLETE` without human approval.

The harness is agent-agnostic. An agent only needs to read the contract, run the CLI, and emit the common evidence format. Doc Bridge and the Playbook can enrich context, but the core protocol remains usable without either integration.

## Lifecycle

```text
CLARIFYING → PLANNED → IMPLEMENTING → VERIFYING
                                      ↓
                         AWAITING_HUMAN_APPROVAL
                                      ↓
              AWAITING_AUTHORIZATION → COMPLETE
```

`BLOCKED` means a required check failed or evidence was incomplete. `STALE` means the contract or source changed after evidence was produced. `CANCELLED` and `SUPERSEDED` preserve the history without pretending the task completed.

## Contract rules

Every repository task contract declares:

- intent, in-scope and out-of-scope surfaces, and unresolved ambiguities;
- outcome statements mapped to required checks;
- applicability for logic, CLI, MCP, UI, endpoint, database, and docs;
- real execution for UI, endpoint, database, CLI, and MCP checks;
- a structured evidence result for every required check;
- conditional external tracking, budget, and cleanup policy.

An agent may propose the contract, but a human must approve it before `PLANNED`. Once a run starts, changing the contract invalidates the run and requires a new approval.

## Evidence format

Every required check prints one final JSON line:

```json
{"status":"passed","criteria":["responsive-layout"],"artifacts":[]}
```

The harness captures stdout, stderr, exit code, duration, source revision, contract hash, and run ID. UI evidence additionally declares `real-browser` and `screenshot`, then supplies project-relative screenshot paths, SHA-256 hashes, and viewport dimensions.

Evidence proves that the declared command ran and produced the declared artifact. It does not replace good acceptance criteria; a weak check is still a weak check.

## Local-first workflow

```bash
ak-harness doctor --json
ak-harness plan approved --by human
ak-harness start
ak-harness verify --json
ak-harness approve approved --by human
```

If tracking is declared by the contract, the final step is:

```bash
ak-harness authorize approved --by human
```

After a failure, fix the code and run `ak-harness retry`. The new run preserves the blocked run as history and receives a new run ID.

## Dogfood

The harness should validate itself in the Playbook and then run a separate, task-scoped contract at the root of `agentskit-os`. Do not reuse an unrelated repository contract or turn the entire monorepo into a mandatory check for every small change.

## See also

- [`quality-gates-pattern.md`](/docs/pillars/quality/quality-gates-pattern)
- [`../../phases/04-test/`](/docs/phases/04-test)
- [`../../pillars/ai-collaboration/human-in-the-loop-pattern.md`](/docs/pillars/ai-collaboration/human-in-the-loop-pattern)
