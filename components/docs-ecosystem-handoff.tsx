import { EcosystemLink } from "@/components/ecosystem-link";
import { ecosystemProduct, type ProductId } from "@/lib/ecosystem";

const HANDOFFS: { id: ProductId; when: string }[] = [
  { id: "doc-bridge", when: "Make repository documentation executable" },
  { id: "agentskit-chat", when: "Build a reusable conversational experience" },
  { id: "code-review", when: "Verify an agent-authored change before merge" },
  { id: "akos", when: "Move governance and operations to enterprise scale" },
];

export function DocsEcosystemHandoff() {
  return (
    <aside className="not-prose mt-12 border-t border-[color:var(--border)] pt-8" aria-labelledby="ecosystem-handoff-title">
      <h2 id="ecosystem-handoff-title" className="text-xl font-semibold">
        Continue when the problem changes
      </h2>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
        Keep the Playbook as the discipline layer and hand off the next concern to its owner.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {HANDOFFS.map(({ id, when }) => {
          const product = ecosystemProduct(id);
          return (
            <EcosystemLink
              key={id}
              href={product.surfaces.docs}
              placement="docs_handoff"
              target={id}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-1)] p-4 hover:bg-[color:var(--surface-2)]"
            >
              <span className="block text-xs uppercase tracking-wide text-[color:var(--subtle-foreground)]">
                {when}
              </span>
              <span className="mt-1 block font-medium text-[color:var(--foreground)]">
                {product.name} →
              </span>
            </EcosystemLink>
          );
        })}
      </div>
    </aside>
  );
}
