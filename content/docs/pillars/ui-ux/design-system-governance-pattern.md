---
title: 'Design System Governance Pattern'
description: 'How to keep a design system useful as it grows — without bloat, without dictatorial restrictions, without drift.'
---

# Design System Governance Pattern

How to keep a design system useful as it grows — without bloat, without dictatorial restrictions, without drift.

## TL;DR (human)

A design system is a shared contract between design + engineering. Without governance, primitives multiply (3 buttons; 5 inputs), tokens drift (every team adds its own color), and the value collapses. Governance is light-touch: a tier model (core vs experimental vs deprecated), a contribution path, a deprecation cycle, and a single source-of-truth.

## For agents

### Three primitive tiers

| Tier | Stability | Where used | Process to change |
|---|---|---|---|
| **Core** | Stable; high stakes | Shared, shipped surfaces | RFC + design review |
| **Experimental** | New; one team adopting | Specific surface | PR review |
| **Deprecated** | Being retired | Existing usages | Migration before removal |

Tier marker on every component in the catalog (Storybook story + code metadata).

### Contribution path

When a team needs a new primitive:

1. **Search the catalog**: does it exist? Variant of existing?
2. **Sketch in their surface**: build prototype locally; iterate.
3. **Propose contribution**: PR to the design system package with rationale.
4. **Design review**: design lead + system maintainer + adopter consensus.
5. **Land as Experimental**: ships; documented; not yet recommended for all surfaces.
6. **Promote to Core**: after N teams adopt and stable for 1 quarter.
7. **Or sunset**: if adopters stay at 1; experimental gets deprecated.

This prevents "I'll just inline it" (drift) and "we need a committee" (paralysis).

### Single source of truth

The design system lives in:

- **Code**: the package shipped to consumers.
- **Storybook / catalog**: visual documentation.
- **Figma library**: design tokens + components mirror the code.
- **Tokens file**: single JSON/YAML source synced to all surfaces (web, mobile, email, marketing).

Tools: Figma Tokens / Tokens Studio + Style Dictionary build pipeline.

If Figma drifts from code (or vice versa), it's a bug. Figma-source vs code-source is a process decision — pick one.

### Visual regression

Every component snapshot rendered + diffed per PR:

- Default brand + test brand kit.
- Light + dark modes.
- All variants × sizes × states.

Drift surfaces: a token change cascades through every component using it; visual diff catches inadvertent change.

Tools: Chromatic, Percy, Lost Pixel, in-house Playwright snapshots.

### Token taxonomy review

Quarterly: review the token catalog.

- Duplicates: two semantic tokens with same value, different names? Merge.
- Unused: tokens with no references? Delete.
- Naming drift: `text-primary` vs `primary-text`? Pick one.
- Layer hygiene: primitives referenced where semantics should be? Refactor.

A token catalog over 200 entries is suspect. 50-150 is typical for a healthy system.

### Component deprecation

When a component is superseded:

1. Mark `@deprecated` with migration path (per [`../architecture/api-versioning-pattern.md`](../architecture/api-versioning-pattern.md)).
2. Console-warn in dev when used.
3. Storybook flagged.
4. Migration codemod where possible.
5. Sunset after window; remove from catalog.
6. Tombstone the doc.

### Cross-platform consistency

When the product spans web + mobile + email:

- Tokens defined once; built per platform (CSS variables for web; iOS / Android theme files; email-safe styles).
- Components conceptually consistent; impl per platform.
- Visual regression covers each.

Avoid: pixel-perfect identical (impossible across email constraints) or wildly inconsistent (user feels two products).

### Branding interplay

Per [`whitelabel-pattern.md`](./whitelabel-pattern.md): tokens layer brand-specific values on the same semantic shape. Governance reviews brand kits the same way:

- New brand kit must pass test-brand-kit checks.
- Brand-specific tokens stay narrow (product name, palette, logo).
- Component-level overrides per brand are red flags — too brand-specific.

### Documentation

Every primitive ships:

- **What it is** (one sentence).
- **When to use** (decision-tree style).
- **When NOT to use** (the alternative).
- **Props** (typed + documented).
- **Examples** (default, variants, edge cases).
- **A11y notes** (keyboard, screen reader, contrast).
- **Migration** (from deprecated alternatives).

Storybook MDX + auto-generated prop tables work well.

### Naming conventions

- Components: PascalCase, descriptive (Button, IconButton, Avatar, AvatarStack).
- Variants: lowercase enum (primary, secondary, ghost, danger).
- Sizes: t-shirt (xs, sm, md, lg, xl) or numbered (1, 2, 3).
- Stay consistent across components.

### Governance team

Small (2-5 people):

- Design lead.
- Engineering lead.
- 1-2 power-user adopters from product teams.

Cadence: weekly review of in-flight contributions; monthly token audit; quarterly retro.

Decisions documented as ADRs (per [`../architecture/adr-pattern.md`](../architecture/adr-pattern.md)).

### Common failure modes

- **"I'll just inline this here"**: drift; every team builds slightly different. → Contribution path; gate native HTML.
- **Mega-component**: Button with 30 props handling everything. → Composition; split into smaller pieces.
- **Token explosion**: 80 color tokens. → Audit; consolidate.
- **No deprecation cycle**: components removed in a major bump without warning. → Versioning + migration.
- **Storybook out of date**: docs say X; code does Y. → Storybook is the canonical reference; CI enforces.
- **No visual regression**: silent drift. → Snapshots per PR.
- **Figma + code drift**: design ships features code doesn't. → Single source; sync pipeline.

### Adoption path

1. **Day 0**: 8-12 primitives; minimal tokens; in-source Storybook.
2. **Quarter 1**: visual regression in CI; contribution path documented.
3. **Quarter 2**: token audit; tier markers; first deprecation.
4. **Quarter 3+**: governance team; quarterly cadence.
5. **Mature**: design system is a product itself; team owns it; adopters love it.

### See also

- [`primitives-pattern.md`](./primitives-pattern.md) — the basic primitives catalog.
- [`design-tokens-pattern.md`](./design-tokens-pattern.md) — the token system.
- [`whitelabel-pattern.md`](./whitelabel-pattern.md) — brand kit governance.
- [`../architecture/anti-overengineering.md`](../architecture/anti-overengineering.md) — primitive proliferation as overengineering.
- [`../architecture/api-versioning-pattern.md`](../architecture/api-versioning-pattern.md) — deprecation discipline.
