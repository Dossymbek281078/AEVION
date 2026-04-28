"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

type EntryKind = "added" | "changed" | "removed" | "deprecated" | "promo" | "module";

interface ChangeEntry {
  date: string;
  kind: EntryKind;
  title: string;
  body: string;
  scope?: string;
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const KIND_META: Record<EntryKind, { label: string; bg: string; fg: string }> = {
  added: { label: "ДОБАВЛЕНО", bg: "#d1fae5", fg: "#065f46" },
  changed: { label: "ИЗМЕНЕНО", bg: "#dbeafe", fg: "#1e40af" },
  removed: { label: "УДАЛЕНО", bg: "#fee2e2", fg: "#991b1b" },
  deprecated: { label: "DEPRECATED", bg: "#fef3c7", fg: "#92400e" },
  promo: { label: "PROMO", bg: "#fce7f3", fg: "#9d174d" },
  module: { label: "МОДУЛЬ", bg: "#e0f2fe", fg: "#075985" },
};

const ENTRIES: ChangeEntry[] = [
  {
    date: "2026-04-28",
    kind: "added",
    title: "Полная матрица тарифов на /pricing/compare",
    body: "Side-by-side сравнение всех 27 модулей × 4 тарифов в одной таблице. Sticky tier headers, фильтр по типу модуля, скрытие SOON/by-request, цветовая подсветка для популярного тарифа.",
    scope: "compare-page",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "/pricing/cases — 6 customer stories",
    body: "Добавлен публичный листинг кейсов клиентов с метриками before/after. Фильтрация по индустрии и тарифу. 4 индустрии: банки, юр.фирмы, стартапы, госсектор.",
    scope: "cases-page",
  },
  {
    date: "2026-04-28",
    kind: "added",
    title: "Refund Policy на /pricing/refund-policy",
    body: "Чёткая политика возвратов: 14-day money-back, прорейтинг, annual-расчёт, data retention 90+60 дней. Без юридического жаргона.",
    scope: "refund-policy",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "/pricing/security — Compliance & Security landing",
    body: "Отдельная страница: SOC 2 Type II, GDPR, 152-ФЗ, PCI DSS. 6 pillars безопасности, residency-таблица EU/RU/KZ, Bug Bounty программа.",
    scope: "security-page",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Динамические OG-images через next/og",
    body: "Edge-runtime генерация OpenGraph картинок для /pricing, /pricing/[tier], /pricing/for/[industry]. 3 шаблона. Lazy edge-render, CDN-кешируемые.",
    scope: "seo",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Public roadmap на /pricing/roadmap",
    body: "Все 27 модулей × 5 фаз (A-E) c прогрессом и target window. Public-facing — для прозрачности и инвесторов.",
    scope: "roadmap-page",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Customer logos row на /pricing",
    body: "6 wordmark-логотипов клиентов в shape-row. Базовое social proof над тарифными картами.",
    scope: "logos",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Полная локализация EN/RU через usePricingT",
    body: "Отдельный словарь pricing-ключей (~120 ключей) с fallback EN→RU→ключ. Покрывает 5 страниц: /pricing, /pricing/[tier], /pricing/for/[industry], /pricing/contact, checkout.",
    scope: "i18n",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Provisioning подписки + welcome-email Resend",
    body: "После Stripe-checkout — автоматический provisioning аккаунта на тариф + welcome-email через Resend (с graceful stub-fallback если RESEND_KEY не задан).",
    scope: "billing",
  },
  {
    date: "2026-04-27",
    kind: "added",
    title: "Testimonials + trust signals + newsletter signup",
    body: "6 отзывов с фильтром по индустрии и модулю. 4-6 trust-numbers (NPS, страны, объекты, uptime). Newsletter на pricing.",
    scope: "trust-signals",
  },
  {
    date: "2026-04-26",
    kind: "promo",
    title: "Промо-коды AEVION20, STARTUP50, EARLYBIRD, FRIEND10, TEAM100",
    body: "5 публичных промо-кодов: 20% запуск, 50% стартапам, 30% ранним пользователям, $10 рефералам, $100 командам. Применяются автоматически в калькуляторе.",
    scope: "promo",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Free trial 14 дней для Pro и Business",
    body: "Кнопка «Попробовать 14 дней бесплатно» в карточках Pro/Business. Карта не списывается до окончания триала. Welcome-email с trialEnds-датой.",
    scope: "trial",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Analytics events ingest + /pricing/admin",
    body: "POST /api/pricing/events ingest (page_view, checkout_start, etc.). Token-gated дашборд /pricing/admin с разбивкой по событиям, тарифам, источникам.",
    scope: "analytics",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Stripe Checkout с graceful stub-fallback",
    body: "Реальный Stripe-чекаут когда STRIPE_SECRET_KEY задан. Stub-режим (без оплаты, выдаёт fake-success URL) для dev/staging без ключей.",
    scope: "checkout",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "POST /api/pricing/lead + форма /pricing/contact",
    body: "Lead-form с rate-limit 5/10мин на IP, email-валидация. JSONL хранилище (gitignored, без PII в репо). Префилл от тарифа/индустрии через query.",
    scope: "leads",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Индустриальные лендинги /pricing/for/[industry]",
    body: "5 индустрий: banks, startups, government, creators, law-firms. Под каждую — рекомендованный стек модулей и копирайт.",
    scope: "industries",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Сравнение с конкурентами + общий FAQ",
    body: "Mini-таблица AEVION vs DocuSign / Stripe / OpenAI / Patently на /pricing. 8 общих FAQ-вопросов с раскрывашками.",
    scope: "compare-mini",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "Детальные страницы тарифов /pricing/[tierId]",
    body: "4 отдельные страницы: Free / Pro / Business / Enterprise. Расширенный список фич, лимиты, FAQ под тариф.",
    scope: "tier-pages",
  },
  {
    date: "2026-04-26",
    kind: "added",
    title: "GTM Pricing API + публичный /pricing",
    body: "Backend `/api/pricing` отдаёт тарифы, модули, бандлы и валюты одним запросом. Калькулятор сметы (POST /api/pricing/quote) с прорейтингом seats и add-on.",
    scope: "core",
  },
];

export default function PricingChangelogPage() {
  const tp = usePricingT();
  const [filter, setFilter] = useState<EntryKind | null>(null);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/changelog" });
  }, []);

  const filtered = useMemo(() => {
    return filter ? ENTRIES.filter((e) => e.kind === filter) : ENTRIES;
  }, [filter]);

  const counts = useMemo(() => {
    const c: Partial<Record<EntryKind, number>> = {};
    for (const e of ENTRIES) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ChangeEntry[]>();
    for (const e of filtered) {
      const month = e.date.slice(0, 7);
      const arr = map.get(month) ?? [];
      arr.push(e);
      map.set(month, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <ProductPageShell maxWidth={920}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {tp("back.allTiers")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("changelog.badge")}
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {tp("changelog.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("changelog.subtitle")}
        </p>
      </section>

      {/* Filters */}
      <section
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 24,
          padding: "12px 14px",
          background: "rgba(13,148,136,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(13,148,136,0.12)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.06em" }}>
          {tp("changelog.filter")}
        </span>
        <FilterChip active={filter === null} onClick={() => setFilter(null)} label={`${tp("changelog.filterAll")} · ${ENTRIES.length}`} />
        {(Object.keys(KIND_META) as EntryKind[]).map((k) => {
          const c = counts[k] ?? 0;
          if (c === 0) return null;
          const meta = KIND_META[k];
          return (
            <FilterChip
              key={k}
              active={filter === k}
              onClick={() => setFilter(filter === k ? null : k)}
              label={`${meta.label} · ${c}`}
              tint={meta.fg}
            />
          );
        })}
      </section>

      {/* Timeline grouped by month */}
      <section style={{ marginBottom: 32 }}>
        {grouped.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#64748b",
              background: "#f8fafc",
              borderRadius: 12,
              border: BORDER,
            }}
          >
            {tp("changelog.empty")}
          </div>
        ) : (
          grouped.map(([month, items]) => (
            <div key={month} style={{ marginBottom: 28 }}>
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  margin: 0,
                  marginBottom: 10,
                  textTransform: "uppercase",
                }}
              >
                {monthLabel(month)} · {items.length} {items.length === 1 ? "запись" : "записей"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((e, i) => {
                  const meta = KIND_META[e.kind];
                  return (
                    <article
                      key={`${e.date}-${i}`}
                      style={{
                        background: "#fff",
                        border: BORDER,
                        borderRadius: 12,
                        padding: "14px 18px",
                        boxShadow: CARD,
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", minWidth: 100 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#475569",
                            fontFamily: "ui-monospace, monospace",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {e.date}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 4,
                            letterSpacing: "0.06em",
                            background: meta.bg,
                            color: meta.fg,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            margin: 0,
                            marginBottom: 4,
                            color: "#0f172a",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {e.title}
                        </h3>
                        <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>{e.body}</p>
                        {e.scope && (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#94a3b8",
                              fontFamily: "ui-monospace, monospace",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {e.scope}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Subscribe CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 24,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          {tp("changelog.subscribeTitle")}
        </h3>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 18, fontSize: 14 }}>
          {tp("changelog.subscribeSubtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing#newsletter"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {tp("changelog.subscribeCta")}
          </Link>
          <Link
            href="/pricing/roadmap"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {tp("changelog.roadmapCta")}
          </Link>
        </div>
      </section>
    </ProductPageShell>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tint = "#0d9488",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tint?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 11,
        fontWeight: 800,
        borderRadius: 999,
        border: active ? "none" : "1px solid rgba(15,23,42,0.12)",
        cursor: "pointer",
        background: active ? tint : "#fff",
        color: active ? "#fff" : "#475569",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </button>
  );
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const months = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  return `${months[(m - 1) % 12]} ${y}`;
}
