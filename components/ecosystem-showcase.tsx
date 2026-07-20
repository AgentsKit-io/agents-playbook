import { createElement } from "react";

export function EcosystemShowcase() {
  return createElement(
    "agentskit-ecosystem",
    { current: "playbook" },
    <section className="relative z-10 border-y border-[color:var(--border)] px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">The AgentsKit ecosystem</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Build the agent. Then take it all the way.
        </h2>
        <p className="mt-4 max-w-2xl text-[color:var(--muted)]">
          One connected toolkit from ready-made source to governed production.
        </p>
      </div>
    </section>,
  );
}
