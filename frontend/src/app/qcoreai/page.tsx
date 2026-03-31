"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Msg = { role: "user" | "assistant" | "system"; content: string };

const SUGGESTIONS = [
  "What is AEVION?",
  "How does QRight protect my IP?",
  "Explain Trust Graph",
  "How do automatic royalties work?",
  "What makes AEVION worth $1B?",
];

export default function QCoreAIPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "system", content: "You are QCoreAI, the AI assistant for the AEVION ecosystem. Answer concisely and helpfully in English. You know about all 29 AEVION modules: QRight (IP registry), QSign (cryptographic signatures), IP Bureau (patent bureau), Planet (compliance and certification), AEVION Bank (digital wallet and royalties), CyberChess (chess platform), Awards (music and film), Auth (identity), and more." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || busy) return;
    const nextMsgs: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(nextMsgs);
    setInput("");
    setErr(null);
    setBusy(true);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      try { const t = localStorage.getItem("aevion_auth_token_v1"); if (t) headers.Authorization = `Bearer ${t}`; } catch {}
      const res = await fetch(apiUrl("/api/qcoreai/chat"), { method: "POST", headers, body: JSON.stringify({ messages: nextMsgs }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const reply = typeof data?.reply === "string" ? data.reply : JSON.stringify(data, null, 2);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I am currently offline. The AI engine needs an API key configured on the backend. Try again later or explore the platform modules directly." }]);
    } finally { setBusy(false); }
  }, [busy, input, messages]);

  const visible = messages.filter((m) => m.role !== "system");

  return (
    <main>
      <ProductPageShell maxWidth={840}>
        <Wave1Nav />
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)", padding: "24px 24px 18px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900 }}>AI</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>QCoreAI</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Multi-model AI assistant for the AEVION ecosystem</p>
              </div>
            </div>
          </div>
        </div>

        <div ref={chatRef} style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 16, minHeight: 320, maxHeight: 480, overflowY: "auto", background: "#f8fafc", marginBottom: 12 }}>
          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>Welcome to QCoreAI</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Ask me anything about AEVION — IP protection, signatures, royalties, or how to get started.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 12, color: "#475569", cursor: "pointer", fontWeight: 600 }}>{s}</button>
                ))}
              </div>
            </div>
          ) : visible.map((m, i) => (
            <div key={i} style={{ marginBottom: 14, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" ? <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0, marginRight: 8, marginTop: 2 }}>AI</div> : null}
              <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: m.role === "user" ? "#0f172a" : "#fff", color: m.role === "user" ? "#fff" : "#0f172a", border: m.role === "user" ? "none" : "1px solid rgba(15,23,42,0.08)", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" as const, boxShadow: m.role === "assistant" ? "0 1px 4px rgba(15,23,42,0.06)" : "none" }}>{m.content}</div>
            </div>
          ))}
          {busy ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}><div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>AI</div><div style={{ padding: "8px 14px", borderRadius: 14, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", fontSize: 13, color: "#94a3b8" }}>Thinking...</div></div> : null}
        </div>

        {err ? <div style={{ color: "#dc2626", marginBottom: 8, fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)" }}>{err}</div> : null}

        <div style={{ display: "flex", gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} placeholder="Ask QCoreAI anything..." disabled={busy}
            style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none" }} />
          <button type="button" onClick={() => send()} disabled={busy || !input.trim()}
            style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: busy ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: busy ? "default" : "pointer" }}>
            {busy ? "..." : "Send"}
          </button>
        </div>

        <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)" }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>QCoreAI capabilities</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {[
              { icon: "🧠", t: "Multi-model", d: "Claude, GPT-4, Gemini — best model per task" },
              { icon: "🔐", t: "Context-aware", d: "Knows your QRight records, Trust Score, history" },
              { icon: "⚡", t: "Real-time", d: "WebSocket streaming for instant responses" },
              { icon: "🌍", t: "Multilingual", d: "English, Russian, and 50+ languages" },
            ].map((f) => (
              <div key={f.t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <div><div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{f.t}</div><div style={{ fontSize: 11, color: "#64748b" }}>{f.d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
