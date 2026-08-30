"use client";

import { Search } from "lucide-react";
import { useSearchContext } from "fumadocs-ui/provider";

export function SiteSearchTrigger() {
  const { setOpenSearch } = useSearchContext();

  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-3 text-sm text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--surface-2)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-strong)]"
      aria-label="Search the Playbook"
    >
      <Search className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded border border-[color:var(--border)] px-1.5 py-0.5 font-mono text-[10px] lg:inline">
        ⌘K
      </kbd>
    </button>
  );
}
