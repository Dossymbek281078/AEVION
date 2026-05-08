"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

/* Embeddable QCoreAI chat widget. URL params:
   theme=light|dark   (default: light)
   strategy=sequential|parallel|debate
   compact=1          (no header, tighter padding)
   title=...          (custom title)
*/

type Msg = { role: "user" | "assistant"; content: string; loading?: boolean };

function WidgetContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "demo";

  const theme = searchParams?.get("theme") === "dark" ? "dark" : "light";
  const strategy = (searchParams?.get("strategy") || "sequential") as "sequential" | "parallel" | "debate";
  const compact = searchParams?.get("compact") === "1";
  const title = searchParams?.get("title") || "QCoreAI";

  const isDark = theme === "dark";
  const bg = isDark ? "#0f172a" : "#ffffff";
  const fg = isDark ? "#f1f5f9" : "#0f172a";
  const surface = isDark ? "#1e293b" : "#f8fafc";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.12)";
  const accent = "#7c3aed";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || busy) return;
    setInput("");
    setBusy(true);
    const loadingId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "assistant", content: "", loading: true },
    ]);

    try {
      const res = await fetch(apiUrl("/api/qcoreai/multi-agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: msg, strategy, sessionId }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          if (!part.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(part.slice(5).trim());
            if (evt.type === "session" && !sessionId) setSessionId(evt.sessionId);
            if (evt.type === "final") finalContent = evt.content;
          } catch { /* skip */ }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.findLastIndex((m) => m.loading);
        if (lastIdx >= 0) next[lastIdx] = { role: "assistant", content: finalContent || "Done.", loading: false };
        return next;
      });
    } catch (e: any) {
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.findLastIndex((m) => m.loading);
        if (lastIdx >= 0) next[lastIdx] = { role: "assistant", content: "⚠ Error: " + e.message, loading: false };
        return next;
      });
    } finally {
      setBusy(false);
      setTimeout(() => textRef.current?.focus(), 50);
    }
  }, [input, busy, strategy, sessionId]);

  const SUGGESTIONS = ["What can you help me with?", "Summarise recent news in AI", "Write a short executive summary"];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: bg, color: fg, fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14, boxSizing: "border-box",
    }}>
      {/* Header */}
      {!compact && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: surface }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 900 }}>✦</div>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{title}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${accent}22`, color: accent, marginLeft: "auto" }}>{strategy}</span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: compact ? "12px" : "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "auto", paddingBottom: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
            <div style={{ fontWeight: 700, marginBottom: 4, color: isDark ? "#94a3b8" : "#475569" }}>Ask me anything</div>
            <div style={{ fontSize: 12, color: isDark ? "#64748b" : "#94a3b8", marginBottom: 16 }}>Powered by AEVION QCoreAI</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} style={{
                  padding: "6px 12px", borderRadius: 999, border: `1px solid ${border}`,
                  background: "transparent", color: isDark ? "#94a3b8" : "#64748b",
                  fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.role === "user" ? accent : surface,
              color: m.role === "user" ? "#fff" : fg,
              border: m.role === "user" ? "none" : `1px solid ${border}`,
              lineHeight: 1.6, whiteSpace: "pre-wrap", fontSize: 13,
            }}>
              {m.loading ? <span style={{ animation: "pulse 1.2s ease-in-out infinite", opacity: 0.6 }}>Thinking…</span> : m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: compact ? "10px" : "14px", borderTop: `1px solid ${border}`, flexShrink: 0, background: surface }}>
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message… (Enter to send)"
            rows={1}
            disabled={busy}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 10,
              border: `1px solid ${border}`, background: bg, color: fg,
              fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none",
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || busy}
            style={{
              padding: "0 16px", borderRadius: 10, border: "none",
              background: !input.trim() || busy ? (isDark ? "#334155" : "#cbd5e1") : accent,
              color: "#fff", fontWeight: 800, fontSize: 13, cursor: !input.trim() || busy ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            {busy ? "…" : "↑"}
          </button>
        </div>
        <div style={{ fontSize: 9, color: isDark ? "#475569" : "#cbd5e1", marginTop: 6, textAlign: "center" }}>
          Powered by <span style={{ fontWeight: 700, color: isDark ? "#64748b" : "#94a3b8" }}>AEVION QCoreAI</span>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: "#94a3b8" }}>Loading…</div>}>
      <WidgetContent />
    </Suspense>
  );
}
