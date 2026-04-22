"use client";

import { useState } from "react";
import { QRCodeView } from "./QRCode";

export function AccountIdCard({
  accountId,
  onCopy,
}: {
  accountId: string;
  onCopy: () => void;
}) {
  const [showQR, setShowQR] = useState<boolean>(false);

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Your account ID</div>
        <button
          onClick={() => setShowQR((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            fontSize: 12,
            fontWeight: 700,
            color: "#334155",
            cursor: "pointer",
          }}
        >
          {showQR ? "Hide QR" : "Show QR"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {showQR ? (
          <div style={{ flexShrink: 0 }}>
            <QRCodeView value={accountId} size={160} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, textAlign: "center" as const }}>
              Scan to get your ID
            </div>
          </div>
        ) : null}
        <div style={{ flex: "1 1 240px", minWidth: 240 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <code
              style={{
                flex: "1 1 220px",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "rgba(15,23,42,0.03)",
                fontSize: 13,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#0f172a",
                overflow: "hidden" as const,
                textOverflow: "ellipsis" as const,
                whiteSpace: "nowrap" as const,
              }}
            >
              {accountId}
            </code>
            <button
              onClick={onCopy}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Copy
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
            Share this ID with other creators to receive AEC. Or generate a payment request link
            below — it auto-fills amount and memo for them.
          </div>
        </div>
      </div>
    </section>
  );
}
