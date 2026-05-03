"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Tab = { id: string; anchorId: string; labelKey: string; icon: string };

const TABS: Tab[] = [
  { id: "wallet", anchorId: "bank-anchor-wallet", labelKey: "mtb.tab.wallet", icon: "₳" },
  { id: "ecosystem", anchorId: "bank-anchor-ecosystem", labelKey: "mtb.tab.ecosystem", icon: "✺" },
  { id: "forecast", anchorId: "bank-anchor-forecast", labelKey: "mtb.tab.forecast", icon: "↗" },
  { id: "trust", anchorId: "bank-anchor-trust", labelKey: "mtb.tab.trust", icon: "★" },
  { id: "achievements", anchorId: "bank-anchor-achievements", labelKey: "mtb.tab.achievements", icon: "◆" },
];

export function MobileTabBar() {
  const { t } = useI18n();
  const [active, setActive] = useState<string>("wallet");

  const jump = useCallback((tab: Tab) => {
    const el = document.getElementById(tab.anchorId);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      el.scrollIntoView();
    }
    setActive(tab.id);
  }, []);

  // Reflect the section currently in view via IntersectionObserver so the
  // active pill tracks the user's scroll position.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const anchors = TABS
      .map((t) => {
        const el = document.getElementById(t.anchorId);
        return el ? { tab: t, el } : null;
      })
      .filter((x): x is { tab: Tab; el: HTMLElement } => x !== null);
    if (anchors.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort(
          (a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0),
        );
        const tab = anchors.find((a) => a.el === visible[0].target)?.tab;
        if (tab) setActive(tab.id);
      },
      { threshold: [0.2, 0.45, 0.7], rootMargin: "-80px 0px -50% 0px" },
    );
    anchors.forEach((a) => observer.observe(a.el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{`
        .aevion-mobile-tabbar {
          display: none;
        }
        @media (max-width: 720px) {
          .aevion-mobile-tabbar {
            display: grid;
          }
          .aevion-bank-helpmenu-offset {
            bottom: 88px !important;
          }
        }
      `}</style>
      <nav
        className="aevion-mobile-tabbar"
        aria-label={t("mtb.aria.nav")}
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 55,
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          gap: 4,
          padding: 6,
          borderRadius: 18,
          background: "rgba(15,23,42,0.94)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 12px 28px rgba(15,23,42,0.25)",
        }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => jump(tab)}
              aria-current={isActive ? "true" : undefined}
              aria-label={t("mtb.aria.jump", { label: t(tab.labelKey) })}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "8px 4px",
                borderRadius: 14,
                border: "none",
                background: isActive
                  ? "linear-gradient(135deg, #0d9488, #0ea5e9)"
                  : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                fontWeight: 800,
                cursor: "pointer",
                transition: "background 200ms ease, color 200ms ease",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 10, letterSpacing: "0.04em" }}>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
