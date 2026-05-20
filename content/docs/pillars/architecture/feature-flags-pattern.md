# Feature Flags Pattern

How to ship code separately from shipping behavior, without accumulating a flag graveyard.

## TL;DR (human)

Feature flags decouple deploy from release. Code lands in main behind a flag, default off. Flags are typed: release / experiment / ops / kill-switch / permission. Every flag has an owner + retirement date. Flags retire as zealously as they are added — stale flags accumulate complexity worse than the alternative they were meant to avoid.

## For agents

### Flag taxonomy

Five types. Each has different lifecycle and ownership.

| Type | Purpose | Lifetime | Owner |
|---|---|---|---|
| **Release** | Hide unfinished features; flip when ready | Days–weeks | Feature team |
| **Experiment** | A/B test variants | Days–weeks (until decision) | Product / experiment owner |
| **Operational** | Ramp / canary / kill expensive code paths | Permanent (but value changes) | Ops / SRE |
| **Kill-switch** | Emergency disable of a feature in prod | Permanent | Ops / SRE |
| **Permission / entitlement** | Per-tenant / per-plan feature gating | Permanent | Product |

Confusing one type for another is the #1 source of flag debt.

### Flag definition shape

```ts
type FeatureFlag = {
  key: string;              // "users.invite-flow.v2"
  type: "release" | "experiment" | "operational" | "kill-switch" | "permission";
  description: string;      // What does flipping it do?
  owner: string;            // Single accountable person / team.
  defaultValue: boolean | string | number;
  createdAt: string;        // ISO date.
  retireAt?: string;        // ISO date. REQUIRED for release / experiment types.
  rollout?: {
    workspaceIds?: string[];      // explicit allowlist
    percentage?: number;          // 0..100 for gradual ramp
    rules?: Array<{ attr: string; op: string; value: unknown }>;  // attribute-based
  };
};
```

`retireAt` is mandatory for release and experiment flags. The flag definition is rejected if missing.

### Reading a flag

```ts
const enabled = flags.evaluate("users.invite-flow.v2", ctx);
if (enabled) {
  // new path
} else {
  // old path
}
```

The `evaluate` call:

- Reads workspace / user attributes from `ctx` (never from request body — see security Rule 2).
- Applies rollout rules in order: kill-switch override → permission gate → operational override → experiment assignment → release flag.
- Caches per-`(flag, ctx)` for the duration of the request.
- Logs the evaluation (sampled) for analytics.

### Naming conventions

`\<feature\>.\<concept\>.\<variant\>`:

- `users.invite-flow.v2` (release)
- `billing.pricing-table.experiment-q3` (experiment)
- `runtime.flow-execution.parallel-handlers` (operational)
- `payments.charge.kill-switch` (kill-switch)
- `tenants.custom-domain` (permission)

Discipline: no `enable_X` / `feature_Y` / `useNewX` — those drift.

### Flag retirement

Retirement is mandatory and tracked. Sequence:

1. **Pick the winner.** For release: the new path. For experiment: whichever variant won.
2. **Make it the default in code.** Replace `if (flag) { newPath } else { oldPath }` with just `newPath`.
3. **Delete the loser path.** This is the point. Keeping both paths "in case" is the trap.
4. **Delete the flag definition.** From flag registry, from any docs.
5. **Audit-log the retirement.**

A retirement PR is a clean revert of the flag-introduction PR. If retirement is hard, the original PR did too much.

### Retirement enforcement

A gate scans:

- Flag definitions with `retireAt < today` → fail.
- Flag references in code where the flag definition no longer exists → fail (stale code).
- Flag definitions with no references in code for > 30 days → warn (likely abandoned).

This prevents flag graveyard accumulation. A flag past retirement is debt; surface it.

### Kill-switch discipline

Kill-switches are permanent flags, but they have constraints:

- **Always default ON**, kill action is "flip to off".
- **Per-tenant override allowed** (mute a noisy customer's expensive feature).
- **Documented runbook**: when to flip, what user-visible effect, expected recovery time.
- **Flipping is audit-logged** with operator id + reason.

A kill-switch you cannot find when production is on fire is worse than no kill-switch.

### Storage

Flag values live in:

- **In-process default**: the flag definition's `defaultValue` (bootstrap fallback).
- **Centralized config store**: durable; per-environment + per-tenant overrides.
- **Edge / runtime override**: fast path for kill-switch flips.

Mutations are audit-logged: who flipped, when, what value, from what state.

### Experiment-specific concerns

Experiments need additional discipline:

- **Pre-registered hypothesis**: what you expect to see; what would change the call.
- **Sample size + power calculation**: how long until you have enough data.
- **Stop conditions**: when do you call it.
- **One experiment per metric per surface at a time**: parallel experiments confound results.

Treat experiments as time-boxed. An experiment past its stop date is a stale flag.

### Permission flags (per-tenant entitlements)

Permission flags differ from feature flags in semantics:

- Persistent (not retired).
- Tied to plan / contract terms.
- Visible in the product (the user can see "you don't have this on your plan").
- Linked to billing.

Implement these via plan presets in the whitelabel runtime (see [`../ui-ux/whitelabel-pattern.md`](../ui-ux/whitelabel-pattern.md)), not via the feature-flag system. Mixing the two is confusing.

### Common failure modes

- **Release flag that lives forever.** Code has both paths permanently. → Mandatory `retireAt`; retirement gate.
- **Experiment with no stop condition.** Runs forever; nobody calls it. → Pre-registered stop conditions.
- **Permission flag in feature-flag system.** Retirement gate flags it; team adds bogus `retireAt` to silence the gate. → Separate system; clear semantics.
- **Flag value read at module-import time.** Cannot change without restart. → Always evaluate per request / per call site.
- **Flag evaluation in security-critical paths without falling back to safe default.** Network blip → flag returns undefined → behavior is wrong. → Default-safe values; circuit-break on store failure.
- **Branching deep inside a function on a flag.** Function does two things; tests have to mock the flag. → Branch at the call site; pass the chosen function down.

### See also

- [`anti-overengineering.md`](./anti-overengineering.md) — flags should not be the default; YAGNI applies.
- [`../security/universal.md`](../security/universal.md) — flag flips audit-logged.
- [`../ui-ux/whitelabel-pattern.md`](../ui-ux/whitelabel-pattern.md) — permission flags via plan presets.
- [`../quality/quality-gates-pattern.md`](../quality/quality-gates-pattern.md) — retirement gate.
