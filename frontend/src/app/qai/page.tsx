"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

interface SessionRecord {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

function exportChatAsMarkdown(messages: Message[], sessionTitle?: string): void {
  const lines: string[] = [];
  lines.push(`# QAI Chat — ${sessionTitle || "Exported Session"}`);
  lines.push(`
Exported: ${new Date().toLocaleString()}
`);
  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`
**You:** ${msg.content}`);
    } else {
      lines.push(`
**QAI:**
${msg.content}`);
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
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
      style={{
        background: "none",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        padding: "3px 8px",
        fontSize: 11,
        cursor: "pointer",
        color: copied ? "#0d9488" : "#94a3b8",
        transition: "color 0.15s",
        marginTop: 6,
        display: "inline-block",
      }}
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
    // Code block
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
          style={{
            background: "#0f172a",
            color: "#e2e8f0",
            padding: 16,
            borderRadius: 8,
            overflow: "auto",
            fontSize: 13,
            margin: "8px 0",
            lineHeight: 1.5,
          }}
        >
          {codeLines.join("\n")}
        </pre>
      );
      i++;
      continue;
    }
    // H3
    if (line.startsWith("# ")) {
      nodes.push(
        <h3
          key={i}
          style={{ fontSize: 16, fontWeight: 700, margin: "10px 0 4px", color: "#0f172a" }}
        >
          {inlineFormat(line.slice(2))}
        </h3>
      );
      i++;
      continue;
    }
    // List item
    if (line.startsWith("- ") || line.startsWith("* ")) {
      nodes.push(
        <li key={i} style={{ marginLeft: 16, marginBottom: 2 }}>
          {inlineFormat(line.slice(2))}
        </li>
      );
      i++;
      continue;
    }
    // Empty line → spacing
    if (line.trim() === "") {
      nodes.push(<div key={i} style={{ height: 6 }} />);
      i++;
      continue;
    }
    // Regular paragraph line
    nodes.push(
      <span key={i} style={{ display: "block" }}>
        {inlineFormat(line)}
      </span>
    );
    i++;
  }
  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  // Handle **bold** and `code`
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
          style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: "0.9em" }}
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

// Animated typing dots
function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#0d9488",
            display: "inline-block",
            animation: `qai-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes qai-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

export default function QAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load sessionId and history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("qai_session_id");
    if (stored) {
      setSessionId(stored);
      // Restore messages for current session
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
    // Load session list
    try {
      const list = localStorage.getItem("qai_sessions");
      if (list) setSessions(JSON.parse(list));
    } catch {
      // ignore
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist messages on change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`qai_msgs_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, id: generateId() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/qai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to get response");
      } else {
        const aiMsg: Message = {
          role: "assistant",
          content: data.reply,
          id: generateId(),
        };
        if (data.sessionId && data.sessionId !== sessionId) {
          setSessionId(data.sessionId);
          localStorage.setItem("qai_session_id", data.sessionId);
        }
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch {
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

  return (
    <>
      <Wave1Nav />
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 64px)",
          background: "#f8fafc",
        }}
      >
        {/* Sidebar — conversation history */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            background: "#fff",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "14px 12px 8px", borderBottom: "1px solid #f1f5f9" }}>
            <button
              onClick={newChat}
              style={{
                width: "100%",
                padding: "8px 0",
                borderRadius: 8,
                border: "1.5px dashed #cbd5e1",
                background: "transparent",
                color: "#374151",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + New chat
            </button>
          </div>
          <div style={{ padding: "8px 6px", flex: 1 }}>
            {sessions.length === 0 && (
              <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 6px" }}>No history yet</div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s)}
                style={{
                  padding: "8px 8px",
                  borderRadius: 7,
                  cursor: "pointer",
                  marginBottom: 2,
                  background: s.id === sessionId ? "#f0fdf4" : "transparent",
                  border: s.id === sessionId ? "1px solid #bbf7d0" : "1px solid transparent",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (s.id !== sessionId)
                    (e.currentTarget as HTMLDivElement).style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  if (s.id !== sessionId)
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1e293b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    paddingRight: 18,
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {formatDate(s.createdAt)}
                </div>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  title="Delete"
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#cbd5e1",
                    fontSize: 14,
                    lineHeight: 1,
                    padding: "2px 4px",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main chat area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "#fff",
              borderBottom: "1px solid #e2e8f0",
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Q
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>QAI Assistant</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Multi-provider AI · No account needed</div>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  const sess = sessions.find((s) => s.id === sessionId);
                  exportChatAsMarkdown(messages, sess?.title);
                }}
                title="Export chat as Markdown"
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#374151",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                ↓ Export .md
              </button>
            )}
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: 800,
              width: "100%",
              margin: "0 auto",
              boxSizing: "border-box",
            }}
          >
            {messages.length === 0 && !loading && (
              <div
                style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  marginTop: 80,
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                  How can I help you today?
                </div>
                <div style={{ fontSize: 14 }}>
                  Ask anything — powered by Claude, GPT-4o, and Gemini
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
                  {[
                    "What is AEVION?",
                    "How does QRight protect IP?",
                    "Explain QSign signatures",
                    "How do I get started?",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        color: "#374151",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
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
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: msg.role === "user" ? "#0d9488" : "#fff",
                      color: msg.role === "user" ? "#fff" : "#1e293b",
                      fontSize: 14,
                      lineHeight: 1.6,
                      border: msg.role === "assistant" ? "1px solid #e2e8f0" : "none",
                      boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.role === "assistant"
                      ? renderMarkdown(msg.content)
                      : <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>}
                  </div>
                  {msg.role === "assistant" && <CopyButton text={msg.content} />}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "14px 20px",
                    borderRadius: "18px 18px 18px 4px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <TypingDots />
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "#991b1b",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              background: "#fff",
              borderTop: "1px solid #e2e8f0",
              padding: "16px 24px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                maxWidth: 800,
                margin: "0 auto",
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
              }}
            >
              <div style={{ flex: 1, position: "relative" }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message QAI... (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1.5px solid #e2e8f0",
                    fontSize: 14,
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                    minHeight: 48,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#0d9488")}
                  onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                style={{
                  padding: "12px 22px",
                  borderRadius: 12,
                  border: "none",
                  background:
                    loading || !input.trim()
                      ? "#e2e8f0"
                      : "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                  color: loading || !input.trim() ? "#94a3b8" : "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  transition: "background 0.15s, color 0.15s",
                  flexShrink: 0,
                  height: 48,
                }}
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
