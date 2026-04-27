"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { QRCodeView } from "../_components/QRCode";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";

// Standalone "scan-to-pay" page. Generates a QR encoding the payment intent
// in URL form, plus a human-readable receipt and a deep link back into the
// AEVION wallet. No auth required to view — the QR itself is the share
// surface; recipients open AEVION (or scan) and confirm the transfer there.
//
// Query params supported:
//   ?to=acc_xxx        receiver accountId (or email)
//   ?amount=42.50      AEC amount
//   ?note=coffee       optional memo
//   ?label=Lana%20K    optional friendly name to display

export default function BankPayPage() {
  const { t } = useI18n();
  const search = useSearchParams();
  const [code] = useState<CurrencyCode>(() =>
    typeof window === "undefined" ? "AEC" : loadCurrency(),
  );
  const [copied, setCopied] = useState<boolean>(false);

  const to = (search?.get("to") ?? "").slice(0, 80);
  const amountRaw = search?.get("amount") ?? "";
  const amount = parseFloat(amountRaw);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const note = (search?.get("note") ?? "").slice(0, 200);
  const label = (search?.get("label") ?? "").slice(0, 64);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://aevion.app";

  const qrPayload = useMemo(() => {
    // aevion://pay?to=...&amount=... is the canonical schema; fallback to a
    // self-resolving https URL so non-AEVION QR scanners still land somewhere
    // useful.
    const params = new URLSearchParams();
    if (to) params.set("to", to);
    if (amountValid) params.set("amount", amount.toFixed(2));
    if (note) params.set("note", note);
    return `${origin}/bank/pay?${params.toString()}`;
  }, [origin, to, amount, amountValid, note]);

  const deepLink = useMemo(() => {
    const params = new URLSearchParams();
    if (to) params.set("to", to);
    if (amountValid) params.set("amount", amount.toFixed(2));
    if (note) params.set("note", note);
    params.set("from", "qr");
    return `/bank?${params.toString()}`;
  }, [to, amount, amountValid, note]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  if (!to) {
    return <Bad t={t} />;
  }

  const displayName = label || (to.length > 24 ? `${to.slice(0, 12)}…${to.slice(-8)}` : to);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #ecfeff 100%)",
        padding: "32px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Link
        href="/bank"
        style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700, marginBottom: 18 }}
      >
        ← {t("pay.backToBank")}
      </Link>

      <section
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderRadius: 22,
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 12px 40px rgba(15,23,42,0.10)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#0d9488",
          }}
        >
          {t("pay.kicker")}
        </div>

        {amountValid ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>
              {t("pay.amountTo", { name: displayName })}
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1, color: "#0f172a", marginTop: 4 }}>
              {formatCurrency(amount, code)}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>
              {t("pay.openWallet", { name: displayName })}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 6, fontFamily: "ui-monospace, monospace" }}>
              {displayName}
            </div>
          </div>
        )}

        {note ? (
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(13,148,136,0.08)",
              color: "#0f766e",
              fontSize: 12,
              fontWeight: 700,
              maxWidth: 360,
              textAlign: "center",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            "{note}"
          </div>
        ) : null}

        <div
          style={{
            padding: 14,
            borderRadius: 16,
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.06)",
          }}
        >
          <QRCodeView value={qrPayload} size={220} />
        </div>

        <Link
          href={deepLink}
          style={{
            width: "100%",
            padding: "14px 22px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            textDecoration: "none",
            textAlign: "center",
            boxShadow: "0 6px 18px rgba(14,165,233,0.30)",
          }}
        >
          {t("pay.cta.openInWallet")}
        </Link>

        <button
          type="button"
          onClick={() => copy(qrPayload)}
          style={{
            width: "100%",
            padding: "10px 18px",
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,0.15)",
            background: copied ? "#059669" : "#fff",
            color: copied ? "#fff" : "#475569",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {copied ? t("pay.copied") : t("pay.copyLink")}
        </button>

        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.55,
            paddingTop: 4,
            borderTop: "1px solid rgba(15,23,42,0.06)",
            width: "100%",
          }}
        >
          {t("pay.hint")}
        </div>
      </section>
    </main>
  );
}

function Bad({ t }: { t: (k: string) => string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }} aria-hidden="true">
        ⊘
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
        {t("pay.bad.title")}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, maxWidth: 420, textAlign: "center", lineHeight: 1.5 }}>
        {t("pay.bad.body")}
      </div>
      <Link
        href="/bank"
        style={{
          marginTop: 18,
          padding: "10px 18px",
          borderRadius: 10,
          background: "#0f172a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {t("pay.bad.cta")}
      </Link>
    </main>
  );
}
