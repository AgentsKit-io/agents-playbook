"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

interface AskWidgetProps {
  endpoint?: string;
  corpus: string;
  title: string;
  fabLabel: string;
  placeholder: string;
  emptyState: string;
  accent: string;
  cta?: { label: string; href: string };
}

const DEFAULT_ENDPOINT = process.env.NEXT_PUBLIC_ASK_ENDPOINT ?? "https://ask.agentskit.io/v1/ask";

function endpointWithCorpus(endpoint: string, corpus: string): string {
  const url = new URL(endpoint, typeof window === "undefined" ? "https://playbook.agentskit.io" : window.location.origin);
  url.searchParams.set("corpus", corpus);
  return endpoint.startsWith("/") ? `${url.pathname}${url.search}` : url.toString();
}

function decodeNdjson(buffer: string): { events: Array<{ type: string; delta?: string; message?: string }>; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events = lines.flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [];
    try {
      return [JSON.parse(trimmed) as { type: string; delta?: string; message?: string }];
    } catch {
      return [];
    }
  });
  return { events, rest };
}

function LogoMark({ size = 16 }: { size?: number }) {
  const height = Math.round((size * 64) / 72);
  return (
    <svg width={size} height={height} viewBox="0 0 72 64" fill="none" aria-hidden="true">
      <line x1="12" y1="52" x2="36" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="12" x2="60" y2="52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="52" x2="60" y2="52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="36" cy="12" r="6" fill="currentColor" />
      <circle cx="12" cy="52" r="6" fill="currentColor" />
      <circle cx="60" cy="52" r="6" fill="currentColor" />
    </svg>
  );
}

function TextWithLinks({ content }: { content: string }) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(content.slice(cursor, index));
    const label = match[1] || match[3] || "";
    const href = match[2] || match[3] || "";
    nodes.push(
      <a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer">
        {label}
      </a>,
    );
    cursor = index + match[0].length;
  }
  if (cursor < content.length) nodes.push(content.slice(cursor));
  return <>{nodes}</>;
}

export function AskWidget({
  endpoint = DEFAULT_ENDPOINT,
  corpus,
  title,
  fabLabel,
  placeholder,
  emptyState,
  accent,
  cta,
}: AskWidgetProps) {
  const storageKey = `ak:ask-thread-v2:${corpus}`;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
    } catch {
      /* ignore storage failures */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore storage failures */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, storageKey]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(endpointWithCorpus(endpoint, corpus), {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const decoded = decodeNdjson(buffer);
        buffer = decoded.rest;
        for (const ev of decoded.events) {
          if (ev.type === "error") setError(ev.message ?? "The assistant could not answer.");
          if (ev.type === "text" && ev.delta) {
            setMessages((prev) => {
              const copy = prev.slice();
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + ev.delta };
              return copy;
            });
          }
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [corpus, endpoint, input, messages, streaming]);

  if (!open) {
    return (
      <>
        <button
          className="ak-ask-fab"
          style={{ "--ask-accent": accent } as CSSProperties}
          aria-label={fabLabel}
          onClick={() => setOpen(true)}
        >
          <LogoMark />
          <span>{fabLabel}</span>
        </button>
        <style jsx>{`
          .ak-ask-fab {
            --ask-bg: var(--surface-1, #ffffff);
            --ask-bg-elevated: var(--surface-2, #f6f8fb);
            --ask-border: var(--border, #d8dee8);
            --ask-text: var(--foreground, #10151f);
            --ask-muted: var(--muted-foreground, #667085);
            --ask-shadow: rgba(16, 24, 40, 0.14);
            position: fixed;
            right: 16px;
            bottom: 16px;
            z-index: 80;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid var(--ask-border);
            border-radius: 999px;
            background: var(--ask-bg);
            color: var(--ask-text);
            padding: 10px 16px;
            box-shadow: 0 12px 32px var(--ask-shadow);
            font-family: var(--font-mono), ui-monospace, monospace;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          }
          .ak-ask-fab:hover {
            border-color: var(--ask-accent);
            box-shadow: 0 16px 40px var(--ask-shadow), 0 0 28px color-mix(in srgb, var(--ask-accent) 24%, transparent);
            transform: translateY(-1px);
          }
          :global(.dark) .ak-ask-fab {
            --ask-bg: #0b1017;
            --ask-bg-elevated: #151b24;
            --ask-border: #2b3340;
            --ask-text: #f2f5f8;
            --ask-muted: #a9b2bf;
            --ask-shadow: rgba(0, 0, 0, 0.34);
          }
          @media (prefers-color-scheme: dark) {
            .ak-ask-fab {
              --ask-bg: #0b1017;
              --ask-bg-elevated: #151b24;
              --ask-border: #2b3340;
              --ask-text: #f2f5f8;
              --ask-muted: #a9b2bf;
              --ask-shadow: rgba(0, 0, 0, 0.34);
            }
          }
        `}</style>
      </>
    );
  }

  return (
    <section className="ak-ask-panel" style={{ "--ask-accent": accent } as CSSProperties} aria-label={title}>
      <header className="ak-ask-header">
        <strong>
          <LogoMark size={18} />
          <span>{title}</span>
        </strong>
        <div>
          <button onClick={() => setMessages([])}>clear</button>
          <button aria-label="Close" onClick={() => setOpen(false)}>x</button>
        </div>
      </header>
      <div className="ak-ask-body">
        {messages.length === 0 ? <p className="ak-ask-empty">{emptyState}</p> : null}
        {messages.map((message, index) => (
          <div key={index} className={`ak-ask-message ${message.role}`}>
            {message.content ? <TextWithLinks content={message.content} /> : message.role === "assistant" && streaming ? "Searching..." : ""}
          </div>
        ))}
        {error ? <p className="ak-ask-error">{error}</p> : null}
        <div ref={endRef} />
      </div>
      <footer className="ak-ask-footer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={placeholder}
          rows={2}
        />
        {streaming ? <button onClick={() => abortRef.current?.abort()}>stop</button> : <button onClick={() => void send()}>send</button>}
        {cta ? <a href={cta.href}>{cta.label}</a> : null}
      </footer>
      <style jsx>{`
        .ak-ask-fab,
        .ak-ask-panel {
          --ask-bg: var(--surface-1, #ffffff);
          --ask-bg-elevated: var(--surface-2, #f6f8fb);
          --ask-bg-input: var(--surface-2, #f6f8fb);
          --ask-border: var(--border, #d8dee8);
          --ask-text: var(--foreground, #10151f);
          --ask-muted: var(--muted-foreground, #667085);
          --ask-danger: var(--danger, #b42318);
          --ask-shadow: rgba(16, 24, 40, 0.14);
          position: fixed;
          right: 16px;
          z-index: 80;
          font-family: var(--font-mono), ui-monospace, monospace;
        }
        .ak-ask-fab {
          bottom: 16px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--ask-border);
          border-radius: 999px;
          background: var(--ask-bg);
          color: var(--ask-text);
          padding: 10px 16px;
          box-shadow: 0 12px 32px var(--ask-shadow);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
        }
        .ak-ask-fab:hover {
          border-color: var(--ask-accent);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.44), 0 0 28px color-mix(in srgb, var(--ask-accent) 24%, transparent);
          transform: translateY(-1px);
        }
        .ak-ask-panel {
          bottom: 16px;
          display: flex;
          width: min(440px, calc(100vw - 32px));
          height: min(620px, calc(100vh - 32px));
          flex-direction: column;
          overflow: hidden;
          border: 1px solid var(--ask-border);
          border-radius: 12px;
          background: var(--ask-bg);
          color: var(--ask-text);
          box-shadow: 0 24px 70px var(--ask-shadow);
        }
        .ak-ask-header,
        .ak-ask-footer {
          border-color: var(--ask-border);
          padding: 10px;
        }
        .ak-ask-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--ask-border);
          background: linear-gradient(135deg, var(--ask-bg-elevated), var(--ask-bg));
        }
        .ak-ask-header strong {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ask-muted);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .ak-ask-header button,
        .ak-ask-footer button,
        .ak-ask-footer a {
          color: var(--ask-accent);
          background: transparent;
          border: 0;
          font: inherit;
          font-size: 11px;
          text-transform: uppercase;
        }
        .ak-ask-body {
          flex: 1;
          overflow: auto;
          padding: 12px;
        }
        .ak-ask-empty,
        .ak-ask-error {
          color: var(--ask-muted);
          font-size: 13px;
        }
        .ak-ask-error {
          color: var(--ask-danger);
        }
        .ak-ask-message {
          margin: 0 0 10px;
          white-space: pre-wrap;
          font-size: 13px;
          line-height: 1.55;
        }
        .ak-ask-message a {
          color: #77b7ff;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .ak-ask-message.user {
          margin-left: auto;
          max-width: 82%;
          border-radius: 10px;
          background: color-mix(in srgb, var(--ask-accent) 14%, transparent);
          padding: 8px 10px;
        }
        .ak-ask-footer {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          border-top: 1px solid var(--ask-border);
        }
        .ak-ask-footer textarea {
          resize: none;
          border: 1px solid var(--ask-border);
          border-radius: 10px;
          background: var(--ask-bg-input);
          color: var(--ask-text);
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }
        :global(.dark) .ak-ask-fab,
        :global(.dark) .ak-ask-panel {
          --ask-bg: #0b1017;
          --ask-bg-elevated: #141a22;
          --ask-bg-input: #151b24;
          --ask-border: #2b3340;
          --ask-text: #f2f5f8;
          --ask-muted: #a9b2bf;
          --ask-danger: #ff9a94;
          --ask-shadow: rgba(0, 0, 0, 0.52);
        }
        @media (prefers-color-scheme: dark) {
          .ak-ask-fab,
          .ak-ask-panel {
            --ask-bg: #0b1017;
            --ask-bg-elevated: #141a22;
            --ask-bg-input: #151b24;
            --ask-border: #2b3340;
            --ask-text: #f2f5f8;
            --ask-muted: #a9b2bf;
            --ask-danger: #ff9a94;
            --ask-shadow: rgba(0, 0, 0, 0.52);
          }
        }
      `}</style>
    </section>
  );
}
