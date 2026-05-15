"use client";

/**
 * QuickDemoControls — the one-click investor-onboarding affordance.
 *
 * Renders inside <BankHero>. Two states:
 *
 *   anonymous (no token)    → shows  [▶ Try the demo (1 click)]  button
 *   demo session active     → shows  badge "Demo · demo_…@aevion.test"
 *                                    + [End demo] button
 *
 * If a real user is signed in (token present, not flagged as demo), the
 * component renders nothing — production-style sign-in already happened.
 *
 * Click flow:
 *   1. Try-the-demo  → POST /api/auth/register with random demo_<ts>@…
 *      → JWT goes under aevion_auth_token_v1 (same key everything else uses)
 *      → toast on success
 *      → soft reload of /bank so useAuthMe picks up the new token
 *
 *   2. End demo      → drop token + demo flag → soft reload of /bank
 *
 * No backend changes; uses existing /api/auth/register exactly the way
 * the auth page does.
 */

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { endQuickDemo, readQuickDemoSession, startQuickDemo } from "../_lib/quickDemo";

const TOKEN_KEY = "aevion_auth_token_v1";

export function QuickDemoControls() {
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [demoSession, setDemoSession] = useState<{ email: string; startedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      let t = "";
      try {
        t = localStorage.getItem(TOKEN_KEY) || "";
      } catch {
        /* ignore */
      }
      setHasToken(!!t);
      setDemoSession(readQuickDemoSession());
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const inDemo = hasToken && demoSession !== null;
  const realUser = hasToken && demoSession === null;
  if (realUser) return null;

  if (inDemo && demoSession) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.25)",
          flexWrap: "wrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#5eead4",
            boxShadow: "0 0 0 4px rgba(94,234,212,0.18)",
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
          Demo · <code style={{ fontSize: 11, color: "#fff" }}>{demoSession.email}</code>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            endQuickDemo();
            showToast("Demo session ended", "info");
            setTimeout(() => {
              window.location.assign("/bank");
            }, 250);
          }}
          style={{
            padding: "5px 11px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.30)",
            background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: busy ? "default" : "pointer",
          }}
        >
          End demo
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        const result = await startQuickDemo();
        if (result.ok) {
          showToast(`Demo signed in as ${result.email}`, "success");
          setTimeout(() => {
            window.location.assign("/bank");
          }, 350);
        } else {
          showToast(`Demo failed: ${result.error}`, "error");
          setBusy(false);
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 12,
        border: "1px solid rgba(94,234,212,0.45)",
        background: "linear-gradient(135deg, rgba(94,234,212,0.18), rgba(14,165,233,0.18))",
        color: "#e2e8f0",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.02em",
        cursor: busy ? "default" : "pointer",
        boxShadow: "0 6px 18px rgba(14,165,233,0.20)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 13 }}>
        ▶
      </span>
      {busy ? "Provisioning demo…" : "Try the demo (1 click)"}
    </button>
  );
}
