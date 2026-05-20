# Contracts — Zod Method Registry Pattern

TS-concrete recipe for a typed JSON-RPC / HTTP / IPC boundary. Scales to several hundred methods across dozens of namespaces in a real production codebase.

## TL;DR (human)

Every method that crosses a trust boundary has:

- a name (namespaced, dot-separated),
- a Zod schema for its params,
- a Zod schema for its result,
- explicit flags for `requireAuth` and `requireConsent`,
- a registered entry in one method registry.

A dispatcher iterates the registry. Inbound payloads are parsed; failures become typed errors; outbound results are also parsed (catches handler bugs at the boundary, not in the wire).

## For agents

### Method definition

```ts
// packages/contracts/src/methods/users.ts
import { z } from "zod";
import { defineMethod } from "../define-method";

export const UsersListParams = z.object({
  workspaceId: z.string().uuid(),
  limit: z.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});

export const UsersListResult = z.object({
  rows: z.array(z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["owner", "admin", "member"]),
  })),
  nextCursor: z.string().nullable(),
});

export const usersList = defineMethod({
  method: "users.list",
  params: UsersListParams,
  result: UsersListResult,
  requireAuth: true,
  requireConsent: false,
});
```

### Registry

```ts
// packages/contracts/src/registry.ts
import { usersList } from "./methods/users";
import { usersUpsert } from "./methods/users";
// ... import all method definitions

export const REGISTRY = {
  [usersList.method]: usersList,
  [usersUpsert.method]: usersUpsert,
  // ...
} as const;

export type MethodName = keyof typeof REGISTRY;
```

### Dispatcher

```ts
// packages/contracts/src/dispatcher.ts
import { ZodError } from "zod";
import { AppError } from "@app/core/errors";
import { REGISTRY } from "./registry";

export type Handler<P, R> = (params: P, ctx: CallContext) => Promise<R>;

export async function dispatch(
  method: string,
  rawParams: unknown,
  ctx: CallContext,
  handlers: Record<string, Handler<unknown, unknown>>,
) {
  const entry = REGISTRY[method as keyof typeof REGISTRY];
  if (!entry) throw new AppError("METHOD_NOT_FOUND", `Unknown method: ${method}`);

  if (entry.requireAuth && !ctx.principalId) {
    throw new AppError("AUTH_REQUIRED", "Authentication required");
  }
  if (entry.requireConsent && !ctx.consents.has(method)) {
    throw new AppError("CONSENT_REQUIRED", "User consent required", {
      hint: `Call consent.grant({ scope: "${method}" })`,
    });
  }

  let params;
  try {
    params = entry.params.parse(rawParams);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new AppError("VALIDATION_ERROR", "Invalid params", { cause: err });
    }
    throw err;
  }

  const handler = handlers[method];
  if (!handler) throw new AppError("HANDLER_NOT_BOUND", `No handler for ${method}`);

  let result;
  try {
    result = await handler(params, ctx);
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Unknown errors become opaque — never leak handler internals.
    throw new AppError("HANDLER_THREW", "Handler failed", { cause: err });
  }

  // Verify the handler returned a result that matches the contract.
  return entry.result.parse(result);
}
```

### Wire serialization

Errors over the wire:

```ts
{
  jsonrpc: "2.0",
  id,
  error: {
    code: -32000, // or a stable numeric mapping
    message: appError.message,
    data: {
      code: appError.code,         // "VALIDATION_ERROR", "AUTH_REQUIRED", ...
      hint: appError.opts.hint,
      docsUrl: appError.opts.docsUrl,
      requestId: ctx.requestId,    // ALWAYS log + return the requestId
    },
  },
}
```

Never include the `cause` chain in the wire payload — it can leak stack traces, file paths, secrets. Log the cause server-side with the `requestId` so support can correlate.

### Namespace conventions

- All-lowercase, dot-separated. `users.list`, `flows.upsert`, `cost.budgets.list`.
- The leading segment is the **owning surface** (a feature concept). The package that owns the namespace owns the handler.
- A namespace is owned by one package. If two packages want to handle `users.*`, the boundary is wrong.

### Stable contract changes (without breaking)

Add fields with defaults — non-breaking:

```ts
export const UsersListParams = z.object({
  workspaceId: z.string().uuid(),
  limit: z.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
  includeDisabled: z.boolean().default(false), // new field, default makes it non-breaking
});
```

Rename / remove fields — breaking → requires an RFC (see [`rfc-pattern.md`](./rfc-pattern.md)).

Method-level renames — also breaking → RFC. Keep the old name registered as a deprecated alias for one major version.

### Gate

Recommended automated checks:

1. **Registry completeness** — every file under `methods/` exports at least one `defineMethod` call, every export is in the registry.
2. **No duplicate method names** — fail at build.
3. **Schema-change detector** — diff the compiled `.d.ts` of the contract package vs the previous release; flag any method whose params/result signature changed without an RFC reference.
4. **Handler binding completeness** — every method in the registry has a handler bound in the runtime.

Reference impls in [`../../scripts/`](../../scripts/).

### Common failure modes (sourced from production)

- **Handler returns the right shape minus one field.** Without `entry.result.parse(result)`, the client sees `undefined` and fails downstream. → Parse outbound; pay the small CPU cost.
- **Agent invents `users.fetchAll` because they did not search for `users.list`.** Two methods now exist; consumers split. → Maintain a namespace map (one file per namespace) and require all methods for that namespace live in that file.
- **`requireAuth: false` slipped onto a sensitive method.** Silent vulnerability. → Default `requireAuth` to `true` in `defineMethod`; require an explicit `false` opt-out and review it in PR intent.
- **Stack traces in `error.data`.** Leaks file paths and sometimes secrets. → Log the cause; never return it.

### See also

- [`error-hierarchy.md`](./error-hierarchy.md) — error model the dispatcher uses.
- [`../security/README.md`](../security/README.md) — auth + consent semantics behind the flags.
- [`../quality/README.md`](../quality/README.md) — gates that enforce the registry shape.
