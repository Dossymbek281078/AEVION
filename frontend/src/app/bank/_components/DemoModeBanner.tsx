"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { clearDemoSeed, hasDemoSeed, seedDemo } from "../_lib/demoSeed";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function DemoModeBanner({
  accountId,
  requested,
  notify,
}: {
  accountId: string;
  requested: boolean;
  notify: Notify;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (requested && !hasDemoSeed()) {
      seedDemo(accountId);
      notify(t("demo.toast.loaded"), "success");
      // Nudge listeners that derive from storage to re-read.
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("aevion:signatures-changed"));
    }
    setActive(hasDemoSeed());
  }, [accountId, requested, notify]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(14,165,233,0.3)",
        background: "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(124,58,237,0.06))",
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "linear-gradient(135deg, #0ea5e9, #7c3aed)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        ⟡
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#0369a1" }}>{t("demo.title")}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
          {t("demo.subtitle")}
        </div>
      </div>
      <button
        onClick={() => {
          clearDemoSeed();
          setActive(false);
          notify(t("demo.toast.cleared"), "info");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("storage"));
            window.dispatchEvent(new Event("aevion:signatures-changed"));
          }
        }}
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
        {t("demo.btn.reset")}
      </button>
    </div>
  );
}
