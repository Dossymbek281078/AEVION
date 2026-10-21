"use client";

// Platform-wide AI mode switch in the header. Flips every smart-call surface
// (QCoreAI, Constitution, HealthAI, Pricing, QRight …) between the cloud free
// fleet and the local / on-prem fleet in one click — the ecosystem-level
// "data stays in the box" control for regulated or air-gapped operators.
//
// SSR-safe: renders the same OFF markup on the server and first client paint,
// then reads the stored preference in useEffect (no hydration mismatch), and
// stays in sync with other tabs and in-page toggles via subscribeAiOffline.
import { useEffect, useState } from "react";
import { isAiOffline, setAiOffline, subscribeAiOffline } from "@/lib/aiOfflinePref";
import { useChromeLang } from "@/components/siteChromeI18n";

export default function AiOfflineToggle() {
  const [on, setOn] = useState(false);
  // 21.10.2026: подпись и подсказка — из словаря шапки (ru/en/kk); на kk «AI: Cloud» шёл английским.
  const { t, own } = useChromeLang();

  useEffect(() => {
    setOn(isAiOffline());
    return subscribeAiOffline(setOn);
  }, []);

  const label = on ? t("aiOnPrem") : t("aiCloud");
  const tip = on ? t("aiTipOnPrem") : t("aiTipCloud");

  return (
    <button
      type="button"
      onClick={() => setAiOffline(!on)}
      translate={own ? "no" : undefined}
      title={tip}
      aria-label={tip}
      aria-pressed={on}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
        color: on ? "#3730a3" : "#334155",
        background: on ? "rgba(99,102,241,0.12)" : "rgba(148,163,184,0.12)",
        border: `1px solid ${on ? "rgba(99,102,241,0.4)" : "rgba(148,163,184,0.35)"}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: on ? "#6366f1" : "#94a3b8",
          boxShadow: on ? "0 0 0 3px rgba(99,102,241,0.18)" : "none",
        }}
      />
      {label}
    </button>
  );
}
