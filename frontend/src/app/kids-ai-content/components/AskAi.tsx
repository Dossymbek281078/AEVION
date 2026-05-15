"use client";

import React, { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

interface Props {
  lessonId: number;
  lang: "ru" | "en" | "kz";
}

interface Message {
  role: "user" | "ai";
  text: string;
  provider?: string;
}

const wrapStyle: React.CSSProperties = {
  background: "#fffbeb",
  border: "2px solid #fde68a",
  borderRadius: 24,
  padding: 20,
  marginTop: 24,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
  fontSize: 18,
  fontWeight: 700,
  color: "#78350f",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "2px solid #fde68a",
  fontSize: 16,
  resize: "vertical",
  fontFamily: "inherit",
  boxSizing: "border-box",
  minHeight: 70,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 22px",
  borderRadius: 999,
  border: "none",
  background: "#f59e0b",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  fontFamily: "inherit",
};

const buttonDisabled: React.CSSProperties = {
  ...buttonStyle,
  background: "#fcd34d",
  cursor: "wait",
};

function messageStyle(role: "user" | "ai"): React.CSSProperties {
  return {
    margin: "10px 0",
    padding: "10px 14px",
    borderRadius: 16,
    background: role === "user" ? "#fef3c7" : "#ffffff",
    border: "1px solid #fde68a",
    fontSize: 15,
    lineHeight: 1.5,
    color: "#1c1917",
    whiteSpace: "pre-wrap",
  };
}

const placeholderByLang: Record<string, string> = {
  ru: "Например: А почему трава зелёная?",
  en: "For example: Why is grass green?",
  kz: "Мысалы: Шөп неге жасыл?",
};

const ctaByLang: Record<string, string> = {
  ru: "Спросить AI",
  en: "Ask AI",
  kz: "AI-дан сұрау",
};

export default function AskAi({ lessonId, lang }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function send() {
    const q = question.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/kids-ai/ask"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, question: q, lang }),
      });
      const data = (await r.json()) as { answer?: string; provider?: string };
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: data.answer ?? "...",
          provider: data.provider,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text:
            lang === "en"
              ? "Hmm, can't reach the AI right now. Try again soon!"
              : lang === "kz"
                ? "Қазір жауап жоқ. Сәл кейінірек қайта сұра!"
                : "Ой, сейчас AI не отвечает. Попробуй чуть позже!",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 28 }}>🤖</span>
        <span>Спроси AI-помощника</span>
      </div>

      {messages.map((m, i) => (
        <div key={i} style={messageStyle(m.role)}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {m.role === "user" ? "Ты" : "AI"}
            {m.provider ? (
              <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6, fontSize: 12 }}>
                · {m.provider}
              </span>
            ) : null}
          </div>
          <div>{m.text}</div>
        </div>
      ))}

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={placeholderByLang[lang] ?? placeholderByLang.ru}
        rows={2}
        style={inputStyle}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={loading || !question.trim()}
        style={loading || !question.trim() ? buttonDisabled : buttonStyle}
      >
        {loading ? "..." : (ctaByLang[lang] ?? ctaByLang.ru)}
      </button>
    </div>
  );
}
