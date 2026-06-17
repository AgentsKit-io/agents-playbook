"use client";

import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copies a literal string (the onboarding prompt) to the clipboard.
 * Distinct from CopyMarkdown, which fetches a raw doc by URL.
 */
export function CopyPrompt({
  text,
  label = "Copy prompt",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-3)] ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-[color:var(--success)]" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {label}
        </>
      )}
    </button>
  );
}
