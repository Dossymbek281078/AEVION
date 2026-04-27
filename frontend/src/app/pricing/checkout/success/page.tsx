"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";

function SuccessInner() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  const stub = sp.get("stub") === "true";
  const tier = sp.get("tier");
  const period = sp.get("period");
  const totalCents = sp.get("total");
  const trialDays = sp.get("trial") ? parseInt(sp.get("trial")!, 10) : 0;

  const totalUsd = totalCents ? Math.round(parseInt(totalCents, 10) / 100) : null;
  const trialEndDate =
    trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU")
      : null;

  useEffect(() => {
    track({
      type: "checkout_success",
      tier: tier ?? undefined,
      source: "pricing",
      value: totalUsd ?? undefined,
      meta: { stub, period: period ?? null, sessionId: sessionId ?? null },
    });
  }, [sessionId, stub, tier, period, totalUsd]);

  return (
    <ProductPageShell maxWidth={680}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Все тарифы
        </Link>
      </div>

      <div
        style={{
          padding: 40,
          textAlign: "center",
          background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
          color: "#fff",
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <div style={{ fontSize: 60, marginBottom: 16 }}>✓</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          {tier === "free"
            ? "Аккаунт активирован"
            : trialDays > 0
              ? "Триал-период активирован"
              : "Оплата прошла"}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, marginBottom: 20, opacity: 0.92 }}>
          {tier === "free"
            ? "Вы перешли на Free. Можете сразу зарегистрировать первую идею в QRight."
            : trialDays > 0
              ? `Бесплатный доступ к AEVION ${tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : ""} на ${trialDays} дней. Карта не списывается до окончания триала.`
              : `Подписка AEVION ${tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : ""} активна. Welcome-email отправлен на ваш почтовый ящик.`}
        </p>

        {trialEndDate && (
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.16)",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              border: "1px dashed rgba(255,255,255,0.3)",
            }}
          >
            Триал заканчивается: <strong>{trialEndDate}</strong>
          </div>
        )}

        {(totalUsd !== null || period) && tier !== "free" && (
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.16)",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            {totalUsd !== null && <strong>${totalUsd.toLocaleString("ru-RU")}</strong>}
            {period && (
              <span style={{ marginLeft: 8, opacity: 0.8 }}>
                · {period === "annual" ? "годовая" : "месячная"}
              </span>
            )}
          </div>
        )}

        {stub && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.75,
              padding: 8,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 6,
              marginBottom: 16,
              maxWidth: 400,
              margin: "0 auto 16px",
            }}
          >
            <strong>STUB MODE</strong> — реальная оплата не проводилась. Установите{" "}
            <code>STRIPE_SECRET_KEY</code> в backend для production.
          </div>
        )}

        {sessionId && (
          <p style={{ fontSize: 11, opacity: 0.7, margin: 0, marginBottom: 24 }}>
            Session: <code>{sessionId}</code>
          </p>
        )}

        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/qright"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#fff",
              color: "#0d9488",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Открыть QRight
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "rgba(255,255,255,0.16)",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            На главную
          </Link>
        </div>
      </div>
    </ProductPageShell>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
