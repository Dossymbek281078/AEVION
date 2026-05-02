"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type TabId = "overview" | "earn" | "send" | "grow" | "security";

const STORAGE_KEY = "aevion_bank_active_tab_v1";

export const TAB_ORDER: TabId[] = ["overview", "earn", "send", "grow", "security"];

const META: Record<TabId, { labelKey: string; hintKey: string; icon: string; accent: string }> = {
  overview: { labelKey: "tab.overview", hintKey: "tab.overview.hint", icon: "◎", accent: "#0ea5e9" },
  earn: { labelKey: "tab.earn", hintKey: "tab.earn.hint", icon: "✦", accent: "#d97706" },
  send: { labelKey: "tab.send", hintKey: "tab.send.hint", icon: "↗", accent: "#0d9488" },
  grow: { labelKey: "tab.grow", hintKey: "tab.grow.hint", icon: "▲", accent: "#7c3aed" },
  security: { labelKey: "tab.security", hintKey: "tab.security.hint", icon: "✓", accent: "#475569" },
};

export function loadTab(): TabId {
  if (typeof window === "undefined") return "overview";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (TAB_ORDER as string[]).includes(v)) return v as TabId;
  } catch {
    // ignore
  }
  return "overview";
}

export function saveTab(t: TabId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // ignore
  }
}

export function useActiveTab(): [TabId, (t: TabId) => void] {
  const [tab, setTabState] = useState<TabId>("overview");
  useEffect(() => {
    setTabState(loadTab());
  }, []);
  const setTab = (t: TabId) => {
    setTabState(t);
    saveTab(t);
  };
  return [tab, setTab];
}

export function SectionTabs({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  const { t } = useI18n();
  return (
    <nav
      role="tablist"
      aria-label="Bank sections"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "rgba(248,250,252,0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        padding: 6,
        marginBottom: 18,
        display: "flex",
        gap: 4,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
      className="aevion-bank-tabs"
    >
      <style>{`
        .aevion-bank-tabs::-webkit-scrollbar { display: none; }
      `}</style>
      {TAB_ORDER.map((id) => {
        const m = META[id];
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`bank-tabpanel-${id}`}
            id={`bank-tab-${id}`}
            onClick={() => onChange(id)}
            title={t(m.hintKey)}
            style={{
              flex: "1 1 auto",
              minWidth: 92,
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: isActive
                ? `linear-gradient(135deg, ${m.accent}, ${m.accent}cc)`
                : "transparent",
              color: isActive ? "#fff" : "#475569",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: "0.01em",
              cursor: "pointer",
              transition: "background 160ms ease, color 160ms ease, transform 160ms ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: isActive ? `0 6px 16px ${m.accent}33` : "none",
              transform: isActive ? "translateY(-1px)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden style={{ fontSize: 14, opacity: isActive ? 1 : 0.6 }}>
              {m.icon}
            </span>
            <span>{t(m.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function TabPanel({
  id,
  active,
  children,
}: {
  id: TabId;
  active: TabId;
  children: React.ReactNode;
}) {
  if (id !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`bank-tabpanel-${id}`}
      aria-labelledby={`bank-tab-${id}`}
      style={{ display: "grid", gap: 16 }}
    >
      {children}
    </div>
  );
}
