"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";

type IndustryId = "banks" | "startups" | "government" | "creators" | "law-firms";

interface IndustryConfig {
  id: IndustryId;
  name: string;
  hero: string;
  problem: string;
  whyAevion: string[];
  recommendedTier: "free" | "pro" | "business" | "enterprise";
  recommendedModules: string[];
  caseStudy: { title: string; result: string };
  metrics: { label: string; value: string }[];
  primaryColor: string;
  accentColor: string;
}

const INDUSTRIES: Record<IndustryId, IndustryConfig> = {
  banks: {
    id: "banks",
    name: "Банки и финтех",
    hero: "Подпись, аудит и платежи в одной инфраструктуре",
    problem:
      "Банкам приходится склеивать DocuSign + аудит-системы + платёжный шлюз + AI-чат поддержки. Каждая интеграция — отдельный проект на 6 месяцев и сторонний compliance-риск.",
    whyAevion: [
      "QSign + QRight + QPayNet под одним SOC2/ISO27001 контуром",
      "Локализация данных в KZ / RU / EU без миграции стека",
      "Аудит-лог на каждый шаг операции — единая запись в реестре",
      "AI-агент QCoreAI обучен на ваших регламентах через Multichat",
      "VPC / on-prem развёртывание, выделенный SLA до 1 часа",
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
      title: "Тинькофф-стиль bank: KYC + ePodpis + аудит",
      result:
        "Сокращение time-to-onboard клиента с 3 дней до 12 минут. Один аудит-лог вместо четырёх систем.",
    },
    metrics: [
      { label: "Сокращение time-to-deploy", value: "−68%" },
      { label: "Снижение compliance-затрат", value: "−40%" },
      { label: "SLA отклика", value: "1h" },
      { label: "Регионов локализации", value: "3" },
    ],
    primaryColor: "#1e3a8a",
    accentColor: "#3b82f6",
  },
  startups: {
    id: "startups",
    name: "Стартапы и инди-фаундеры",
    hero: "От идеи до защищённого продукта без юристов и интеграторов",
    problem:
      "Защитить идею, подписать договор с фрилансером, собрать AI-помощника, принять платёж — это 4 разных подписки и 2 недели бюрократии. Параллельно нужно строить продукт.",
    whyAevion: [
      "QRight: регистрация идеи за 30 секунд, certified PDF",
      "QSign: подпись NDA / договоров без DocuSign",
      "QCoreAI: 5M токенов на Pro — хватает на MVP-чат",
      "AEVION IP Bureau: pre-validation идеи перед патентным поверенным",
      "Startup Exchange: монетизируйте идею, даже если не строите продукт",
    ],
    recommendedTier: "pro",
    recommendedModules: ["qright", "qsign", "qcoreai", "aevion-ip-bureau"],
    caseStudy: {
      title: "AI-стартап MVP за 14 дней",
      result:
        "Регистрация 12 идей, 8 подписанных контрактов, AI-чат с памятью на основе QCoreAI. Стоимость стека: $19/мес вместо ~$120/мес у конкурентов.",
    },
    metrics: [
      { label: "Time-to-protect идею", value: "30s" },
      { label: "Экономия vs DocuSign+OpenAI+Patently", value: "84%" },
      { label: "Месяцев на Free до апгрейда", value: "≈3" },
      { label: "Подписей в день", value: "50" },
    ],
    primaryColor: "#7c3aed",
    accentColor: "#a78bfa",
  },
  government: {
    id: "government",
    name: "Государственный сектор",
    hero: "Цифровое государство без vendor lock-in",
    problem:
      "Гражданам нужны электронные услуги, ведомствам — реестр операций с аудит-следом, регуляторам — compliance-отчётность. Импортные SaaS не проходят локализацию данных.",
    whyAevion: [
      "On-prem развёртывание в дата-центре ведомства",
      "Открытый исходный код модулей под аудит",
      "QRight как национальный реестр цифровой собственности",
      "Planet Compliance: certified-сертификаты с verifiable proof",
      "Voice of Earth для гражданского участия и петиций",
      "Локализация UI на казахский / русский / английский",
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
      title: "Электронное патентное бюро для KZ",
      result:
        "Полный пайплайн: гражданин → QRight регистрация → IP Bureau ревью → Planet certified-сертификат. Экономия 70% бумажного оборота.",
    },
    metrics: [
      { label: "Локализация регулятор-готова", value: "100%" },
      { label: "Open-source аудитируемых модулей", value: "27" },
      { label: "Сокращение бумажного оборота", value: "70%" },
      { label: "Регионов pilot", value: "3" },
    ],
    primaryColor: "#065f46",
    accentColor: "#10b981",
  },
  creators: {
    id: "creators",
    name: "Создатели контента",
    hero: "Защита авторства, AI-помощник и монетизация — без посредников",
    problem:
      "Контент копируют за минуты, авторские права доказать сложно. AI-генерация снижает порог копирования. Платформы забирают 30% дохода. Нужен независимый стек.",
    whyAevion: [
      "QRight: timestamp каждого черновика, доказательство авторства",
      "QSign: подпись медиа-файлов, цепочка передачи прав",
      "Kids AI Content: монетизация образовательного контента",
      "QPersona: цифровой аватар для масштабирования",
      "Startup Exchange: продажа лицензий на готовый контент",
    ],
    recommendedTier: "pro",
    recommendedModules: ["qright", "qsign", "kids-ai-content", "qpersona", "startup-exchange"],
    caseStudy: {
      title: "Инди-блогер: 1000 защищённых статей за год",
      result:
        "Все черновики автоматически в QRight. Цепочка timestamp от черновика до публикации. 3 случая копирования — все доказаны через certified PDF.",
    },
    metrics: [
      { label: "Стоимость защиты статьи", value: "$0" },
      { label: "Доказательная сила", value: "Crypto-grade" },
      { label: "Платформ интеграции", value: "5+" },
      { label: "Комиссия за лицензирование", value: "0%" },
    ],
    primaryColor: "#be185d",
    accentColor: "#ec4899",
  },
  "law-firms": {
    id: "law-firms",
    name: "Юридические фирмы",
    hero: "Полный IP-контур клиента под одной подпиской",
    problem:
      "Юристы используют 4–5 систем: DocuSign для подписей, Patently для патентов, отдельный реестр объектов, AI-помощник для черновиков. Биллинг и аудит — везде разный.",
    whyAevion: [
      "Все клиентские объекты в одном QRight registry",
      "QSign: цифровая подпись с full chain of custody",
      "AEVION IP Bureau: pre-validation перед подачей в Роспатент / KazPatent",
      "QContract: smart-документы с истекающим сроком",
      "Multichat-агенты на ваших шаблонах договоров",
      "Аудит-лог под export для регулятора одной кнопкой",
    ],
    recommendedTier: "business",
    recommendedModules: [
      "qright",
      "qsign",
      "aevion-ip-bureau",
      "qcontract",
      "multichat-engine",
      "qcoreai",
    ],
    caseStudy: {
      title: "Практика IP-фирмы 12 юристов",
      result:
        "Замена связки DocuSign+Patently+Notion+ChatGPT на единый AEVION Business. Экономия $480/мес × 12 seats. Audit-export к ФАС в 1 клик.",
    },
    metrics: [
      { label: "Экономия на стеке", value: "$480/мес" },
      { label: "Seats в Business", value: "12" },
      { label: "Audit-export время", value: "1 клик" },
      { label: "Замена систем", value: "4→1" },
    ],
    primaryColor: "#92400e",
    accentColor: "#f59e0b",
  },
};

interface PricingPayload {
  tiers: { id: string; name: string; priceMonthly: number | null }[];
  modules: { id: string; name: string; code: string; oneLiner: string }[];
}

export default function IndustryLandingPage() {
  const params = useParams<{ industry: string }>();
  const industry = INDUSTRIES[params?.industry as IndustryId];
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
          <h1>Индустрия не найдена</h1>
          <p style={{ color: "#64748b" }}>
            Доступные:{" "}
            {Object.keys(INDUSTRIES).map((k) => (
              <Link key={k} href={`/pricing/for/${k}`} style={{ color: "#0d9488", marginRight: 12 }}>
                {INDUSTRIES[k as IndustryId].name}
              </Link>
            ))}
          </p>
          <Link href="/pricing" style={{ color: "#0d9488", fontWeight: 700 }}>
            ← Все тарифы
          </Link>
        </div>
      </ProductPageShell>
    );
  }

  const recommendedTier = data?.tiers.find((t) => t.id === industry.recommendedTier);
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
          ← Все тарифы
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
          ИНДУСТРИЯ · {industry.name.toUpperCase()}
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
          {industry.hero}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.92, maxWidth: 720 }}>
          {industry.problem}
        </p>
      </section>

      {/* Metrics */}
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
              {m.value}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 4 }}>
              {m.label}
            </div>
          </div>
        ))}
      </section>

      {/* Why AEVION */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Почему AEVION
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {industry.whyAevion.map((w, i) => (
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
              <span>{w}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended modules */}
      {moduleNames.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Рекомендованные модули
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
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{m.oneLiner}</div>
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
          КЕЙС
        </div>
        <h3 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          {industry.caseStudy.title}
        </h3>
        <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
          {industry.caseStudy.result}
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
          РЕКОМЕНДОВАННЫЙ ТАРИФ ДЛЯ ВАС
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
            <span style={{ fontSize: 14, color: "#64748b", marginLeft: 4 }}>/мес</span>
          </div>
        )}
        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href={`/pricing/contact?tier=${industry.recommendedTier}&industry=${encodeURIComponent(industry.name)}`}
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
            Связаться с продажами
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
            Подробнее о тарифе
          </Link>
        </div>
      </section>

      {/* Other industries */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 12, color: "#475569" }}>
          Другие индустрии
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
                {i.name} →
              </Link>
            ))}
        </div>
      </section>
    </ProductPageShell>
  );
}
