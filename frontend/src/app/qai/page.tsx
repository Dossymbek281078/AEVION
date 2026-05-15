"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  personaId?: string;
  model?: string;
}

interface SessionRecord {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
}

interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  emoji: string;
  description?: string;
}

interface Usage {
  promptChars: number;
  completionChars: number;
  totalChars: number;
  approxPromptTokens: number;
  approxCompletionTokens: number;
  approxTotalTokens: number;
}

// Fallback list if /personas endpoint not reachable
const FALLBACK_PERSONAS: Persona[] = [
  { id: "assistant", name: "AEVION Assistant", systemPrompt: "", emoji: "AI", description: "General-purpose helper" },
  { id: "coder", name: "Code Expert", systemPrompt: "", emoji: "{}", description: "Software engineering, debugging" },
  { id: "mentor", name: "Patient Mentor", systemPrompt: "", emoji: "M", description: "Teaching and explaining" },
  { id: "critic", name: "Sharp Critic", systemPrompt: "", emoji: "!", description: "Reviewing ideas critically" },
  { id: "writer", name: "Creative Writer", systemPrompt: "", emoji: "W", description: "Storytelling, copy" },
  { id: "analyst", name: "Data Analyst", systemPrompt: "", emoji: "#", description: "Numbers and insights" },
];

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

function exportChatAsMarkdown(messages: Message[], sessionTitle?: string): void {
  const lines: string[] = [];
  lines.push(`# QAI Chat — ${sessionTitle || "Exported Session"}`);
  lines.push(`\nExported: ${new Date().toLocaleString()}\n`);
  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`\n**You:** ${msg.content}`);
    } else {
      lines.push(`\n**QAI${msg.personaId ? ` (${msg.personaId})` : ""}:**\n${msg.content}`);
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qai-chat-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="mt-1.5 inline-block rounded border border-slate-700 bg-transparent px-2 py-0.5 text-[11px] transition-colors hover:border-slate-500"
      style={{ color: copied ? "#34d399" : "#94a3b8" }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// Simple inline markdown renderer (no external libs)
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre
          key={i}
          className="my-2 overflow-auto rounded-lg bg-black/60 p-4 text-[13px] leading-relaxed text-slate-100 ring-1 ring-slate-700"
        >
          {codeLines.join("\n")}
        </pre>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      nodes.push(
        <h3 key={i} className="my-2 text-base font-bold text-slate-100">
          {inlineFormat(line.slice(2))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      nodes.push(
        <li key={i} className="ml-4 mb-0.5 list-disc">
          {inlineFormat(line.slice(2))}
        </li>
      );
      i++;
      continue;
    }
    if (line.trim() === "") {
      nodes.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }
    nodes.push(
      <span key={i} className="block">
        {inlineFormat(line)}
      </span>
    );
    i++;
  }
  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={idx++}>{text.slice(last, match.index)}</span>);
    }
    const raw = match[0];
    if (raw.startsWith("**")) {
      parts.push(<strong key={idx++}>{raw.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code
          key={idx++}
          className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.9em] text-emerald-300"
        >
          {raw.slice(1, -1)}
        </code>
      );
    }
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(<span key={idx++}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
          style={{ animation: `qai-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes qai-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

interface Persona {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
}

export default function QAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [personas, setPersonas] = useState<Persona[]>(FALLBACK_PERSONAS);
  const [activePersona, setActivePersona] = useState<string>("assistant");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [sessionTotalTokens, setSessionTotalTokens] = useState<number>(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load personas + sessionId + history
  useEffect(() => {
    // Personas — fetch best-effort
    fetch(apiUrl("/api/qai/personas"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.personas && Array.isArray(data.personas)) {
          setPersonas(data.personas);
        }
      })
      .catch(() => {
        // keep fallback
      });

    const stored = localStorage.getItem("qai_session_id");
    if (stored) {
      setSessionId(stored);
      try {
        const saved = localStorage.getItem(`qai_msgs_${stored}`);
        if (saved) setMessages(JSON.parse(saved));
      } catch {
        // ignore
      }
    } else {
      const newId = generateId() + generateId();
      localStorage.setItem("qai_session_id", newId);
      setSessionId(newId);
    }
    try {
      const list = localStorage.getItem("qai_sessions");
      if (list) setSessions(JSON.parse(list));
    } catch {
      // ignore
    }
    try {
      const persona = localStorage.getItem("qai_persona");
      if (persona) setActivePersona(persona);
    } catch {
      // ignore
    }
  }, []);

  // Auto-scroll on new content

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, streamingText]);

  // Persist messages
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`qai_msgs_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  // Persist persona choice
  useEffect(() => {
    localStorage.setItem("qai_persona", activePersona);
  }, [activePersona]);

  const saveCurrentSession = useCallback(() => {
    if (!sessionId || messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser ? firstUser.content.slice(0, 40) : "Untitled";
    const lastMsg = messages[messages.length - 1];
    const record: SessionRecord = {
      id: sessionId,
      title,
      lastMessage: lastMsg.content.slice(0, 60),
      createdAt: new Date().toISOString(),
    };
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      const updated = [record, ...filtered].slice(0, 20);
      localStorage.setItem("qai_sessions", JSON.stringify(updated));
      return updated;
    });
  }, [sessionId, messages]);

  const sendMessageStreaming = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text, id: generateId() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let acc = "";

    try {
      const res = await fetch(apiUrl("/api/qai/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, personaId: activePersona }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`stream failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastDone: { reply?: string; usage?: Usage; model?: string; personaId?: string; sessionId?: string } | null = null;

      let streamError: string | null = null;

      streamLoop: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          let evt: { type?: string; text?: string; sessionId?: string; message?: string; reply?: string; usage?: Usage; model?: string; personaId?: string } | null = null;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue; // tolerate malformed SSE line
          }
          if (!evt || typeof evt !== "object") continue;
          if (evt.type === "chunk" && typeof evt.text === "string") {
            acc += evt.text;
            setStreamingText(acc);
          } else if (evt.type === "done") {
            lastDone = evt;
          } else if (evt.type === "start" && evt.sessionId) {
            if (evt.sessionId !== sessionId) {
              setSessionId(evt.sessionId);
              localStorage.setItem("qai_session_id", evt.sessionId);
            }
          } else if (evt.type === "error") {
            streamError = evt.message || "stream error";
            break streamLoop;
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }

      const finalText = lastDone?.reply ?? acc;
      if (finalText) {
        const aiMsg: Message = {
          role: "assistant",
          content: finalText,
          id: generateId(),
          personaId: lastDone?.personaId,
          model: lastDone?.model,
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (lastDone?.usage) {
          setUsage(lastDone.usage);
          setSessionTotalTokens((t) => t + (lastDone?.usage?.approxTotalTokens ?? 0));
        }
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") {
        // Partial reply: if we accumulated something, save it
        if (acc.trim().length > 0) {
          const partial: Message = {
            role: "assistant",
            content: acc + "\n\n_[stopped]_",
            id: generateId(),
            personaId: activePersona,
          };
          setMessages((prev) => [...prev, partial]);
        }
      } else {
        setError(err?.message || "Streaming error");
      }

    } finally {
      setStreaming(false);
      setStreamingText("");
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  }, [input, streaming, sessionId, activePersona]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessageStreaming();
    }
  };

  const newChat = () => {
    saveCurrentSession();
    const newId = generateId() + generateId();
    setSessionId(newId);
    localStorage.setItem("qai_session_id", newId);
    setMessages([]);
    setError(null);
    setInput("");
    setUsage(null);
    setSessionTotalTokens(0);
    textareaRef.current?.focus();
  };

  const loadSession = (rec: SessionRecord) => {
    saveCurrentSession();
    setSessionId(rec.id);
    localStorage.setItem("qai_session_id", rec.id);
    try {
      const saved = localStorage.getItem(`qai_msgs_${rec.id}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
    setError(null);
    setUsage(null);
    setSessionTotalTokens(0);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem("qai_sessions", JSON.stringify(updated));
      return updated;
    });
    localStorage.removeItem(`qai_msgs_${id}`);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const activePersonaObj = personas.find((p) => p.id === activePersona) ?? personas[0];

  return (
    <>
      <Wave1Nav />
      <div className="flex h-[calc(100vh-64px)] bg-slate-950 text-slate-100">
        {/* Sidebar */}
        <aside className="flex w-60 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-3">
            <button
              onClick={newChat}
              className="w-full rounded-lg border border-dashed border-slate-600 bg-transparent px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-emerald-400 hover:text-emerald-300"
            >
              + New chat
            </button>
          </div>

          {/* Persona selector */}
          <div className="border-b border-slate-800 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Persona
            </div>
            <div className="flex flex-col gap-1">
              {personas.map((p) => {
                const active = p.id === activePersona;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePersona(p.id)}
                    title={p.description ?? p.name}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                        active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {p.emoji}
                    </span>
                    <span className="flex-1 truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* History */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              History
            </div>
            {sessions.length === 0 && (
              <div className="px-2 py-1 text-xs text-slate-500">No history yet</div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s)}
                className={`group relative mb-0.5 cursor-pointer rounded-md border px-2 py-1.5 transition-colors ${
                  s.id === sessionId
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-transparent hover:bg-slate-800"
                }`}
              >
                <div className="truncate pr-5 text-xs font-medium text-slate-200">{s.title}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{formatDate(s.createdAt)}</div>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  title="Delete"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:bg-slate-700 hover:text-slate-200 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main chat */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 text-base font-extrabold text-white">
                Q
              </div>
              <div>
                <div className="text-[15px] font-bold text-slate-100">QAI Assistant</div>
                <div className="text-xs text-slate-400">
                  Persona:{" "}
                  <span className="text-emerald-300">{activePersonaObj?.name ?? activePersona}</span>
                  {" · "}Multi-provider AI
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Token usage badge */}
              {(usage || sessionTotalTokens > 0) && (
                <div className="hidden items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] sm:flex">
                  {usage && (
                    <span className="text-slate-300" title="Tokens for last response (approx)">
                      <span className="text-slate-500">last:</span>{" "}
                      <span className="font-mono text-emerald-300">
                        {usage.approxPromptTokens}↑ {usage.approxCompletionTokens}↓
                      </span>
                    </span>
                  )}
                  {sessionTotalTokens > 0 && (
                    <span className="text-slate-300" title="Approx tokens used this session">
                      <span className="text-slate-500">session:</span>{" "}
                      <span className="font-mono text-violet-300">~{sessionTotalTokens}</span>
                    </span>
                  )}
                </div>
              )}

              {messages.length > 0 && (
                <button
                  onClick={() => {
                    const sess = sessions.find((s) => s.id === sessionId);
                    exportChatAsMarkdown(messages, sess?.title);
                  }}
                  title="Export chat as Markdown"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                >
                  ↓ Export .md
                </button>
              )}
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6">
              {messages.length === 0 && !streaming && (
                <div className="mt-20 text-center text-slate-400">
                  <div className="mb-4 text-5xl text-emerald-400/80">◈</div>
                  <div className="mb-2 text-xl font-bold text-slate-100">
                    How can I help you today?
                  </div>
                  <div className="text-sm">
                    Persona:{" "}
                    <span className="text-emerald-300">{activePersonaObj?.name}</span>
                    {activePersonaObj?.description && (
                      <span className="text-slate-500"> — {activePersonaObj.description}</span>
                    )}
                  </div>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {[
                      "What is AEVION?",
                      "How does QRight protect IP?",
                      "Explain QSign signatures",
                      "How do I get started?",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`break-words px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-900/40"
                          : "rounded-2xl rounded-bl-md border border-slate-700 bg-slate-800/70 text-slate-100"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        renderMarkdown(msg.content)
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                    {msg.role === "assistant" && (
                      <div className="mt-1 flex items-center gap-2">
                        <CopyButton text={msg.content} />
                        {msg.personaId && (
                          <span className="text-[10px] text-slate-500">via {msg.personaId}</span>
                        )}
                        {msg.model && (
                          <span className="text-[10px] text-slate-600">· {msg.model}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Live streaming bubble */}
              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-emerald-500/30 bg-slate-800/70 px-4 py-3 text-sm leading-relaxed text-slate-100">
                    {streamingText ? (
                      renderMarkdown(streamingText)
                    ) : (
                      <TypingDots />
                    )}
                    {streamingText && (
                      <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-emerald-400 align-middle" />
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900 px-6 py-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <div className="relative flex-1">

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activePersonaObj?.name ?? "QAI"}...  (Enter to send, Shift+Enter for newline)`}
                  rows={1}
                  disabled={streaming}
                  className="max-h-[200px] min-h-[48px] w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              {streaming ? (
                <button
                  onClick={stopStreaming}
                  title="Stop generation"
                  className="h-12 flex-shrink-0 rounded-xl border border-red-500/50 bg-red-500/10 px-5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20"
                >
                  ◼ Stop
                </button>
              ) : (
                <button
                  onClick={sendMessageStreaming}
                  disabled={!input.trim()}
                  className="h-12 flex-shrink-0 rounded-xl px-6 text-sm font-bold transition-all disabled:cursor-not-allowed"
                  style={{
                    background: !input.trim()
                      ? "#334155"
                      : "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                    color: !input.trim() ? "#64748b" : "#fff",
                  }}
                >
                  Send
                </button>
              )}
            </div>

            <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between text-[11px] text-slate-500">
              <span>
                Session:{" "}
                <span className="font-mono text-slate-400">
                  {sessionId?.slice(0, 8) ?? "—"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {streaming && (
                  <span className="text-emerald-400">● streaming</span>
                )}
                {!streaming && usage && (
                  <span>
                    last response: {usage.completionChars} chars · ~{usage.approxCompletionTokens} tokens
                  </span>
                )}
              </span>

            </div>
          </div>
        </main>
      </div>
    </>
  );
}
