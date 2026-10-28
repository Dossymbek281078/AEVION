"use client";

import { useState } from "react";
import { encryptPlaintext } from "./cryptoHelpers";
import { useShadowT } from "../i18n";

interface Props {
  onPosted?: () => void;
}

export default function EncryptedPostForm({ onPosted }: Props) {
  const [alias, setAlias] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [password, setPassword] = useState("");
  // ok — зелёная плашка; прежде цвет решала приставка «error:» в самом тексте
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useShadowT();
  const ошибка = (text: string) => setStatus({ ok: false, text });

  async function submit() {
    setStatus(null);
    if (!alias || !/^[a-zA-Z0-9_-]{2,64}$/.test(alias)) {
      ошибка(t("form.errAlias"));
      return;
    }
    if (!plaintext.trim()) {
      ошибка(t("form.errText"));
      return;
    }
    if (password.length < 8) {
      ошибка(t("form.errPassword"));
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
        setStatus({ ok: true, text: t("form.stored", { id: j.data.id }) });
        setPlaintext("");
        setPassword("");
        onPosted?.();
      } else {
        ошибка(t("form.errServer"));
      }
    } catch {
      ошибка(t("form.offline"));
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
        {t("form.title")}
      </h3>
      <p style={{ color: "#a78bfa", fontSize: "12px", margin: "0 0 16px 0", lineHeight: 1.5 }}>
        {t("form.sub")}
      </p>

      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>{t("form.alias")}</label>
        <input aria-label={t("form.alias")}
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder={t("form.aliasPh")}
          style={inputStyle}
          disabled={busy}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>{t("form.text")}</label>
        <textarea aria-label={t("form.text")}
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          rows={5}
          placeholder={t("form.textPh")}
          style={{ ...inputStyle, resize: "vertical", minHeight: "100px" }}
          disabled={busy}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{t("form.password")}</label>
        <input aria-label={t("form.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("form.passwordPh")}
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
        {busy ? t("form.encrypting") : t("form.submit")}
      </button>

      {status && (
        // role="status": экранный чтец объявляет итог публикации
        <div
          role="status"
          style={{
            marginTop: "14px",
            padding: "10px",
            background: !status.ok
              ? "rgba(239,68,68,0.1)"
              : "rgba(34,211,238,0.08)",
            border: `1px solid ${!status.ok ? "rgba(239,68,68,0.4)" : "rgba(34,211,238,0.4)"}`,
            borderRadius: "6px",
            color: !status.ok ? "#fca5a5" : "#a5f3fc",
            fontSize: "12px",
            fontFamily: "monospace",
          }}
        >
          {status.text}
        </div>
      )}
    </div>
  );
}
