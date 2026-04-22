"use client";

import type { ReactNode } from "react";

export function BankHero({ email, extra }: { email?: string; extra?: ReactNode }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #4c1d95 100%)",
        padding: "32px 28px 28px",
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.08)",
          marginBottom: 14,
        }}
      >
        AEVION Bank · digital finance layer
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.03em" }}>
        Ecosystem digital bank
      </h1>
      <p style={{ margin: 0, fontSize: 15, opacity: 0.88, lineHeight: 1.6, maxWidth: 600 }}>
        Wallet, P2P transfers between creators, automatic royalties for content usage, Awards
        payouts. Every transaction linked to Trust Graph.
      </p>
      {email ? (
        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
          Signed in as <strong>{email}</strong>
        </div>
      ) : null}
      {extra ? <div style={{ marginTop: 14 }}>{extra}</div> : null}
    </div>
  );
}
