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
  type PaywallPayload,
} from "@/lib/paywall";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/aevionCatalog";
import { usePricingT } from "@/lib/pricingI18n";

/**
 * Веерное предложение в стене 402.
 *
 * Стена умеет только «оформи тариф» — и это дороже всего, что человеку нужно
 * прямо сейчас. Если у него уже что-то куплено, веер даёт заблокированный
 * модуль дешевле розницы (docs/FAN_DISCOUNTS_2026-07.md). Спрос на этих
 * модулях уже собирается в `/api/paywall/funnel`; здесь мы наконец отвечаем
 * на него предложением, а не только апселлом.
 *
 * Без токена молчим: /fan/me отдаёт 401, и придумывать скидку «наверное, есть»
 * нельзя — это обещание, которое чекаут не выполнит.
 */
interface FanMeOffer {
  module: string;
  discountPercent: number;
  priceMonthly: number;
  listMonthly: number;
}

export function PaywallModal() {
  const tp = usePricingT();
  const [info, setInfo] = useState<PaywallPayload | null>(null);
  const [fanOffer, setFanOffer] = useState<FanMeOffer | null>(null);

  const close = useCallback(() => {
    setInfo(null);
    setFanOffer(null);
  }, []);

  useEffect(() => {
    installPaywallInterceptor();
    const onPaywall = (e: Event) => {
      const detail = (e as CustomEvent<PaywallPayload>).detail;
      if (detail) setInfo(detail);
    };
    window.addEventListener(PAYWALL_EVENT, onPaywall as EventListener);
    return () => window.removeEventListener(PAYWALL_EVENT, onPaywall as EventListener);
  }, []);

  // Веер для заблокированного модуля — только для авторизованного покупателя.
  useEffect(() => {
    setFanOffer(null);
    const token = getAuthToken();
    if (!info || !token) return;
    let alive = true;
    fetch(apiUrl("/api/pricing/fan/me"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || j?.status !== "active") return;
        const hit = (j.offers as FanMeOffer[] | undefined)?.find(
          (o) => o.module === info.module && o.discountPercent > 0,
        );
        if (hit) setFanOffer(hit);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [info]);

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
        background: "rgba(15, 23, 42, 0.45)",
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
          color: "#0f172a",
          background: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 24px 80px rgba(15,23,42,0.18)",
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
            background: "#f1f5f9",
            color: "#64748b",
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
            background: "#f0fdfa",
            border: "1px solid #5eead4",
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

        <p style={{ margin: "0 0 6px", fontSize: 14.5, lineHeight: 1.5, color: "#475569" }}>
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
            background: "#f0fdfa",
            border: "1px solid #5eead4",
            fontSize: 12.5,
            fontWeight: 700,
            color: "#0f766e",
          }}
        >
          Тариф: {tiers}
        </div>

        {fanOffer && (
          <div
            style={{
              margin: "0 0 18px",
              padding: "12px 14px",
              borderRadius: 12,
              background: "#f0fdfa",
              border: "1px solid #5eead4",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {tp("fan.paywall.title")}
            </div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "#134e4a" }}>
              {tp("fan.paywall.offer", {
                module: fanOffer.module,
                cur: "$",
                price: fanOffer.priceMonthly,
                list: fanOffer.listMonthly,
              })}{" "}
              <span style={{ fontWeight: 900, color: "#0f766e" }}>−{fanOffer.discountPercent}%</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={fanOffer ? `/pricing?module=${encodeURIComponent(fanOffer.module)}` : info.upgradeUrl}
            style={{
              flex: 1,
              minWidth: 160,
              textAlign: "center",
              padding: "12px 18px",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
              color: "#fff",
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              boxShadow: "0 8px 24px rgba(13,148,136,0.35)",
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
              color: "#475569",
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
            }}
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
