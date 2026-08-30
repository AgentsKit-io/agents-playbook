# @agentskit/harness

Portable, evidence-backed development protocol for coding agents. The harness freezes a human-approved task contract, executes every configured check, binds evidence to the current source revision, detects stale results, and refuses completion without human approval.

## Install

```bash
pnpm add -D @agentskit/harness
```

The package requires Node.js 22 or newer and exposes both `ak-harness` and the common-protocol alias `ak-verify`.

## Workflow

```bash
ak-harness doctor --json
ak-harness plan approved --by human
ak-harness start
ak-verify run --json
ak-verify approve <run-id> approved --by human --json
ak-harness cancel <run-id> --by human --reason "Requirements changed"
ak-harness benchmark --manifest benchmarks/harness-phase-0.json --json
```

`plan` rejects unresolved ambiguities and unauthorized dirty worktrees. After `start`, the contract is frozen. Any source, configuration, or contract change invalidates evidence and moves the run to `STALE`. A human can cancel an active run; retrying a blocked, stale, or cancelled run marks the previous run `SUPERSEDED`.

Automated CI may prepare a run with `ak-harness plan prepared --by ci`. This records a CI preparation, never a human approval; the run remains unable to become `COMPLETE` until a human approves the verified result.

## External coding benchmark bridge

The harness validates a provenance-bearing task manifest and the JSON report
emitted by an external coding benchmark, including AgentsKit OS:

```bash
AGENTSKIT_OS_ROOT=/path/to/agentskit-os \
AGENTSKIT_OS_BENCHMARK_REPORT=/path/to/report.json \
node scripts/verify-harness-agentskit-os-benchmark.mjs \
  --manifest benchmarks/agentskit-os-phase-28.json \
  --target "$AGENTSKIT_OS_ROOT" \
  --report "$AGENTSKIT_OS_BENCHMARK_REPORT"
```

The bridge checks the pinned source revision, task definition, prompt digests,
scope, and provider report shape. Provider status and heuristic scores remain
observations: they do not grant human acceptance. With no controlled baseline,
improvement is reported as unavailable rather than inferred.

Phase 29 adds a reproducible real-provider baseline runner for the AgentsKit OS
seed corpus. It uses disposable fixture copies, the existing OS benchmark
runner, and task-specific validation:

```bash
node scripts/run-agentskit-os-baseline.mjs \
  --target /path/to/agentskit-os \
  --provider codex \
  --output benchmarks/agentskit-os-phase-29-baseline
```

The observations are not an improvement claim until equivalent harness runs
exist.

To collect equivalent baseline samples, run the same corpus independently and
record the aggregate only after every task has been sampled:

```bash
node scripts/run-agentskit-os-baseline.mjs \
  --target /path/to/agentskit-os \
  --provider codex \
  --repeats 3 \
  --output benchmarks/agentskit-os-phase-35-baseline \
  --record-manifest benchmarks/agentskit-os-phase-28.json
```

Each repeat uses a fresh disposable fixture. The report stores the end-to-end
duration of fixture setup, provider execution, validation, and cleanup in
`durationSamplesMs`; the provider's own duration remains nested in the raw
report. The manifest is replaced atomically through
the typed observation recorder. `--record-manifest` requires the complete task
set; omit it to inspect an uncommitted collection. Replicas are not retries,
and a failed sample keeps the aggregate failed so the quality gate cannot turn
an incomplete baseline into an improvement claim.

## Contract

Every repository supplies `.codex/verification.json` with explicit scope, outcomes, applicable surfaces, and executable checks. Each check must declare `evidence: "structured"`; its final output line must be JSON and map to the outcome IDs it proves:

```json
{"status":"passed","criteria":["api-behavior"]}
```

Endpoint, database, CLI, MCP, and UI checks must declare `execution: "real"`. UI checks additionally require `real-browser` and `screenshot` capabilities. Screenshot artifacts carry a project-relative path, SHA-256 hash, and viewport.

## API

The public TypeScript API is exported from `src/index.ts` and includes configuration loading, lifecycle operations, state transitions, evidence verification, approvals, cancellation, retries, and task-owned cleanup. Internal modules are not part of the supported API.

## Extensibility

The kernel stays responsible for contracts, state transitions, evidence, source
binding, stale detection, and human decisions. Optional integrations use the
typed plugin registry instead of changing those guarantees:

```ts
import { createPluginRegistry, createPluginSlot } from '@agentskit/harness'

const providers = createPluginSlot<{ readonly resolve: (query: string) => Promise<string> }>('context.provider')
const registry = createPluginRegistry()
registry.register({
  id: 'my-context', version: '1.0.0', apiVersion: 1,
  apply: (context) => {
    context.register(providers, 'local', { resolve: async (query) => `context:${query}` })
  },
})
registry.mount()
// registry.contributions(providers) is deterministic and typed.
registry.dispose()
```

Each run also writes an append-only `events.ndjson` containing lifecycle facts
bound to its source revision and contract hash. New event logs carry a chained
SHA-256 digest; verify one with `ak-harness events verify [run-id]`. Logs from
older harness versions remain readable but are reported as `legacy`, not as
verified. After verification, `run.json` also carries a `verificationDigest`
that must match the `verification.completed` event before human approval. Human
approvals, rejections, and tracking authorizations are then recorded as
hash-chained `approval.recorded` or `authorization.recorded` events bound to
that digest, source revision, and contract hash. The stable `run.json` remains
the CLI projection and evidence index.

Use `ak-harness audit [run-id]` to reconcile a run projection with its verified
events. `ak-harness status` performs the same reconciliation before reporting
the current state, so a post-approval edit cannot appear as `COMPLETE`.
Concurrent event writers are serialized by an atomic per-run lock and fail
closed if the log is busy.

Export a reconciled `COMPLETE` run for external review with an Ed25519 key:

```bash
ak-harness events export <run-id> --output evidence.json --private-key private.pem --key-id release-v1
ak-harness events verify-bundle evidence.json --trusted-key-store trust-store.json
```

The bundle includes the run projection, event log, and referenced check outputs,
each with a SHA-256 digest. A trust store can mark keys `active` or `revoked` to
support controlled key rotation. Treat exported outputs as potentially sensitive.

The signed bundle is self-contained: it can be copied to an isolated directory
and verified there with only the bundle and the trusted public key.

Profiles are optional declarative overlays in `.codex/verification.json`. They
inherit in order, override existing checks by ID, and are resolved before the
contract is frozen:

```json
{
  "profile": "ci",
  "profiles": {
    "ci": {
      "checkOverrides": [{ "id": "unit", "timeoutMs": 120000 }],
      "budget": { "maxDurationMs": 900000 }
    }
  }
}
```

Doc Bridge and Playbook integrations can implement `ContextProvider` and
register it through `CONTEXT_PROVIDER_SLOT`; the kernel records neither their
credentials nor their transport and does not depend on either package. The
portable adapter reads a local Doc Bridge index without adding a dependency:

```ts
import { createDocBridgeContextProvider, planRun } from '@agentskit/harness'

const provider = createDocBridgeContextProvider({ root: process.cwd() })
const context = await provider.resolve({ query: 'harness', scope: ['playbook'] })
const run = await planRun({
  configPath: '.codex/verification.json',
  decision: 'approved',
  contextSnapshots: [context],
})
```

The same boundary is available to shell-based agents:

```bash
ak-harness context resolve harness --scope playbook --json > context.json
ak-harness plan approved --context-file context.json --json
```

`context.json` may contain one snapshot or an array of snapshots, so providers
outside this package can participate without a runtime plugin loader.
The loader rejects a snapshot when its semantic contents no longer match its
`snapshotHash`.

The snapshot stores the Doc Bridge `contentHash`, reference hashes, and a
stable `contextHash`; resolution time is metadata and does not change the
reproducibility hash. Context is resolved before planning and is frozen with
the run, so later index changes cannot silently change its evidence.

Agent sessions can record adapter identity, turns, and guarded tool actions
during `IMPLEMENTING` without persisting prompt, argument, or result contents:

```ts
import { createSessionRecorder } from '@agentskit/harness'

const session = createSessionRecorder({
  stateDir: '.codex/verification',
  run: implementingRun,
  adapter: { id: 'my-agent', version: '1.0.0', capabilities: ['tool-calls'] },
  policy,
  runtime,
})
const turn = session.startTurn(inputHash)
const action = session.requestTool({ turnId: turn.payload.turnId, toolId: 'shell', argumentsHash })
await session.executeTool({ actionId: action.payload.actionId, arguments: { command: 'echo ok' } })
session.end('completed')

// After a process interruption, recover the same session from events.ndjson.
const resumed = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: session.sessionId, resume: true })
```

The recorder enforces turn-before-tool, one terminal result per action, no
pending actions or unresolved approvals at session end, and no calls after
termination. With `resume: true`, it reconstructs turns, pending actions, and
approval decisions from the hash-chained event log; completed actions are not
replayed. It is an observation seam; tool execution and policy decisions remain
separate kernel phases.

Every session also requires a policy gate. The built-in gate is an ordered
allow/block/approve list with deny-by-default behavior:

```ts
import { createPolicyGate, createSessionRecorder } from '@agentskit/harness'

const policy = createPolicyGate({
  rules: [{ id: 'safe-shell', effect: 'allow', toolIds: ['shell'], reason: 'approved local tool' }],
})
const session = createSessionRecorder({ stateDir, run, adapter, policy })
```

The first matching rule wins. A blocked attempt writes `policy.evaluated` and
`tool.blocked` events and raises `POLICY_BLOCKED`; it never becomes a pending
tool action. An `approve` decision writes `tool.approval.requested` and keeps
the action out of the runtime until `session.approveTool({ actionId,
decision: 'approved' })` is called by a human. Rejection writes an auditable
`tool.approval.recorded` and `tool.blocked` pair. Custom policy gates can
implement the same typed `PolicyGate` interface without coupling the harness
to a runtime or provider.

When resuming, an action with a persisted `tool.execution.started` event is
ambiguous: its runtime may have produced an external side effect before the
process stopped. The harness refuses to execute it until a human calls
`session.recoverTool({ actionId, decision: 'retry', actor: 'human' })` or
`session.recoverTool({ actionId, decision: 'abandon', actor: 'human' })`.
Actions that were requested but never started remain safe to execute after
recovery. Completed actions are never replayed.

The built-in runtime executes registered handlers in memory, passes an
`AbortSignal`, enforces a timeout, and records only a result hash and duration:

```ts
import { createToolRuntime } from '@agentskit/harness'

const runtime = createToolRuntime({
  timeoutMs: 30_000,
  tools: [{ toolId: 'shell', execute: async ({ arguments: input }) => runShell(input) }],
})
```

Missing tools, handler errors, and timeouts become structured failures. This is
an execution boundary, not a process/container security sandbox; use a
provider-specific isolated runtime when hard isolation is required.

For a shell-free child-process boundary, register fixed commands with
`createProcessToolRuntime`. It sends one JSON request over stdin, kills a
timed-out or oversized process, and hashes stdout without storing it:

```ts
import { createProcessToolRuntime } from '@agentskit/harness'

const runtime = createProcessToolRuntime({
  timeoutMs: 30_000,
  maxOutputBytes: 1_048_576,
  tools: [{ toolId: 'worker', command: process.execPath, args: ['worker.mjs'] }],
})
```

This is a process boundary with bounded I/O, not a container or operating
system security boundary. Use an isolated provider runtime for untrusted code.

For an optional Docker boundary, register fixed image commands with
`createDockerToolRuntime`. The default is fail-closed for image supply: it
uses cached images only, disables network access, makes the container root
filesystem read-only, drops capabilities, runs without privilege escalation,
and applies resource limits:

```ts
import { createDockerToolRuntime } from '@agentskit/harness'

const runtime = createDockerToolRuntime({
  tools: [{
    toolId: 'worker',
    image: 'node:22.13.0-bookworm-slim',
    command: ['node', 'worker.mjs'],
    mounts: [{ source: process.cwd(), target: '/workspace', readOnly: true }],
    cwd: '/workspace',
  }],
  memoryLimit: '512m',
  cpus: 1,
  pidsLimit: 128,
})
```

The provider does not add Docker as a package dependency and is not a VM or a
compromised-daemon boundary. Pin images for reproducibility; set `pull` to
`missing` or `always` only when image acquisition is explicitly authorized.
Completed and failed tool events carry the resolved image digest and an
effective profile hash, so reviewers can identify the runtime used for each
action without storing raw output.

`benchmark` aggregates the local run history into a versioned JSON report. It
includes check/outcome/evidence pass rates, retries, stale runs, human approvals,
and average/median verification duration. It also reports `effective*` metrics
over the latest non-superseded run in each retry lineage, so attempt history is
not confused with the current delivery state. With `--manifest`, it also compares
bound harness tasks with explicitly recorded baseline observations. A baseline
must include evidence for every acceptance criterion; missing, duplicate, or
unknown criterion evidence is rejected. Missing baselines and incomplete
evidence remain non-comparable; the harness never invents a baseline. These are
execution metrics, not a claim of productivity improvement; compare reports over
a controlled task corpus to measure that outcome.

Attach a task to a benchmark suite in the verification contract:

```json
{
  "benchmark": {
    "suiteId": "agentskit-harness-phase-9",
    "taskId": "harness-benchmark-evidence",
    "mode": "harness"
  }
}
```

The manifest format is available at `benchmarks/harness-phase-9.json`. Record a
controlled baseline through the public CLI instead of editing JSON by hand:

```bash
ak-harness benchmark baseline harness-benchmark-evidence \
  --manifest benchmarks/harness-phase-9.json \
  --status passed \
  --source manual-run-2026-08-29 \
  --evidence-file benchmarks/harness-phase-9-evidence.example.json \
  --attempts 1 --duration-ms 900000 \
  --review-minutes 20 --escaped-incomplete 0
```

The command validates the task and values, rejects duplicate observations, and
atomically updates the manifest. Baseline observations are explicit records
with a source, timestamp, and criterion-level evidence. An empty or `not-run` baseline is reported as
non-comparable rather than treated as success.

When evidence is supplied through `--evidence-file`, the manifest also stores
the file's lowercase SHA-256 digest as `evidenceDigest`. This binds the
recorded JSON input to the observation; it does not independently validate a
manual, remote, or external source named by an evidence entry.

A comparison is considered comparable only when the task has an explicit
baseline with complete criterion-level evidence and its latest bound harness
run is `COMPLETE`. Blocked, incomplete, missing, or `not-run` inputs expose a
non-comparability reason and mark directional outcomes as `unavailable`.
Comparable reports include check, outcome, evidence, duration, attempt, and
human-review metrics plus directional outcomes. Completed runs with every
check, outcome, and evidence slot passing are projected as
`escapedIncomplete: 0`; a controlled baseline can record observed escapes and
the report exposes their delta and direction. A positive improvement rate
means the harness used less of that measured resource; these metrics do not
establish causality or productivity improvement alone.

For paired real-provider measurements, `scripts/run-agentskit-os-harness-benchmark.mjs`
prepares one frozen contract per manifest task, binds each run to the suite and
task ID, and leaves the lifecycle at the human approval gate. Use
`--repeats 3` for three independent samples per task; each sample has its own
state directory and must be approved separately. Run `--collect` after
approvals to aggregate the isolated task state directories. Pending or blocked
task runs remain non-comparable; only `COMPLETE` runs produce directional
improvement values. Duration comparisons use the median of completed samples,
while retry metrics count only superseded retry lineages, so experimental
replication is not misreported as agent retry cost.

The AgentsKit OS benchmark runner can expose the built `ak-verify` CLI inside
its disposable fixture. The fixture contract is prepared by CI, the provider
inherits a fixture-local PATH entry, and human approval is never synthesized.
This makes provider-side verification available without making the fixture a
security boundary; the outer harness remains the authoritative evidence gate.

Benchmark reports also expose a fail-closed `qualityGate`. It separates
historical retries from effective delivery, reports duration regressions, and
labels small samples as `insufficient-data` or `directional` instead of
claiming enterprise-level improvement. Configure
`minBaselineSamplesPerTask` alongside `minCompletedRunsPerTask`: a single
baseline observation is not comparable to replicated harness runs. Baseline
observations may store `durationSamplesMs`; the report compares medians.

## Development

```bash
pnpm install
pnpm --filter @agentskit/harness typecheck
pnpm --filter @agentskit/harness test
pnpm --filter @agentskit/harness build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for changes, tests, and release expectations. See [CHANGELOG.md](./CHANGELOG.md) for version history.

The Playbook CI dogfoods the package with `harness:test`, `harness:cli`, and a
clean packed-consumer probe before the broader repository checks run.
It also uploads the resulting `.codex/verification/harness-phase-24` run
directory so a human can inspect the exact evidence before approval.

## License

MIT. See [LICENSE](./LICENSE).
