"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { QRCodeView } from "../../_components/QRCode";
import { listAccounts, listOperations } from "../../_lib/api";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../../_lib/currency";
import { loadSignatures, type SignedOperation } from "../../_lib/signatures";
import type { Account, Operation } from "../../_lib/types";

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { t, lang } = useI18n();
  const id = params?.id || "";
  const wantsAutoPrint = (search?.get("print") || "") === "1";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [signatures, setSignatures] = useState<SignedOperation[]>([]);
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setCode(loadCurrency());
    setSignatures(loadSignatures());
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const op = useMemo(() => operations.find((o) => o.id === id) ?? null, [operations, id]);
  const myAccount = accounts[0] ?? null;
  const signature = useMemo(
    () => signatures.find((s) => s.id === id) ?? null,
    [signatures, id],
  );

  const counterpartyId = useMemo(() => {
    if (!op || !myAccount) return null;
    if (op.kind === "topup") return null;
    return op.from === myAccount.id ? op.to : op.from;
  }, [op, myAccount]);

  const counterparty = useMemo(
    () => accounts.find((a) => a.id === counterpartyId) ?? null,
    [accounts, counterpartyId],
  );

  const direction: "in" | "out" | "topup" = useMemo(() => {
    if (!op || !myAccount) return "in";
    if (op.kind === "topup") return "topup";
    return op.from === myAccount.id ? "out" : "in";
  }, [op, myAccount]);

  // Auto-print once data loaded.
  useEffect(() => {
    if (!wantsAutoPrint || !loaded || !op) return;
    const t = window.setTimeout(() => window.print(), 1200);
    return () => window.clearTimeout(t);
  }, [wantsAutoPrint, loaded, op]);

  const formattedAmount = useMemo(() => {
    if (!op) return "";
    return formatCurrency(op.amount, code);
  }, [op, code]);

  const formattedDate = useMemo(() => {
    if (!op) return "";
    try {
      const d = new Date(op.createdAt);
      return new Intl.DateTimeFormat(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(d);
    } catch {
      return op.createdAt;
    }
  }, [op, lang]);

  const verifyUrl = origin ? `${origin}/bank/receipt/${id}` : "";

  if (loaded && !op) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#fff",
          color: "#0f172a",
          padding: "32px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#dc2626", textTransform: "uppercase" }}>
            {t("receipt.notFound.kicker")}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginTop: 8, lineHeight: 1.15 }}>
            {t("receipt.notFound.title")}
          </h1>
          <p style={{ fontSize: 14, color: "#475569", marginTop: 12, lineHeight: 1.55 }}>
            {t("receipt.notFound.body", { id: id || "—" })}
          </p>
          <Link
            href="/bank"
            style={{
              display: "inline-block",
              marginTop: 18,
              padding: "12px 18px",
              borderRadius: 10,
              background: "#0d9488",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ← {t("about.backToBank")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "24px 16px 48px",
      }}
    >
      <style>{`
        @media print {
          .receipt-no-print { display: none !important; }
          body { background: #fff !important; }
          main { background: #fff !important; padding: 0 !important; }
          .receipt-card {
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>

      <div className="receipt-no-print" style={{ maxWidth: 640, margin: "0 auto 16px" }}>
        <Link
          href="/bank"
          style={{
            fontSize: 12,
            color: "#64748b",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← {t("about.backToBank")}
        </Link>
      </div>

      <article
        className="receipt-card"
        style={{
          maxWidth: 640,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 4px 28px rgba(15,23,42,0.08)",
          padding: "32px 28px",
          border: "1px solid rgba(15,23,42,0.06)",
        }}
      >
        {/* Brand header */}
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: -1,
            }}
          >
            ₳
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#0d9488", textTransform: "uppercase" }}>
              AEVION · Bank
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
              {t("receipt.heading")}
            </div>
          </div>
        </header>

        {/* Status pill */}
        <div style={{ marginBottom: 24 }}>
          <span
            style={{
              display: "inline-block",
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 2,
              fontWeight: 800,
              textTransform: "uppercase",
              background:
                direction === "in"
                  ? "rgba(13,148,136,0.12)"
                  : direction === "out"
                    ? "rgba(217,70,239,0.12)"
                    : "rgba(99,102,241,0.12)",
              color: direction === "in" ? "#0d9488" : direction === "out" ? "#a21caf" : "#4f46e5",
            }}
          >
            {direction === "in"
              ? t("receipt.status.in")
              : direction === "out"
                ? t("receipt.status.out")
                : t("receipt.status.topup")}
          </span>
        </div>

        {/* Big amount */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase" }}>
            {t("receipt.amount")}
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: -1.5,
              marginTop: 4,
              color: direction === "out" ? "#0f172a" : "#0d9488",
            }}
          >
            {direction === "out" ? "−" : "+"}
            {loaded ? formattedAmount : "—"}
          </div>
        </div>

        {/* Field grid */}
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 18px", marginBottom: 28 }}>
          <Field label={t("receipt.f.id")} value={op?.id ?? "—"} mono />
          <Field label={t("receipt.f.kind")} value={
            op?.kind === "topup" ? t("receipt.kind.topup") : t("receipt.kind.transfer")
          } />
          <Field label={t("receipt.f.date")} value={loaded ? formattedDate : "—"} />
          {op?.kind === "transfer" && (
            <>
              <Field
                label={direction === "out" ? t("receipt.f.from") : t("receipt.f.to")}
                value={myAccount ? myAccount.owner : "—"}
              />
              <Field
                label={direction === "out" ? t("receipt.f.to") : t("receipt.f.from")}
                value={counterparty ? counterparty.owner : counterpartyId ?? "—"}
              />
            </>
          )}
          {op?.kind === "topup" && (
            <Field label={t("receipt.f.to")} value={myAccount ? myAccount.owner : "—"} />
          )}
        </dl>

        {/* Signature row */}
        <section
          style={{
            padding: 14,
            borderRadius: 12,
            background: signature ? "rgba(13,148,136,0.06)" : "rgba(100,116,139,0.06)",
            border: `1px solid ${signature ? "rgba(13,148,136,0.20)" : "rgba(100,116,139,0.18)"}`,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#0d9488", textTransform: "uppercase" }}>
                {t("receipt.qsign.kicker")}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                {signature
                  ? signature.verified === "valid"
                    ? t("receipt.qsign.verified")
                    : signature.verified === "invalid"
                      ? t("receipt.qsign.tampered")
                      : t("receipt.qsign.signed")
                  : t("receipt.qsign.unsigned")}
              </div>
              {signature && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                  {signature.algo} · {signature.signature.slice(0, 24)}…
                </div>
              )}
            </div>
            {signature && (
              <span
                aria-hidden
                style={{
                  fontSize: 24,
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background:
                    signature.verified === "valid"
                      ? "#0d9488"
                      : signature.verified === "invalid"
                        ? "#dc2626"
                        : "#0ea5e9",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                }}
              >
                {signature.verified === "valid" ? "✓" : signature.verified === "invalid" ? "!" : "·"}
              </span>
            )}
          </div>
        </section>

        {/* Verify QR */}
        <section
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            padding: 16,
            border: "1px dashed rgba(15,23,42,0.18)",
            borderRadius: 12,
            marginBottom: 18,
          }}
        >
          {verifyUrl ? <QRCodeView value={verifyUrl} size={120} /> : <div style={{ width: 120, height: 120 }} />}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#0d9488", textTransform: "uppercase" }}>
              {t("receipt.verify.kicker")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 4, lineHeight: 1.3 }}>
              {t("receipt.verify.title")}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 6, lineHeight: 1.5 }}>
              {t("receipt.verify.body")}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, monospace", wordBreak: "break-all" }}>
              {verifyUrl}
            </div>
          </div>
        </section>

        <footer
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px dashed rgba(15,23,42,0.12)",
            fontSize: 11,
            color: "#94a3b8",
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>{t("receipt.footer.brand")}</span>
          <span>{t("receipt.footer.disclaimer")}</span>
        </footer>
      </article>

      {/* Action bar — print, copy link, back */}
      <div
        className="receipt-no-print"
        style={{
          maxWidth: 640,
          margin: "16px auto 0",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            background: "#0f172a",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
          }}
        >
          {t("receipt.action.print")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!verifyUrl) return;
            navigator.clipboard?.writeText(verifyUrl).catch(() => {});
          }}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            background: "#fff",
            color: "#0f172a",
            fontSize: 13,
            fontWeight: 800,
            border: "1px solid rgba(15,23,42,0.14)",
            cursor: "pointer",
          }}
        >
          {t("receipt.action.copyLink")}
        </button>
        <Link
          href="/bank/statement"
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            background: "#fff",
            color: "#0f172a",
            fontSize: 13,
            fontWeight: 800,
            border: "1px solid rgba(15,23,42,0.14)",
            textDecoration: "none",
          }}
        >
          {t("receipt.action.viewStatement")}
        </Link>
        <Link
          href={`/bank/audit-log?q=${encodeURIComponent(id)}`}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            background: "#fff",
            color: "#0f172a",
            fontSize: 13,
            fontWeight: 800,
            border: "1px solid rgba(15,23,42,0.14)",
            textDecoration: "none",
          }}
        >
          ✎ Open in audit log
        </Link>
      </div>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", margin: 0, alignSelf: "center" }}>
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          color: "#0f172a",
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : undefined,
          wordBreak: "break-all",
        }}
      >
        {value}
      </dd>
    </>
  );
}
