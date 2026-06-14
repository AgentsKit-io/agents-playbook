import { source } from "@/lib/source";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { CopyMarkdown } from "@/components/copy-markdown";
import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://playbook.agentskit.io";

function docUrl(slug?: string[]): string {
  const path = (slug ?? []).join("/");
  return path ? `${SITE_URL}/docs/${path}` : `${SITE_URL}/docs`;
}

// Serialize JSON-LD safely: escape `<` so a `</script>` in any field can't
// break out of the script element. Content is build-time/trusted, but this is
// the standard hardening for inline JSON-LD.
function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const slug = params.slug ?? [];
  const rawPath = `/raw/${slug.join("/")}.md`;
  const canonical = docUrl(slug);

  // Per-page structured data: a technical article + breadcrumb trail.
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.data.title,
    description: page.data.description,
    url: canonical,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: "Agents Playbook", url: SITE_URL },
    license: "https://creativecommons.org/licenses/by/4.0/",
  };
  const crumbItems = [
    { name: "Playbook", url: `${SITE_URL}/docs` },
    ...slug.map((seg, i) => ({
      name: seg.replace(/-/g, " "),
      url: `${SITE_URL}/docs/${slug.slice(0, i + 1).join("/")}`,
    })),
  ];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbItems.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      editOnGithub={{
        owner: "AgentsKit-io",
        repo: "agents-playbook",
        sha: "main",
        path: `content/docs/${page.file?.path ?? ""}`,
      }}
      tableOfContent={{
        style: "clerk",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }}
      />
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description ? (
        <DocsDescription>{page.data.description}</DocsDescription>
      ) : null}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <CopyMarkdown rawPath={rawPath} />
        <Link
          href={rawPath}
          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-2.5 py-1 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
          View raw .md
        </Link>
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return {};
  const canonical = docUrl(params.slug);
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical },
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url: canonical,
      type: "article",
      siteName: "Agents Playbook",
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
    },
  };
}
