"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { gatherSuggestions, type Suggestion } from "../_lib/suggestions";
import type { Account, Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

export function SmartSuggestions({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const reload = () => setTick((x) => x + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("storage", reload);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", reload);
      }
    };
  }, []);

  const suggestions = useMemo(
    () => gatherSuggestions({ account, operations }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account.id, account.balance, operations, tick],
  );

  if (suggestions.length === 0) {
    return (
      <section style={containerStyle}>
        <div style={titleRowStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("sugg.title")}</div>
            <InfoTooltip text={t("sugg.tooltip")} />
          </div>
        </div>
        <div
          style={{
            padding: 18,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            background: "rgba(13,148,136,0.05)",
            borderRadius: 12,
          }}
        >
          {t("sugg.empty")}
        </div>
      </section>
    );
  }

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("sugg.title")}</div>
            <InfoTooltip text={t("sugg.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("sugg.subtitle", { count: suggestions.length })}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} s={s} />
        ))}
      </div>
    </section>
  );
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const { t } = useI18n();

  const handleAction = () => {
    if (s.action?.anchor && typeof document !== "undefined") {
      const el = document.getElementById(s.action.anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${s.toneColor}33`,
        background: `${s.toneColor}08`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 22 }}>{s.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
            {t(
              s.titleKey,
              s.titleVars
                ? Object.fromEntries(
                    Object.entries(s.titleVars).map(([k, v]) => [
                      k,
                      typeof v === "string" && v.includes(".") ? t(v) : v,
                    ]),
                  )
                : undefined,
            )}
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
            {t(s.bodyKey, s.bodyVars)}
          </div>
        </div>
      </div>
      {s.action ? (
        <button
          onClick={handleAction}
          style={{
            alignSelf: "flex-start",
            padding: "5px 12px",
            borderRadius: 8,
            border: "none",
            background: s.toneColor,
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {t(s.action.labelKey)}
        </button>
      ) : null}
    </div>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(13,148,136,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
