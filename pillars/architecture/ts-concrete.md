# Architecture — TS / Node ≥22 / pnpm Monorepo (Concrete)

Copy-paste-ready recipes that implement [`universal.md`](./universal.md) on a TypeScript stack. Calibrated on AgentsKitOS (33 packages, 5 apps, ~1 year of agent-driven dev).

## TL;DR (human)

- pnpm workspaces + Turbo for the monorepo wiring.
- One `os-core` package that owns Zod schemas, the error class hierarchy, and the event bus. Hard 25 KB gzipped budget.
- Strict TypeScript everywhere: `"strict": true`, `noUncheckedIndexedAccess: true`, no `any`, named exports only.
- Zod parses every HTTP / JSON-RPC / IPC / file-IO boundary.
- `AppError` subclasses with `<NS>_<REASON>` codes; thrown only via `throw new AppError(...)`-style classes; raw `new Error` is lint-banned at boundary files.
- Sub-path package layout (RFC-driven) so each package can ship multiple entry points without circular imports.

## For agents

### Topology

```
repo/
├─ packages/
│  ├─ core/               # Zod schemas, errors, event bus. <25 KB gz. No internal deps.
│  ├─ contracts/          # JSON-RPC method registry + dispatcher. Depends on: core.
│  ├─ log/                # createLogger(tag), transports. Depends on: core.
│  ├─ storage/            # Persistence stores. Depends on: core, log.
│  ├─ runtime/            # Execution layer. Depends on: core, contracts, storage, log.
│  ├─ ui/                 # Shared UI primitives. Depends on: core (types only).
│  └─ <feature-pkg>/      # One per cohesive feature surface.
├─ apps/
│  ├─ desktop/            # End-user app. Consumes packages.
│  ├─ web/                # Marketing + docs.
│  └─ cloud/              # Control plane.
├─ docs/
│  ├─ adr/                # Decisions (accepted = source of truth).
│  ├─ rfc/                # In-flight.
│  └─ for-agents/         # RAG-indexed per-package + per-screen + per-flow refs.
├─ AGENTS.md              # Top-level routing table (which package owns what).
├─ CLAUDE.md              # Non-negotiables mirror for AI agents.
└─ pnpm-workspace.yaml
```

### Workspace files

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`turbo.json` (Turborepo): cache `build`, `test`, `lint`, `typecheck`. Make `check:all` depend on each.

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "esModuleInterop": false
  }
}
```

Per-package `tsconfig.json` extends this and adds `references` for incremental builds.

### `package.json` rules

- `"type": "module"` everywhere.
- `"exports"` map with explicit sub-paths. No barrel-only packages.
- `"sideEffects": false` unless you actually rely on import side effects.
- `peerDependencies` for cross-cutting concerns (e.g. `zod`, `react`) so consumers pin one copy.

Example:

```json
{
  "name": "@app/core",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./errors": "./dist/errors/index.js",
    "./schemas": "./dist/schemas/index.js",
    "./events": "./dist/events/index.js"
  },
  "sideEffects": false,
  "peerDependencies": { "zod": "^3" }
}
```

### Sub-path layout (post-monolith-barrel)

When a package grows past ~5 cohesive concerns, split its public surface into sub-paths:

```
packages/core/
├─ src/
│  ├─ errors/      # Error classes + code constants. Exported via "./errors".
│  ├─ schemas/     # Zod schemas. Exported via "./schemas".
│  ├─ events/      # Event bus types. Exported via "./events".
│  └─ index.ts     # Re-exports the public surface from each subdir.
└─ package.json    # exports map per subdir.
```

Why: consumers import only what they need; tree-shaking works even without `sideEffects:false`; agents can reason about a sub-path without loading the whole package.

### Named exports only

`.eslintrc.cjs`:

```js
module.exports = {
  rules: {
    "import/no-default-export": "error",
  },
  overrides: [
    {
      // Next.js App Router + config files require default exports.
      files: [
        "apps/web/app/**/{page,layout,loading,error,not-found,template}.tsx",
        "apps/web/app/**/route.ts",
        "**/{tailwind,next,vitest,vite,playwright}.config.*",
      ],
      rules: { "import/no-default-export": "off" },
    },
  ],
};
```

### No `any` enforcement

`.eslintrc.cjs` (additive):

```js
"@typescript-eslint/no-explicit-any": "error",
"@typescript-eslint/no-unsafe-assignment": "error",
"@typescript-eslint/no-unsafe-call": "error",
"@typescript-eslint/no-unsafe-member-access": "error",
"@typescript-eslint/no-unsafe-return": "error",
```

Escape hatch: `// allow-any: <reason>` line comment. Lint allows it; a separate gate counts these and fails if the count grows. See [`../../scripts/`](../../scripts/).

### Zod at every boundary

```ts
// packages/contracts/src/methods/example.ts
import { z } from "zod";

export const ExampleParams = z.object({
  id: z.string().min(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const ExampleResult = z.object({
  rows: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const exampleMethod = {
  method: "example.list",
  params: ExampleParams,
  result: ExampleResult,
  requireAuth: true,
} as const;
```

Handler:

```ts
import { AppError } from "@app/core/errors";
import { ExampleParams, ExampleResult } from "@app/contracts/methods/example";

export async function exampleHandler(rawParams: unknown) {
  const params = ExampleParams.parse(rawParams); // throws ZodError on bad input
  // ... business logic
  return ExampleResult.parse(result); // confirms our output matches the contract
}
```

Dispatcher converts `ZodError` to `AppError({ code: "VALIDATION_ERROR", ... })`.

### Errors

```ts
// packages/core/src/errors/app-error.ts
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly opts: {
      readonly hint?: string;
      readonly docsUrl?: string;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "AppError";
  }
}

// Subclasses by namespace:
export class AuthError extends AppError {}
export class ValidationError extends AppError {}
export class NotFoundError extends AppError {}
// ... etc.
```

Codes live in one file:

```ts
// packages/core/src/errors/codes.ts
export const ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  HANDLER_THREW: "HANDLER_THREW",
  // ...
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

Lint rule (custom or `no-restricted-syntax`) bans `throw new Error(` in `**/methods/**` and `**/handlers/**` directories. Escape hatch: typed subclass.

### Logger

```ts
// packages/log/src/index.ts
export function createLogger(tag: string) {
  return {
    info: (msg: string, fields?: Record<string, unknown>) => write("info", tag, msg, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => write("warn", tag, msg, fields),
    error: (msg: string, fields?: Record<string, unknown>) => write("error", tag, msg, fields),
    debug: (msg: string, fields?: Record<string, unknown>) => write("debug", tag, msg, fields),
  };
}
```

Lint bans `console.log` / `console.warn` / `console.error` repo-wide except in `scripts/` (build-time tooling) and tests.

### Size budgets (gate)

Reference impl in [`../../scripts/check-file-size.example.mjs`](../../scripts/check-file-size.example.mjs).

Mode: **shrink-only baseline**. A JSON baseline lists every file currently over budget. New files must be under budget; baselined files must not grow.

### Hard size gate on `core`

```bash
pnpm --filter @app/core build
gzip -c packages/core/dist/index.js | wc -c
# fail if > 25600
```

Wire into `check:all`.

## Checklist when standing up a new package

1. Add to `pnpm-workspace.yaml`.
2. `package.json` with `type: module`, `exports` map, `sideEffects: false`.
3. `tsconfig.json` extends base, adds `references` to deps.
4. `src/index.ts` re-exports the public surface only.
5. `src/__tests__/` next to source, not in a top-level `test/` dir.
6. Add the package to the `AGENTS.md` routing table.
7. Add a one-pager doc in `docs/for-agents/packages/<pkg-name>.md` (template in [`../../templates/`](../../templates/)).
8. If the package owns persistence, register its schema with the storage layer + the contract registry.

## See also

- [`contracts-zod-pattern.md`](./contracts-zod-pattern.md) — JSON-RPC + Zod registry deep dive.
- [`error-hierarchy.md`](./error-hierarchy.md) — full error model + serializer.
- [`file-size-budget.md`](./file-size-budget.md) — baseline gate calibration.
- [`../quality/README.md`](../quality/README.md) — wiring the gates into CI.
