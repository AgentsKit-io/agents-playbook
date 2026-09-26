/**
 * Same-origin files served outside the App Router pages (the ZIP bundle,
 * llms*.txt, raw markdown, JSON, API routes). Rendering them through
 * next/link makes Next prefetch an RSC payload that does not exist (404), so
 * they are plain anchors instead.
 */
export function isNonPageHref(href: string | undefined): boolean {
  if (!href || !href.startsWith("/")) return false;
  const path = href.split(/[?#]/)[0];
  return (
    /\.(zip|txt|md|mdx|json|xml)$/i.test(path) ||
    path.startsWith("/raw/") ||
    path.startsWith("/api/")
  );
}
