import { EcosystemLink } from "@/components/ecosystem-link";
import { ecosystemProducts } from "@/lib/ecosystem";

export function EcosystemBar() {
  return (
    <nav
      aria-label="AgentsKit ecosystem"
      className="relative z-40 border-b border-[color:var(--border)] bg-[#090b10] text-xs text-slate-300"
    >
      <div className="mx-auto grid min-h-11 max-w-7xl grid-cols-4 items-stretch px-2 sm:flex sm:items-center sm:px-6">
        {ecosystemProducts.map((product) => {
          const current = product.id === "playbook";
          return (
            <EcosystemLink
              key={product.id}
              href={current ? "/" : product.surfaces.home}
              placement="ecosystem_bar"
              target={product.id}
              newTab={false}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center border-b-2 px-2 text-center transition sm:flex-1 sm:px-3 ${
                current
                  ? "border-violet-400 bg-white/5 font-semibold text-white"
                  : "border-transparent hover:border-slate-600 hover:text-white"
              }`}
            >
              {product.shortName}
            </EcosystemLink>
          );
        })}
      </div>
    </nav>
  );
}
