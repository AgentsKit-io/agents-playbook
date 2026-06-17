import { defineDocs, defineConfig } from "fumadocs-mdx/config";

// Open Knowledge Format (OKF) alignment: every doc carries an OKF `type` (and
// optional tags/timestamp/resource) in its YAML frontmatter — see
// docs/pillars/ai-collaboration/open-knowledge-format-pattern and the
// `check:okf-type` gate. fumadocs' default frontmatter schema tolerates these
// extra keys (they're ignored for rendering) and they are served verbatim in
// the raw markdown at /raw/<path>.md, which is what OKF consumers read.
export const docs = defineDocs({
  dir: "content/docs",
});

/**
 * Auto-styles every "**Failure mode prevented:** …" paragraph as a warning
 * callout. The playbook's whole thesis is "each rule fixes a real failure mode",
 * so we surface those lines visually across all docs — no per-file edits, no
 * JSX in the content. Adds a class the docs CSS targets (.callout-failure-mode).
 */
function remarkFailureMode() {
  function isFailureMode(p: any): boolean {
    const first = p.children?.[0];
    if (!first || first.type !== "strong") return false;
    const text = first.children?.[0]?.value ?? "";
    return /^Failure mode prevented/i.test(text);
  }

  function walk(node: any): void {
    if (!node || !Array.isArray(node.children)) return;
    for (const child of node.children) {
      if (child?.type === "paragraph" && isFailureMode(child)) {
        child.data = child.data ?? {};
        child.data.hProperties = {
          ...(child.data.hProperties ?? {}),
          className: ["callout-failure-mode"],
        };
      }
      walk(child);
    }
  }

  return (tree: unknown) => {
    walk(tree);
  };
}

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkFailureMode],
  },
});
