"use client";

import { useState } from "react";
import { encryptPlaintext } from "./cryptoHelpers";

interface Props {
  onPosted?: () => void;
}

export default function EncryptedPostForm({ onPosted }: Props) {
  const [alias, setAlias] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setStatus(null);
    if (!alias || !/^[a-zA-Z0-9_-]{2,64}$/.test(alias)) {
      setStatus("error: alias must be 2-64 chars [A-Za-z0-9_-]");
      return;
    }
    if (!plaintext.trim()) {
      setStatus("error: plaintext required");
      return;
    }
    if (password.length < 8) {
      setStatus("error: password must be ≥ 8 chars");
      return;
    }

    setBusy(true);
    try {
      const payload = await encryptPlaintext(plaintext, password);
      const r = await fetch("/api-backend/api/shadownet/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, ...payload }),
      });
      const j = await r.json();
      if (j && j.success) {
        setStatus(`encrypted + stored. post id = ${j.data.id}`);
        setPlaintext("");
        setPassword("");
        onPosted?.();
      } else {
        setStatus("error: " + (j?.error || "server rejected"));
      }
    } catch (e) {
      setStatus("error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(168,85,247,0.4)",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#e9d5ff",
    fontFamily: "monospace",
    fontSize: "13px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    color: "#a855f7",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "6px",
    fontFamily: "monospace",
  };

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(168,85,247,0.4)",
        borderRadius: "10px",
        padding: "20px",
      }}
    >
      <h3
        style={{
          color: "#e9d5ff",
          fontSize: "16px",
          margin: "0 0 6px 0",
          fontFamily: "monospace",
        }}
      >
        encrypt &amp; post
      </h3>
      <p style={{ color: "#a78bfa", fontSize: "12px", margin: "0 0 16px 0", lineHeight: 1.5 }}>
        AES-GCM 256 + PBKDF2 (250k iterations). Шифрование в браузере — сервер
        видит только ciphertext + iv + salt. Пароль никогда не уходит из устройства.
      </p>

      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>alias (your handle)</label>
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="e.g. shadow_walker"
          style={inputStyle}
          disabled={busy}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>plaintext</label>
        <textarea
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          rows={5}
          placeholder="что хочешь зашифровать…"
          style={{ ...inputStyle, resize: "vertical", minHeight: "100px" }}
          disabled={busy}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>password (min 8 chars)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="strong passphrase"
          style={inputStyle}
          disabled={busy}
        />
      </div>

      <button
        onClick={submit}
        disabled={busy}
        style={{
          background: "#a855f7",
          color: "#000",
          border: "none",
          padding: "10px 24px",
          borderRadius: "6px",
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontSize: "12px",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "encrypting…" : "encrypt + post"}
      </button>

      {status && (
        <div
          style={{
            marginTop: "14px",
            padding: "10px",
            background: status.startsWith("error")
              ? "rgba(239,68,68,0.1)"
              : "rgba(34,211,238,0.08)",
            border: `1px solid ${status.startsWith("error") ? "rgba(239,68,68,0.4)" : "rgba(34,211,238,0.4)"}`,
            borderRadius: "6px",
            color: status.startsWith("error") ? "#fca5a5" : "#a5f3fc",
            fontSize: "12px",
            fontFamily: "monospace",
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}
