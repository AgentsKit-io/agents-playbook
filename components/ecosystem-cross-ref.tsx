import ecosystem from "@/ecosystem.json";
import { EcosystemLink } from "@/components/ecosystem-link";

/**
 * Compact ecosystem sentence for human landings.
 * Foundation → starting point → discipline → operation, with optional peers
 * available in the fuller grid below.
 */
const ORDER = ["agentskit", "registry", "playbook", "akos"] as const;

const CLAUSE: Record<string, { lead: string; label: string }> = {
  agentskit: { lead: "build on the", label: "AgentsKit foundation" },
  registry: { lead: "start from the", label: "Registry" },
  playbook: { lead: "ship with the", label: "Playbook" },
  akos: { lead: "operate on", label: "AKOS" },
};

export function EcosystemCrossRef({
  current,
  placement,
  className,
  linkClassName = "font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 hover:decoration-current",
}: {
  current: (typeof ORDER)[number];
  placement: string;
  className?: string;
  linkClassName?: string;
}) {
  const byId = Object.fromEntries(ecosystem.properties.map((p) => [p.id, p]));

  return (
    <p className={className}>
      Part of the AgentsKit ecosystem:{" "}
      {ORDER.map((id, i) => {
        const c = CLAUSE[id];
        const p = byId[id];
        const last = i === ORDER.length - 1;
        const sep = i === 0 ? "" : last ? ", and " : ", ";
        const label =
          id === current ? (
            <span className="font-medium text-[color:var(--foreground)]">
              {c.label}
            </span>
          ) : (
            <EcosystemLink
              href={p.url}
              placement={placement}
              target={id}
              className={linkClassName}
            >
              {c.label}
            </EcosystemLink>
          );
        return (
          <span key={id}>
            {sep}
            {c.lead} {label}
          </span>
        );
      })}
      . Also:{" "}
      <EcosystemLink
        href="https://chat.agentskit.io/"
        placement={placement}
        target="agentskit-chat"
        className={linkClassName}
      >
        Chat
      </EcosystemLink>
      ,{" "}
      <EcosystemLink
        href="https://agentskit-io.github.io/doc-bridge/"
        placement={placement}
        target="doc-bridge"
        className={linkClassName}
      >
        Doc Bridge
      </EcosystemLink>
      , and{" "}
      <EcosystemLink
        href="https://github.com/AgentsKit-io/code-review-cli#readme"
        placement={placement}
        target="code-review"
        className={linkClassName}
      >
        Code Review
      </EcosystemLink>
      .
    </p>
  );
}
