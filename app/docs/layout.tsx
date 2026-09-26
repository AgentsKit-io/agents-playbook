import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { Download, FileText } from "lucide-react";
import { ProductWordmark } from "@/components/product-wordmark";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: <ProductWordmark />,
        url: "/",
      }}
      links={[
        { text: "For agents", url: "/for-agents" },
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
      // Playbook is dark-only (forcedTheme in the root layout), so a theme
      // toggle would be a control that does nothing.
      themeSwitch={{ enabled: false }}
      sidebar={{
        defaultOpenLevel: 1,
        collapsible: true,
      }}
    >
      {children}
    </DocsLayout>
  );
}
