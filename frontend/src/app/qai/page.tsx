"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2);
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

export default function QAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load or create sessionId from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("qai_session_id");
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = generateId() + generateId();
      localStorage.setItem("qai_session_id", newId);
      setSessionId(newId);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    const newId = generateId() + generateId();
    setSessionId(newId);
    localStorage.setItem("qai_session_id", newId);
    setMessages([]);
    setError(null);
    setInput("");
    textareaRef.current?.focus();
  };

  return (
    <>
      <Wave1Nav />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 64px)",
          background: "#f8fafc",
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
          <button
            onClick={newChat}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#374151",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            + New chat
          </button>
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
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
                {msg.role === "assistant" && <CopyButton text={msg.content} />}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "12px 20px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  color: "#94a3b8",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#0d9488",
                    animation: "pulse 1s ease-in-out infinite",
                  }}
                />
                Thinking...
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
    </>
  );
}
