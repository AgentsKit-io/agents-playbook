---
title: 'Human-in-the-Loop Pattern'
description: 'Design where humans review, approve, correct, and take over from agents — so autonomy scales with confidence and every correction becomes training signal.'
---

# Human-in-the-Loop Pattern

Design where humans review, approve, correct, and take over from agents — so autonomy scales with confidence and every correction becomes training signal.

> **Reference implementation:** [`createApprovalGate` in `@agentskit/core`](https://www.agentskit.io/docs/agents/hitl) — the pending/approved/rejected lifecycle this pattern describes, ready to wire. Or [install an HITL-gated agent](https://registry.agentskit.io) from the Registry.

## TL;DR (human)

Full autonomy and full manual are both wrong defaults. Place humans at the points where the cost of an error exceeds the cost of a review: gate **irreversible or high-stakes actions** behind explicit approval, **escalate low-confidence** outputs instead of emitting them, and let humans **edit** before shipping. Then capture every approval, rejection, and edit as structured signal — the edit-diff and the rejection reason are the highest-value training data you own. The goal is to *earn* autonomy: start supervised, measure agreement, and widen the agent's unsupervised envelope as the evals prove it. The human is not a fallback; the human is the loop that makes the agent get better.

## For agents

### Why HITL is an architecture, not an afterthought

For output someone puts their name on, "the model probably got it right" is not a shipping criterion. But routing *everything* through a human throws away the agent's leverage. The design question is precise: **at which decisions does a human add more value than they cost?** Answer it per action, not globally — and make the answer move as confidence grows.

### The interaction modes

| Mode | Human role | Use when |
|---|---|---|
| **Approve / reject (gate)** | Authorizes before execution | Action is irreversible, costly, externally visible, or privileged |
| **Edit-before-ship** | Corrects the draft | Output is usually-right and cheap to fix; the edit is signal |
| **Escalate-on-uncertainty** | Takes over the hard cases | Agent's confidence / source-support is low |
| **Review-after (audit)** | Spot-checks shipped output | Volume is high, stakes moderate, full gating too slow |
| **Autonomous** | None (sampled offline) | Reversible, low-stakes, evals prove reliability |

These are a **ladder**. A new capability starts near the top (gated); as its evals and online agreement prove out, it descends toward autonomous. Demote it back up the instant quality regresses.

### Gate the irreversible

The hard rule: **the blast radius of the action sets the gate, not the model's confidence.** Sending an email, charging a card, deleting data, publishing externally, mutating production, spending real money, anything privileged — gate it, even if the agent is "sure." Reversible, sandboxed, low-cost actions can run free. This mirrors the security posture: privileged operations require explicit, audited authorization (see [`../security/governance-posture-pattern.md`](/docs/pillars/security/governance-posture-pattern), [`../security/audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern)).

Approvals must be **legible**: show the human *what* will happen and *why* (the agent's reasoning + the action's effect), not a yes/no with no context. A rubber-stamp gate is theater.

### Escalate, don't emit, on low confidence

Tie escalation to the confidence signals from the eval and hallucination layers:

- Low source-support / failed faithfulness check → escalate rather than ship a likely fabrication.
- Low self-consistency across samples → escalate.
- Out-of-distribution input (unlike anything in the eval set) → escalate.

A handed-off "I'm not sure about this one" is cheap and trust-building; a confident wrong answer is expensive and trust-destroying. Calibrate the threshold against cost: too eager and you drown humans (alert fatigue → rubber-stamping); too reluctant and unsafe output leaks.

### Every interaction is training signal — capture it

This is the part teams leave on the floor. Each human touch is labeled data:

| Interaction | Signal | Use |
|---|---|---|
| Approved as-is | positive label | reinforce; candidate for autonomy |
| Edited then shipped | **the diff** — *exactly* what was wrong | highest-value: targeted prompt/eval fix |
| Rejected | negative + reason | frozen eval case; failure-mode taxonomy |
| Escalated & resolved | a hard case + its answer | new eval case; was the threshold right? |

Capture them **structured**, not as ad-hoc edits lost in a doc. The edit-distance and the rejection reason feed straight into [`../quality/agent-eval-framework-pattern.md`](/docs/pillars/quality/agent-eval-framework-pattern) and the next [`prompt-versioning-pattern.md`](/docs/pillars/ai-collaboration/prompt-versioning-pattern) iteration. A HITL system that doesn't record its corrections is paying for human review and discarding the receipt.

### Earn autonomy with measurement

Decide the autonomy envelope from agreement data, not gut:

1. Run the capability gated; log agent-proposed vs. human-final.
2. Measure agreement per slice (accept rate, edit-distance).
3. Where agreement is high and stable, widen to edit-before-ship, then sampled-audit, then autonomous.
4. Keep the harder slices gated.
5. Regression on the online signal → tighten the gate immediately.

Autonomy is a privilege the evals grant and revoke — not a launch decision made once.

### Design for the human's attention

HITL fails when it ignores the human's cognitive budget:

- **Don't flood.** Too many approvals → fatigue → rubber-stamping → the gate is now noise. Batch, prioritize by stakes, auto-clear the obvious.
- **Make review fast.** Surface the diff and the reasoning; let one keystroke approve/reject/edit. Review latency is a product metric.
- **Show provenance.** Sources, tool calls, confidence — so the human can judge in seconds, not re-derive the work.

### Common failure modes

- **Gate on confidence, not blast radius.** A confident agent deletes prod. → Irreversibility sets the gate, always.
- **Rubber-stamp approvals.** Context-free yes/no → humans approve blindly. → Show what + why; batch the trivial.
- **Corrections discarded.** Edits/rejections vanish into the product. → Capture structured; feed evals + prompt iteration.
- **Static autonomy.** Shipped fully-auto on day one, or gated forever. → Climb/descend the ladder on measured agreement.
- **Threshold mis-set.** Too eager → alert fatigue; too shy → unsafe output ships. → Calibrate against cost; watch fatigue as a metric.
- **No audit on gated actions.** Approval happened, no record. → Signed ledger entry per privileged action.

### See also

- [`../quality/agent-eval-framework-pattern.md`](/docs/pillars/quality/agent-eval-framework-pattern) — confidence signals that trigger escalation; edits/rejections become eval cases.
- [`hallucination-reduction-pattern.md`](/docs/pillars/ai-collaboration/hallucination-reduction-pattern) — low-support output escalates instead of shipping.
- [`prompt-versioning-pattern.md`](/docs/pillars/ai-collaboration/prompt-versioning-pattern) — corrections drive the next prompt iteration.
- [`../security/governance-posture-pattern.md`](/docs/pillars/security/governance-posture-pattern) — privileged actions require gated authorization.
- [`../security/audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — every approval is a signed ledger entry.
- [`../governance/phased-pr-pattern.md`](/docs/pillars/governance/phased-pr-pattern) — human approval gates in the shipping flow.
