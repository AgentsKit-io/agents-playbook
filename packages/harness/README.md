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
```

`plan` rejects unresolved ambiguities and unauthorized dirty worktrees. After `start`, the contract is frozen. Any source, configuration, or contract change invalidates evidence and moves the run to `STALE`. A human can cancel an active run; retrying a blocked, stale, or cancelled run marks the previous run `SUPERSEDED`.

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
bound to its source revision and contract hash. The stable `run.json` remains
the CLI projection and evidence index.

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

The snapshot stores the Doc Bridge `contentHash`, reference hashes, and a
stable `contextHash`; resolution time is metadata and does not change the
reproducibility hash. Context is resolved before planning and is frozen with
the run, so later index changes cannot silently change its evidence.

## Development

```bash
pnpm install
pnpm --filter @agentskit/harness typecheck
pnpm --filter @agentskit/harness test
pnpm --filter @agentskit/harness build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for changes, tests, and release expectations. See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT. See [LICENSE](./LICENSE).
