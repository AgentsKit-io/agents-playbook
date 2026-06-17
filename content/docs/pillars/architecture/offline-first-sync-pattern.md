---
type: Playbook Pattern
title: 'Offline-First + Sync Pattern'
description: 'How to design apps that work without network connectivity and reconcile state when connectivity returns.'
---

# Offline-First + Sync Pattern

How to design apps that work without network connectivity and reconcile state when connectivity returns.

## TL;DR (human)

Offline-first means the local copy is the truth; sync to remote when possible. Designed right: instant interactions, work-anywhere, automatic reconciliation. Designed wrong: lost data, conflicting state, user confusion. Three problems to solve: local persistence, sync protocol, conflict resolution. CRDTs simplify the last; explicit policy works otherwise.

## For agents

### Three concerns

| Concern | Question | Tools |
|---|---|---|
| **Local persistence** | Where does data live offline? | IndexedDB (web), SQLite (mobile), file system (desktop) |
| **Sync protocol** | How do client + server reconcile? | Custom REST + diff, GraphQL subscriptions, CouchDB-style replication |
| **Conflict resolution** | When local and remote disagree, who wins? | CRDT auto-merge, last-writer-wins, manual resolution UX |

### Local persistence

**Web**: IndexedDB (browser-native; large quotas; structured) > localStorage (small; sync). Wrappers: Dexie, idb, RxDB.

**Mobile**: SQLite (cross-platform; mature; queryable) > AsyncStorage (key-value only). Wrappers: WatermelonDB, Realm.

**Desktop**: SQLite or file-based; per-platform OS-native options.

The local store mirrors the server's data shape. Reads are local; writes are local-first (then sync).

### Sync protocol

Sync protocol is the contract between client + server. Three styles:

**Full replication**: client downloads everything for its scope. Re-sync == replace. Works for small datasets per user.

**Incremental sync**:

- Client tracks last-sync timestamp / version.
- Server returns changes since.
- Client applies; updates last-sync.

Requires server-side change log (per [`event-streaming-pattern.md`](/docs/pillars/architecture/event-streaming-pattern)) or efficient timestamp queries.

**Operational transform / CRDT replication**: each side captures operations or CRDT updates; merge convergent regardless of order.

### Operation log on client

Local writes captured as operations (not just state mutations):

```ts
type LocalOp = {
  id: string;
  type: "create" | "update" | "delete";
  entity: string;
  payload: unknown;
  clientTimestamp: number;
  status: "pending" | "synced" | "failed";
};
```

Operations sit in a local queue. When online: replay in order to server; mark synced. Server returns canonical-state diffs.

### Conflict resolution strategies

| Strategy | When |
|---|---|
| **Last-writer-wins (LWW)** | Strict total order via timestamps; data class allows loss | Reasonable default for collaborative-but-not-critical |
| **First-writer-wins** | "Once set, immutable" semantics |
| **CRDT** | Math guarantees convergence regardless of order | Counters, sets, sequences, text (Yjs, Automerge) |
| **Manual** | UI shows conflict; user picks | High-stakes data; rare |
| **Custom semantic** | Domain-specific merge | When math doesn't help |

CRDT is the cleanest if your data shape fits (counters, text editors, lists, sets). Outside those shapes: LWW + careful UX.

### Clock discipline

Conflict resolution often uses timestamps. Clock skew breaks it:

- Use server time when sync happens (server stamps).
- Hybrid Logical Clocks (HLC) for distributed correctness without strict NTP.
- Lamport / vector clocks for strict ordering.

Don't use client wall-clock alone — devices drift, users adjust manually.

### Sync state machine per record

```
local-only → syncing → synced
local-only → syncing → failed → retry
synced → modified-locally → syncing → ...
```

Each record's status determines UI behaviour:

- `local-only`: badge "Saving locally".
- `syncing`: subtle activity indicator.
- `synced`: clean.
- `failed`: error state with retry.

### Offline UX

Tell the user:

- **Network status**: visible (header banner when offline).
- **Sync progress**: subtle (post-success), explicit (when active sync is non-trivial).
- **Per-record state**: badges or icons for in-progress / failed.
- **Conflicts** (rare): explicit UX to resolve.

Never silently lose data. If a sync fails permanently, surface it.

### Authentication offline

Tricky:

- Tokens issued before going offline still work locally.
- Refresh fails offline; access token may expire mid-offline session.
- Permission changes on server don't reach client until online.

Pattern: cached permissions; long-lived offline access token; re-auth when online if expired during offline window. Step-up operations (per [`../security/session-mgmt-pattern.md`](/docs/pillars/security/session-mgmt-pattern)) require online.

### Service workers (web)

For PWAs:

- Service worker intercepts requests.
- Cache strategies: cache-first (static assets), network-first (API), stale-while-revalidate.
- Background sync API: queue writes; replay when online.

Service workers add complexity; only adopt when offline is a core product requirement.

### Sync at scale

For each tenant in multi-tenant systems:

- Sync state per (user, device).
- Sync windows: tenants don't see other tenants' streams.
- Large dataset users may need progressive sync (paginated by time / entity).

### Local search

Local data enables local search:

- IndexedDB indexes for fast lookup.
- SQLite FTS5 for full-text search.
- Bloom filters for membership tests in larger datasets.

Search latency dominates UX; local search makes the app feel instant.

### When NOT offline-first

- Single-session web tools.
- Sensitive data that shouldn't sit on client devices.
- Truly real-time-only (live video).
- Trivial CRUD where online assumption is acceptable.

Offline-first is a significant architecture commitment. Adopt when network unreliability is part of the product reality.

### Common failure modes

- **Local data + no sync UI**: user wonders if their work persisted. → Per-record status.
- **LWW without HLC**: clock skew = wrong winner. → HLC or server stamps.
- **No conflict UX for high-stakes data**: silent loss. → Manual resolution; never silently overwrite.
- **No retry policy**: failed sync stays failed. → Exponential backoff; resume on connectivity.
- **Token expiry during offline**: user logged out unexpectedly. → Long offline window; clear re-auth on return.
- **All data synced for every user**: storage explodes; sync slow. → Scope (tenant; recent; visible).
- **No "i lost this" recovery path**: data gone if device wiped. → Server is canonical; local is cache; loss recoverable from server if synced.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Local DB (web) | IndexedDB direct, Dexie, idb, RxDB |
| Local DB (mobile) | SQLite, WatermelonDB, Realm |
| Sync framework | PouchDB / CouchDB, Replicache, Electric SQL, PowerSync |
| CRDT | Yjs (Y.js), Automerge, Loro |
| Operation queue | Custom; or sync framework's built-in |
| Service worker | Workbox |

### Adoption path

1. **Day 0**: no offline support. Online-required. Document.
2. **If offline needed**: pick scope (read-only offline first; then writes; then full offline).
3. **Choose strategy**: LWW for simple; CRDT for collaborative; manual UX for high-stakes.
4. **Per-record sync state in UI**.
5. **Test**: throttled / disconnected / re-connect cycles + multi-device.
6. **Drill**: conflict scenarios; data loss recovery.

### See also

- [`distributed-data-pattern.md`](/docs/pillars/architecture/distributed-data-pattern) — eventual consistency.
- [`event-streaming-pattern.md`](/docs/pillars/architecture/event-streaming-pattern) — operation log + replay.
- [`../security/session-mgmt-pattern.md`](/docs/pillars/security/session-mgmt-pattern) — offline auth concerns.
- [`../ui-ux/empty-states-pattern.md`](/docs/pillars/ui-ux/empty-states-pattern) — offline as an empty/error state.
- [`anti-overengineering.md`](/docs/pillars/architecture/anti-overengineering) — adopt offline-first only with real need.
