import { describe, expect, it } from "vitest";
import {
  ecosystemPeers,
  ecosystemProduct,
  ecosystemProducts,
  PRODUCT_IDS,
} from "./ecosystem";

describe("ecosystem contract", () => {
  it("keeps one canonical seven-product workflow", () => {
    expect(ecosystemProducts.map((product) => product.id)).toEqual(PRODUCT_IDS);
    expect(new Set(ecosystemProducts.map((product) => product.id))).toHaveLength(7);
  });

  it("gives the Playbook exactly six continuation targets", () => {
    const peers = ecosystemPeers("playbook");
    expect(peers).toHaveLength(6);
    expect(peers.map((product) => product.id)).not.toContain("playbook");
  });

  it("routes strategic hooks to canonical documentation surfaces", () => {
    expect(ecosystemProduct("registry").surfaces.docs).toBe(
      "https://registry.agentskit.io/docs",
    );
    expect(ecosystemProduct("agentskit-chat").surfaces.docs).toBe(
      "https://chat.agentskit.io/docs",
    );
    expect(ecosystemProduct("doc-bridge").surfaces.docs).toBe(
      "https://agentskit-io.github.io/doc-bridge/",
    );
    expect(ecosystemProduct("akos").surfaces.docs).toBe(
      "https://akos.agentskit.io/docs",
    );
  });

  it("publishes an llms surface for every product", () => {
    for (const product of ecosystemProducts) {
      expect(product.surfaces.llms).toMatch(/^https:\/\//);
    }
  });
});
