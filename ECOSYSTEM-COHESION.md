# AgentsKit ecosystem cohesion spec

The four properties — **AgentsKit** (framework), **Registry** (ready-made agents),
**Playbook** (engineering standards), **AKOS** (production OS) — must read as one
product family: same accent, same narrative, same cross-links, same social proof.

This file is the source of truth for that surface. Copy the components below into
each sibling repo. Keep the **copy strings verbatim** — that's what makes the
family feel like one thing.

## 1. Narrative roles (verbatim everywhere)

| Property | Role label | One-liner |
|---|---|---|
| AgentsKit | The libraries | Build the agent, skip the plumbing. Chat UI, runtime, tools, memory, RAG in one JS toolkit. |
| Registry | The registry | The shadcn for agents. Copy production-ready agents into your project — no boilerplate. |
| Playbook | The standards | The engineering discipline that keeps agent-built code reviewable, safe, and shippable. |
| AKOS | The OS | Orchestrate and govern agents in production — identity, audit, permissions, cost control. |

**Workflow thread** (use on every landing): *AgentsKit builds it, the Registry
gives you a head start, the Playbook keeps it shippable, AKOS runs it in
production.*

**Canonical cross-ref sentence** (one line, every hero, same link order):
> Part of the AgentsKit ecosystem: build with the **framework**, grab ready-made
> agents from the **Registry**, ship by the **Playbook**, and run them in
> production on **AKOS**.

The current property renders **bold plain**; the other three render as links.

## 2. Color (family accent = blue)

All properties use the same functional accent. Per-property colors from
`ecosystem.json` are used **only** as the identity dot inside the ecosystem grid,
never as the site's primary action color.

```css
--accent:        oklch(0.70 0.15 250);  /* blue — buttons, links, focus */
--accent-strong: oklch(0.76 0.15 250);
/* fumadocs / docs sites also set: */
--color-fd-primary: oklch(0.70 0.15 250);
/* gradient: */
linear-gradient(135deg, oklch(0.70 0.16 250), oklch(0.74 0.13 212));
```

Theme: prefer dark. If a property is light (AKOS), the **accent, ecosystem bar,
and cross-ref sentence must still be identical** — only the surface flips.

## 3. Global ecosystem bar (already shared)

Embed the single-source bar on every property. It is `position:relative`, z-index
30, ~37px tall, reads `data-current`, injects no stars. Sits above your own header
— no overlap.

```html
<script src="https://www.agentskit.io/ecosystem-bar.js" data-current="<id>"></script>
```

`<id>` ∈ `agentskit | registry | playbook | akos`.

## 4. Combined stars in the header (React)

Any single repo is young; show the **family total**, not one repo. Same component
in every header.

```tsx
"use client";
import { useEffect, useState } from "react";

export function EcosystemStars({ repos, org = "AgentsKit-io" }: { repos: string[]; org?: string }) {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all(
      repos.map((r) =>
        fetch(`https://api.github.com/repos/${r}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((d) => (d?.stargazers_count ?? 0))
          .catch(() => 0),
      ),
    ).then((c) => active && c.reduce((a, b) => a + b, 0) > 0 && setTotal(c.reduce((a, b) => a + b, 0)));
    return () => { active = false; };
  }, [repos]);
  const fmt = total === null ? "★" : total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total);
  return <a href={`https://github.com/${org}`} title="Total stars across the AgentsKit ecosystem">{fmt} ecosystem</a>;
}
```

Repos: derive from `ecosystem.json` → `properties.map(p => p.repo)`.

> ⚠️ The public GitHub API is rate-limited (~60 req/h per IP, unauthenticated).
> For high-traffic sites, cache the total in a build-time/edge route
> (`/api/stars.json`) instead of hitting GitHub from every visitor's browser.

## 5. Cross-ref sentence component (React)

Data-driven from `ecosystem.json`; pass the current property's `id`. This repo's
`components/ecosystem-cross-ref.tsx` is the reference implementation — copy it as-is
and only change the `current` prop per site.

## 6. Per-property checklist

- [ ] Ecosystem bar embedded with correct `data-current`
- [ ] Accent = family blue (`--accent` + docs primary)
- [ ] Cross-ref sentence in hero, current property bold
- [ ] Combined `EcosystemStars` in header
- [ ] Role one-liner matches the table above verbatim
- [ ] Outbound ecosystem links carry `utm_source=<self>&utm_campaign=ecosystem`
- [ ] PostHog `cross_subdomain_cookie: true` so a visitor is one person across `*.agentskit.io`
