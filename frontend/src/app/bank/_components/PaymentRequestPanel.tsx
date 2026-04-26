"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { absoluteRequestUrl } from "../_lib/paymentRequest";
import { QRCodeView } from "./QRCode";

type Props = {
  accountId: string;
  onCopy: (msg: string) => void;
};

export function PaymentRequestPanel({ accountId, onCopy }: Props) {
  const { t } = useI18n();
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [showQR, setShowQR] = useState<boolean>(false);

  const url = useMemo(() => {
    const n = parseFloat(amount);
    return absoluteRequestUrl({
      to: accountId,
      amount: Number.isFinite(n) && n > 0 ? n : undefined,
      memo: memo.trim() || undefined,
    });
  }, [accountId, amount, memo]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onCopy(t("preq.toast.copied"));
    } catch {
      onCopy(t("preq.toast.blocked"));
    }
  };

  const share = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      void copy();
      return;
    }
    try {
      await navigator.share({
        title: t("preq.share.title"),
        text: memo
          ? t("preq.share.text.memo", { amount, memo })
          : amount
          ? t("preq.share.text.amount", { amount })
          : t("preq.share.text.any"),
        url,
      });
    } catch {
      // user cancelled — ignore
    }
  };

  return (
    <section
      style={{
        border: "1px solid rgba(124,58,237,0.25)",
        borderRadius: 16,
        padding: 20,
        background: "linear-gradient(135deg, rgba(124,58,237,0.04), rgba(14,165,233,0.03))",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 15, color: "#4c1d95" }}>{t("preq.title")}</div>
        <button
          onClick={() => setShowQR((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(124,58,237,0.3)",
            background: "#fff",
            fontSize: 12,
            fontWeight: 700,
            color: "#4c1d95",
            cursor: "pointer",
          }}
        >
          {showQR ? t("preq.btn.hideQR") : t("preq.btn.showQR")}
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {showQR ? (
          <div style={{ flexShrink: 0 }}>
            <QRCodeView value={url} size={160} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, textAlign: "center" as const }}>
              {t("preq.qr.scanHint")}
            </div>
          </div>
        ) : null}
        <div style={{ flex: "1 1 240px", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
                {t("preq.field.amount")}
              </div>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.15)",
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ flex: "2 1 180px" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
                {t("preq.field.memo")}
              </div>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={t("preq.field.memo.placeholder")}
                maxLength={80}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.15)",
                  fontSize: 14,
                }}
              />
            </div>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#fff",
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              color: "#334155",
              overflow: "hidden" as const,
              textOverflow: "ellipsis" as const,
              whiteSpace: "nowrap" as const,
            }}
          >
            {url}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => void copy()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("preq.btn.copyLink")}
            </button>
            <button
              onClick={() => void share()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("preq.btn.share")}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
            {t("preq.footer")}
          </div>
        </div>
      </div>
    </section>
  );
}
