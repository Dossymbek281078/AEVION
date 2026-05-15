"use client";

import { useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface Props {
  alias: string;
}

const STARTERS = [
  "Сильно тянет, не справляюсь",
  "Срыв близко, что делать?",
  "Хочу выговориться",
];

export default function SupportChat({ alias }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message, ts: Date.now() }]);
    setDraft("");
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/psyapp-deps/support"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, alias }),
      });
      const d = await r.json();
      const reply = (d.reply as string | undefined) ?? "Сейчас не получается ответить. Сделай один маленький шаг прямо сейчас — выпей воды и подыши.";
      setMessages((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
      if (!r.ok && !d.reply) {
        setError(d.error || "AI временно недоступен");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сеть недоступна");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Связь прервана. Сделай один шаг прямо сейчас: 4 медленных вдоха, ладонь на грудь.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(draft);
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>AI-поддержка</h2>
      <p style={styles.hint}>
        Мягкий советник. Не диагноз, не терапия — просто рядом, когда нужно. До 5 запросов в минуту.
      </p>

      <div ref={scrollRef} style={styles.thread}>
        {messages.length === 0 ? (
          <div style={styles.starters}>
            <p style={styles.startersTitle}>Начни с чего-то простого:</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                style={styles.starterBtn}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                ...styles.bubble,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "#3f6f4f" : "#0f0c08",
                color: m.role === "user" ? "#f5ebd7" : "#d6c7a8",
                border: m.role === "user" ? "1px solid #5b9d70" : "1px solid #2a241c",
              }}
            >
              {m.content}
            </div>
          ))
        )}
        {loading ? <div style={styles.typing}>советник печатает…</div> : null}
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Расскажи, что происходит…"
          style={styles.input}
          maxLength={1000}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          style={{
            ...styles.send,
            opacity: loading || !draft.trim() ? 0.5 : 1,
            cursor: loading || !draft.trim() ? "not-allowed" : "pointer",
          }}
        >
          ↑
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#1a1510",
    border: "1px solid #3a342c",
    borderRadius: 16,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    minHeight: 380,
  },
  title: { margin: "0 0 6px 0", color: "#f5ebd7", fontSize: 18, fontWeight: 700 },
  hint: { margin: "0 0 14px 0", color: "#b8a98c", fontSize: 13, lineHeight: 1.5 },
  thread: {
    flex: 1,
    background: "#0a0805",
    border: "1px solid #2a241c",
    borderRadius: 12,
    padding: 12,
    minHeight: 220,
    maxHeight: 360,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  starters: { display: "flex", flexDirection: "column", gap: 8, padding: 12 },
  startersTitle: { margin: 0, color: "#9b8b6e", fontSize: 12, fontStyle: "italic" },
  starterBtn: {
    background: "#1f1a14",
    border: "1px solid #3a342c",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#d6c7a8",
    fontSize: 13,
    textAlign: "left",
    cursor: "pointer",
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  typing: { color: "#7d6f54", fontSize: 12, fontStyle: "italic", padding: "4px 12px" },
  error: {
    background: "#3a1f1f",
    color: "#f5b5b5",
    border: "1px solid #5a2f2f",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    marginBottom: 8,
  },
  form: { display: "flex", gap: 8 },
  input: {
    flex: 1,
    background: "#0f0c08",
    border: "1px solid #3a342c",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#f5ebd7",
    fontSize: 14,
    outline: "none",
  },
  send: {
    background: "#3f6f4f",
    color: "#f5ebd7",
    border: "none",
    borderRadius: 10,
    padding: "0 18px",
    fontSize: 18,
    fontWeight: 700,
  },
};
