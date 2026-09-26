import Script from "next/script";
import { createElement } from "react";
import { sharedNavProducts } from "@/lib/ecosystem";
import {
  SHELL_CURRENT,
  SHELL_CURRENT_REPO,
  SHELL_LICENSE,
  SHELL_SCRIPT_URL,
  SHELL_STYLESHEET_URL,
} from "@/lib/shell";

/** Shared v1 tokens, Space Grotesk headings, wordmark, footer and aurora styles. */
export function AgentsKitShellStylesheet() {
  return <link rel="stylesheet" href={SHELL_STYLESHEET_URL} precedence="default" />;
}

/**
 * Loads shell v1. The script auto-injects the ecosystem bar at the top of
 * <body> and upgrades <agentskit-*> elements. It runs after hydration so the
 * server-rendered footer fallback is hydrated before v1.js replaces it.
 */
export function AgentsKitShellScript() {
  return (
    <Script
      id="agentskit-shell-v1"
      src={SHELL_SCRIPT_URL}
      strategy="afterInteractive"
      data-current={SHELL_CURRENT}
      data-current-repo={SHELL_CURRENT_REPO}
    />
  );
}

/** Fixed, decorative background layer rendered once per page. */
export function AgentsKitAurora() {
  return createElement("agentskit-aurora", { "aria-hidden": "true" });
}

/**
 * Shared ecosystem footer. The static fallback keeps product, repository and
 * license links in the server HTML for crawlers and no-JS readers; v1.js
 * replaces it with the canonical footer on upgrade.
 */
export function AgentsKitFooter() {
  const repoUrl = `https://github.com/${SHELL_CURRENT_REPO}`;
  return createElement(
    "agentskit-footer",
    { current: SHELL_CURRENT, repo: SHELL_CURRENT_REPO, license: SHELL_LICENSE },
    <footer className="ak-footer-fallback" aria-label="AgentsKit ecosystem">
      <nav aria-label="AgentsKit products">
        <ul>
          {sharedNavProducts.map((product) => (
            <li key={product.id}>
              <a href={product.surfaces.home}>{product.shortName}</a>
            </li>
          ))}
        </ul>
      </nav>
      <p>
        <a href={repoUrl}>{SHELL_CURRENT_REPO}</a>
        {" · "}
        <a href={`${repoUrl}/blob/main/LICENSE`}>MIT (code)</a>
        {" · "}
        <a href={`${repoUrl}/blob/main/LICENSE-CONTENT`}>CC-BY-4.0 (docs)</a>
      </p>
    </footer>,
  );
}
