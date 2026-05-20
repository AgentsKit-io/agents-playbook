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
  Download,
} from "lucide-react";

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
    body: "13 reference gate scripts (Node 22, zero deps) you can drop into any repo. Pure copy-paste.",
  },
  {
    icon: Zap,
    title: "Drop-in templates",
    body: "ADR, RFC, PR-intent, CLAUDE.md, AGENTS.md, MEMORY.md — ready for any project.",
  },
];

const STATS = [
  { label: "Pillars", value: "6" },
  { label: "Patterns", value: "70+" },
  { label: "Gate scripts", value: "13" },
  { label: "SDLC phases", value: "6" },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-hero-gradient" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" aria-hidden />

      <SiteHeader />

      <Hero />

      <Stats />

      <Features />

      <PillarShowcase />

      <AgentFriendly />

      <CTASection />

      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent-gradient text-white shadow-glow-purple">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
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
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
        >
          <Github className="h-3.5 w-3.5" aria-hidden />
          GitHub
        </a>
      </nav>
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
            v0.1 · CC-BY-4.0
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            The gold-standard playbook for shipping production software with
            {" "}
            <span className="text-accent-gradient">AI coding agents</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-[color:var(--muted-foreground)]">
            Pillars, patterns, prompts, and gates earned from a year of agent-driven
            development on a real production codebase. Drop-in templates,
            ready-to-run gate scripts, and a structure built for both humans and
            agents.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/docs"
              className="group inline-flex items-center gap-2 rounded-md bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow-purple transition hover:bg-accent-gradient-hover"
            >
              Read the playbook
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/docs/templates/CLAUDE.md.template"
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
            >
              Start from CLAUDE.md
            </Link>
            <a
              href="/playbook-bundle.zip"
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] px-5 py-2.5 text-sm font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            >
              <Download className="h-4 w-4" aria-hidden />
              Bundle (.zip)
            </a>
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
        className="absolute -inset-1 rounded-2xl bg-accent-gradient opacity-40 blur-xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-1)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] opacity-70" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--warning)] opacity-70" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--success)] opacity-70" aria-hidden />
          <span className="ml-3 text-xs text-[color:var(--subtle-foreground)] font-mono">CLAUDE.md</span>
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

function Stats() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl border-t border-[color:var(--border)] px-6 py-12">
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-4xl font-semibold tracking-tight text-accent-gradient">
              {s.value}
            </div>
            <div className="mt-1 text-sm uppercase tracking-wider text-[color:var(--muted-foreground)]">
              {s.label}
            </div>
          </div>
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
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-5 font-mono text-[12.5px] leading-relaxed text-[color:var(--muted-foreground)]">
            <pre>{`# fetch raw markdown from any doc
curl https://agents-playbook.dev/raw/pillars/architecture/universal.md

# one-shot bundle for RAG indexing
curl https://agents-playbook.dev/llms-full.txt

# zip everything
curl -O https://agents-playbook.dev/playbook-bundle.zip`}</pre>
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
            <Link
              href="/docs/matrix"
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-2)]"
            >
              See the matrix
            </Link>
          </div>
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

function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 text-sm text-[color:var(--muted-foreground)] sm:flex-row sm:items-center">
        <div>
          <div className="font-semibold text-[color:var(--foreground)]">Agents Playbook</div>
          <div className="mt-1">CC-BY-4.0 · Adapt freely · Attribution appreciated.</div>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link href="/docs" className="hover:text-[color:var(--foreground)]">Docs</Link>
          <Link href="/docs/glossary" className="hover:text-[color:var(--foreground)]">Glossary</Link>
          <Link href="/docs/matrix" className="hover:text-[color:var(--foreground)]">Matrix</Link>
          <Link href="/llms.txt" className="hover:text-[color:var(--foreground)]">llms.txt</Link>
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="hover:text-[color:var(--foreground)]">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
