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

function productHome(id: string): string {
  const product = ecosystem.products.find((candidate) => candidate.id === id);
  if (!product) throw new Error(`Unknown ecosystem product: ${id}`);
  return product.surfaces.home;
}

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
  const byId = Object.fromEntries(ecosystem.products.map((product) => [product.id, product]));

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
              href={p.surfaces.home}
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
        href={productHome("agentskit-chat")}
        placement={placement}
        target="agentskit-chat"
        className={linkClassName}
      >
        Chat
      </EcosystemLink>
      {" and "}
      <EcosystemLink
        href={productHome("doc-bridge")}
        placement={placement}
        target="doc-bridge"
        className={linkClassName}
      >
        Doc Bridge
      </EcosystemLink>
      .
    </p>
  );
}
