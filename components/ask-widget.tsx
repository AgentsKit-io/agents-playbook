"use client";

import {
  Children,
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ChatReturn, Message as AgentsKitMessage } from "@agentskit/core";
import { ChatContainer } from "@agentskit/react";
import {
  SourceListPropsSchema,
  StandardComponentCatalog,
  createAskAdapter,
  createAskSessionMemory,
  defineChat,
  defineComponentManifest,
} from "@agentskit/chat";
import {
  AgentChat,
  StandardComponent as FrameworkStandardComponent,
  type AgentChatSlots,
  type StandardComponentProps,
} from "@agentskit/chat-react";
import { createPlaybookDiscoveryAdapter, loadPlaybookDiscovery, type PlaybookDiscoveryInputs } from "@/lib/discovery";

const DISCOVERY_RETRY_DELAY_MS = 1_000;

interface AskWidgetProps {
  readonly endpoint?: string;
  readonly corpus: string;
  readonly title: string;
  readonly fabLabel: string;
  readonly placeholder: string;
  readonly emptyState: string;
  readonly accent: string;
  readonly cta?: { readonly label: string; readonly href: string };
}

interface AskRuntime {
  readonly chat: { current: ChatReturn | null };
  readonly emptyState: ReactNode;
}

const ASK_COMPONENTS = defineComponentManifest(StandardComponentCatalog);
const AskRuntimeContext = createContext<AskRuntime | undefined>(undefined);

function useAskRuntime(): AskRuntime {
  const runtime = useContext(AskRuntimeContext);
  if (!runtime) throw new Error("Ask runtime is unavailable.");
  return runtime;
}

function LogoMark({ size = 16 }: { readonly size?: number }) {
  const height = Math.round((size * 64) / 72);
  return (
    <svg width={size} height={height} viewBox="0 0 72 64" fill="none" aria-hidden="true">
      <path d="M12 52 36 12l24 40H12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="36" cy="12" r="6" fill="currentColor" />
      <circle cx="12" cy="52" r="6" fill="currentColor" />
      <circle cx="60" cy="52" r="6" fill="currentColor" />
    </svg>
  );
}

function InlineContent({ content }: { readonly content: string }) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(content.slice(cursor, index));
    const href = match[2] || match[5];
    if (href) nodes.push(<a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer">{match[1] || match[5]}</a>);
    else if (match[3]) nodes.push(<code key={`code-${index}`}>{match[3]}</code>);
    else nodes.push(<strong key={`strong-${index}`}>{match[4]}</strong>);
    cursor = index + match[0].length;
  }
  if (cursor < content.length) nodes.push(content.slice(cursor));
  return <>{nodes}</>;
}

function MarkdownContent({ content }: { readonly content: string }) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line) { index += 1; continue; }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index]?.trim() ?? "").startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push(<pre key={`code-block-${index}`}><code data-language={language || undefined}>{code.join("\n")}</code></pre>);
      continue;
    }
    if (line.startsWith("## ")) {
      nodes.push(<h3 key={`heading-${index}`}><InlineContent content={line.slice(3)} /></h3>);
      index += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: ReactNode[] = [];
      while ((lines[index]?.trim() ?? "").startsWith("- ")) {
        const item = lines[index]?.trim().slice(2) ?? "";
        items.push(<li key={`item-${index}`}><InlineContent content={item} /></li>);
        index += 1;
      }
      nodes.push(<ul key={`list-${index}`}>{items}</ul>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const value = lines[index]?.trim() ?? "";
      if (!value || value.startsWith("## ") || value.startsWith("- ") || value.startsWith("```")) break;
      paragraph.push(value);
      index += 1;
    }
    nodes.push(<p key={`paragraph-${index}`}><InlineContent content={paragraph.join(" ")} /></p>);
  }
  return <>{nodes}</>;
}

function AskMessage({ message }: { readonly message: AgentsKitMessage }) {
  return (
    <div className={`ak-ask-message ${message.role === "user" ? "user" : "assistant"}`} data-ak-message={message.role}>
      {message.role === "user" ? message.content : <MarkdownContent content={message.content} />}
    </div>
  );
}

function AskContainer({ children, className }: ComponentProps<typeof ChatContainer>) {
  const runtime = useAskRuntime();
  const hasMessages = Children.count(children) > 1;
  return (
    <ChatContainer className={`${className ?? ""} ak-ask-body`}>
      {hasMessages ? null : <p className="ak-ask-empty">{runtime.emptyState}</p>}
      {children}
    </ChatContainer>
  );
}

function AskThinking({ visible }: { readonly visible: boolean }) {
  return visible ? <p className="ak-ask-thinking" role="status"><LogoMark size={15} /> Searching the corpus…</p> : null;
}

function AskInput({ chat, placeholder, disabled }: ComponentProps<NonNullable<AgentChatSlots["Input"]>>) {
  const runtime = useAskRuntime();
  runtime.chat.current = chat;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disabled && chat.input.trim()) void chat.send(chat.input);
  };
  return (
    <form className="ak-ask-compose" onSubmit={submit}>
      <label>
        <span className="ak-sr-only">Ask a question</span>
        <textarea
          value={chat.input}
          onChange={(event) => chat.setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!disabled && chat.input.trim()) void chat.send(chat.input);
            }
          }}
          rows={2}
          placeholder={placeholder}
          disabled={disabled}
        />
      </label>
      <button type="submit" disabled={disabled || !chat.input.trim()}>send</button>
    </form>
  );
}

function AskStandardComponent(props: StandardComponentProps) {
  if (props.frame.componentKey !== "source-list") return <FrameworkStandardComponent {...props} />;
  const parsed = SourceListPropsSchema.safeParse(props.frame.props);
  if (!parsed.success) return null;
  return (
    <section className="ak-ask-sources" aria-label={parsed.data.label}>
      <strong>{parsed.data.label}</strong>
      <ol>
        {parsed.data.sources.map((source) => (
          <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</li>
        ))}
      </ol>
    </section>
  );
}

export function AskWidget({
  endpoint = process.env.NEXT_PUBLIC_ASK_ENDPOINT ?? "https://ask.agentskit.io/v1/ask",
  corpus,
  title,
  fabLabel,
  placeholder,
  emptyState,
  accent,
  cta,
}: AskWidgetProps) {
  const [open, setOpen] = useState(false);
  const [discovery, setDiscovery] = useState<PlaybookDiscoveryInputs | null | undefined>(undefined);
  const [answerPath, setAnswerPath] = useState<"local" | "backend" | "pending" | null>(null);
  const chatRef = useRef<ChatReturn | null>(null);
  const discoveryPromiseRef = useRef<Promise<void> | null>(null);
  const discoveryFailureAtRef = useRef(0);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openedOnceRef = useRef(false);
  const storageKey = `ak:ask-thread-v3:${corpus}`;
  const ensureDiscovery = useCallback(() => {
    if (discovery || discoveryPromiseRef.current) return discoveryPromiseRef.current;
    if (discovery === null && Date.now() - discoveryFailureAtRef.current < DISCOVERY_RETRY_DELAY_MS) return null;
    const pending = loadPlaybookDiscovery(fetch)
      .then((inputs) => {
        discoveryFailureAtRef.current = inputs ? 0 : Date.now();
        setDiscovery(inputs);
      })
      .finally(() => { discoveryPromiseRef.current = null; });
    discoveryPromiseRef.current = pending;
    return pending;
  }, [discovery]);
  const definition = useMemo(() => {
    const fallback = createAskAdapter({ endpoint, corpus });
    const answer = createPlaybookDiscoveryAdapter({
      inputs: discovery ?? null,
      fallback,
      onDecision: (decision) => {
        if (decision.outcome === "answer") setAnswerPath(decision.provenance.source);
        else if (decision.outcome === "escalation") setAnswerPath("pending");
        else setAnswerPath("local");
      },
      onBackendStart: () => setAnswerPath("pending"),
      onBackendAnswer: () => setAnswerPath("backend"),
    });
    return defineChat({
      id: `ask-${corpus}`,
      components: ASK_COMPONENTS,
      ...(answer.deterministic ? { choiceSubmission: answer.deterministic.resolveChoiceSubmission } : {}),
      chat: {
        adapter: answer.adapter,
        memory: createAskSessionMemory({ key: storageKey, legacyKeys: [`ak:ask-thread-v2:${corpus}`, `ak:ask-thread:${corpus}`] }),
      },
    });
  }, [corpus, discovery, endpoint, storageKey]);
  const runtime = useMemo<AskRuntime>(() => ({ chat: chatRef, emptyState }), [emptyState]);
  const style = { "--ask-accent": accent } as CSSProperties;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (open) {
        openedOnceRef.current = true;
        panelRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      } else if (openedOnceRef.current) {
        openedOnceRef.current = false;
        fabRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [discovery, open]);

  if (!open) return (
    <>
      <button ref={fabRef} type="button" className="ak-ask-fab" style={style} aria-label={fabLabel} onFocus={() => { void ensureDiscovery(); }} onPointerEnter={() => { void ensureDiscovery(); }} onClick={() => { void ensureDiscovery(); setOpen(true); }}>
        <LogoMark /><span>{fabLabel}</span>
      </button>
      <AskStyles />
    </>
  );

  return (
    <AskRuntimeContext.Provider value={runtime}>
      <section ref={panelRef} className="ak-ask-panel" style={style} role="dialog" aria-label={title} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
        }
      }}>
        <header className="ak-ask-header">
          <strong><LogoMark size={18} /><span>{title}</span></strong>
          <div>
            <button type="button" onClick={() => { setAnswerPath(null); void chatRef.current?.clear(); }}>clear</button>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
        </header>
        <div className="ak-ask-runtime">
          {discovery === undefined
            ? <p className="ak-ask-loading" role="status"><LogoMark size={15} /> Preparing local Playbook knowledge…</p>
            : <AgentChat
                key={storageKey}
                definition={definition}
                placeholder={placeholder}
                slots={{ Container: AskContainer, Message: AskMessage, Input: AskInput, Thinking: AskThinking, StandardComponent: AskStandardComponent }}
              />}
        </div>
        <footer className="ak-ask-footer">
          <a href={cta?.href ?? "/docs"}>{cta?.label ?? "Browse the Playbook →"}</a>
          {answerPath ? <span data-ak-answer-path={answerPath}>{answerPath === "local" ? "instant · local" : answerPath === "backend" ? "grounded · backend" : "consulting backend"}</span> : null}
        </footer>
        <AskStyles />
      </section>
    </AskRuntimeContext.Provider>
  );
}

function AskStyles() {
  return <style jsx global>{`
    .ak-ask-fab,.ak-ask-panel{--ask-bg:#0b1017;--ask-surface:#151b24;--ask-border:#2b3340;--ask-text:#f2f5f8;--ask-muted:#a9b2bf;--ask-danger:#ff9a94;position:fixed;right:1rem;bottom:1rem;z-index:80;color:var(--ask-text);font-family:var(--font-mono),ui-monospace,monospace}
    .ak-ask-fab{display:inline-flex;min-height:44px;align-items:center;gap:.5rem;border:1px solid var(--ask-border);border-radius:999px;background:var(--ask-bg);padding:.625rem 1rem;box-shadow:0 12px 32px rgba(0,0,0,.34);font-size:.75rem;font-weight:700;cursor:pointer;transition:border-color 160ms ease,transform 160ms ease}
    .ak-ask-fab:hover{border-color:var(--ask-accent);transform:translateY(-1px)}
    .ak-ask-panel{display:flex;width:min(440px,calc(100vw - 2rem));height:min(620px,calc(100dvh - 2rem));flex-direction:column;overflow:hidden;border:1px solid var(--ask-border);border-radius:.75rem;background:var(--ask-bg);box-shadow:0 24px 70px rgba(0,0,0,.52)}
    .ak-ask-header{display:flex;min-height:48px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ask-border);background:linear-gradient(135deg,var(--ask-surface),var(--ask-bg));padding:.5rem .75rem}
    .ak-ask-header strong,.ak-ask-header div{display:flex;align-items:center;gap:.5rem}.ak-ask-header strong{color:var(--ask-muted);font-size:.75rem;font-weight:500;letter-spacing:.16em;text-transform:uppercase}
    .ak-ask-header button,.ak-ask-footer a,.ak-ask-compose button,.ak-ask-runtime [data-ak-app-chat]>button,.ak-ask-runtime [aria-label="Response actions"] button{min-width:44px;min-height:44px;border:0;background:transparent;color:var(--ask-accent);font:inherit;font-size:.6875rem;text-transform:uppercase;cursor:pointer}
    .ak-ask-runtime{min-height:0;flex:1;overflow:hidden;padding:.75rem}.ak-ask-runtime>[data-ak-app-chat]{display:flex;height:100%;min-height:0;flex-direction:column}.ak-ask-runtime>[data-ak-app-chat]>[role=log]{display:flex;min-height:0;flex:1;overflow:hidden}
    .ak-ask-body{display:flex;min-height:0;flex:1;flex-direction:column;gap:.65rem;overflow-y:auto}.ak-ask-empty{margin:0;color:var(--ask-muted);font-size:.8125rem;line-height:1.5}
    .ak-ask-message{max-width:92%;font-size:.8125rem;line-height:1.55}.ak-ask-message.user{align-self:flex-end;white-space:pre-wrap;border-radius:.625rem;background:color-mix(in srgb,var(--ask-accent) 14%,transparent);padding:.5rem .625rem}.ak-ask-message.assistant{align-self:flex-start}.ak-ask-message.assistant h3{margin:0 0 .6rem;font-size:1rem}.ak-ask-message.assistant p{margin:0 0 .65rem}.ak-ask-message.assistant ul{margin:0 0 .65rem;padding-left:1.25rem}.ak-ask-message.assistant code{border:1px solid var(--ask-border);border-radius:.25rem;background:var(--ask-surface);padding:.08rem .25rem;font-size:.75rem}.ak-ask-message.assistant pre{max-width:100%;overflow-x:auto;border:1px solid var(--ask-border);border-radius:.5rem;background:var(--ask-surface);padding:.625rem}.ak-ask-message.assistant pre code{display:block;border:0;background:transparent;padding:0;white-space:pre}.ak-ask-message a,.ak-ask-sources a{color:#8fc5ff;text-decoration:underline;text-underline-offset:3px}
    .ak-ask-thinking{display:flex;align-items:center;gap:.5rem;color:var(--ask-muted);font-size:.75rem}.ak-ask-sources{border-top:1px solid var(--ask-border);padding-top:.5rem;font-size:.75rem}.ak-ask-sources strong{color:var(--ask-muted);text-transform:uppercase}.ak-ask-sources ol{margin:.4rem 0 0;padding-left:1.25rem}
    .ak-ask-compose{display:grid;grid-template-columns:1fr auto;gap:.5rem;border-top:1px solid var(--ask-border);padding-top:.625rem}.ak-ask-compose label{min-width:0}.ak-ask-compose textarea{box-sizing:border-box;width:100%;resize:none;border:1px solid var(--ask-border);border-radius:.625rem;background:var(--ask-surface);color:var(--ask-text);padding:.5rem;font:inherit;font-size:.75rem}.ak-ask-compose button{color:var(--ask-accent)}
    .ak-ask-runtime [role=alert]{margin:.4rem 0;color:var(--ask-danger);font-size:.75rem}.ak-ask-runtime [aria-label="Response actions"]{display:flex;flex-wrap:wrap;gap:.25rem;border-top:1px solid var(--ask-border)}
    .ak-ask-loading{display:flex;align-items:center;gap:.5rem;color:var(--ask-muted);font-size:.75rem}.ak-ask-footer{display:flex;min-height:44px;align-items:center;justify-content:space-between;gap:.5rem;border-top:1px solid var(--ask-border);padding:0 .75rem}.ak-ask-footer a{display:inline-flex;align-items:center}.ak-ask-footer [data-ak-answer-path]{color:var(--ask-muted);font-size:.625rem;letter-spacing:.08em;text-transform:uppercase}.ak-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .ak-ask-panel button:focus-visible,.ak-ask-panel a:focus-visible,.ak-ask-panel textarea:focus-visible,.ak-ask-fab:focus-visible{outline:2px solid var(--ask-accent);outline-offset:2px}
    @media(max-width:639px){.ak-ask-panel{inset:.5rem;width:auto;height:auto}.ak-ask-fab{right:.75rem;bottom:.75rem}}
    @media(prefers-reduced-motion:reduce){.ak-ask-fab{transition:none}.ak-ask-fab:hover{transform:none}}
  `}</style>;
}
