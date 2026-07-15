"use client";

import { useState } from "react";
import Script from "next/script";
import { EcosystemBar } from "@/components/ecosystem-bar";

const SHARED_BAR_URL = "https://www.agentskit.io/ecosystem-bar.js";

/**
 * The central artifact remains authoritative. The local manifest-backed bar is
 * a fail-closed fallback while an older deployment or a network failure cannot
 * satisfy the seven-product contract.
 */
export function SharedEcosystemBar() {
  const [sharedReady, setSharedReady] = useState(false);

  function validateSharedBar() {
    requestAnimationFrame(() => {
      const shared = document.querySelector<HTMLElement>("#ak-eco");
      const productLinks = shared?.querySelectorAll(
        "a.ak-eco-link:not(.ak-eco-cta)",
      ).length ?? 0;
      if (shared && productLinks === 7) {
        setSharedReady(true);
        return;
      }
      shared?.setAttribute("hidden", "");
      setSharedReady(false);
    });
  }

  return (
    <>
      <Script
        src={SHARED_BAR_URL}
        strategy="afterInteractive"
        data-current="playbook"
        onLoad={validateSharedBar}
        onReady={validateSharedBar}
      />
      {sharedReady ? null : <EcosystemBar />}
    </>
  );
}
