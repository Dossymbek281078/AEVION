"use client";

import { useState, useRef, useEffect, useMemo } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/qcore` : "http://localhost:4001/api/qcore";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001/ws/qcore";
const USER_ID = "test-user-1";

interface Message { role: string; content: string; }
interface Chat { id: string; title: string; updatedAt: string; }

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative", margin: "12px 0", borderRadius: 10, overflow: "hidden", background: "#0d1117", border: "1px solid #21262d" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", background: "#161b22", fontSize: 11, color: "#8b949e" }}>
        <span>{lang || "code"}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ background: "none", border: "1px solid #30363d", borderRadius: 6, color: "#8b949e", padding: "2px 10px", cursor: "pointer", fontSize: 11 }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: 14, overflowX: "auto", fontSize: 13, lineHeight: 1.5, color: "#c9d1d9" }}><code>{code}</code></pre>
    </div>
  );
}

function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: formatInline(text.slice(lastIndex, match.index)) }} />);
    }
    parts.push(<CodeBlock key={key++} lang={match[1]} code={match[2].trimEnd()} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: formatInline(text.slice(lastIndex)) }} />);
  }
  return parts;
}

function formatInline(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/\n/g, "<br/>");
}

export default function QCorePage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadChats(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamText]);
  useEffect(() => { if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + "px"; } }, [input]);

  async function loadChats() {
    try {
      const res = await fetch(`${API}/chats`, { headers: { "x-user-id": USER_ID } });
      const data = await res.json();
      setChats(Array.isArray(data) ? data : []);
    } catch {
      setChats([]);
    }
  }

  async function loadMessages(chatId: string) {
    try {
      const res = await fetch(`${API}/chats/${chatId}/messages`, { headers: { "x-user-id": USER_ID } });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    }
    setActiveChatId(chatId);
  }

  async function createChat() {
    try {
      const res = await fetch(`${API}/chats`, { method: "POST", headers: { "x-user-id": USER_ID, "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const chat = await res.json();
      setChats((p) => [chat, ...p]);
      setActiveChatId(chat.id);
      setMessages([]);
      inputRef.current?.focus();
    } catch {
      // silent fail
    }
  }

  function connectWS(): Promise<WebSocket> {
    return new Promise((resolve) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) { resolve(wsRef.current); return; }
      const ws = new WebSocket(WS_URL);
      ws.onopen = () => { ws.send(JSON.stringify({ type: "auth", userId: USER_ID })); wsRef.current = ws; setTimeout(() => resolve(ws), 100); };
      ws.onclose = () => { wsRef.current = null; };
    });
  }

  async function sendMessage() {
    if (!input.trim() || !activeChatId || streaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: userMsg }]);
    setStreaming(true);
    setStreamText("");
    const ws = await connectWS();
    const handler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "chunk") setStreamText((p) => p + data.text);
      if (data.type === "stream_end") { setMessages((p) => [...p, { role: "assistant", content: data.content }]); setStreamText(""); setStreaming(false); ws.removeEventListener("message", handler); loadChats(); }
      if (data.type === "error") { setStreamText(""); setStreaming(false); setMessages((p) => [...p, { role: "assistant", content: "Error: " + data.message }]); ws.removeEventListener("message", handler); }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ type: "message", chatId: activeChatId, content: userMsg }));
  }

  async function deleteChat(chatId: string) {
    try {
      await fetch(`${API}/chats/${chatId}`, { method: "DELETE", headers: { "x-user-id": USER_ID } });
      setChats((p) => p.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) { setActiveChatId(null); setMessages([]); }
    } catch {
      // silent fail
    }
  }

  const activeChat = useMemo(() => Array.isArray(chats) ? chats.find((c) => c.id === activeChatId) : undefined, [chats, activeChatId]);

  return (
    <div translate="no" suppressHydrationWarning style={{ display: "flex", height: "calc(100vh - 49px)", background: "#0a0e1a", color: "#e2e8f0" }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 280 : 0, overflow: "hidden", transition: "width 0.3s",
        background: "#0f1629", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: 16, borderBottom: "1px solid #1e293b" }}>
          <button onClick={createChat} style={{
            width: "100%", padding: "10px 0", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", borderRadius: 10, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>
            + New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.map((chat) => (
            <div key={chat.id} onClick={() => loadMessages(chat.id)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", cursor: "pointer", transition: "background 0.2s",
              background: activeChatId === chat.id ? "#1e293b" : "transparent",
              borderLeft: activeChatId === chat.id ? "3px solid #6366f1" : "3px solid transparent",
            }}>
              <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: activeChatId === chat.id ? "#fff" : "#94a3b8" }}>
                {chat.title}
              </span>
              <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #1e293b", textAlign: "center", fontSize: 11, color: "#475569" }}>
          QCoreAI · Powered by Claude
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Header */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12, background: "#0d1220" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>☰</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#c4b5fd" }}>{activeChat?.title || "QCoreAI"}</span>
        </div>

        {!activeChatId ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🧠</div>
              <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, background: "linear-gradient(135deg, #6366f1, #a78bfa, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                QCoreAI
              </h1>
              <p style={{ color: "#64748b", fontSize: 16, marginBottom: 24 }}>Your intelligent assistant on AEVION platform</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {["Write code", "Create content", "Analyze data", "Brainstorm ideas"].map((t) => (
                  <span key={t} style={{ padding: "8px 16px", background: "#1e293b", borderRadius: 20, fontSize: 13, color: "#94a3b8", border: "1px solid #334155" }}>{t}</span>
                ))}
              </div>
              <button onClick={createChat} style={{
                marginTop: 32, padding: "12px 32px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", borderRadius: 12, color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer",
              }}>
                Start a conversation
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
              <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px" }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 24, display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                      background: msg.role === "user" ? "#4f46e5" : "linear-gradient(135deg, #6366f1, #a78bfa)",
                      color: "#fff",
                    }}>
                      {msg.role === "user" ? "U" : "Q"}
                    </div>
                    <div style={{
                      maxWidth: "75%", padding: "12px 16px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: msg.role === "user" ? "#4f46e5" : "#1a1f35",
                      border: msg.role === "user" ? "none" : "1px solid #1e293b",
                      fontSize: 14, lineHeight: 1.7, color: "#e2e8f0",
                    }}>
                      {renderContent(msg.content)}
                    </div>
                  </div>
                ))}
                {streaming && streamText && (
                  <div style={{ marginBottom: 24, display: "flex", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: "linear-gradient(135deg, #6366f1, #a78bfa)", color: "#fff" }}>Q</div>
                    <div style={{ maxWidth: "75%", padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "#1a1f35", border: "1px solid #1e293b", fontSize: 14, lineHeight: 1.7 }}>
                      {renderContent(streamText)}
                      <span style={{ display: "inline-block", width: 8, height: 18, background: "#6366f1", borderRadius: 2, marginLeft: 2, animation: "pulse 1s infinite" }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input */}
            <div style={{ borderTop: "1px solid #1e293b", padding: "16px 20px", background: "#0d1220" }}>
              <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", gap: 12, alignItems: "flex-end" }}>
                <textarea ref={inputRef} value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Message QCoreAI..."
                  disabled={streaming} rows={1}
                  style={{
                    flex: 1, background: "#151b2e", border: "1px solid #1e293b", borderRadius: 12,
                    padding: "12px 16px", color: "#e2e8f0", fontSize: 14, resize: "none", outline: "none",
                    maxHeight: 150, lineHeight: 1.5, fontFamily: "inherit",
                  }}
                />
                <button onClick={sendMessage} disabled={streaming || !input.trim()}
                  style={{
                    padding: "12px 20px", background: streaming || !input.trim() ? "#1e293b" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none", borderRadius: 12, color: streaming || !input.trim() ? "#475569" : "#fff",
                    fontWeight: 600, fontSize: 14, cursor: streaming || !input.trim() ? "default" : "pointer", transition: "all 0.2s",
                  }}>
                  {streaming ? "⏳" : "Send"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        textarea::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}
