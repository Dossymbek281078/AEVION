"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
type BillingPeriod = "monthly" | "annual";
type TierId = "free" | "pro" | "business" | "enterprise";

interface PricingTier {
  id: TierId;
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceAnnualPerMonth: number | null;
  priceAnnualTotal: number | null;
  features: string[];
  limits: {
    modules: number | null;
    qrightObjectsPerMonth: number | null;
    qsignOpsPerDay: number | null;
    llmTokensPerMonth: number | null;
    seats: number | null;
    supportSlaHours: number | null;
  };
  ctaLabel: string;
  highlight?: boolean;
}

interface ModulePrice {
  id: string;
  name: string;
  code: string;
  addonMonthly: number | null;
  includedIn: TierId[];
  availability: "live" | "beta" | "soon" | "on_request";
  oneLiner: string;
}

interface PricingPayload {
  tiers: PricingTier[];
  modules: ModulePrice[];
  currencies: Record<CurrencyCode, { rate: number; symbol: string; label: string }>;
}

const TIER_FAQ: Record<TierId, { q: string; a: string }[]> = {
  free: [
    {
      q: "Можно ли остаться на Free навсегда?",
      a: "Да. Free не имеет триал-таймера. Если уперлись в лимиты — апгрейд в любой момент.",
    },
    {
      q: "Какой модуль выбрать на Free?",
      a: "Большинство выбирают QRight (для регистрации идей) или Cyberchess. QRight + QSign даёт минимальный IP-контур.",
    },
    {
      q: "Что произойдёт при превышении лимитов?",
      a: "Операция вернёт 429 quota_exceeded. Данные не теряются. Можно дождаться следующего месяца или апгрейднуться.",
    },
  ],
  pro: [
    {
      q: "В чём разница Pro и Business?",
      a: "Pro — 5 модулей и 1 пользователь. Business — все 27 модулей и 5 seats с командными ролями.",
    },
    {
      q: "Можно ли менять подписку модулями в течение месяца?",
      a: "Да. Списания пропорциональные, неиспользованные дни возвращаются в виде кредита.",
    },
    {
      q: "Включён ли AI Bureau в Pro?",
      a: "Базовый — да. Расширенный (мульти-юрисдикции, экспорт PDF certs) — Business.",
    },
    {
      q: "Аннуальная скидка реальная?",
      a: "Да, 16% — два месяца бесплатно при оплате на год. Можно отменить с возвратом за неиспользованные.",
    },
  ],
  business: [
    {
      q: "Сколько seats на Business?",
      a: "5 включено. Каждый дополнительный — $5/месяц. Больше 50 — переходите на Enterprise.",
    },
    {
      q: "Есть ли SLA на API?",
      a: "8 часов на ответ поддержки. Аптайм SLA 99.5%. Для гарантии 99.95% — Enterprise.",
    },
    {
      q: "Аудит и логи?",
      a: "Полный аудит-лог на всех 27 модулях (через QRight registry). Экспорт в JSON/CSV.",
    },
    {
      q: "Можно ли self-hosted на Business?",
      a: "Нет, только cloud. Self-hosted и on-prem — Enterprise.",
    },
  ],
  enterprise: [
    {
      q: "Что входит в Enterprise?",
      a: "Выделенная инфра (VPC или on-prem), кастом-SLA от 1 часа, SOC2/ISO27001 пакет, безлимитные seats и токены, CSM, влияние на roadmap.",
    },
    {
      q: "Минимальный контракт?",
      a: "Обычно 12 месяцев. Pilot 3 месяца — по запросу.",
    },
    {
      q: "Юрисдикции и compliance?",
      a: "Поддерживаем GDPR, KZ data localization, RU 152-ФЗ. NDA/DPA/MSA по стандартам или вашим шаблонам.",
    },
    {
      q: "Как начать?",
      a: "Кнопка «Связаться с продажами» — наш Customer Success свяжется в течение 24 часов с предложением и demo.",
    },
  ],
};

const TIER_AUDIENCE: Record<TierId, { who: string; usecase: string[]; notFor: string }> = {
  free: {
    who: "Для тех, кто впервые знакомится с AEVION: студенты, фаундеры на стадии идеи, исследователи.",
    usecase: [
      "Зарегистрировать первую идею в QRight",
      "Подписать пробный документ через QSign",
      "Поиграть в CyberChess",
      "Пройти Globus-онбординг",
    ],
    notFor: "Не подойдёт для коммерческого использования с регулярной нагрузкой.",
  },
  pro: {
    who: "Индивидуальные создатели: блогеры, фрилансеры, авторы контента, инди-фаундеры.",
    usecase: [
      "Регулярная регистрация идей и черновиков (безлимит QRight)",
      "Цифровая подпись клиентских документов",
      "AI-помощник в QCoreAI до 5M токенов",
      "Базовое IP Bureau для одной юрисдикции",
    ],
    notFor: "Не покрывает командные сценарии (только 1 seat).",
  },
  business: {
    who: "Команды и продуктовые студии 2–50 человек.",
    usecase: [
      "Все 27 модулей AEVION одной подпиской",
      "Multichat Engine с агентами под отдельные процессы",
      "Командные роли + аудит-лог через QRight registry",
      "Приоритетная поддержка 8 часов",
    ],
    notFor: "Не покрывает on-prem, выделенную инфру и кастом-compliance — это Enterprise.",
  },
  enterprise: {
    who: "Корпорации, банки, государственный сектор, финансовые холдинги.",
    usecase: [
      "Выделенная инфра (VPC или on-prem)",
      "SOC2 / ISO27001 / DPA-пакет",
      "Кастом-SLA до 1 часа",
      "Влияние на roadmap и кастом-фичи",
      "Customer Success менеджер",
    ],
    notFor: "Не подойдёт, если можно обойтись Business — переплатите за неиспользуемые гарантии.",
  },
};

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{q}</span>
        <span style={{ fontSize: 16, color: "#64748b" }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 18px 14px",
            fontSize: 13,
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          {a}
        </div>
      )}
    </div>
  );
}

function fmtLimit(n: number | null, suffix: string): string {
  if (n === null) return "Безлимит";
  return `${n.toLocaleString("ru-RU")} ${suffix}`;
}

export default function TierDetailPage() {
  const router = useRouter();
  const params = useParams<{ tierId: string }>();
  const tierId = params?.tierId as TierId;

  const [data, setData] = useState<PricingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/pricing"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: PricingPayload) => {
        if (!cancelled) {
          setData(j);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tier = useMemo(() => data?.tiers.find((t) => t.id === tierId), [data, tierId]);
  const includedModules = useMemo(() => {
    if (!data || !tier) return [];
    return data.modules.filter((m) => m.includedIn.includes(tier.id));
  }, [data, tier]);

  if (loading) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          Загружаем тариф...
        </div>
      </ProductPageShell>
    );
  }

  if (error || !data) {
    return (
      <ProductPageShell>
        <div
          style={{
            padding: 24,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 8 }}>Прайс недоступен</h2>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      </ProductPageShell>
    );
  }

  if (!tier) {
    return (
      <ProductPageShell>
        <div style={{ padding: 24, textAlign: "center" }}>
          <h2>Тариф не найден</h2>
          <p style={{ color: "#64748b" }}>
            id: <code>{tierId}</code>
          </p>
          <Link href="/pricing" style={{ color: "#0d9488", fontWeight: 700 }}>
            ← Все тарифы
          </Link>
        </div>
      </ProductPageShell>
    );
  }

  const symbol = data.currencies[currency].symbol;
  const rate = data.currencies[currency].rate;
  const displayPrice = (usd: number | null): string => {
    if (usd === null) return "По запросу";
    if (usd === 0) return "Бесплатно";
    return `${symbol}${Math.round(usd * rate).toLocaleString("ru-RU")}`;
  };

  const audience = TIER_AUDIENCE[tier.id];
  const faq = TIER_FAQ[tier.id];
  const showPrice = period === "annual" ? tier.priceAnnualPerMonth : tier.priceMonthly;

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
          padding: "32px 0",
          textAlign: "center",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: tier.id === "enterprise" ? "#0f172a" : "#0d9488",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          ТАРИФ {tier.name.toUpperCase()}
        </div>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          AEVION {tier.name}
        </h1>
        <p style={{ fontSize: 16, color: "#475569", maxWidth: 600, margin: "8px auto 24px" }}>
          {tier.tagline}
        </p>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.03em", color: "#0f172a" }}>
            {displayPrice(showPrice)}
          </span>
          {showPrice !== null && showPrice > 0 && (
            <span style={{ fontSize: 16, color: "#64748b", marginLeft: 4 }}>/мес</span>
          )}
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              borderRadius: 10,
              padding: 4,
              gap: 4,
            }}
          >
            {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: period === p ? "#fff" : "transparent",
                  color: period === p ? "#0f172a" : "#64748b",
                }}
              >
                {p === "monthly" ? "Месяц" : "Год (-16%)"}
              </button>
            ))}
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {Object.entries(data.currencies).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.symbol} {code}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => router.push(`/pricing#calculator`)}
            style={{
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background:
                tier.id === "enterprise"
                  ? "#0f172a"
                  : "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
            }}
          >
            {tier.ctaLabel}
          </button>
        </div>
      </section>

      {/* Audience */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            background: "#f0fdfa",
            border: "1px solid rgba(13,148,136,0.2)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", letterSpacing: "0.06em", margin: 0, marginBottom: 8 }}>
            КОМУ ПОДОЙДЁТ
          </h3>
          <p style={{ margin: 0, marginBottom: 16, color: "#0f172a", fontSize: 14, lineHeight: 1.5 }}>
            {audience.who}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
            {audience.usecase.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", letterSpacing: "0.06em", margin: 0, marginBottom: 8 }}>
            КОГДА НЕ БРАТЬ
          </h3>
          <p style={{ margin: 0, color: "#7f1d1d", fontSize: 14, lineHeight: 1.5 }}>
            {audience.notFor}
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Что входит
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {tier.features.map((f, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 10,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span style={{ color: "#0d9488", fontWeight: 800, fontSize: 16 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Limits */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Лимиты и квоты
        </h2>
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {[
                ["Активные модули", fmtLimit(tier.limits.modules, "шт")],
                ["QRight объекты / мес", fmtLimit(tier.limits.qrightObjectsPerMonth, "шт")],
                ["QSign операции / день", fmtLimit(tier.limits.qsignOpsPerDay, "оп")],
                ["LLM токены / мес", fmtLimit(tier.limits.llmTokensPerMonth, "токенов")],
                ["Пользователи (seats)", fmtLimit(tier.limits.seats, "шт")],
                [
                  "SLA поддержки",
                  tier.limits.supportSlaHours === null
                    ? "Сообщество"
                    : `${tier.limits.supportSlaHours}h`,
                ],
              ].map(([label, value], i) => (
                <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontWeight: 600 }}>{label}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Included modules */}
      {includedModules.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Включённые модули ({includedModules.length})
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {includedModules.map((m) => (
              <div
                key={m.id}
                style={{
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <strong style={{ fontSize: 13 }}>{m.name}</strong>
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{m.code}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{m.oneLiner}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Частые вопросы
        </h2>
        <div>
          {faq.map((f, i) => (
            <FAQItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          textAlign: "center",
          padding: "32px 0",
          marginBottom: 24,
          borderTop: "1px solid rgba(15,23,42,0.08)",
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 8 }}>
          Готовы начать с AEVION {tier.name}?
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          {tier.id === "free"
            ? "Создайте аккаунт и зарегистрируйте первую идею за 30 секунд."
            : tier.id === "enterprise"
              ? "Customer Success свяжется в течение 24 часов."
              : "Подписка отменяется в любой момент. Возврат за неиспользованное."}
        </p>
        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => router.push("/pricing#calculator")}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background:
                tier.id === "enterprise"
                  ? "#0f172a"
                  : "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
            }}
          >
            {tier.ctaLabel}
          </button>
          <Link
            href="/pricing"
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              cursor: "pointer",
              background: "#f1f5f9",
              color: "#0f172a",
              textDecoration: "none",
            }}
          >
            Сравнить тарифы
          </Link>
        </div>
      </section>
    </ProductPageShell>
  );
}
