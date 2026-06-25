"use client";

/**
 * Global paywall surface. Mounted once in ClientProviders. Installs the fetch
 * interceptor (lib/paywall.ts) and renders an upgrade prompt whenever any
 * module answers a gated request with 402 upgrade_required.
 */

import { useEffect, useState, useCallback } from "react";
import {
  PAYWALL_EVENT,
  installPaywallInterceptor,
  formatTiers,
  type PaywallInfo,
} from "@/lib/paywall";

export function PaywallModal() {
  const [info, setInfo] = useState<PaywallInfo | null>(null);

  const close = useCallback(() => setInfo(null), []);

  useEffect(() => {
    installPaywallInterceptor();
    const onPaywall = (e: Event) => {
      const detail = (e as CustomEvent<PaywallInfo>).detail;
      if (detail) setInfo(detail);
    };
    window.addEventListener(PAYWALL_EVENT, onPaywall as EventListener);
    return () => window.removeEventListener(PAYWALL_EVENT, onPaywall as EventListener);
  }, []);

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [info, close]);

  if (!info) return null;

  const tiers = formatTiers(info.requiredTiers);
  const message =
    info.message ||
    `Этот раздел доступен на тарифах: ${tiers}. Оформи подписку, чтобы продолжить.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Требуется обновление тарифа"
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(440px, calc(100vw - 40px))",
          borderRadius: 18,
          padding: "28px 26px 24px",
          color: "#f8fafc",
          background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))",
          border: "1px solid rgba(148, 163, 184, 0.45)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={close}
          aria-label="Закрыть"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(99,102,241,0.35), rgba(168,85,247,0.35))",
            border: "1px solid rgba(168,85,247,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            marginBottom: 16,
          }}
          aria-hidden
        >
          🔓
        </div>

        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>
          Доступно на платном тарифе
        </h2>

        <p style={{ margin: "0 0 6px", fontSize: 14.5, lineHeight: 1.5, color: "rgba(226,232,240,0.92)" }}>
          {message}
        </p>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            margin: "10px 0 22px",
            padding: "5px 11px",
            borderRadius: 999,
            background: "rgba(168,85,247,0.15)",
            border: "1px solid rgba(168,85,247,0.4)",
            fontSize: 12.5,
            fontWeight: 700,
            color: "#e9d5ff",
          }}
        >
          Тариф: {tiers}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={info.upgradeUrl}
            style={{
              flex: 1,
              minWidth: 160,
              textAlign: "center",
              padding: "12px 18px",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
              color: "#0b1020",
              background: "linear-gradient(135deg, #a78bfa, #818cf8)",
              boxShadow: "0 8px 24px rgba(129,140,248,0.4)",
            }}
          >
            Перейти к тарифам
          </a>
          <button
            onClick={close}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              color: "rgba(226,232,240,0.85)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(148,163,184,0.35)",
            }}
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
