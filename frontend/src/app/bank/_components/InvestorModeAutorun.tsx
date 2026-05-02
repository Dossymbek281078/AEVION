"use client";

/**
 * InvestorModeAutorun — invisible helper that turns one URL into a
 * complete investor walk-through.
 *
 *   https://aevion.app/bank?investor=1
 *
 * Flow on /bank when ?investor=1 is present:
 *
 *   anonymous (no token)
 *     → call startQuickDemo() (POST /api/auth/register, demo_<ts>@aevion.test)
 *     → on success: redirect to /bank/smoke?auto=1
 *
 *   already in a quick-demo session
 *     → redirect straight to /bank/smoke?auto=1
 *
 *   real user is signed in
 *     → do nothing (don't override their session)
 *
 * Renders a short fullscreen overlay while provisioning so the investor
 * sees what is happening rather than a blank reload. The overlay is
 * dismissed automatically once we navigate.
 *
 * The component reads the search-param exactly once — a useRef guard
 * prevents double-fires from React 18 strict-mode dev re-renders.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startQuickDemo, isQuickDemoActive } from "../_lib/quickDemo";

const TOKEN_KEY = "aevion_auth_token_v1";

export function InvestorModeAutorun() {
  const searchParams = useSearchParams();
  const fired = useRef(false);
  const [stage, setStage] = useState<"idle" | "provisioning" | "redirecting" | "skipped">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fired.current) return;
    if (typeof window === "undefined") return;
    if (searchParams?.get("investor") !== "1") return;
    fired.current = true;

    let token = "";
    try {
      token = localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      /* ignore */
    }

    const isDemo = isQuickDemoActive();

    if (token && !isDemo) {
      // Real user — don't touch their session.
      setStage("skipped");
      return;
    }

    if (token && isDemo) {
      setStage("redirecting");
      window.setTimeout(() => {
        window.location.assign("/bank/smoke?auto=1");
      }, 600);
      return;
    }

    // anonymous → provision demo, then go to smoke
    setStage("provisioning");
    void (async () => {
      const result = await startQuickDemo();
      if (!result.ok) {
        setError(result.error);
        setStage("idle");
        return;
      }
      setStage("redirecting");
      window.setTimeout(() => {
        window.location.assign("/bank/smoke?auto=1");
      }, 600);
    })();
  }, [searchParams]);

  if (stage === "idle" || stage === "skipped") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(15,23,42,0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          background: "#fff",
          borderRadius: 18,
          padding: "24px 22px",
          boxShadow: "0 30px 60px rgba(15,23,42,0.45)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.16em",
            color: "#7c3aed",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Investor mode
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
          {stage === "provisioning" ? "Provisioning a demo account…" : "Opening live backend smoke test…"}
        </div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          {stage === "provisioning"
            ? "Registering a fresh demo_<ts>@aevion.test user against the backend. This usually takes ~1.5 seconds."
            : "Redirecting to /bank/smoke. The 11 wired endpoints will fire automatically."}
        </div>
        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(220,38,38,0.4)",
              background: "rgba(254,226,226,0.5)",
              color: "#7f1d1d",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        ) : (
          <div
            aria-hidden="true"
            style={{
              marginTop: 16,
              height: 4,
              borderRadius: 999,
              background: "rgba(15,23,42,0.08)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "-30%",
                width: "30%",
                height: "100%",
                background: "linear-gradient(90deg, #7c3aed, #0ea5e9)",
                borderRadius: 999,
                animation: "aevion-investor-progress 1.4s ease-in-out infinite",
              }}
            />
            <style>{`
              @keyframes aevion-investor-progress {
                0% { left: -30%; }
                100% { left: 100%; }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
