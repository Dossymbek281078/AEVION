"use client";

import { useState, FormEvent } from "react";
import { getApiBase } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";

type Props = {
  campaignId: string;
  currency: string;
  status: string;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; amountCents: number }
  | { kind: "error"; message: string };

export default function DonateForm({ campaignId, currency, status }: Props) {
  const [amount, setAmount] = useState<string>("25");
  const [donorName, setDonorName] = useState<string>("");
  const [donorEmail, setDonorEmail] = useState<string>("");
  const [messageText, setMessageText] = useState<string>("");
  const [anonymous, setAnonymous] = useState<boolean>(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const { t } = useI18n();

  const isActive = status === "active";
  const isSubmitting = state.kind === "submitting";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isActive || isSubmitting) return;

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setState({ kind: "error", message: t("qgood.donate.err.amount") });
      return;
    }
    const amountCents = Math.round(amountNum * 100);

    const body: Record<string, unknown> = {
      amountCents,
      currency,
      anonymous,
    };
    if (!anonymous && donorName.trim()) body.donorName = donorName.trim();
    if (donorEmail.trim()) body.donorEmail = donorEmail.trim();
    if (messageText.trim()) body.messageText = messageText.trim();

    setState({ kind: "submitting" });

    try {
      const r = await fetch(`${getApiBase()}/api/qgood/campaigns/${encodeURIComponent(campaignId)}/donations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        let msg: string;
        if (data && typeof data.error === "string") {
          const k = errKey(data.error);
          msg = k ? t(k) : data.error.replace(/_/g, " ");
        } else if (data && typeof data.message === "string") {
          msg = data.message;
        } else {
          msg = t("qgood.donate.err.http", { status: r.status });
        }
        setState({ kind: "error", message: msg });
        return;
      }
      setState({ kind: "success", amountCents: Number(data?.amountCents ?? amountCents) });
      setAmount("25");
      setDonorName("");
      setDonorEmail("");
      setMessageText("");
      setAnonymous(false);
    } catch (err) {
      setState({ kind: "error", message: t("qgood.donate.err.network") });
    }
  }

  if (!isActive) {
    return (
      <div style={cardBox}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 6 }}>
          {t("qgood.donate.closed.title")}
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
          {t("qgood.donate.closed.body", { status })}
        </p>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div style={cardBox}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#34d399", marginBottom: 8 }}>
          {t("qgood.donate.success.title")}
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
          {t("qgood.donate.success.body")}
        </p>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          style={primaryBtn}
        >
          {t("qgood.donate.again")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={cardBox}>
      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: "#f1f5f9" }}>
        {t("qgood.donate.title")}
      </div>

      <label style={labelStyle}>
        {t("qgood.donate.amount", { currency })}
        <div style={{ position: "relative", marginTop: 4 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 13 }}>$</span>
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 24 }}
          />
        </div>
      </label>

      <div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["10", "25", "50", "100", "250"].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setAmount(q)}
            style={{
              padding: "6px 10px",
              background: amount === q ? "rgba(16,185,129,0.2)" : "#0f172a",
              border: amount === q ? "1px solid #34d399" : "1px solid #334155",
              color: amount === q ? "#34d399" : "#94a3b8",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ${q}
          </button>
        ))}
      </div>

      <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          style={{ accentColor: "#10b981", width: 16, height: 16, cursor: "pointer" }}
        />
        <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{t("qgood.donate.anon")}</span>
      </label>

      {!anonymous && (
        <label style={labelStyle}>
          {t("qgood.donate.name")}
          <input
            type="text"
            maxLength={120}
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder={t("qgood.donate.name.ph")}
            style={inputStyle}
          />
        </label>
      )}

      <label style={labelStyle}>
        {t("qgood.donate.email")}
        <input
          type="email"
          maxLength={200}
          value={donorEmail}
          onChange={(e) => setDonorEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        {t("qgood.donate.message")}
        <textarea
          maxLength={500}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={t("qgood.donate.message.ph")}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>

      {state.kind === "error" && (
        <div style={{ padding: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>
          {state.message}
        </div>
      )}

      <button type="submit" disabled={isSubmitting} style={{ ...primaryBtn, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? "wait" : "pointer" }}>
        {isSubmitting ? t("qgood.donate.processing") : t("qgood.donate.submit", { amount: amount || "0" })}
      </button>

      <p style={{ fontSize: 10, color: "#64748b", margin: 0, marginTop: 10, lineHeight: 1.5 }}>
        {t("qgood.donate.mvpNote")}
      </p>
    </form>
  );
}

const KNOWN_DONATE_ERRORS = new Set([
  "campaign_not_found", "campaign_not_active", "currency_mismatch",
  "invalid_amount", "amount_too_small", "amount_too_large",
  "invalid_email", "invalid_currency", "rate_limited",
]);
// Maps a known backend error code to its i18n key, or null for unknown codes
// (caller falls back to a humanized form of the raw code).
function errKey(code: string): string | null {
  return KNOWN_DONATE_ERRORS.has(code) ? `qgood.donate.err.${code}` : null;
}

const cardBox: React.CSSProperties = {
  padding: 18,
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  marginTop: 4,
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 13,
  fontWeight: 500,
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 16px",
  background: "#10b981",
  color: "#062e22",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  letterSpacing: "0.02em",
};
