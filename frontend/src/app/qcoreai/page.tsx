"use client";

import { useCallback, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export default function QCoreAIPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "system",
      content:
        "Ты — QCoreAI, краткий ассистент экосистемы AEVION. Отвечай по делу, по-русски, без воды.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<string | null>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setInput("");
    setErr(null);
    setBusy(true);
    setLastMeta(null);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      try {
        const t = localStorage.getItem("aevion_auth_token_v1");
        if (t) headers.Authorization = `Bearer ${t}`;
      } catch {
        // ignore
      }

      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: nextMsgs }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const reply =
        typeof data?.reply === "string"
          ? data.reply
          : JSON.stringify(data, null, 2);

      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      setLastMeta(
        `mode=${data?.mode || "?"} model=${data?.model || "?"}`
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, input, messages]);

  return (
    <main>
      <ProductPageShell maxWidth={800}>
      <Wave1Nav />

      <h1 style={{ fontSize: 26, marginBottom: 8 }}>QCoreAI</h1>
      <p style={{ color: "#555", marginBottom: 16, lineHeight: 1.5 }}>
        Minimal chat via backend. С ключом <code>OPENAI_API_KEY</code> — ответы модели; без ключа —
        meaningful stub. Совместимый API: задайте <code>OPENAI_BASE_URL</code> (например локальный
        прокси).
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          minHeight: 280,
          maxHeight: 420,
          overflowY: "auto",
          background: "#fafafa",
          marginBottom: 12,
        }}
      >
        {messages
          .filter((m) => m.role !== "system")
          .map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 12,
                textAlign: m.role === "user" ? "right" : "left",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  maxWidth: "92%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: m.role === "user" ? "#111" : "#fff",
                  color: m.role === "user" ? "#fff" : "#111",
                  border: m.role === "user" ? "none" : "1px solid #e5e5e5",
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
      </div>

      {err && (
        <div style={{ color: "crimson", marginBottom: 10, fontSize: 14 }}>{err}</div>
      )}
      {lastMeta && (
        <div style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>{lastMeta}</div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Message..."
          disabled={busy}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 15,
          }}
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={busy || !input.trim()}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #111",
            background: busy ? "#999" : "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
      </ProductPageShell>
    </main>
  );
}
