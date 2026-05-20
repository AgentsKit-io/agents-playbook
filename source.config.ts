import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig({
  mdxOptions: {
    // Allow raw HTML-looking angle brackets in templates (e.g. <issue#>)
    // by stripping the unhandled raw node before estree conversion.
    remarkRehypeOptions: {
      passThrough: ["raw"],
    },
  },
});
