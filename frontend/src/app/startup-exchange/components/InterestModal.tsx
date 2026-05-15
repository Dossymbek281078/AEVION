"use client";

import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/apiBase";
import type { Idea } from "./IdeaCard";

interface Props {
  idea: Idea;
  onClose: () => void;
  onSubmitted: (ideaId: number) => void;
}

export function InterestModal({ idea, onClose, onSubmitted }: Props) {
  const [investorEmail, setInvestorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Close on ESC.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl(`/api/startupx/ideas/${idea.id}/interest`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorEmail: investorEmail.trim(),
          message: message.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        setError(typeof data?.error === "string" ? data.error : `HTTP ${resp.status}`);
        return;
      }
      setDone(true);
      onSubmitted(idea.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit failed");
    } finally {
      setBusy(false);
    }
  }

  const fieldLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 6,
    display: "block",
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Заявка инвестора
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>
              {idea.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {done ? (
          <div>
            <p style={{ fontSize: 14, color: "#15803d", margin: "0 0 14px" }}>
              Спасибо — основатель получит вашу заявку. Контакт основателя:
              {" "}
              {idea.contact_method || <span style={{ color: "#94a3b8" }}>скрыт</span>}.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Ваш email*</label>
              <input
                type="email"
                value={investorEmail}
                onChange={(e) => setInvestorEmail(e.target.value)}
                required
                maxLength={200}
                style={input}
                placeholder="investor@example.com"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Сообщение (опционально)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                style={{ ...input, resize: "vertical" }}
                placeholder="Чем заинтересовал проект, ваш ticket size, ожидания…"
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={busy || !investorEmail.trim()}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: busy ? "#a78bfa" : "#7c3aed",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: busy ? "wait" : "pointer",
                  opacity: !investorEmail.trim() ? 0.6 : 1,
                }}
              >
                {busy ? "Отправляю…" : "Отправить интерес"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
