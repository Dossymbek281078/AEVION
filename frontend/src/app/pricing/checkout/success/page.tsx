"use client";

import { естьСледОплаты } from "@/lib/paymentTrace";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { useI18n } from "@/lib/i18n";

const APP_LINKS: Record<string, { name: string; href: string }> = {
  qcoreai:    { name: "QCoreAI", href: "/qcoreai" },
  healthai:   { name: "HealthAI", href: "/healthai" },
  qlearn:     { name: "QLearn", href: "/qlearn" },
  psyapp:     { name: "PsyApp", href: "/psyapp-deps" },
  "psyapp-deps": { name: "PsyApp", href: "/psyapp-deps" },
  qstore:     { name: "QStore", href: "/qstore" },
  deepsan:    { name: "DeepSan", href: "/deepsan" },
  qpersona:   { name: "QPersona", href: "/qpersona" },
  lifebox:    { name: "LifeBox", href: "/lifebox" },
  shadownet:  { name: "ShadowNet", href: "/shadownet" },
  platform:   { name: "QRight", href: "/qright" },
  ventures: { name: "AEVION Ventures", href: "/ventures" },
  "multichat-engine": { name: "AEVION Multichat Engine", href: "/multichat-engine" },
  qfusionai: { name: "QFusionAI", href: "/qfusionai" },
  qright: { name: "QRight", href: "/qright" },
  qsign: { name: "QSign", href: "/qsign" },
  qtradeoffline: { name: "QTradeOffline", href: "/qtradeoffline" },
  qmaskcard: { name: "QMaskCard", href: "/qmaskcard" },
  veilnetx: { name: "VeilNetX", href: "/veilnetx" },
  cyberchess: { name: "CyberChess", href: "/cyberchess" },
  qlife: { name: "QLife", href: "/qlife" },
  qgood: { name: "QGood", href: "/qgood" },
  "kids-ai-content": { name: "Kids AI Content", href: "/kids-ai-content" },
  "voice-of-earth": { name: "Voice of the Earth Series", href: "/voice-of-earth" },
  "startup-exchange": { name: "Startup Exchange", href: "/startup-exchange" },
  qventure: { name: "QVenture", href: "/qventure" },
  qskyway: { name: "QSkyway", href: "/qskyway" },
  qreal: { name: "QReal Studio", href: "/qreal" },
  mapreality: { name: "MapReality", href: "/mapreality" },
  "z-tide": { name: "Z-Tide", href: "/z-tide" },
  qcontract: { name: "QContract", href: "/qcontract" },
  qchaingov: { name: "QChainGov", href: "/qchaingov" },
  "smeta-trainer": { name: "Smeta Trainer", href: "/smeta-trainer" },
  qnews: { name: "QNews", href: "/qnews" },
  qmedia: { name: "QMedia", href: "/qmedia" },
  qai: { name: "QAI", href: "/qai" },
  qevents: { name: "QEvents", href: "/qevents" },
  constitution: { name: "Constitution", href: "/constitution" },
};

/** Как называется платёжный сервис на экране. Имена не склоняются, поэтому
 *  подставляются во все три языка без переделки фразы. */
const PROCESSOR_LABEL: Record<string, string> = {
  lemonsqueezy: "Lemon Squeezy",
  gumroad: "Gumroad",
  paypal: "PayPal",
  paybox: "PayBox",
};

function SuccessInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  // Gumroad redirects back with ?sale_id=...; keep _ptxn as a legacy fallback.
  const saleId = sp.get("sale_id") ?? sp.get("_ptxn");
  // Кто именно принял платёж. Раньше здесь стояло `?? "gumroad"`, и страница
  // писала «квитанция от Gumroad», «управление подпиской в аккаунте Gumroad»
  // ВСЕМ — включая тех, кто заплатил через Lemon Squeezy (сейчас это основной
  // провайдер подписок) или PayPal. Человека отправляли искать подписку в
  // аккаунт, которого у него нет. Определяем по тем меткам, которые реально
  // приходят: PayPal и PayBox возвращают ?paypal=1 / ?paybox=1, Gumroad —
  // ?sale_id, Lemon Squeezy — ?provider=lemonsqueezy.
  const provider =
    sp.get("provider") ??
    (sp.get("paypal") ? "paypal" : null) ??
    (sp.get("paybox") ? "paybox" : null) ??
    (sp.get("gumroad") || saleId ? "gumroad" : null);
  // Название сервиса пишем, только если знаем его наверняка. Не знаем —
  // строка без названия: выдуманное имя хуже отсутствующего.
  const processor = provider ? (PROCESSOR_LABEL[provider] ?? null) : null;
  const stub = sp.get("stub") === "true";
  const tier = sp.get("tier") ?? sp.get("tierId");
  const period = sp.get("period");
  const totalCents = sp.get("total");
  const trialDays = sp.get("trial") ? parseInt(sp.get("trial")!, 10) : 0;
  const appId = sp.get("appId") ?? "platform";

  const totalUsd = totalCents ? Math.round(parseInt(totalCents, 10) / 100) : null;
  const trialEndDate =
    trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU")
      : null;

  const tierName = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : null;

  /*
   * Что человек купил — знаем НЕ ВСЕГДА, и врать об этом нельзя.
   *
   * Замер 31.08.2026 в браузере: страница возврата говорила «Pro активирован!»
   * на голом адресе и предлагала «Открыть QRight →» независимо от покупки.
   * Проверено по коду всех четырёх касс: параметр appId не кладёт НИ ОДНА, то
   * есть ссылку на QRight видел КАЖДЫЙ покупатель — включая тех, кто заплатил
   * за QSign, QLearn или QCoreAI. Тариф теряется реже, но тоже теряется: у
   * PayBox в адрес возврата уходит ref, а не tier, и казахстанский покупатель
   * Lite читал «Pro активирован».
   *
   * Здесь тот же приём, что автор уже применил ниже к пункту «управлять
   * подпиской»: не знаем — не называем. Неизвестный продукт ведёт в каталог,
   * неизвестный тариф даёт «Оплата принята» без имени.
   */
  const knownApp = Object.prototype.hasOwnProperty.call(APP_LINKS, appId) && appId !== "platform";
  const appLink = knownApp ? APP_LINKS[appId] : null;

  // Событие уходит только при следе оплаты: адрес публичный, и голый заход
  // считался бы покупкой — в сводке и в рекламе. Полное объяснение и разбор
  // всех четырёх касс живут в `lib/paymentTrace.ts`, рядом с самим признаком:
  // два описания одного правила разъезжаются молча.
  const следОплаты = естьСледОплаты({
    provider,
    ref: sessionId ?? saleId,
    total: totalUsd,
    stub,
  });

  useEffect(() => {
    if (!следОплаты) return;
    track({
      type: "checkout_success",
      tier: tier ?? undefined,
      source: "pricing",
      value: totalUsd ?? undefined,
      meta: { stub, period: period ?? null, sessionId: sessionId ?? saleId ?? null, provider },
    });
  }, [sessionId, stub, tier, period, totalUsd, следОплаты]);

  return (
    <ProductPageShell maxWidth={680}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {t("pricing.checkoutSuccess.backAllTiers")}
        </Link>
      </div>

      {/* Main card */}
      <div
        style={{
          padding: "40px 36px",
          textAlign: "center",
          background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
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
            ? t("pricing.checkoutSuccess.titleStub")
            : trialDays > 0
              ? tierName
                ? t("pricing.checkoutSuccess.titleTrial", { tier: tierName, days: trialDays })
                : t("pricing.checkoutSuccess.titleTrialNoTier", { days: trialDays })
              : tierName
                ? t("pricing.checkoutSuccess.titleActivated", { tier: tierName })
                : t("pricing.checkoutSuccess.titleActivatedNoTier")}
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px", opacity: 0.92, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          {stub
            ? t("pricing.checkoutSuccess.subtitleStub")
            : trialDays > 0
              ? t("pricing.checkoutSuccess.subtitleTrial", { date: trialEndDate ?? "" })
              : tierName
                ? t("pricing.checkoutSuccess.subtitleActivated", { tier: tierName })
                : t("pricing.checkoutSuccess.subtitleActivatedNoTier")}
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
            {t("pricing.checkoutSuccess.firstCharge")} <strong>{trialEndDate}</strong>
            {period && <span style={{ opacity: 0.8 }}> · {period === "annual" ? t("pricing.checkoutSuccess.periodAnnual") : t("pricing.checkoutSuccess.periodMonthly")} {t("pricing.checkoutSuccess.subscriptionWord")}</span>}
          </div>
        )}

        {/* Amount */}
        {!stub && totalUsd !== null && totalUsd > 0 && (
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 20 }}>
            {t("pricing.checkoutSuccess.amountLabel")} <strong>${totalUsd}</strong>
          </div>
        )}

        {/* Provider badge */}
        {!stub && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 12px",
            fontSize: 12, marginBottom: 24, border: "1px solid rgba(255,255,255,0.2)",
          }}>
            <span>🔒</span>
            <span>{processor
              ? t("pricing.checkoutSuccess.providerBadge", { processor })
              : t("pricing.checkoutSuccess.providerBadgeNoName")}{period ? ` · ${period === "annual" ? t("pricing.checkoutSuccess.periodAnnual") : t("pricing.checkoutSuccess.periodMonthly")}` : ""}</span>
          </div>
        )}

        {/* Transaction ID */}
        {(saleId || sessionId) && (
          <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 20px" }}>
            {processor ?? "Session"}: <code style={{ fontFamily: "monospace" }}>{saleId ?? sessionId}</code>
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href={appLink ? appLink.href : "/apps"}
            style={{
              display: "inline-block", padding: "13px 28px",
              background: "#fff", color: "#0d9488",
              borderRadius: 12, textDecoration: "none",
              fontWeight: 800, fontSize: 15,
            }}
          >
            {appLink
              ? t("pricing.checkoutSuccess.openApp", { app: appLink.name })
              : t("pricing.checkoutSuccess.openAppNoName")}{" "}→
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
            {t("pricing.checkoutSuccess.home")}
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
            {t("pricing.checkoutSuccess.whatsNext")}
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "📧", text: processor
                  ? t("pricing.checkoutSuccess.nextEmail", { processor })
                  : t("pricing.checkoutSuccess.nextEmailNoName") },
              {
                icon: "🚀",
                text: appLink
                  ? t("pricing.checkoutSuccess.nextOpenApp", { app: appLink.name })
                  : t("pricing.checkoutSuccess.nextOpenAppNoName"),
              },
              // Куда идти управлять подпиской, можно сказать только зная сервис.
              // Не знаем — пункт не показываем, а не отправляем наугад.
              ...(processor
                ? [{ icon: "⚙️", text: t("pricing.checkoutSuccess.nextManage", { processor }) }]
                : []),
              { icon: "💬", text: t("pricing.checkoutSuccess.nextQuestions") },
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
          <strong>{t("pricing.checkoutSuccess.stubNoticeTitle")}</strong> {t("pricing.checkoutSuccess.stubNoticeBody")}
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
