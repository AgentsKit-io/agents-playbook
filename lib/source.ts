import { docs } from "@/.source";
import { loader } from "fumadocs-core/source";

const mdxSource = docs.toFumadocsSource();
// fumadocs-core 15.8 reads `files` as an array; fumadocs-mdx 11.x exposes a thunk at runtime.
const files = (
  typeof mdxSource.files === "function" ? (mdxSource.files as () => unknown)() : mdxSource.files
) as typeof mdxSource.files;

export const source = loader({
  baseUrl: "/docs",
  source: { ...mdxSource, files },
});
