"use client";

import { useState } from "react";

export function TopupForm({
  onTopup,
}: {
  onTopup: (amount: number) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const submit = async () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    const ok = await onTopup(n);
    if (ok) setAmount("");
    setBusy(false);
  };

  return (
    <section
      style={{
        border: "1px solid rgba(16,185,129,0.25)",
        borderRadius: 16,
        padding: 20,
        background: "rgba(16,185,129,0.03)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12, color: "#065f46" }}>
        Top up (demo)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 140px" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
            Amount AEC
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 14,
            }}
          />
        </div>
        <button
          onClick={() => void submit()}
          disabled={busy}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: busy ? "#94a3b8" : "#059669",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: busy ? "default" : "pointer",
            whiteSpace: "nowrap" as const,
          }}
        >
          {busy ? "Adding…" : "Top up"}
        </button>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>
        Demo instant credit. Real card / crypto rails will replace this.
      </div>
    </section>
  );
}
