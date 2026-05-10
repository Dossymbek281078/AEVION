"use client";

/**
 * TestModeBanner — full-width disclaimer ribbon visible on every /bank/*
 * surface while the platform is operating without a banking / payment-service
 * license.
 *
 * Why
 * ───
 *  • Legal: any UI that talks about "deposits", "transfers", "balance" needs
 *    a visible disclaimer that we are NOT a regulated payment service while
 *    the partnership / license is being secured. This shrinks regulator and
 *    user-complaint surface dramatically.
 *  • UX: tells the user that AEC moved here is part of a test ledger. Stops
 *    anyone from believing they topped up real money.
 *  • Investor: a credible test-mode disclaimer is *more* trustworthy than
 *    pretending to already be a bank. It signals "we know the regulatory
 *    path and we're following it".
 *
 * Visibility is controlled by NEXT_PUBLIC_BANK_MODE:
 *   "production" → banner hidden (use only after license / partnership)
 *   anything else (default "test") → banner shown
 *
 * Dismissal is per-tab/session — a closed banner reopens on a fresh visit so
 * the disclaimer is never permanently buried.
 */

import { useEffect, useState } from "react";

const SESSION_KEY = "aevion_bank_testmode_dismissed_v1";

export function TestModeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mode = (process.env.NEXT_PUBLIC_BANK_MODE || "test").trim().toLowerCase();
    if (mode === "production" || mode === "prod" || mode === "live") return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* ignore */
    }
    setVisible(!dismissed);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Test environment disclaimer"
      style={{
        position: "relative",
        width: "100%",
        background: "linear-gradient(90deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%)",
        borderBottom: "1px solid rgba(180,83,9,0.30)",
        color: "#78350f",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.01em",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "#b45309",
          color: "#fff",
          fontSize: 12,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        !
      </span>
      <span style={{ flex: 1, minWidth: 240, lineHeight: 1.4 }}>
        <strong style={{ fontWeight: 900, marginRight: 6 }}>Pre-license test mode.</strong>
        AEVION Bank is operating in a test environment while the licensing /
        BaaS partnership is being secured. AEC balances, top-ups and transfers
        are part of a simulated ledger and are <strong>not</strong> regulated
        payment-service operations.
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            /* ignore */
          }
          setVisible(false);
        }}
        aria-label="Dismiss test-mode disclaimer for this session"
        style={{
          padding: "4px 10px",
          borderRadius: 8,
          border: "1px solid rgba(180,83,9,0.35)",
          background: "rgba(255,255,255,0.6)",
          color: "#78350f",
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
