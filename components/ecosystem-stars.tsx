"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { track } from "@/lib/posthog-client";

/**
 * Combined GitHub star count across the whole AgentsKit ecosystem (framework +
 * registry + playbook + AKOS). Any single repo is still young, but the family
 * total is a credible social-proof number — so we sum them and show one figure
 * in the header. The same-origin route caches and bounds GitHub requests so a
 * public API limit never leaks browser errors into the experience.
 */
export function EcosystemStars({
  repos,
  org = "AgentsKit-io",
}: {
  repos: string[];
  org?: string;
}) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/ecosystem-stars")
      .then((response) => response.ok ? response.json() as Promise<unknown> : null)
      .then((value) => {
      if (!active) return;
      if (value && typeof value === "object" && "total" in value && typeof value.total === "number" && value.total > 0) setTotal(value.total);
    })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [repos]);

  const formatted =
    total === null
      ? null
      : total >= 1000
        ? `${(total / 1000).toFixed(1)}k`
        : String(total);

  return (
    <a
      href={`https://github.com/${org}`}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("community_clicked", { target: "github", placement: "header_total" })}
      title="Total stars across the AgentsKit ecosystem"
      className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-2.5 py-1.5 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-2)]"
    >
      <Star className="h-3.5 w-3.5 text-[color:var(--warning)]" aria-hidden />
      <span className="font-mono text-xs">{formatted ?? "★"}</span>
      <span className="hidden sm:inline text-[color:var(--muted-foreground)]">ecosystem</span>
    </a>
  );
}
