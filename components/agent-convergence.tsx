/**
 * Convergence visual: the coding agents you already use flow along animated
 * arcs INTO the playbook, which fans out into the outcomes it guarantees —
 * code that's reviewable, secure, and shippable. Decorative SVG is aria-hidden;
 * the DOM carries the semantics. Pure presentational, no client state.
 */
import { Eye, ShieldCheck, Rocket, type LucideIcon } from "lucide-react";
import { AGENT_MARKS } from "@/components/agent-marks";

const CORE = "Playbook";
const CORE_CHIPS = ["Rules", "Gates", "Patterns", "Prompts", "Templates", "Scripts"];

const OUTCOMES: readonly { label: string; desc: string; icon: LucideIcon }[] = [
  {
    label: "Reviewable",
    desc: "Sized files, named exports, no nested-ternary soup — diffs a human can actually read, understand, and approve without rubber-stamping.",
    icon: Eye,
  },
  {
    label: "Secure",
    desc: "Patterns and gates for secrets, auth boundaries, and safe defaults — security designed into the contract, not bolted on after a leak. Production runtime enforcement lives in AKOS when you need it.",
    icon: ShieldCheck,
  },
  {
    label: "Shippable",
    desc: "Tests in the diff, gates green, complete-or-it-doesn't-ship — no half-built screens marked done, no stale branches grinding against main.",
    icon: Rocket,
  },
];

// Arc geometry (viewBox 1000×460) — mirrors the ecosystem hero math.
const CORE_IN = { x: 430, y: 230 };
const CORE_OUT = { x: 570, y: 230 };
const SOURCE_YS = [120, 195, 265, 340];
const DEST_YS = [130, 230, 330];
const SOURCE_X = 210;
const DEST_X = 800;

const inflow = (y: number): string =>
  `M ${SOURCE_X} ${y} C ${SOURCE_X + 150} ${y}, ${CORE_IN.x - 120} ${CORE_IN.y}, ${CORE_IN.x} ${CORE_IN.y}`;
const outflow = (y: number): string =>
  `M ${CORE_OUT.x} ${CORE_OUT.y} C ${CORE_OUT.x + 120} ${CORE_OUT.y}, ${DEST_X - 150} ${y}, ${DEST_X} ${y}`;

function Arcs() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 460"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
    >
      <defs>
        <radialGradient id="pb-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="500" cy="230" r="200" fill="url(#pb-core-glow)" />
      {SOURCE_YS.map((y) => (
        <g key={`in-${y}`}>
          <path d={inflow(y)} fill="none" stroke="var(--border-strong)" strokeWidth="1.25" opacity="0.6" />
          <path d={inflow(y)} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" className="ak-flow" />
        </g>
      ))}
      {DEST_YS.map((y) => (
        <g key={`out-${y}`}>
          <path d={outflow(y)} fill="none" stroke="var(--border-strong)" strokeWidth="1.25" opacity="0.6" />
          <path d={outflow(y)} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" className="ak-flow-out" />
        </g>
      ))}
    </svg>
  );
}

export function AgentConvergence() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="relative px-1 sm:px-3 md:aspect-[1000/460] md:px-4">
        <Arcs />
        <div className="relative grid h-full grid-cols-1 items-stretch gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.95fr)] md:gap-0">
          {/* sources — the coding agents you already run */}
          <div
            className="grid h-full grid-cols-2 grid-rows-4 gap-2.5 sm:gap-3"
            role="img"
            aria-label="Coding agents the playbook works with"
          >
            {AGENT_MARKS.map((m) => (
              <div
                key={m.title}
                className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-1)] px-3 py-3 text-center"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6 shrink-0 text-[color:var(--foreground)]" fill="currentColor">
                  <title>{m.title}</title>
                  <path d={m.path} />
                </svg>
                <span className="text-xs text-[color:var(--muted-foreground)]">{m.title}</span>
              </div>
            ))}
          </div>

          {/* the playbook core */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-[260px] rounded-2xl border border-[color:var(--accent-strong)] bg-[color:var(--surface-2)] p-4 text-center ring-glow">
              <div className="flex items-center justify-center gap-2 text-base font-semibold tracking-tight">
                <svg viewBox="0 0 72 64" fill="none" className="h-5 w-5" aria-hidden>
                  <g stroke="#2997ff" strokeWidth="3" strokeLinecap="round">
                    <line x1="12" y1="52" x2="36" y2="12" />
                    <line x1="36" y1="12" x2="60" y2="52" />
                    <line x1="12" y1="52" x2="60" y2="52" />
                  </g>
                  <circle cx="36" cy="12" r="6" fill="#2997ff" />
                  <circle cx="12" cy="52" r="6" fill="#2997ff" />
                  <circle cx="60" cy="52" r="6" fill="#2997ff" />
                </svg>
                {CORE}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {CORE_CHIPS.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-1.5 py-1 text-[11px] text-[color:var(--muted-foreground)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* outcomes — what comes out the other side */}
          <div className="flex h-full flex-col gap-2.5 sm:gap-3 md:pl-2">
            {OUTCOMES.map(({ label, desc, icon: Icon }) => (
              <div
                key={label}
                className="flex min-h-[84px] flex-1 flex-col justify-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-1)] px-4 py-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-2)] text-[color:var(--accent-strong)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-[color:var(--foreground)]">{label}</span>
                </div>
                <p className="text-xs leading-relaxed text-[color:var(--subtle-foreground)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
