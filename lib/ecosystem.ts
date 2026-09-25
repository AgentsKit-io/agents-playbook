import ecosystem from "../ecosystem.json";

/** Catalog order mirrors the canonical AgentsKit ecosystem.json. */
export const PRODUCT_IDS = [
  "agentskit",
  "registry",
  "agentskit-chat",
  "doc-bridge",
  "code-review",
  "harness",
  "playbook",
] as const;

/** Products listed in shared navigation (bar and tour). Playbook is not one. */
export const SHARED_NAV_PRODUCT_IDS = [
  "agentskit",
  "registry",
  "agentskit-chat",
  "doc-bridge",
  "code-review",
  "harness",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type EcosystemProduct = (typeof ecosystem.products)[number];

export const ecosystemProducts = [...ecosystem.products].sort(
  (a, b) => a.navigation.order - b.navigation.order,
);

/** The six products shown in the shared bar, tour, and footer. */
export const sharedNavProducts = ecosystemProducts.filter(
  (product) => product.navigation.showInBar,
);

export function ecosystemProduct(id: ProductId): EcosystemProduct {
  const product = ecosystemProducts.find((candidate) => candidate.id === id);
  if (!product) throw new Error(`Unknown ecosystem product: ${id}`);
  return product;
}

export function ecosystemPeers(current: ProductId): EcosystemProduct[] {
  return sharedNavProducts.filter((product) => product.id !== current);
}
