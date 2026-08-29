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
ak-verify approve approved <run-id> --by human --json
```

`plan` rejects unresolved ambiguities and unauthorized dirty worktrees. After `start`, the contract is frozen. Any source, configuration, or contract change invalidates evidence and moves the run to `STALE`.

## Contract

Every repository supplies `.codex/verification.json` with explicit scope, outcomes, applicable surfaces, and executable checks. Each check must declare `evidence: "structured"`; its final output line must be JSON and map to the outcome IDs it proves:

```json
{"status":"passed","criteria":["api-behavior"]}
```

Endpoint, database, CLI, MCP, and UI checks must declare `execution: "real"`. UI checks additionally require `real-browser` and `screenshot` capabilities. Screenshot artifacts carry a project-relative path, SHA-256 hash, and viewport.

## API

The public TypeScript API is exported from `src/index.ts` and includes configuration loading, lifecycle operations, state transitions, evidence verification, approvals, retries, and task-owned cleanup. Internal modules are not part of the supported API.

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
