---
type: SDLC Phase
title: 'Phase 05 — Ship'
description: 'How to turn a green main into a release without surprising consumers.'
---

# Phase 05 — Ship

How to turn a green main into a release without surprising consumers.

## TL;DR (human)

Tests green is not enough. A release-gate checklist runs structural gates + sanity + cold prod-build walk + changesets + security review. Versions bump per semver. Artifacts get signed. Rollback plan is written before, not after.

## For agents

### Pre-release outputs

- [ ] **`pnpm check:all`** — full pre-release sweep green.
- [ ] **Sanity report CLEAN** — no metric regressions vs last release baseline.
- [ ] **Release-blockers empty** — no open issue tagged `release-blocker`.
- [ ] **Changesets generated** — every consumer-visible PR has one; aggregated into the release notes.
- [ ] **Cold prod-build walk** — operator-driven; literal demo script; recorded.
- [ ] **Security sweep** — pending advisories triaged; threat model reviewed for new surfaces.
- [ ] **Signed artifacts** — binaries / installers signed; SHA / GPG attested.
- [ ] **Rollback plan** — how to revert; who pushes; on-call assigned.

### Per pillar — Ship-phase discipline

**Architecture**
- [ ] Peer-dep compat matrix updated.
- [ ] Public API diff produced; breaking changes called out.
- [ ] ADRs for this release tagged with the release version.

**Security**
- [ ] Dependency vulnerability triage (CVE list).
- [ ] Threat model walked: new surfaces, new mitigations, new residuals.
- [ ] Key rotation review (any keys past their rotation date?).
- [ ] Audit ledger verification job green.

**UI-UX**
- [ ] Per-locale parity verified.
- [ ] Brand-kit matrix tested (default + test brand both render cleanly).
- [ ] A11y full sweep on changed screens.
- [ ] Demo walk-through script executed on cold prod build.

**Quality**
- [ ] `check:all` green.
- [ ] Mutation pass scheduled (or last result acceptable).
- [ ] Coverage at threshold per package.
- [ ] No flaky-tests baseline regressions.

**Governance**
- [ ] Changesets present per consumer-visible PR.
- [ ] Tombstones applied to retired plans.
- [ ] Release notes drafted (user-facing + internal).

**AI-collaboration**
- [ ] Memory groomed: facts that are now release-stable promoted to `CLAUDE.md` / `AGENTS.md`.
- [ ] Sub-agent recipe updates rolled out (if any).

### Cold prod-build walk (non-skippable)

CI green is not "demo reachable". A green build can hide:

- Route-gating bugs that prod-only conditions trigger.
- Bundler-mode differences (dev vs prod).
- SSR vs CSR boundary mistakes.
- Environment-variable misses.

Therefore:

1. Build a production artefact from `main` on a clean checkout.
2. Walk the literal demo script: every step a customer / investor would take.
3. Record outcome. Screenshots / video.
4. Any unhandled state → SHIP-BLOCK. File issue; fix; redo walk.

This is operator-driven. Agents cannot self-verify a cold walk because they cannot click. They prepare the artefact and the script; the operator runs it.

### Investor / customer percent claims

The percent-ready number you state externally comes from the cold walk, not from CI. CI-derived percentages are a sanity check; they are not the truth. Reading too much into "tests pass" produces overclaims that hurt at demo time.

### Versioning

Semver per package. Conventions:

- **patch** (`x.y.Z+1`) — internal fixes, no consumer-visible API change.
- **minor** (`x.Y+1.0`) — additive changes; new method, new field with default.
- **major** (`X+1.0.0`) — breaking change. Requires RFC + migration plan + deprecation window honoured.

Aggregate the changesets; verify each PR's classification matches its diff.

### Rollback plan

Per release:

- **What changed**: list of consumer-visible changes.
- **Smoke tests post-release**: which surfaces / flows to verify within N minutes.
- **Rollback procedure**: exact commands; expected duration.
- **Rollback authority**: who can trigger; under what condition.
- **Comms plan**: who tells users; via which channel.

The plan exists before the release tag. Writing it post-release is too late.

### Common failure modes

- **"Investor-ready 90% because tests pass."** Overclaim; demo crashes. → Cold walk dictates the number.
- **Release with no changesets.** Consumers cannot see what changed. → Per-PR changeset; aggregate at release.
- **Auto-publish from CI on tag.** Rollback path unclear if it goes wrong. → Manual trigger; explicit on-call.
- **Tombstones not applied.** Release ships with retired plans claiming work that is done. → Sweep tombstones at release branch.

### Exit criteria (release tag)

You can tag a release when:

1. All checkboxes above ticked.
2. Cold walk complete with no blockers.
3. Rollback plan signed off.
4. Release notes published (or queued for publish at tag).

### See also

- [`../../pillars/quality/sanity-pattern.md`](/docs/pillars/quality/sanity-pattern)
- [`../../pillars/governance/tombstone-pattern.md`](/docs/pillars/governance/tombstone-pattern)
- [`../../prompts/slash-ship.md`](/docs/prompts/slash-ship) — orchestrator slash command for this checklist.
