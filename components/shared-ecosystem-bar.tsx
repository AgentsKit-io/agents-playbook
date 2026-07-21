"use client";

import { useState } from "react";
import Script from "next/script";

const SHARED_BAR_URL = "https://www.agentskit.io/ecosystem-bar.js";

/**
 * The central artifact remains authoritative. The local manifest-backed bar is
 * a fail-closed fallback while an older deployment or a network failure cannot
 * satisfy the six-product public contract.
 */
export function SharedEcosystemBar() {
  const [sharedReady, setSharedReady] = useState(false);

  function validateSharedBar() {
    requestAnimationFrame(() => {
      const shared = document.querySelector<HTMLElement>("#ak-eco");
      const productLinks = shared?.querySelectorAll(
        "a.ak-eco-link:not(.ak-eco-cta)",
      ).length ?? 0;
      if (shared && productLinks > 0) {
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
      {sharedReady ? null : (
        <div className="relative z-40 flex min-h-11 items-center justify-center border-b border-[color:var(--border)] bg-[#090b10] px-4 text-xs text-slate-300" role="status">
          Loading AgentsKit ecosystem navigation…
        </div>
      )}
    </>
  );
}
