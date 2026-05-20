# Architecture — Universal Principles

Stack-agnostic. Applies to any language, any framework.

## TL;DR (human)

Six rules. They scale from a one-package project to a 30+ package monorepo. They are the price of admission for letting agents touch your code without supervision.

1. Name every boundary. If you cannot tell an agent "this code goes in package X", the boundary does not exist yet.
2. One contract package owns schemas + error model. Everything else depends on it; it depends on nothing internal.
3. Every change to that contract goes through a written decision (ADR / RFC). The document is the artifact.
4. No `any` / `dyn` / `interface{}` at any external boundary. Parse with a runtime schema.
5. Errors are typed with stable codes. The client (or another agent) can pattern-match without reading strings.
6. Files have size budgets enforced by a gate. Reviewability is a feature.

## For agents

### Rule 1 — Name every boundary

Every directory that an agent might write code into must answer: "what is this for, and what is it not for?" in one sentence.

- Maintain a top-level routing table mapping intent ("I want to change X") to location ("edit package Y"). Template: [`../../templates/AGENTS.md.template.md`](../../templates/AGENTS.md.template.md).
- If two packages could plausibly own the same change, the boundary is wrong. Fix the boundary or merge the packages.
- Group packages into 4–7 **logical groups** (e.g. "contracts + foundation", "runtime + flow", "security + collaboration"). Agents triage faster by group than by alphabetical name.

**Failure mode prevented:** agents inventing new packages or piling code into the largest existing file because no rule said where it goes.

### Rule 2 — One contract package owns schemas + error model

Pick one package (call it `core` or `contracts`). It contains:

- All shared types / schemas (Zod, Pydantic, Protobuf — your choice).
- The error class hierarchy + the central error-code constants.
- Nothing else. No business logic. No I/O.

Constraints:

- This package has **no internal dependencies**. It can depend on `zod` and `std`, nothing else.
- It has a hard size budget (e.g. 25 KB gzipped). The budget is a CI gate. Hitting the budget forces a real conversation about what belongs in the contract layer.

**Failure mode prevented:** circular dependencies, schema drift between packages, agents copy-pasting "the same" schema with a one-field difference.

### Rule 3 — Decisions are written down before they ship

Two artifacts:

- **ADR** (Architecture Decision Record) — for choices that affect the codebase's shape. Numbered. Append-only. Status: Proposed / Accepted / Superseded / Tombstoned. Template: [`../../templates/ADR.template.md`](../../templates/ADR.template.md).
- **RFC** (Request for Comment) — for choices that affect external contracts (public API, wire format, plugin protocol). Has a review window. Promotes to ADR when accepted. Template: [`../../templates/RFC.template.md`](../../templates/RFC.template.md).

Rules:

- An agent proposing a structural change without an ADR is proposing tech debt. Reject the PR; ask for the ADR first.
- An agent proposing a breaking change without an RFC is proposing an unannounced break. Reject the PR; ask for the RFC.
- ADRs/RFCs are the **change**. The code is the implementation of the change.

**Failure mode prevented:** "we decided" without anyone able to find the decision; future agents reverting it because they cannot see why it was made.

### Rule 4 — Parse, don't validate, at every external boundary

External boundary = anywhere bytes enter the process from outside the trust boundary: HTTP, IPC, JSON-RPC, file I/O, env vars, CLI args, message-bus payloads.

- Define a schema. Parse the input. Use the parsed type. If parsing fails, raise a typed error with a stable code.
- Do not type-cast unparsed input. Do not "trust the API contract on the other side". Parse.
- The parsed type is the only type that flows into the rest of the system. Untyped data is sandboxed at the edge.

**Failure mode prevented:** runtime errors deep in the system caused by an upstream caller's drift; agents writing handler code that assumes the wrong shape and breaks silently.

### Rule 5 — Typed errors with stable codes

Define one base error class. Every other error in the system subclasses it. Each error has:

- a stable string code (`NAMESPACE_REASON`, all-caps, snake-case),
- a human message (intl-keyed in user-facing surfaces),
- an optional `hint` (one-line suggestion to the caller),
- an optional `docsUrl` (link to the error doc).

Constraints:

- Never `throw new Error('...')` at a boundary. Wrap in a typed subclass.
- The dispatcher / HTTP layer serializes typed errors with `code` + `message` + `hint` + `docsUrl`. Unknown thrown errors become an opaque `INTERNAL_ERROR` — never leak stack traces or raw strings.
- Codes are append-only. Renames go through an ADR.

**Failure mode prevented:** clients pattern-matching on error message strings (which drift); agents inventing new error shapes per package; opaque failures in production.

### Rule 6 — File-size budgets

Pick budgets per file kind. Enforce them in a gate.

Example budgets (calibrated for TS/React; adjust per language):

- View / component files: 300 lines.
- Logic / module files: 500 lines.
- Test files: 800 lines (often unavoidable for table-driven tests).

Rules:

- The gate is **baseline-shrink-only**: an existing file over budget is grandfathered, but new code in that file must shrink it; new files must respect the budget.
- Hitting the budget = extract. Do not lower the budget to fit. Do not split into `\<file\>-2.\<ext\>`.

**Failure mode prevented:** files becoming unreviewable; agents losing context inside a 1500-line component; reviewers approving PRs they cannot read.

## See also

- [`adr-pattern.md`](./adr-pattern.md) — how to write an ADR.
- [`rfc-pattern.md`](./rfc-pattern.md) — when an ADR is not enough.
- [`error-hierarchy.md`](./error-hierarchy.md) — the error model in detail.
- [`file-size-budget.md`](./file-size-budget.md) — budget calibration + gate impl.
- [`../governance/README.md`](../governance/README.md) — merge rules that protect these boundaries.
