"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

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
      <button className="ak-ask-fab" style={{ "--ask-accent": accent } as CSSProperties} onClick={() => setOpen(true)}>
        {fabLabel}
      </button>
    );
  }

  return (
    <section className="ak-ask-panel" style={{ "--ask-accent": accent } as CSSProperties} aria-label={title}>
      <header className="ak-ask-header">
        <strong>{title}</strong>
        <div>
          <button onClick={() => setMessages([])}>clear</button>
          <button onClick={() => setOpen(false)}>close</button>
        </div>
      </header>
      <div className="ak-ask-body">
        {messages.length === 0 ? <p className="ak-ask-empty">{emptyState}</p> : null}
        {messages.map((message, index) => (
          <div key={index} className={`ak-ask-message ${message.role}`}>
            {message.content || (message.role === "assistant" && streaming ? "Searching..." : "")}
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
          position: fixed;
          right: 18px;
          z-index: 80;
          font-family: var(--font-mono), ui-monospace, monospace;
        }
        .ak-ask-fab {
          bottom: 18px;
          border: 1px solid color-mix(in srgb, var(--ask-accent) 48%, #2a3242);
          border-radius: 999px;
          background: #10151f;
          color: #f4f7fb;
          padding: 10px 14px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
        }
        .ak-ask-panel {
          bottom: 18px;
          display: flex;
          width: min(430px, calc(100vw - 24px));
          height: min(620px, calc(100vh - 36px));
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #273143;
          border-radius: 14px;
          background: #0c1018;
          color: #eef3f8;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
        }
        .ak-ask-header,
        .ak-ask-footer {
          border-color: #273143;
          padding: 10px;
        }
        .ak-ask-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #273143;
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
          color: #98a6b8;
          font-size: 13px;
        }
        .ak-ask-error {
          color: #ff7b72;
        }
        .ak-ask-message {
          margin: 0 0 10px;
          white-space: pre-wrap;
          font-size: 13px;
          line-height: 1.55;
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
          border-top: 1px solid #273143;
        }
        .ak-ask-footer textarea {
          resize: none;
          border: 1px solid #273143;
          border-radius: 10px;
          background: #111824;
          color: #eef3f8;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }
      `}</style>
    </section>
  );
}
