import { EcosystemLink } from "@/components/ecosystem-link";
import { ecosystemPeers, type ProductId } from "@/lib/ecosystem";

/** Compact sibling discovery for narrative surfaces. */
const ACTION: Record<ProductId, string> = {
  agentskit: "build with",
  registry: "start from",
  "agentskit-chat": "deliver chat with",
  playbook: "apply discipline with",
  "doc-bridge": "connect docs through",
  "code-review": "verify with",
  akos: "operate at enterprise scale with",
};

export function EcosystemCrossRef({
  current,
  placement,
  className,
  linkClassName = "font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 hover:decoration-current",
}: {
  current: ProductId;
  placement: string;
  className?: string;
  linkClassName?: string;
}) {
  const peers = ecosystemPeers(current);

  return (
    <p className={className}>
      Continue through the AgentsKit ecosystem:{" "}
      {peers.map((product, index) => {
        const last = index === peers.length - 1;
        const separator = index === 0 ? "" : last ? ", or " : ", ";
        return (
          <span key={product.id}>
            {separator}
            {ACTION[product.id as ProductId]}{" "}
            <EcosystemLink
              href={product.surfaces.docs}
              placement={placement}
              target={product.id}
              className={linkClassName}
            >
              {product.shortName}
            </EcosystemLink>
          </span>
        );
      })}
      .
    </p>
  );
}
