import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Layers,
  Lock,
  Sparkles,
  Workflow,
  Zap,
  Shield,
  Activity,
  Palette,
  Bot,
  Github,
  Boxes,
  AlertTriangle,
  GitMerge,
  GitBranch,
  FileWarning,
  Repeat,
  Package,
  Blocks,
  Cpu,
  Star,
} from "lucide-react";
import stats from "./stats.snapshot.json";
import ecosystem from "@/ecosystem.json";
import { EcosystemLink } from "@/components/ecosystem-link";
import { EcosystemStars } from "@/components/ecosystem-stars";
import { EcosystemCrossRef } from "@/components/ecosystem-cross-ref";
import { CopyPrompt } from "@/components/copy-prompt";
import { AgentConvergence } from "@/components/agent-convergence";

// Counts are derived from content by scripts/compute-stats.mjs (single source).
const C = stats.counts;

// Ready-to-paste onboarding prompt — feeds any agent the whole playbook and
// asks it to map the practices onto the user's actual repo. Kept tool-neutral.
const ONBOARDING_PROMPT = `You are onboarding to a shared engineering playbook for shipping production software with AI coding agents.

1. Fetch and read the full playbook bundle: https://playbook.agentskit.io/llms-full.txt
   (Site map: https://playbook.agentskit.io/llms.txt — fetch individual docs from the /raw/ paths if you can't load the bundle at once.)
2. Then audit THIS repository against it:
   - Which playbook practices already hold here?
   - Which are missing or violated, ranked by risk (security > correctness > quality > governance > DX)?
   - Which are not applicable to this stack, and why?
3. Propose a short, prioritized adoption plan: the 5 highest-leverage changes for this repo, each with the playbook doc it comes from and a concrete first step.
4. Draft (or update) the repo's bootstrap doc — CLAUDE.md, AGENTS.md, .cursor/rules, .windsurfrules, or .github/copilot-instructions.md as appropriate for the agent in use — using the playbook's template as the starting point.

Do not change code yet. Output the audit and the plan first, then wait for my go-ahead.`;

// Machine-readable endpoints — each rendered with its own copy button.
const CURLS = [
  {
    note: "fetch raw markdown from any doc",
    cmd: "curl playbook.agentskit.io/raw/pillars/security/rbac-pattern.md",
  },
  {
    note: "one-shot bundle for RAG indexing",
    cmd: "curl playbook.agentskit.io/llms-full.txt",
  },
  {
    note: "zip everything for local indexing",
    cmd: "curl -O playbook.agentskit.io/playbook-bundle.zip",
  },
];

const PILLARS = [
  {
    slug: "architecture",
    title: "Architecture",
    icon: Layers,
    summary:
      "Modular boundaries, typed contracts, ADRs / RFCs, file-size budgets, anti-overengineering, distributed data, event streaming, multi-region.",
    docs: 19,
  },
  {
    slug: "security",
    title: "Security",
    icon: Shield,
    summary:
      "RBAC, vault, audit ledger, egress allowlist, vulnerability mgmt, secrets deep, multi-tenant isolation, compliance (SOC 2 / GDPR), AI/LLM safety.",
    docs: 17,
  },
  {
    slug: "ui-ux",
    title: "UI / UX",
    icon: Palette,
    summary:
      "Design tokens, primitives catalog, intl + ICU, empty states, a11y (WCAG-AA deep), motion + reduced-motion, whitelabel, design-system governance.",
    docs: 9,
  },
  {
    slug: "quality",
    title: "Quality",
    icon: Activity,
    summary:
      "Test pyramid, gates, sanity, mutation, observability + SLOs, performance budgets, chaos engineering, CI/CD pipeline, FinOps, contract testing.",
    docs: 14,
  },
  {
    slug: "governance",
    title: "Governance",
    icon: Workflow,
    summary:
      "PR intent manifest, merge rules, tombstones, phased PRs — keeps multi-author work additive instead of subtractive.",
    docs: 5,
  },
  {
    slug: "ai-collaboration",
    title: "AI Collaboration",
    icon: Bot,
    summary:
      "Bootstrap docs (CLAUDE.md / AGENTS.md), persistent memory, sub-agent recipes, slash commands, concurrent-agent survival.",
    docs: 6,
  },
];

const FEATURES = [
  {
    icon: BookOpenCheck,
    title: "Production-earned",
    body: "Every rule traces to a reproducible failure mode. No theory; only patterns paid for in shipped repos.",
  },
  {
    icon: Sparkles,
    title: "Dual-mode docs",
    body: "Each page has a Human TL;DR and a For-Agents section. Optimised for both linear reading and RAG retrieval.",
  },
  {
    icon: Lock,
    title: "Gates included",
    body: `${C.gateScripts} reference gate scripts (Node 22, zero deps) you can drop into any repo. Pure copy-paste.`,
  },
  {
    icon: Zap,
    title: "Drop-in templates",
    body: "ADR, RFC, PR-intent, CLAUDE.md, AGENTS.md, MEMORY.md — ready for any project.",
  },
];

const FAILURE_MODES = [
  {
    icon: Boxes,
    title: "Reinvented primitives",
    body: "Agent rewrites a helper that already exists upstream — instead of depending on it.",
    fix: "Architecture",
    href: "/docs/pillars/architecture/universal",
  },
  {
    icon: AlertTriangle,
    title: "Unreviewable diffs",
    body: "Ternaries nested until no human can read the file, and the PR rubber-stamps through.",
    fix: "Quality",
    href: "/docs/pillars/quality",
  },
  {
    icon: GitMerge,
    title: "Deleted peer work",
    body: "A merge resolved with checkout --theirs silently wipes another author's code.",
    fix: "Governance",
    href: "/docs/pillars/governance",
  },
  {
    icon: FileWarning,
    title: "Fake “done”",
    body: "Screen marked shipped while half its tabs still throw not implemented.",
    fix: "Quality",
    href: "/docs/pillars/quality",
  },
  {
    icon: Repeat,
    title: "Session amnesia",
    body: "Agent repeats a mistake you already fixed last week — context lost between runs.",
    fix: "AI Collaboration",
    href: "/docs/pillars/ai-collaboration",
  },
  {
    icon: GitBranch,
    title: "Stale-branch grind",
    body: "Agent keeps building on a branch while main has already gone red.",
    fix: "Governance",
    href: "/docs/pillars/governance",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-hero-gradient" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" aria-hidden />

      <SiteHeader />

      <Hero />

      <WorksWith />

      <FailureModes />

      <Features />

      <PillarShowcase />

      <AgentFriendly />

      <TrainYourAgent />

      <EcosystemSection />

      <CTASection />

      <SiteFooter />
    </main>
  );
}

function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 64" fill="none" className={className} aria-hidden>
      <g stroke="#2997ff" strokeWidth="3" strokeLinecap="round">
        <line x1="12" y1="52" x2="36" y2="12" />
        <line x1="36" y1="12" x2="60" y2="52" />
        <line x1="12" y1="52" x2="60" y2="52" />
      </g>
      <circle cx="36" cy="12" r="6" fill="#2997ff" />
      <circle cx="12" cy="52" r="6" fill="#2997ff" />
      <circle cx="60" cy="52" r="6" fill="#2997ff" />
    </svg>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] glass">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <BrandMark className="h-6 w-6" />
        <span>Agents Playbook</span>
      </Link>
      <nav className="flex items-center gap-6 text-sm">
        <Link href="/docs" className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">Docs</Link>
        <Link href="/docs/matrix" className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">Matrix</Link>
        <Link href="/docs/glossary" className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">Glossary</Link>
        <Link
          href="/llms.txt"
          className="hidden md:inline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          llms.txt
        </Link>
        <EcosystemLink
          href="https://www.agentskit.io/"
          placement="header"
          className="hidden sm:inline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          AgentsKit ↗
        </EcosystemLink>
        <EcosystemStars repos={ecosystem.properties.map((p) => p.repo)} />
        <EcosystemLink
          href="https://github.com/AgentsKit-io/agents-playbook"
          placement="header"
          event="community_clicked"
          className="hidden sm:inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
        >
          <Github className="h-3.5 w-3.5" aria-hidden />
          GitHub
        </EcosystemLink>
      </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pt-12 pb-24 sm:pt-20 sm:pb-32">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-1)] px-3 py-1 text-xs uppercase tracking-wider text-[color:var(--muted-foreground)]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-gradient" aria-hidden />
            Works with any coding agent
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            Make AI agents ship code you&rsquo;d{" "}
            <span className="text-accent-gradient">actually merge</span>.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-[color:var(--muted-foreground)]">
            They reimplement primitives, nest ternaries past readability, and mark
            screens &ldquo;done&rdquo; with half the tabs throwing{" "}
            <span className="font-mono text-[0.95em] text-[color:var(--foreground)]">not implemented</span>.
            This is the rules, gates, and prompts — earned over a year of
            agent-driven production — that stop it.
          </p>
          <EcosystemCrossRef
            current="playbook"
            placement="hero"
            className="mt-4 max-w-xl text-sm text-[color:var(--muted-foreground)]"
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/docs"
              className="group inline-flex items-center gap-2 rounded-md bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow-purple transition hover:bg-accent-gradient-hover"
            >
              Read the playbook
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/docs/onboard-your-agent"
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
            >
              Onboard your agent
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <CodePreview />
        </div>
      </div>
    </section>
  );
}

function CodePreview() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-1 rounded-2xl bg-accent-gradient opacity-30 blur-2xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-1)] ring-glow">
        <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] opacity-70" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--warning)] opacity-70" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--success)] opacity-70" aria-hidden />
          <span className="ml-3 text-xs text-[color:var(--subtle-foreground)] font-mono">CLAUDE.md · AGENTS.md · .cursor/rules</span>
        </div>
        <pre className="overflow-x-auto p-5 text-[12.5px] leading-relaxed font-mono text-[color:var(--muted-foreground)]">
{`# CLAUDE.md

## Non-negotiables

1. No \`any\`. Schema parse every boundary.
2. Named exports only.
3. Typed AppError + stable codes.
4. createLogger(tag); no console.log.
5. ADR before architecture. RFC before
   breaking contracts.
6. Ship complete or don't ship.
7. Merges sum work, never subtract.
8. UI via shared primitives only.
9. Every visible string is intl.
10. Tokens; no raw color literals.

## Before you ship
\`\`\`
pnpm check:quality-gates
pnpm check:all
\`\`\``}
        </pre>
      </div>
    </div>
  );
}

// Cohesive ecosystem narrative — one role sentence per property, in workflow
// order. Accent + tagline data come from ecosystem.json (synced from the
// canonical registry); this layer adds the "where it fits" framing.
const ECOSYSTEM_ROLE: Record<
  string,
  { kind: string; icon: typeof Package; role: string; cta: string; target: string }
> = {
  agentskit: {
    kind: "The libraries",
    icon: Package,
    role: "Build the agent, skip the plumbing. Chat UI, runtime, tools, memory, and RAG in one JavaScript toolkit.",
    cta: "Build an agent",
    target: "agentskit",
  },
  registry: {
    kind: "The registry",
    icon: Blocks,
    role: "The shadcn for agents. Copy production-ready agents straight into your project — no boilerplate.",
    cta: "Browse agents",
    target: "registry",
  },
  playbook: {
    kind: "The standards",
    icon: BookOpenCheck,
    role: "You're here. The engineering discipline that keeps agent-built code reviewable, safe, and shippable.",
    cta: "Read the playbook",
    target: "playbook",
  },
  akos: {
    kind: "The OS",
    icon: Cpu,
    role: "Orchestrate and govern agents in production — identity, audit, permissions, and cost control.",
    cta: "Explore AKOS",
    target: "akos",
  },
};
const ECOSYSTEM_ORDER = ["agentskit", "registry", "playbook", "akos"] as const;

function EcosystemSection() {
  const props = Object.fromEntries(
    ecosystem.properties.map((p) => [p.id, p]),
  );
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <SectionLabel>The ecosystem</SectionLabel>
      <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        One workflow. Four parts that fit together.
      </h2>
      <p className="mt-4 max-w-3xl text-pretty text-[color:var(--muted-foreground)]">
        <span className="font-medium text-[color:var(--foreground)]">AgentsKit</span>{" "}
        builds it, the{" "}
        <span className="font-medium text-[color:var(--foreground)]">Registry</span>{" "}
        gives you a head start, this{" "}
        <span className="font-medium text-[color:var(--foreground)]">Playbook</span>{" "}
        keeps it shippable, and{" "}
        <span className="font-medium text-[color:var(--foreground)]">AKOS</span>{" "}
        runs it in production. Same standards end to end.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ECOSYSTEM_ORDER.map((id) => {
          const p = props[id];
          const meta = ECOSYSTEM_ROLE[id];
          const Icon = meta.icon;
          const current = id === "playbook";
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${p.accent}1a`,
                    color: p.accent,
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {current ? (
                  <span className="rounded-full border border-[color:var(--accent-strong)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--accent-strong)]">
                    You are here
                  </span>
                ) : (
                  <span className="text-[11px] uppercase tracking-wider text-[color:var(--subtle-foreground)]">
                    {meta.kind}
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-base font-semibold">{p.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                {meta.role}
              </p>
              <div
                className="mt-5 inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: current ? "var(--accent-strong)" : p.accent }}
              >
                {meta.cta}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </div>
            </>
          );
          const cardClass = `card-lift group rounded-xl border p-6 ${
            current
              ? "border-[color:var(--accent-strong)] bg-[color:var(--surface-2)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-1)]"
          }`;
          return current ? (
            <Link key={id} href="/docs" className={cardClass}>
              {inner}
            </Link>
          ) : (
            <EcosystemLink
              key={id}
              href={p.url}
              placement="ecosystem_grid"
              target={meta.target}
              className={cardClass}
            >
              {inner}
            </EcosystemLink>
          );
        })}
      </div>
    </section>
  );
}

function FailureModes() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pt-4 pb-12">
      <SectionLabel>The problem</SectionLabel>
      <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        You&rsquo;ve shipped — or caught — every one of these.
      </h2>
      <p className="mt-4 max-w-2xl text-pretty text-[color:var(--muted-foreground)]">
        Each rule in the playbook is the fix for a specific, reproducible way
        agents break production code. Not theory — failure modes paid for in real
        repos.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FAILURE_MODES.map((m) => (
          <Link
            key={m.title}
            href={m.href}
            className="card-lift group rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-1)] p-6"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--surface-2)] text-[color:var(--danger)]">
              <m.icon className="h-4 w-4" aria-hidden />
            </div>
            <h3 className="mt-4 text-base font-semibold">{m.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              {m.body}
            </p>
            <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--accent-strong)]">
              Fixed in {m.fix}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <SectionLabel>Why</SectionLabel>
      <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Built for the kind of code agents actually ship.
      </h2>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="card-lift rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-1)] p-6"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent-gradient text-white shadow-glow-purple">
              <f.icon className="h-4 w-4" aria-hidden />
            </div>
            <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PillarShowcase() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <SectionLabel>Pillars</SectionLabel>
      <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Six pillars. Six SDLC phases. One matrix.
      </h2>
      <p className="mt-4 max-w-2xl text-pretty text-[color:var(--muted-foreground)]">
        Each pillar carries a universal (stack-agnostic) layer plus concrete
        recipes for a TypeScript stack. Together they form a checklist for any
        agent-augmented team.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <Link
            key={p.slug}
            href={`/docs/pillars/${p.slug}`}
            className="card-lift group rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-1)] p-6"
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--surface-2)] text-[color:var(--accent-strong)]">
                <p.icon className="h-4 w-4" aria-hidden />
              </div>
              <span className="text-[11px] uppercase tracking-wider text-[color:var(--subtle-foreground)]">
                {p.docs} docs
              </span>
            </div>
            <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              {p.summary}
            </p>
            <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--accent-strong)]">
              Explore
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AgentFriendly() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-1)]">
        <div className="grid gap-8 p-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <SectionLabel>For agents</SectionLabel>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight">
              Built so your agents can find what they need.
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-[color:var(--muted-foreground)]">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-[10px] font-bold text-white">1</span>
                <span><code className="font-mono">/llms.txt</code> at root — convention for LLM-readable site map.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-[10px] font-bold text-white">2</span>
                <span>Each doc serves a raw <code className="font-mono">.md</code> alongside the HTML — agents fetch source.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-[10px] font-bold text-white">3</span>
                <span>Structured data (JSON-LD) and OpenGraph on every page.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-[10px] font-bold text-white">4</span>
                <span>Single-file <code className="font-mono">llms-full.txt</code> bundles every doc for one-shot RAG indexing.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-[10px] font-bold text-white">5</span>
                <span>Zip bundle (<code className="font-mono">/playbook-bundle.zip</code>) for download + local indexing.</span>
              </li>
            </ul>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            {CURLS.map((c) => (
              <div
                key={c.cmd}
                className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3.5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[color:var(--subtle-foreground)]">
                    # {c.note}
                  </span>
                  <CopyPrompt text={c.cmd} label="Copy" className="shrink-0" />
                </div>
                <code className="block whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-[12.5px] leading-relaxed text-[color:var(--muted-foreground)]">
                  {c.cmd}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10">
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-1)] p-10 text-center">
        <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-50" aria-hidden />
        <div className="relative">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Start with the eight non-negotiables.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-[color:var(--muted-foreground)]">
            The kernel of the playbook. If an agent breaks one, fail the PR.
            Everything else flows from these.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-md bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow-purple transition hover:bg-accent-gradient-hover"
            >
              Read the playbook
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <EcosystemLink
              href="https://github.com/AgentsKit-io/agents-playbook"
              placement="cta"
              event="community_clicked"
              className="group inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
            >
              <Star className="h-4 w-4 text-[color:var(--warning)] transition group-hover:scale-110" aria-hidden />
              Star on GitHub
            </EcosystemLink>
            <Link
              href="/docs/matrix"
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
            >
              See the matrix
            </Link>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-sm text-[color:var(--muted-foreground)]">
            Free and open (CC-BY-4.0). If the playbook saved you a code review,{" "}
            <EcosystemLink
              href="https://github.com/AgentsKit-io/agents-playbook"
              placement="cta"
              event="community_clicked"
              className="font-semibold text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 hover:decoration-current"
            >
              drop a star ↗
            </EcosystemLink>{" "}
            — it helps other teams find it.
          </p>
          <p className="mx-auto mt-8 max-w-xl text-pretty text-sm text-[color:var(--muted-foreground)]">
            Want the platform these practices run on?{" "}
            <EcosystemLink
              href="https://www.agentskit.io/"
              placement="cta"
              className="font-semibold text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 hover:decoration-current"
            >
              Explore AgentsKit ↗
            </EcosystemLink>
          </p>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
      <span className="h-px w-6 bg-accent-gradient" aria-hidden />
      {children}
    </div>
  );
}

function WorksWith() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-6">
      <div className="text-center">
        <SectionLabel>Agent-agnostic</SectionLabel>
        <h2 className="mx-auto mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Whatever agent you run, it ships through the same playbook.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-[color:var(--muted-foreground)]">
          Drops in as the bootstrap doc for any coding agent — rules, gates, and
          prompts in, reviewable and shippable code out.
        </p>
      </div>
      <div className="mt-10">
        <AgentConvergence />
      </div>
    </section>
  );
}

function TrainYourAgent() {
  return (
    <section id="train-your-agent" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <SectionLabel>Onboard in one paste</SectionLabel>
      <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Train your agent on the whole playbook.
      </h2>
      <p className="mt-4 max-w-2xl text-pretty text-[color:var(--muted-foreground)]">
        Paste this into Claude Code, Cursor, Windsurf, Codex — any agent. It pulls
        the entire playbook, audits your repo against it, and proposes a
        prioritized adoption plan before touching a line of code.
      </p>

      <div className="mt-10 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-1)] ring-glow">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-5 py-3">
          <span className="font-mono text-xs text-[color:var(--subtle-foreground)]">
            onboarding prompt
          </span>
          <CopyPrompt text={ONBOARDING_PROMPT} />
        </div>
        <pre className="overflow-x-auto p-5 text-[12.5px] leading-relaxed font-mono text-[color:var(--muted-foreground)] whitespace-pre-wrap">
          {ONBOARDING_PROMPT}
        </pre>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/docs/onboard-your-agent"
          className="group inline-flex items-center gap-2 rounded-md bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow-purple transition hover:bg-accent-gradient-hover"
        >
          Per-tool setup &amp; variants
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <Link
          href="/llms-full.txt"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
        >
          <code className="font-mono text-[0.85em]">llms-full.txt</code>
        </Link>
        <Link
          href="/llms.txt"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
        >
          <code className="font-mono text-[0.85em]">llms.txt</code>
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 text-sm text-[color:var(--muted-foreground)] sm:flex-row sm:items-center">
        <div>
          <div className="font-semibold text-[color:var(--foreground)]">Agents Playbook</div>
          <div className="mt-1">CC-BY-4.0 · Adapt freely · Attribution appreciated.</div>
          <div className="mt-1">
            Built by{" "}
            <EcosystemLink
              href="https://www.agentskit.io/"
              placement="footer"
              className="font-medium text-[color:var(--foreground)] hover:underline"
            >
              AgentsKit
            </EcosystemLink>{" "}
            — the agent-native platform.
          </div>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link href="/docs" className="hover:text-[color:var(--foreground)]">Docs</Link>
          <Link href="/docs/glossary" className="hover:text-[color:var(--foreground)]">Glossary</Link>
          <Link href="/docs/matrix" className="hover:text-[color:var(--foreground)]">Matrix</Link>
          <Link href="/llms.txt" className="hover:text-[color:var(--foreground)]">llms.txt</Link>
          <EcosystemLink href="https://www.agentskit.io/" placement="footer" className="hover:text-[color:var(--foreground)]">AgentsKit ↗</EcosystemLink>
          <EcosystemLink href="https://github.com/AgentsKit-io/agents-playbook" placement="footer" event="community_clicked" className="hover:text-[color:var(--foreground)]">GitHub</EcosystemLink>
        </div>
      </div>
    </footer>
  );
}
