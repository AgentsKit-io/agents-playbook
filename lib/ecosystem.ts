import ecosystem from "../ecosystem.json";

export const PRODUCT_IDS = [
  "agentskit",
  "registry",
  "agentskit-chat",
  "playbook",
  "doc-bridge",
  "code-review",
  "akos",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type EcosystemProduct = (typeof ecosystem.products)[number];

export const ecosystemProducts = [...ecosystem.products].sort(
  (a, b) => a.navigation.order - b.navigation.order,
);

export function ecosystemProduct(id: ProductId): EcosystemProduct {
  const product = ecosystemProducts.find((candidate) => candidate.id === id);
  if (!product) throw new Error(`Unknown ecosystem product: ${id}`);
  return product;
}

export function ecosystemPeers(current: ProductId): EcosystemProduct[] {
  return ecosystemProducts.filter((product) => product.id !== current);
}
