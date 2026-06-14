import ecosystem from "@/ecosystem.json";
import { EcosystemLink } from "@/components/ecosystem-link";

/**
 * The canonical one-line ecosystem sentence, shared verbatim across every
 * AgentsKit property. Pass the current property's id — it renders bold/plain,
 * the other three render as tracked outbound links in the same fixed order:
 * framework → registry → playbook → akos.
 *
 * Drop this identical component into agentskit / registry / akos with a
 * different `current` and the whole family reads the same narrative.
 */
const ORDER = ["agentskit", "registry", "playbook", "akos"] as const;

// Per-property clause: the connective text + the link label. Keep these strings
// identical across all sibling repos so the sentence is verbatim everywhere.
const CLAUSE: Record<string, { lead: string; label: string }> = {
  agentskit: { lead: "build with the", label: "framework" },
  registry: { lead: "grab ready-made agents from the", label: "Registry" },
  playbook: { lead: "ship by the", label: "Playbook" },
  akos: { lead: "run them in production on", label: "AKOS" },
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
      .
    </p>
  );
}
