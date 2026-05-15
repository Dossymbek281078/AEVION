"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

// Stages must match backend's STAGES tuple in routes/startupExchange.ts.
const STAGES = [
  { id: "idea", label: "Idea" },
  { id: "prototype", label: "Prototype" },
  { id: "mvp", label: "MVP" },
  { id: "scaling", label: "Scaling" },
] as const;

type SubmitResult = {
  id: number;
  qrightProtected: boolean;
  contentHash: string;
};

interface Props {
  onSubmitted: (result: SubmitResult) => void;
}

export function SubmitIdeaForm({ onSubmitted }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<string>("idea");
  const [founderEmail, setFounderEmail] = useState("");
  const [contactMethod, setContactMethod] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const resp = await fetch(apiUrl("/api/startupx/ideas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          stage,
          founderEmail: founderEmail.trim() || undefined,
          contactMethod: contactMethod.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        setError(typeof data?.error === "string" ? data.error : `HTTP ${resp.status}`);
        return;
      }
      onSubmitted({
        id: data.data.id,
        qrightProtected: Boolean(data.data.qrightProtected),
        contentHash: String(data.data.contentHash ?? ""),
      });
      // Reset form on success.
      setTitle("");
      setDescription("");
      setStage("idea");
      setFounderEmail("");
      setContactMethod("");
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
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 24,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>
        Подать идею
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>
        Идея автоматически получает SHA-256 IP-метку (QRight-совместимая) перед публикацией.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={fieldLabel}>Название*</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          style={input}
          placeholder="напр. MedScanAI — диагностика рентгенов по сетям клиник"
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={fieldLabel}>Описание*</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          maxLength={4000}
          rows={5}
          style={{ ...input, resize: "vertical" }}
          placeholder="Проблема, решение, отличие, текущая стадия, нужные средства."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={fieldLabel}>Стадия</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            style={input}
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>Email основателя</label>
          <input
            type="email"
            value={founderEmail}
            onChange={(e) => setFounderEmail(e.target.value)}
            maxLength={200}
            style={input}
            placeholder="founder@example.com"
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={fieldLabel}>Способ связи (Telegram, LinkedIn, и пр.)</label>
        <input
          value={contactMethod}
          onChange={(e) => setContactMethod(e.target.value)}
          maxLength={500}
          style={input}
          placeholder="@my_telegram · https://linkedin.com/in/me"
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

      <button
        type="submit"
        disabled={busy || !title.trim() || !description.trim()}
        style={{
          width: "100%",
          padding: "11px 0",
          borderRadius: 10,
          border: "none",
          background: busy ? "#a78bfa" : "#7c3aed",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          cursor: busy ? "wait" : "pointer",
          opacity: !title.trim() || !description.trim() ? 0.6 : 1,
        }}
      >
        {busy ? "Подаю…" : "Защитить + опубликовать"}
      </button>
    </form>
  );
}
