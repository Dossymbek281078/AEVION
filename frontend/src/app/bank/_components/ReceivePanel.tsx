"use client";

// Closes the P2P request loop: a wallet owner enters an optional amount
// and memo, the panel encodes a payment-request URL via the existing
// util, and renders the holographic QR. A friend scans it; their device
// opens /bank?to=...&amount=...&memo=... which auto-prefills the send
// form (decodePaymentRequest already wired in BankContent).
//
// Design choice: amount is optional. An empty amount produces a "request
// any amount" QR — useful for tip jars / open invoices. A non-empty
// amount locks the QR to that exact value.

import { useMemo, useState } from "react";
import type { Account } from "../_lib/types";
import { absoluteRequestUrl, encodePaymentRequest } from "../_lib/paymentRequest";
import { QRCodeView } from "./QRCode";

export function ReceivePanel({ account }: { account: Account }) {
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [copied, setCopied] = useState<"link" | "id" | null>(null);

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [amount]);

  const link = useMemo(
    () =>
      absoluteRequestUrl({
        to: account.id,
        amount: parsedAmount,
        memo: memo.trim() || undefined,
      }),
    [account.id, parsedAmount, memo],
  );

  const relativePath = useMemo(
    () =>
      encodePaymentRequest({
        to: account.id,
        amount: parsedAmount,
        memo: memo.trim() || undefined,
      }),
    [account.id, parsedAmount, memo],
  );

  const copy = async (text: string, key: "link" | "id") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 16,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 18,
        alignItems: "center",
      }}
      aria-label="Receive AEC"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <header>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
            Receive AEC
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.5 }}>
            Show this QR to a friend. Their device opens a prefilled send form on /bank — no
            address typing.
          </div>
        </header>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: "#475569" }}>
          Amount (AEC, optional)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="any"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 13,
              fontFamily: "ui-monospace, monospace",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: "#475569" }}>
          Memo (optional)
          <input
            type="text"
            value={memo}
            maxLength={140}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Lunch · Concert ticket · Tip"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 13,
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void copy(link, "link")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(124,58,237,0.30)",
              background: copied === "link" ? "#7c3aed" : "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(14,165,233,0.10))",
              color: copied === "link" ? "#fff" : "#4c1d95",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {copied === "link" ? "Copied ✓" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => void copy(account.id, "id")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              background: copied === "id" ? "#0f172a" : "#fff",
              color: copied === "id" ? "#fff" : "#0f172a",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {copied === "id" ? "Copied ✓" : "Copy account id"}
          </button>
        </div>

        <code
          style={{
            fontSize: 10,
            color: "#94a3b8",
            fontFamily: "ui-monospace, monospace",
            wordBreak: "break-all",
            overflowWrap: "break-word",
          }}
        >
          {relativePath}
        </code>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <QRCodeView value={link} size={160} />
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {parsedAmount ? `${parsedAmount.toFixed(2)} AEC` : "open amount"}
        </div>
      </div>
    </section>
  );
}
