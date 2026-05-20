---
title: 'Whitelabel Pattern'
description: 'How to make every product surface reskinnable per tenant — even if you do not sell whitelabel today.'
---

# Whitelabel Pattern

How to make every product surface reskinnable per tenant — even if you do not sell whitelabel today.

## TL;DR (human)

A whitelabel runtime resolves product name, logos, palette, typography, motion, and plan presets per tenant. Components reference token names and `productName`; values come from the runtime. Build-time bake for performance; runtime overrides for preview / OEM admin.

## For agents

### What "whitelabel" includes

| Surface | Whitelabel'd via |
|---|---|
| Product name | `productName` token (with safe fallback) |
| Logo + favicon | Brand kit asset paths |
| Palette | Token overrides (primitive + semantic layers) |
| Typography | Font family + weight overrides |
| Motion | Duration + easing overrides (rare) |
| Plan presets | Feature flags resolved per tenant tier |
| Legal links | ToS, privacy, contact resolved per tenant |
| Email templates | Sender name + footer per tenant |

What is **not** whitelabel'd (always the same):

- Behavior. The product does the same things regardless of brand.
- Names of features in UI (those are intl, brand-token-free).
- Stable API contracts (consumers depend on these).

### Brand kit shape

A brand kit is a JSON document. Schema:

```ts
type BrandKit = {
  productName: string;            // "AppName"
  productNameFallback: string;    // when productName missing at render time
  legalEntity?: string;           // company name in footers
  palette: {
    accent: string;               // oklch / hex
    surface1: string;
    surface2: string;
    textPrimary: string;
    textOnAccent: string;
    danger: string;
    success: string;
    // ... per project
  };
  typography: {
    fontSans: string;             // "Inter, system-ui"
    fontMono: string;
    fontDisplay?: string;
  };
  logos: {
    primary: string;              // path / data url
    favicon: string;
    emailHeader?: string;
  };
  motion?: {
    durationFast: string;
    durationNormal: string;
    durationSlow: string;
  };
  legalLinks?: {
    terms?: string;
    privacy?: string;
    contact?: string;
  };
  planPresets?: Record<string, PlanFeatures>;
};
```

A default brand kit ships with the repo. Per-tenant overrides apply via the runtime.

### Runtime

```ts
// at app boot
const kit = await loadBrandKit({ tenantId, env });
applyBrandKit(kit);

// applyBrandKit:
// 1. Writes CSS variables to :root.
// 2. Updates the React context with productName + logos + legalLinks.
// 3. Sets the favicon link tag.
// 4. Updates document.title prefix if configured.
```

The context provides hooks:

```ts
const { productName, logos, legalLinks } = useBrand();
const t = useT();

return (
  <h1>{t("dashboard.title", { product: productName })}</h1>
);
```

### Build-time vs runtime

Two modes, often combined:

| Mode | Behavior | Use when |
|---|---|---|
| Build-time | Brand kit baked into the bundle at build | Single-brand deploy; max performance |
| Runtime | Brand kit fetched per session at boot | Multi-tenant cloud; per-tenant overrides |

Implementation pattern:

- Build-time defaults bake in.
- Runtime override applies on top after boot.
- Hot-swap (preview "what would my new brand look like") via re-running `applyBrandKit`.

### Plan presets

Per-tenant feature gating goes through the brand kit's `planPresets`:

```ts
planPresets: {
  free: { maxWorkspaces: 1, customDomain: false, ssoEnabled: false },
  pro:  { maxWorkspaces: 5, customDomain: false, ssoEnabled: false },
  team: { maxWorkspaces: 25, customDomain: true,  ssoEnabled: true  },
}
```

The runtime resolves the tenant's plan, exposes feature flags via a hook:

```ts
const { canUseCustomDomain, ssoEnabled } = usePlan();
```

This keeps plan logic out of business code.

### Product name in strings

The single trickiest case: a user-visible string mentions the product name.

```ts
// ✗ wrong — hardcoded
t("welcome.banner") // → "Welcome to AppName"

// ✓ right — interpolated
t("welcome.banner", { product: productName }) // → "Welcome to {product}"
```

Locale files contain `"welcome.banner": "Welcome to {product}"`. Intl + whitelabel compose; product name swaps without re-translating.

Fallback discipline: if `productName` is missing (e.g. brand kit failed to load), fall back to a safe short string like `"App"`. Empty strings produce broken-looking copy ("Welcome to ").

### The gate

A "whitelabel readiness" check ensures:

1. **No hardcoded product name** outside the allowlist. Grep for the production product name in source; fail if found.
2. **No hardcoded brand colors** outside the design-token system. Covered by [`design-tokens-pattern.md`](./design-tokens-pattern.md).
3. **Default brand kit loads** in CI; a test brand kit also loads, both render the app, no errors.

### Default brand kit + test brand kit

Two brand kits shipped with the repo:

- **`default.json`**: the product's primary brand.
- **`test.json`**: a wildly different brand (orange instead of blue, different typography, different name). CI renders against this and snapshots key surfaces. Drift between the two indicates a hardcode.

### Common failure modes

- **`productName` hardcoded in JSX literal.** Intl gate catches; but easy to miss in attributes (e.g. `<meta name="application-name" content="AppName">`). → Whitelabel readiness gate scans for the brand name in source files.
- **Image / logo files referenced by hardcoded path.** Cannot swap. → Logos go through the brand kit's `logos.primary`.
- **Plan logic inline in business code** (`if (workspace.tier === "free") ...`). Hard to whitelabel pricing tiers. → Plan logic in `planPresets`; consumer asks the runtime.
- **Brand kit applied client-side only.** Server-rendered HTML has the wrong brand for a flash. → Server resolves the kit before render.
- **No fallback for missing brand kit.** Page crashes if fetch fails. → Default brand kit always available as fallback.
- **OEM admin can edit anything.** Including critical strings that should not move. → OEM admin edits brand kit fields only; never raw locale files or business code.

### Adoption path even if you do not sell whitelabel

Cost of building whitelabel-ready from day one: small. Cost of retrofitting later: large. Even single-brand projects benefit:

- Cleaner separation of brand assets and code.
- Easier dark-mode / theme variants (themes are mini brand kits).
- Easier reskin if the company rebrands.
- Easier acquisition by a buyer (whitelabel = customer-ready).

### See also

- [`universal.md`](./universal.md) — Rule 10.
- [`design-tokens-pattern.md`](./design-tokens-pattern.md) — palette flows through tokens.
- [`intl-pattern.md`](./intl-pattern.md) — product name composes with intl.
