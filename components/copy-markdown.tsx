"use client";

import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copies the page's raw markdown (fetched from its /raw/*.md route) to the
 * clipboard. Lets an agent or human grab the whole source of any doc in one
 * click — the page-level analogue of a code block's copy button.
 */
export function CopyMarkdown({ rawPath }: { rawPath: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const onClick = useCallback(async () => {
    try {
      const res = await fetch(rawPath);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [rawPath]);

  const label =
    state === "copied"
      ? "Copied!"
      : state === "error"
        ? "Copy failed"
        : "Copy as Markdown";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy this page as Markdown"
      className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-1)] px-2.5 py-1 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
    >
      {state === "copied" ? (
        <Check className="h-3 w-3" aria-hidden />
      ) : (
        <Copy className="h-3 w-3" aria-hidden />
      )}
      {label}
    </button>
  );
}
