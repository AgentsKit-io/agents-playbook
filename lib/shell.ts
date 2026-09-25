/**
 * AgentsKit shell v1 (bar, tour, footer, aurora, shared tokens).
 * The origin is overridable for local review, e.g. http://localhost:3000.
 */
export const SHELL_ORIGIN = (
  process.env.NEXT_PUBLIC_AGENTSKIT_SHELL_ORIGIN || "https://www.agentskit.io"
).replace(/\/+$/, "");

export const SHELL_SCRIPT_URL = `${SHELL_ORIGIN}/shell/v1.js`;
export const SHELL_STYLESHEET_URL = `${SHELL_ORIGIN}/shell/v1.css`;

/** Playbook loads the shell but is not listed in shared navigation. */
export const SHELL_CURRENT = "playbook";
export const SHELL_CURRENT_REPO = "AgentsKit-io/agents-playbook";
