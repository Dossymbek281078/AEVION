"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { useI18n } from "@/lib/i18n";
import { localizeModuleOneLiner } from "@/lib/pricingLocalize";

type IndustryId = "banks" | "startups" | "government" | "creators" | "law-firms";

interface IndustryConfig {
  id: IndustryId;
  nameKey: string;
  heroKey: string;
  problemKey: string;
  whyAevionKeys: string[];
  recommendedTier: "free" | "lite" | "medium" | "full" | "enterprise";
  recommendedModules: string[];
  caseStudy: { titleKey: string; resultKey: string };
  /*
   * 🔴 ИСТОЧНИК ОБЯЗАТЕЛЕН У ЧИСЛА (01.10.2026). На продающей странице число
   * без замера — это обещание. Здесь стояли «−68 % time-to-deploy», «−40 %
   * compliance-затрат», «SLA отклика 1h», «27 open-source модулей», «70 %
   * сокращение бумажного оборота» и ещё одиннадцать; ни одно не было ничем
   * подтверждено, а «1h» мы в тот же день убрали из тарифа как неисполнимое.
   * Проверку «27 открытых модулей» провалил сам предмет: публичной организации
   * на GitHub нет (ответ 404), списка открытых модулей в коде тоже нет.
   * Сторож unprovenIndustryNumbers требует `source` у любого значения с цифрой.
   */
  metrics: { labelKey: string; value: string; valueKey?: string; source?: string }[];
  primaryColor: string;
  accentColor: string;
}

/*
 * ПРОВЕРЯЕМЫЕ ФАКТЫ ПЛАТФОРМЫ — то, чем заполнены блоки метрик вместо снятых
 * шестнадцати неподтверждённых чисел (01.10.2026).
 *
 * Все четыре взяты из одностраничника для организаций, который собран по
 * замерам на РАБОТАЮЩЕЙ системе 29–30.09.2026, и у каждого стоит источник —
 * по тому же правилу, которое мы применили к процентам: число живёт на
 * продающей странице только вместе с тем, откуда оно взято.
 *
 * Факты одни на все отрасли намеренно: это свойства платформы, а не обещания
 * конкретному рынку. Разные цифры на разных страницах и были той болезнью.
 */
const ПРОВЕРЯЕМЫЕ_ФАКТЫ = [
  {
    labelKey: "pricing.forIndustry.fact.certLabel",
    value: "1.2s",
    source: "замер на работающей системе 29–30.09.2026: выдача без регистрации и без оплаты",
  },
  {
    labelKey: "pricing.forIndustry.fact.signLabel",
    value: "RFC 8785 + Ed25519",
    source: "канонизация JSON по RFC 8785, подпись Ed25519 — публичная страница подписи показывает оба",
  },
  {
    labelKey: "pricing.forIndustry.fact.verifyLabel",
    value: "SHA-256",
    source: "посторонний пересчитывает хеш и проверяет подпись по опубликованному открытому ключу",
  },
  {
    labelKey: "pricing.forIndustry.fact.apiLabel",
    value: "OpenAPI",
    source: "замер 29–30.09.2026: открытый API отвечает описанием OpenAPI",
  },
];

const INDUSTRIES: Record<IndustryId, IndustryConfig> = {
  banks: {
    id: "banks",
    nameKey: "pricing.forIndustry.banks.name",
    heroKey: "pricing.forIndustry.banks.hero",
    problemKey: "pricing.forIndustry.banks.problem",
    whyAevionKeys: [
      "pricing.forIndustry.banks.why1",
      "pricing.forIndustry.banks.why2",
      "pricing.forIndustry.banks.why3",
      "pricing.forIndustry.banks.why4",
      "pricing.forIndustry.banks.why5",
    ],
    recommendedTier: "enterprise",
    recommendedModules: [
      "qsign",
      "qright",
      "aevion-ip-bureau",
      "qpaynet-embedded",
      "qcoreai",
      "qcontract",
    ],
    caseStudy: {
      titleKey: "pricing.forIndustry.banks.caseTitle",
      resultKey: "pricing.forIndustry.banks.caseResult",
    },
    metrics: ПРОВЕРЯЕМЫЕ_ФАКТЫ,
    primaryColor: "#1e3a8a",
    accentColor: "#3b82f6",
  },
  startups: {
    id: "startups",
    nameKey: "pricing.forIndustry.startups.name",
    heroKey: "pricing.forIndustry.startups.hero",
    problemKey: "pricing.forIndustry.startups.problem",
    whyAevionKeys: [
      "pricing.forIndustry.startups.why1",
      "pricing.forIndustry.startups.why2",
      "pricing.forIndustry.startups.why3",
      "pricing.forIndustry.startups.why4",
      "pricing.forIndustry.startups.why5",
    ],
    recommendedTier: "medium",
    recommendedModules: ["qright", "qsign", "qcoreai", "aevion-ip-bureau"],
    caseStudy: {
      titleKey: "pricing.forIndustry.startups.caseTitle",
      resultKey: "pricing.forIndustry.startups.caseResult",
    },
    metrics: ПРОВЕРЯЕМЫЕ_ФАКТЫ,
    primaryColor: "#7c3aed",
    accentColor: "#a78bfa",
  },
  government: {
    id: "government",
    nameKey: "pricing.forIndustry.government.name",
    heroKey: "pricing.forIndustry.government.hero",
    problemKey: "pricing.forIndustry.government.problem",
    whyAevionKeys: [
      "pricing.forIndustry.government.why1",
      "pricing.forIndustry.government.why2",
      "pricing.forIndustry.government.why3",
      "pricing.forIndustry.government.why4",
      "pricing.forIndustry.government.why5",
      "pricing.forIndustry.government.why6",
    ],
    recommendedTier: "enterprise",
    recommendedModules: [
      "qright",
      "qsign",
      "aevion-ip-bureau",
      "qcontract",
      "qchaingov",
      "voice-of-earth",
    ],
    caseStudy: {
      titleKey: "pricing.forIndustry.government.caseTitle",
      resultKey: "pricing.forIndustry.government.caseResult",
    },
    metrics: ПРОВЕРЯЕМЫЕ_ФАКТЫ,
    primaryColor: "#065f46",
    accentColor: "#10b981",
  },
  creators: {
    id: "creators",
    nameKey: "pricing.forIndustry.creators.name",
    heroKey: "pricing.forIndustry.creators.hero",
    problemKey: "pricing.forIndustry.creators.problem",
    whyAevionKeys: [
      "pricing.forIndustry.creators.why1",
      "pricing.forIndustry.creators.why2",
      "pricing.forIndustry.creators.why3",
      "pricing.forIndustry.creators.why4",
      "pricing.forIndustry.creators.why5",
    ],
    recommendedTier: "medium",
    recommendedModules: ["qright", "qsign", "kids-ai-content", "qpersona", "startup-exchange"],
    caseStudy: {
      titleKey: "pricing.forIndustry.creators.caseTitle",
      resultKey: "pricing.forIndustry.creators.caseResult",
    },
    metrics: [
      // Единственное число, которое мы можем показать: выдача сертификата в
      // бюро действительно бесплатна — ручки сертификата отвечают 200 без
      // оплаты и без входа (замер прода 01.10.2026).
      {
        labelKey: "pricing.forIndustry.creators.metric1Label",
        value: "$0",
        source: "замер прода 01.10.2026: ручки сертификата бюро отвечают 200 без оплаты и без входа",
      },
      { labelKey: "pricing.forIndustry.creators.metric2Label", value: "Crypto-grade" },
    ],
    primaryColor: "#be185d",
    accentColor: "#ec4899",
  },
  "law-firms": {
    id: "law-firms",
    nameKey: "pricing.forIndustry.lawFirms.name",
    heroKey: "pricing.forIndustry.lawFirms.hero",
    problemKey: "pricing.forIndustry.lawFirms.problem",
    whyAevionKeys: [
      "pricing.forIndustry.lawFirms.why1",
      "pricing.forIndustry.lawFirms.why2",
      "pricing.forIndustry.lawFirms.why3",
      "pricing.forIndustry.lawFirms.why4",
      "pricing.forIndustry.lawFirms.why5",
      "pricing.forIndustry.lawFirms.why6",
    ],
    recommendedTier: "full",
    recommendedModules: [
      "qright",
      "qsign",
      "aevion-ip-bureau",
      "qcontract",
      "multichat-engine",
      "qcoreai",
    ],
    caseStudy: {
      titleKey: "pricing.forIndustry.lawFirms.caseTitle",
      resultKey: "pricing.forIndustry.lawFirms.caseResult",
    },
    metrics: ПРОВЕРЯЕМЫЕ_ФАКТЫ,
    primaryColor: "#92400e",
    accentColor: "#f59e0b",
  },
};

interface PricingPayload {
  tiers: { id: string; name: string; priceMonthly: number | null }[];
  modules: { id: string; name: string; code: string; oneLiner: string }[];
}

export default function IndustryLandingPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ industry: string }>();
  // Обращаться к словарю ключом из адреса можно только через hasOwnProperty:
  // INDUSTRIES["constructor"] вернёт функцию из прототипа — она истинна, ветка
  // "не найдено" ниже её пропускала, и на industry.recommendedModules страница
  // падала с 500. Воспроизведено на проде 05.08.2026 для constructor,
  // __proto__ и toString.
  const industryKey = params?.industry;
  const industry: IndustryConfig | undefined =
    typeof industryKey === "string" &&
    Object.prototype.hasOwnProperty.call(INDUSTRIES, industryKey)
      ? INDUSTRIES[industryKey as IndustryId]
      : undefined;
  const [data, setData] = useState<PricingPayload | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/pricing"))
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (industry) {
      track({
        type: "industry_view",
        industry: industry.id,
        source: "pricing/for/[industry]",
      });
    }
  }, [industry]);

  if (!industry) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center" }}>
          <h1>{t("pricing.forIndustry.notFound.title")}</h1>
          <p style={{ color: "#64748b" }}>
            {t("pricing.forIndustry.notFound.available")}{" "}
            {Object.keys(INDUSTRIES).map((k) => (
              <Link key={k} href={`/pricing/for/${k}`} style={{ color: "#0d9488", marginRight: 12 }}>
                {t(INDUSTRIES[k as IndustryId].nameKey)}
              </Link>
            ))}
          </p>
          <Link href="/pricing" style={{ color: "#0d9488", fontWeight: 700 }}>
            {t("pricing.forIndustry.backToPricing")}
          </Link>
        </div>
      </ProductPageShell>
    );
  }

  const recommendedTier = data?.tiers.find((tier) => tier.id === industry.recommendedTier);
  const moduleNames = (data?.modules ?? [])
    .filter((m) => industry.recommendedModules.includes(m.id))
    .map((m) => ({ ...m }));

  return (
    <ProductPageShell maxWidth={1100}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{
            color: "#64748b",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("pricing.forIndustry.backToPricing")}
        </Link>
      </div>

      {/* Hero */}
      <section
        style={{
          padding: "48px 32px",
          marginBottom: 40,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${industry.primaryColor}, ${industry.accentColor})`,
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "rgba(255,255,255,0.16)",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {t("pricing.forIndustry.badge", { name: t(industry.nameKey).toUpperCase() })}
        </div>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            maxWidth: 800,
          }}
        >
          {t(industry.heroKey)}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.92, maxWidth: 720 }}>
          {t(industry.problemKey)}
        </p>
      </section>

      {/* Metrics. Пустой блок НЕ рисуем: после снятия неподтверждённых чисел
          (01.10.2026) у отрасли может не остаться ни одной метрики, и сетка
          оставляла бы на странице заметную дыру. Нечего показать — показываем
          ничего, а не пустую рамку. */}
      {industry.metrics.length > 0 && (
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 40,
        }}
      >
        {industry.metrics.map((m, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: 18,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: industry.primaryColor,
              }}
            >
              {m.valueKey ? t(m.valueKey) : m.value}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 4 }}>
              {t(m.labelKey)}
            </div>
          </div>
        ))}
      </section>
      )}

      {/* Why AEVION */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {t("pricing.forIndustry.whyHeading")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {industry.whyAevionKeys.map((key, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.5,
                display: "flex",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: industry.primaryColor,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended modules */}
      {moduleNames.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
            {t("pricing.forIndustry.modulesHeading")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {moduleNames.map((m) => (
              <div
                key={m.id}
                style={{
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: 16,
                  borderLeft: `4px solid ${industry.accentColor}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>
                  {m.code}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                  {localizeModuleOneLiner(m.id, m.oneLiner, lang)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Case study */}
      <section
        style={{
          marginBottom: 40,
          background: "#0f172a",
          color: "#f8fafc",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: industry.accentColor,
            letterSpacing: "0.06em",
            marginBottom: 12,
          }}
        >
          {t("pricing.forIndustry.caseLabel")}
        </div>
        <h3 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          {t(industry.caseStudy.titleKey)}
        </h3>
        <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
          {t(industry.caseStudy.resultKey)}
        </p>
      </section>

      {/* CTA — recommended tier */}
      <section
        style={{
          padding: 32,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 16,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "#f1f5f9",
            fontSize: 11,
            fontWeight: 800,
            color: "#475569",
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 12,
          }}
        >
          {t("pricing.forIndustry.recommendedTierLabel")}
        </div>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.025em",
          }}
        >
          AEVION {recommendedTier?.name ?? industry.recommendedTier}
        </h2>
        {recommendedTier?.priceMonthly !== null && recommendedTier?.priceMonthly !== undefined && (
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: industry.primaryColor }}>
              ${recommendedTier.priceMonthly}
            </span>
            <span style={{ fontSize: 14, color: "#64748b", marginLeft: 4 }}>
              {t("pricing.forIndustry.perMonth")}
            </span>
          </div>
        )}
        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href={`/pricing/contact?tier=${industry.recommendedTier}&industry=${encodeURIComponent(t(industry.nameKey))}`}
            style={{
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              background: industry.primaryColor,
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {t("pricing.forIndustry.ctaContact")}
          </Link>
          <Link
            href={`/pricing/${industry.recommendedTier}`}
            style={{
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              background: "#f1f5f9",
              color: "#0f172a",
              textDecoration: "none",
            }}
          >
            {t("pricing.forIndustry.ctaLearnMore")}
          </Link>
        </div>
      </section>

      {/* Other industries */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 12, color: "#475569" }}>
          {t("pricing.forIndustry.otherIndustries")}
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.values(INDUSTRIES)
            .filter((i) => i.id !== industry.id)
            .map((i) => (
              <Link
                key={i.id}
                href={`/pricing/for/${i.id}`}
                style={{
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: "#fff",
                  color: "#475569",
                  textDecoration: "none",
                }}
              >
                {t(i.nameKey)} →
              </Link>
            ))}
        </div>
      </section>
    </ProductPageShell>
  );
}
