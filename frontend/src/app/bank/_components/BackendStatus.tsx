"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { pingBackend } from "../_lib/api";

// Floating bottom-left pill that shows when the backend stops responding.
// Pings every 60s; surfaces immediately on first failure to prevent users
// blaming themselves for a "frozen" UI.
export function BackendStatus() {
  const { t } = useI18n();
  const [up, setUp] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const check = async () => {
      const ok = await pingBackend();
      if (!cancelled) setUp(ok);
    };
    void check();
    const id = window.setInterval(() => void check(), 60_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (up !== false) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 70,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(220,38,38,0.95)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        boxShadow: "0 8px 20px rgba(220,38,38,0.35)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 9 }}>●</span>
      {t("status.backendDown")}
    </div>
  );
}
