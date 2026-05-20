# Dependency Hygiene Pattern

How to keep your dependency tree healthy across thousands of transitive packages without it becoming a full-time job.

## TL;DR (human)

Every dependency is an attack surface, a maintenance burden, and a future incompatibility. The discipline: small set, well-chosen, locked, automated-bumps for patches, manual review for majors, and continuous CVE triage. Saying no to a dep is the highest-leverage refactor you can do.

## For agents

### Adding a dependency — the checklist

Before adding any new dep, answer:

1. **Necessity** — can the functionality be reasonably inlined? A 2-line problem solved by a 200KB package is overhead.
2. **Maturity** — > 1 year of releases; recent commits; multiple contributors.
3. **Maintenance health** — active issue triage; reasonable PR turnaround; not a single-maintainer critical path.
4. **Trust signal** — well-known author / org; or a thorough read of the source.
5. **License** — compatible with project license (MIT, Apache 2.0, BSD are usually fine; GPL/LGPL/AGPL need legal review for commercial).
6. **Size** — measure the bundled cost (`bundlephobia` for JS, `cargo bloat` for Rust). Trees of small deps add up.
7. **Type coverage** — TypeScript definitions present and accurate; otherwise you're back to `any`.
8. **Substitutability** — could you swap to another lib in < 1 day? If not, the boundary is wrong.
9. **Existing alternative in tree** — search `package.json`s + lock for a dep that already covers it. Adding a 4th HTTP client is a code smell.

If any answer is no without compensating justification: don't add. Push the choice into the PR conversation; reviewers see it.

### Dependency categories

| Category | Examples | Trust posture |
|---|---|---|
| **Stdlib-like** | `lodash`, `date-fns`, `zod`, `react` | Stable; pinned; minor bumps freely |
| **Framework-core** | `next`, `vite`, `pnpm`, `turbo` | Stable; majors require coordinated migration |
| **Tooling** | linters, formatters, test runners | Dev-only; bumps less critical |
| **Build-time only** | codemods, generators | Disappear from final artefact |
| **Niche utility** | one-off helper used in one file | High scrutiny; usually inline instead |
| **Plugin / integration** | OAuth provider clients, payment SDKs | Vetted; signed; pinned |
| **Hot-path** | crypto, parsing, serialisation | Critical security review |

Each category has a different review and update cadence.

### Lock files

Always commit:

- `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock`
- `Cargo.lock`
- `Gemfile.lock`
- `poetry.lock` / `uv.lock`
- `go.sum`

CI runs `--frozen-lockfile` (or equivalent). Mismatch fails the build.

Why: deterministic builds; same tree everywhere; CVE scans correlate with truth.

### Pin precision

Three tiers:

| Style | Example | Use case |
|---|---|---|
| **Exact** | `"react": "18.3.1"` | Critical / hot-path |
| **Patch** | `"react": "~18.3.1"` | Default for production deps; accepts patches |
| **Minor** | `"react": "^18.3.1"` | Tooling; dev deps |

Lock file still pins exactly. The range in `package.json` is what the resolver allows during installs.

For libraries you ship to others: prefer permissive ranges in `peerDependencies`. For applications: prefer tight ranges; the lock file is the contract.

### Automated bump cadence

Configure Renovate / Dependabot per the matrix:

| Category | Cadence | Auto-merge if tests pass? |
|---|---|---|
| Patch on stdlib-like | Daily | Yes |
| Patch on framework-core | Daily | Yes |
| Minor on stdlib-like | Weekly | Yes (after staging soak) |
| Minor on framework-core | Weekly | No — review |
| Major (any) | On-demand | No — RFC-level review |
| Security patch (any) | Hourly | Yes (per severity SLA) |

Auto-merge requires: all CI green; package not on the manual-review list.

### Delay before auto-merge

A compromised maintainer publishes a malicious version; the world updates within minutes. Mitigate:

- **Patch delay 48h**: auto-merge only after the version is 48h old. Compromise usually surfaces in that window.
- **Minor delay 7 days**: same idea, longer for higher-risk changes.
- **Security patches**: shorter delay (24h for non-critical, immediate for critical with provenance).

This is the easiest defense against time-window compromise.

### Manual-review list

Some deps justify always-manual review:

- Crypto libraries.
- Auth libraries.
- Anything that touches the audit ledger.
- Anything that runs in the sandbox boundary.
- Anything with `postinstall` scripts.
- Anything from a maintainer you've seen compromised before.

Maintained in `.dependency-policy.json` at repo root. Renovate / Dependabot respects it.

### Major version migrations

Treat majors like RFCs:

1. **RFC**: why bump now? What breaks? What's the migration?
2. **Try in a branch**: run all tests; measure impact on bundle / latency.
3. **Codemod**: if the upstream provides one, run; else write project-specific transforms.
4. **Phase plan**: one major per PR; not "bump 5 majors at once".
5. **Soak in staging**: at least 24h before production.

Hoarding majors across upgrades creates worse migrations (5 majors at once = combinatorial pain).

### Abandoned dependency detection

Quarterly sweep:

- Last release > 12 months ago.
- Maintainer activity (any) > 6 months ago.
- Open issues / PRs piling up unaddressed.

For each abandoned dep:

- **Find alternative + migrate** (preferred).
- **Fork + maintain yourself** (rare; only critical deps).
- **Inline + delete** (small surface area).

Abandoned deps are CVE bombs waiting.

### Transitive risk

You vet 50 direct deps; you inherit 500 transitives. You don't review 450 of them.

Mitigations:

- **`npm audit` / `pnpm audit` in CI**: flags known-vulnerable transitives.
- **`socket.dev` / `snyk` / `osv-scanner`**: deeper risk signals (typosquat, malicious-pattern, install-script smell).
- **Resolution overrides**: when a transitive is forced to a vulnerable version, override at the lock level (`overrides` in npm, `pnpm.overrides`).
- **Bundled-not-transitive**: vendoring critical deps removes upstream risk (but adds maintenance).

### Dead dependency removal

Periodically: `depcheck` (Node) / equivalent surfaces packages installed but unused.

Remove. Each removed dep is:

- Less surface for compromise.
- Less bytes shipped.
- Less maintenance.
- Less to type-check.

A PR titled "remove unused deps" is high-yield refactor. Quarterly.

### License hygiene

CI scans every dep's license; warns on:

- New GPL/LGPL/AGPL in your tree (if your project license is incompatible).
- Unknown / missing license (treat as restrictive).
- License change between versions (rare but happens; can require legal review).

Tool: `license-checker` (Node), `cargo-deny` (Rust), `pip-licenses` (Python).

### `package.json` discipline

- **No catch-all "utils"** with 30 micro-deps. Trim.
- **Dev / runtime separation**: `dependencies` only what ships to production; `devDependencies` for everything else.
- **PeerDependencies** for things consumers must provide (especially in library packages).
- **No `git+` URLs in production deps**: fragile; not reproducible; security-suspect.
- **No `*` or `latest` version ranges**: random builds; impossible audits.

### Vendoring (selective)

For critical, security-sensitive deps:

- Copy the source into your repo.
- Pin the exact commit.
- Document why vendored.
- Update via PR like your own code.

Cost: you maintain it. Benefit: you control supply chain absolutely.

Worth it for: cryptography primitives, payment libraries, things that ship signed binaries.

Not worth it for: everyday utilities.

### Per-pillar interaction

**Security**: dependency hygiene IS supply-chain security. See [`vulnerability-mgmt-pattern.md`](./vulnerability-mgmt-pattern.md) for SBOM + CVE pipeline.

**Quality**: bundle-size impact of new deps. See [`../quality/performance-budgets-pattern.md`](../quality/performance-budgets-pattern.md).

**Architecture**: every dep is a coupling. See [`../architecture/anti-overengineering.md`](../architecture/anti-overengineering.md) for "could I inline this?"

**Governance**: dep updates ship via PR with intent manifest like any other code.

### Common failure modes

- **Adding deps without policy.** Tree grows; review impossible. → Per-PR justification template.
- **Lock file not committed.** Reproducibility lost. → Commit; frozen install in CI.
- **Auto-merge with no delay window.** Compromised version hits prod within an hour. → 48h delay on patches.
- **Hoarded majors.** Bumping 5 at once = multi-week migration. → One major per PR.
- **Transitive vulnerabilities ignored.** "Not our code" attitude. → Override at lock level.
- **Abandoned deps unchecked.** Year-old library; CVE drops; nobody's home. → Quarterly sweep.
- **`postinstall` enabled by default.** One compromised dep runs code on every install. → Disable; allow explicitly.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Auto-bumps | Renovate (preferred for configurability), Dependabot |
| Audit | `pnpm audit`, `npm audit`, `osv-scanner`, Snyk |
| Risk signals | socket.dev, Snyk Risk, GitHub Advanced Security |
| Unused detection | depcheck, knip, ts-prune |
| License | license-checker, cargo-deny, pip-licenses |
| Bundle impact | bundlephobia, size-limit |
| Lockfile diff | renovate native, custom GH Action |

### See also

- [`vulnerability-mgmt-pattern.md`](./vulnerability-mgmt-pattern.md) — CVE triage pipeline this feeds into.
- [`secrets-leak-postmortem-playbook.md`](./secrets-leak-postmortem-playbook.md) — supply-chain compromise scenario.
- [`../architecture/anti-overengineering.md`](../architecture/anti-overengineering.md) — fewer deps is fewer abstractions.
- [`../quality/ci-cd-pipeline-pattern.md`](../quality/ci-cd-pipeline-pattern.md) — where the gates run.
