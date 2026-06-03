import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles, Download, FileText } from "lucide-react";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent-gradient text-white">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>Agents Playbook</span>
          </Link>
        ),
        url: "/",
      }}
      links={[
        { text: "Matrix", url: "/docs/matrix" },
        { text: "Glossary", url: "/docs/glossary" },
        {
          text: "llms.txt",
          url: "/llms.txt",
          icon: <FileText className="h-3.5 w-3.5" />,
          external: true,
        },
        {
          text: "Bundle",
          url: "/playbook-bundle.zip",
          icon: <Download className="h-3.5 w-3.5" />,
          external: true,
        },
      ]}
      githubUrl="https://github.com/AgentsKit-io/agents-playbook"
      sidebar={{
        defaultOpenLevel: 1,
        collapsible: true,
      }}
    >
      {children}
    </DocsLayout>
  );
}
