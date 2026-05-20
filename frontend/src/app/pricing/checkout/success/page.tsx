"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

const APP_LINKS: Record<string, { label: string; href: string }> = {
  qcoreai:    { label: "Открыть QCoreAI", href: "/qcoreai" },
  healthai:   { label: "Открыть HealthAI", href: "/healthai" },
  qlearn:     { label: "Открыть QLearn", href: "/qlearn" },
  psyapp:     { label: "Открыть PsyApp", href: "/psyapp-deps" },
  "psyapp-deps": { label: "Открыть PsyApp", href: "/psyapp-deps" },
  qstore:     { label: "Открыть QStore", href: "/qstore" },
  deepsan:    { label: "Открыть DeepSan", href: "/deepsan" },
  qpersona:   { label: "Открыть QPersona", href: "/qpersona" },
  lifebox:    { label: "Открыть LifeBox", href: "/lifebox" },
  shadownet:  { label: "Открыть ShadowNet", href: "/shadownet" },
  platform:   { label: "Открыть QRight", href: "/qright" },
};

function SuccessInner() {
  const tp = usePricingT();
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  const paddleTxn = sp.get("_ptxn");
  const provider = sp.get("provider") ?? (paddleTxn ? "paddle" : "legacy");
  const stub = sp.get("stub") === "true";
  const tier = sp.get("tier") ?? sp.get("tierId");
  const period = sp.get("period");
  const totalCents = sp.get("total");
  const trialDays = sp.get("trial") ? parseInt(sp.get("trial")!, 10) : 14; // Paddle всегда 14
  const appId = sp.get("appId") ?? "platform";

  const isPaddle = provider === "paddle";
  const totalUsd = totalCents ? Math.round(parseInt(totalCents, 10) / 100) : null;
  const trialEndDate =
    trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU")
      : null;

  const tierName = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Pro";
  const appLink = APP_LINKS[appId] ?? APP_LINKS["platform"];

  useEffect(() => {
    track({
      type: "checkout_success",
      tier: tier ?? undefined,
      source: "pricing",
      value: totalUsd ?? undefined,
      meta: { stub, period: period ?? null, sessionId: sessionId ?? paddleTxn ?? null, provider },
    });
  }, [sessionId, stub, tier, period, totalUsd]);

  return (
    <ProductPageShell maxWidth={680}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Все тарифы
        </Link>
      </div>

      {/* Main card */}
      <div
        style={{
          padding: "40px 36px",
          textAlign: "center",
          background: isPaddle
            ? "linear-gradient(135deg, #1e40af, #4f46e5, #7c3aed)"
            : "linear-gradient(135deg, #0d9488, #0ea5e9)",
          color: "#fff",
          borderRadius: 20,
          marginTop: 24,
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {stub ? "🔬" : "🎉"}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          {stub
            ? "Тестовый checkout"
            : trialDays > 0
              ? `${tierName} — ${trialDays} дней бесплатно!`
              : `${tierName} активирован!`}
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px", opacity: 0.92, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          {stub
            ? "Paddle KYB верификация на рассмотрении (1–3 дня). Как только одобрят — реальные платежи заработают."
            : trialDays > 0
              ? `Триал до ${trialEndDate}. Карта не списывается до окончания периода — отмена в любой момент.`
              : `Спасибо! Ваша подписка AEVION ${tierName} активна.`}
        </p>

        {/* Trial end date badge */}
        {!stub && trialEndDate && (
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.18)",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              marginBottom: 20,
              border: "1px dashed rgba(255,255,255,0.35)",
            }}
          >
            💳 Первое списание — <strong>{trialEndDate}</strong>
            {period && <span style={{ opacity: 0.8 }}> · {period === "annual" ? "годовая" : "месячная"} подписка</span>}
          </div>
        )}

        {/* Amount */}
        {!stub && totalUsd !== null && totalUsd > 0 && (
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 20 }}>
            Сумма: <strong>${totalUsd}</strong>
          </div>
        )}

        {/* Provider badge */}
        {isPaddle && !stub && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 12px",
            fontSize: 12, marginBottom: 24, border: "1px solid rgba(255,255,255,0.2)",
          }}>
            <span>🔒</span>
            <span>Оплата через Paddle · безопасно · {period === "annual" ? "годовая" : "месячная"}</span>
          </div>
        )}

        {/* Transaction ID */}
        {(paddleTxn || sessionId) && (
          <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 20px" }}>
            {paddleTxn ? "Paddle TX" : "Session"}: <code style={{ fontFamily: "monospace" }}>{paddleTxn ?? sessionId}</code>
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href={appLink.href}
            style={{
              display: "inline-block", padding: "13px 28px",
              background: "#fff", color: isPaddle ? "#4f46e5" : "#0d9488",
              borderRadius: 12, textDecoration: "none",
              fontWeight: 800, fontSize: 15,
            }}
          >
            {appLink.label} →
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-block", padding: "13px 24px",
              background: "rgba(255,255,255,0.14)", color: "#fff",
              borderRadius: 12, textDecoration: "none",
              fontWeight: 700, fontSize: 14,
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            На главную
          </Link>
        </div>
      </div>

      {/* What's next block */}
      {!stub && (
        <div style={{
          marginTop: 24, padding: "20px 24px",
          background: "#f8fafc", borderRadius: 14,
          border: "1px solid #e2e8f0",
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
            Что дальше?
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "📧", text: "Проверьте email — квитанция от Paddle уже отправлена" },
              { icon: "🚀", text: `Откройте ${appLink.label.replace("Открыть ", "")} и начните работать` },
              { icon: "⚙️", text: "Управление подпиской — в вашем аккаунте Paddle" },
              { icon: "💬", text: "Вопросы? Пишите на support@aevion.app" },
            ].map((item, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "#475569" }}>
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stub notice */}
      {stub && (
        <div style={{
          marginTop: 20, padding: "16px 20px",
          background: "#fef3c7", borderRadius: 12,
          border: "1px solid #fde68a", fontSize: 13, color: "#92400e",
        }}>
          <strong>Тестовый режим.</strong> Paddle KYB верификация обычно занимает 1–3 рабочих дня.
          Как только аккаунт будет одобрен, реальные платежи заработают автоматически.
        </div>
      )}
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
