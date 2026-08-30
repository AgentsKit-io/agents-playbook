"use client";

import { track } from "@/lib/posthog-client";

interface EcosystemLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> {
  href: string;
  placement: string;
  event?: "ecosystem_clicked" | "community_clicked";
  newTab?: boolean;
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
  newTab = true,
  target = "agentskit",
  ...anchorProps
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
      {...anchorProps}
      href={resolvedHref}
      target={newTab && !href.startsWith("/") ? "_blank" : undefined}
      rel={newTab && !href.startsWith("/") ? "noreferrer" : undefined}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
