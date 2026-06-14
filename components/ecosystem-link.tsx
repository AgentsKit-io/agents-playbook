"use client";

import { track } from "@/lib/posthog-client";

interface EcosystemLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  placement: string;
  event?: "ecosystem_clicked" | "community_clicked";
  /** Which ecosystem property this points at — drives cross-property funnel analytics. */
  target?: string;
}

/**
 * Wraps outbound ecosystem links (agentskit.io / GitHub) to:
 *  1. Append UTM params on agentskit.io links.
 *  2. Fire a PostHog event on click, tagged with the destination property.
 */
export function EcosystemLink({
  href,
  className,
  children,
  placement,
  event = "ecosystem_clicked",
  target = "agentskit",
}: EcosystemLinkProps) {
  const resolvedHref = href.includes("agentskit.io")
    ? `${href}${href.includes("?") ? "&" : "?"}utm_source=playbook&utm_medium=${encodeURIComponent(placement)}&utm_campaign=ecosystem`
    : href;

  function handleClick() {
    if (event === "ecosystem_clicked") {
      track("ecosystem_clicked", { target, placement });
    } else {
      track("community_clicked", { target: "github", placement });
    }
  }

  return (
    <a
      href={resolvedHref}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
