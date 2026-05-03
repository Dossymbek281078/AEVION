"use client";

// Fallback success-redirect target for the OAuth bridge. Backend's
// OAUTH_SUCCESS_REDIRECT defaults to /auth/success when unset, but
// production deploys should override it to a richer landing (the main
// /auth page handles the same ?token=… params and shows the signed-in
// state inline). This page just persists the token and bounces.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "aevion_auth_token_v1";

export default function AuthSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const token = sp.get("token");
    if (!token) {
      setStatus("missing");
      return;
    }
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
    // Strip token from URL bar before any third-party asset can read it via
    // Referer, before browser sync ships history to other devices, and before
    // server access logs would otherwise capture the secret.
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch {}
    setStatus("ok");
    // Brief delay so the user can see the confirmation, then bounce home.
    const t = window.setTimeout(() => router.replace("/auth"), 800);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: "32px 28px",
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.10)",
          background: "#fff",
          textAlign: "center",
        }}
      >
        {status === "loading" ? (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Finishing sign-in…</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Storing your session token.</div>
          </>
        ) : status === "ok" ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Signed in</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Redirecting to your account…</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Token missing</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              The OAuth callback didn&apos;t carry a token. Try signing in again.
            </div>
            <a
              href="/auth"
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 18px",
                borderRadius: 10,
                background: "#0f172a",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Back to sign-in
            </a>
          </>
        )}
      </div>
    </main>
  );
}
