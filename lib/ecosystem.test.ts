import { describe, expect, it } from "vitest";
import ecosystem from "../ecosystem.json";
import {
  ecosystemPeers,
  ecosystemProduct,
  ecosystemProducts,
  PRODUCT_IDS,
  SHARED_NAV_PRODUCT_IDS,
  sharedNavProducts,
} from "./ecosystem";

describe("ecosystem contract", () => {
  it("mirrors the canonical catalog order", () => {
    expect(ecosystemProducts.map((product) => product.id)).toEqual(PRODUCT_IDS);
    expect(ecosystem.properties.map((property) => property.id)).toEqual([
      "agentskit",
      "playbook",
      "registry",
    ]);
  });

  it("lists exactly six products in shared navigation, without the Playbook", () => {
    expect(sharedNavProducts.map((product) => product.id)).toEqual(SHARED_NAV_PRODUCT_IDS);
    expect(ecosystemProduct("playbook").navigation.showInBar).toBe(false);
    expect(ecosystem.properties.find((property) => property.id === "playbook")?.showInBar).toBe(false);
  });

  it("gives the Playbook the six shared products as continuation targets", () => {
    const peers = ecosystemPeers("playbook");
    expect(peers.map((product) => product.id)).toEqual(SHARED_NAV_PRODUCT_IDS);
  });

  it("routes strategic hooks to canonical documentation surfaces", () => {
    expect(ecosystemProduct("registry").surfaces.docs).toBe(
      "https://registry.agentskit.io/docs",
    );
    expect(ecosystemProduct("agentskit-chat").surfaces.docs).toBe(
      "https://chat.agentskit.io/docs",
    );
    expect(ecosystemProduct("doc-bridge").surfaces.docs).toBe(
      "https://doc-bridge.agentskit.io/",
    );
    expect(ecosystemProduct("harness").surfaces.docs).toBe(
      "https://harness.agentskit.io/docs",
    );
  });

  it("publishes an llms surface for every product", () => {
    for (const product of ecosystemProducts) {
      expect(product.surfaces.llms).toMatch(/^https:\/\//);
    }
  });

  it("keeps retired products out of the public catalog", () => {
    const raw = JSON.stringify(ecosystem).toLowerCase();
    expect(raw).not.toContain("akos");
    expect(raw).not.toContain("agentskit os");
  });
});
