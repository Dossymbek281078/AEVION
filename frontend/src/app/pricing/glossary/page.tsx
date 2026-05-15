"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

interface Term {
  id: string;
  abbr: string;
  full: string;
  category: "legal" | "tech" | "compliance" | "billing" | "auth" | "ops";
  ru: string;
  en: string;
  /** id других терминов в глоссарии для перекрёстных ссылок */
  related?: string[];
}

const TERMS: Term[] = [
  // Legal / IP
  { id: "tsp", abbr: "TSP", full: "Time-Stamping Protocol", category: "legal", related: ["eidas", "rfc3161"], ru: "Протокол временной метки (RFC 3161). Удостоверяет, что документ существовал в указанный момент времени, без раскрытия содержимого. AEVION QSign использует TSP для каждой подписи.", en: "Time-Stamping Protocol (RFC 3161). Proves a document existed at a specific moment without revealing content. AEVION QSign uses TSP for every signature." },
  { id: "rfc3161", abbr: "RFC 3161", full: "Internet X.509 PKI Time-Stamp Protocol", category: "legal", related: ["tsp"], ru: "Стандарт IETF для time-stamping. Описывает структуру TSP-запроса/ответа и формат подписи timestamp authority.", en: "IETF standard for time-stamping. Defines TSP request/response structure and timestamp authority signature format." },
  { id: "eidas", abbr: "eIDAS", full: "electronic IDentification, Authentication and trust Services", category: "legal", related: ["tsp", "qes", "soc2"], ru: "Регламент ЕС 910/2014 о доверенных сервисах: электронная идентификация, подпись, печать, доставка. AEVION QSign — eIDAS-совместимый.", en: "EU Regulation 910/2014 on trust services: e-identification, signature, seal, delivery. AEVION QSign is eIDAS-compatible." },
  { id: "qes", abbr: "QES", full: "Qualified Electronic Signature", category: "legal", related: ["eidas"], ru: "Квалифицированная электронная подпись (eIDAS). Юридически эквивалентна рукописной во всех странах ЕС.", en: "Qualified Electronic Signature (eIDAS). Legally equivalent to handwritten in all EU member states." },
  { id: "ip", abbr: "IP", full: "Intellectual Property", category: "legal", ru: "Интеллектуальная собственность: авторские права, товарные знаки, патенты, ноу-хау. AEVION QRight + IP Bureau покрывают весь жизненный цикл IP.", en: "Intellectual Property: copyrights, trademarks, patents, know-how. AEVION QRight + IP Bureau cover the full IP lifecycle." },

  // Compliance
  { id: "soc2", abbr: "SOC 2", full: "Service Organization Control 2", category: "compliance", related: ["iso27001", "gdpr"], ru: "Аудит-стандарт AICPA для SaaS-платформ: Security, Availability, Processing Integrity, Confidentiality, Privacy. AEVION SOC 2 Type II сертифицирован.", en: "AICPA audit standard for SaaS: Security, Availability, Processing Integrity, Confidentiality, Privacy. AEVION is SOC 2 Type II certified." },
  { id: "iso27001", abbr: "ISO 27001", full: "Information Security Management Systems", category: "compliance", related: ["soc2"], ru: "Международный стандарт для управления информационной безопасностью. AEVION ISO 27001 сертифицирован для Enterprise-tier.", en: "International standard for information security management. AEVION is ISO 27001 certified for Enterprise tier." },
  { id: "gdpr", abbr: "GDPR", full: "General Data Protection Regulation", category: "compliance", related: ["dpa", "fz152"], ru: "Регламент ЕС о защите персональных данных (2018). AEVION даёт data residency в EU/RU/KZ, полный экспорт и right-to-be-forgotten.", en: "EU regulation on personal data protection (2018). AEVION offers data residency in EU/RU/KZ, full export and right-to-be-forgotten." },
  { id: "fz152", abbr: "152-ФЗ", full: "О персональных данных (РФ)", category: "compliance", related: ["gdpr"], ru: "Российский закон о персональных данных. AEVION compliant: данные граждан РФ хранятся на серверах в РФ для российских клиентов.", en: "Russian Federal Law on Personal Data. AEVION compliant: Russian citizen data stays on RF servers for Russian customers." },
  { id: "pcidss", abbr: "PCI DSS", full: "Payment Card Industry Data Security Standard", category: "compliance", ru: "Стандарт безопасности для обработки данных карт. AEVION QPayNet — Level 1 сертифицирован для эмбеддед-платежей.", en: "Payment card data security standard. AEVION QPayNet is Level 1 certified for embedded payments." },
  { id: "dpa", abbr: "DPA", full: "Data Processing Agreement", category: "compliance", related: ["gdpr"], ru: "Соглашение о обработке данных между клиентом и SaaS-провайдером. Требуется по GDPR. Доступен в Enterprise-tier AEVION.", en: "Data processing agreement between customer and SaaS. Required by GDPR. Available on AEVION Enterprise." },
  { id: "msa", abbr: "MSA", full: "Master Services Agreement", category: "compliance", related: ["dpa", "sla"], ru: "Главное соглашение об услугах: общие условия для всех SOW. AEVION использует MSA для Enterprise-контрактов.", en: "Master Services Agreement: umbrella terms for all SOW. AEVION uses MSA for Enterprise contracts." },
  { id: "sla", abbr: "SLA", full: "Service Level Agreement", category: "compliance", related: ["msa"], ru: "Соглашение об уровне сервиса: uptime, response-time, кредиты при нарушении. AEVION SLA: 99.9% (всё), 99.95% (Enterprise).", en: "Service Level Agreement: uptime, response-time, credits on breach. AEVION SLA: 99.9% (all), 99.95% (Enterprise)." },
  { id: "nda", abbr: "NDA", full: "Non-Disclosure Agreement", category: "compliance", ru: "Соглашение о неразглашении. AEVION QSign имеет NDA-template для подписи в один клик.", en: "Non-Disclosure Agreement. AEVION QSign has an NDA template for one-click signing." },

  // Tech / security
  { id: "hsm", abbr: "HSM", full: "Hardware Security Module", category: "tech", related: ["byok"], ru: "Аппаратный модуль безопасности для хранения криптоключей. AEVION использует HSM-совместимые хранилища с ротацией ключей раз в 90 дней.", en: "Hardware Security Module for cryptographic keys. AEVION uses HSM-compatible storage with 90-day key rotation." },
  { id: "byok", abbr: "BYOK", full: "Bring Your Own Key", category: "tech", related: ["hsm"], ru: "Возможность клиента использовать собственные ключи шифрования (например, в AWS KMS, Azure Key Vault). Доступно в Enterprise-tier.", en: "Customer brings their own encryption keys (e.g. AWS KMS, Azure Key Vault). Available on Enterprise tier." },
  { id: "rbac", abbr: "RBAC", full: "Role-Based Access Control", category: "auth", ru: "Ролевая модель доступа с granular-разрешениями на уровне объекта. AEVION включает MFA + SSO + RBAC.", en: "Role-Based Access Control with granular per-object permissions. AEVION includes MFA + SSO + RBAC." },
  { id: "mfa", abbr: "MFA", full: "Multi-Factor Authentication", category: "auth", ru: "Двухфакторная (или больше) аутентификация. Обязательна для всех аккаунтов AEVION.", en: "Two-factor (or more) authentication. Mandatory for all AEVION accounts." },
  { id: "sso", abbr: "SSO", full: "Single Sign-On", category: "auth", related: ["saml", "oidc"], ru: "Единый вход через корпоративный IdP. AEVION поддерживает SAML 2.0 и OpenID Connect.", en: "Single sign-on via corporate IdP. AEVION supports SAML 2.0 and OpenID Connect." },
  { id: "saml", abbr: "SAML", full: "Security Assertion Markup Language", category: "auth", related: ["sso", "oidc"], ru: "XML-стандарт для SSO. AEVION SAML 2.0 IdP-initiated и SP-initiated.", en: "XML standard for SSO. AEVION supports SAML 2.0 IdP-initiated and SP-initiated." },
  { id: "oidc", abbr: "OIDC", full: "OpenID Connect", category: "auth", related: ["sso", "saml"], ru: "JSON-based SSO поверх OAuth 2.0. AEVION OIDC + JWT для API-аутентификации.", en: "JSON-based SSO over OAuth 2.0. AEVION OIDC + JWT for API auth." },

  // Operations
  { id: "rpo", abbr: "RPO", full: "Recovery Point Objective", category: "ops", related: ["rto"], ru: "Допустимая потеря данных при сбое. AEVION RPO ≤ 1 час: репликация данных в 2+ зоны доступности.", en: "Acceptable data loss on failure. AEVION RPO ≤ 1 hour: replication across 2+ availability zones." },
  { id: "rto", abbr: "RTO", full: "Recovery Time Objective", category: "ops", related: ["rpo"], ru: "Допустимое время восстановления после сбоя. AEVION RTO ≤ 4 часа: ежеквартальные DR-учения.", en: "Acceptable recovery time after failure. AEVION RTO ≤ 4 hours: quarterly DR drills." },
  { id: "siem", abbr: "SIEM", full: "Security Information and Event Management", category: "ops", ru: "Система мониторинга security-событий (Splunk, Datadog, ELK). AEVION экспортирует audit-log в SIEM через webhook или S3.", en: "Security event monitoring system (Splunk, Datadog, ELK). AEVION exports audit log to SIEM via webhook or S3." },
  { id: "owasp", abbr: "OWASP", full: "Open Web Application Security Project", category: "ops", ru: "Сообщество для security-best-practices. OWASP Top-10 проверки в CI AEVION.", en: "Community for security best practices. OWASP Top-10 checks in AEVION CI." },

  // Billing / GTM
  { id: "arr", abbr: "ARR", full: "Annual Recurring Revenue", category: "billing", related: ["mrr"], ru: "Годовой рекуррентный доход — ключевая метрика SaaS. AEVION публикует aggregate ARR в годовых отчётах.", en: "Annual Recurring Revenue — key SaaS metric. AEVION publishes aggregate ARR in annual reports." },
  { id: "mrr", abbr: "MRR", full: "Monthly Recurring Revenue", category: "billing", related: ["arr"], ru: "Месячный рекуррентный доход. ARR = MRR × 12.", en: "Monthly Recurring Revenue. ARR = MRR × 12." },
  { id: "ltv", abbr: "LTV", full: "Lifetime Value", category: "billing", related: ["cac"], ru: "Сумма дохода с одного клиента за всё время. Affiliate AEVION получает 20% от LTV.", en: "Total revenue per customer over their lifetime. AEVION affiliates earn 20% of LTV." },
  { id: "cac", abbr: "CAC", full: "Customer Acquisition Cost", category: "billing", related: ["ltv"], ru: "Стоимость привлечения одного клиента. LTV/CAC > 3 — здоровый SaaS.", en: "Cost to acquire one customer. LTV/CAC > 3 indicates a healthy SaaS." },
  { id: "nps", abbr: "NPS", full: "Net Promoter Score", category: "billing", ru: "Метрика удовлетворённости (-100 до +100). AEVION NPS = +72 на 2026-04.", en: "Customer satisfaction metric (-100 to +100). AEVION NPS = +72 as of 2026-04." },
  { id: "saas", abbr: "SaaS", full: "Software as a Service", category: "billing", ru: "Программное обеспечение как услуга. AEVION — multi-product SaaS с 27 модулями.", en: "Software as a Service. AEVION is a multi-product SaaS with 27 modules." },
];

const CATEGORY_META: Record<Term["category"], { ru: string; en: string; color: string; bg: string }> = {
  legal: { ru: "Право и IP", en: "Legal & IP", color: "#7c3aed", bg: "#f5f3ff" },
  compliance: { ru: "Compliance", en: "Compliance", color: "#0d9488", bg: "#ecfdf5" },
  tech: { ru: "Технологии", en: "Tech", color: "#0ea5e9", bg: "#e0f2fe" },
  auth: { ru: "Аутентификация", en: "Authentication", color: "#be185d", bg: "#fdf2f8" },
  ops: { ru: "Операции", en: "Operations", color: "#475569", bg: "#f1f5f9" },
  billing: { ru: "Биллинг и метрики", en: "Billing & metrics", color: "#f59e0b", bg: "#fefce8" },
};

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

export default function PricingGlossaryPage() {
  const tp = usePricingT();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<Term["category"] | null>(null);
  const [filterLetter, setFilterLetter] = useState<string | null>(null);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/glossary" });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TERMS.filter((t) => {
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterLetter && t.abbr[0].toUpperCase() !== filterLetter) return false;
      if (q) {
        const haystack = `${t.abbr} ${t.full} ${t.ru} ${t.en}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a.abbr.localeCompare(b.abbr));
  }, [search, filterCategory, filterLetter]);

  const letters = useMemo(() => {
    const s = new Set<string>();
    for (const t of TERMS) s.add(t.abbr[0].toUpperCase());
    return Array.from(s).sort();
  }, []);

  const counts = useMemo(() => {
    const m: Partial<Record<Term["category"], number>> = {};
    for (const t of TERMS) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, []);

  return (
    <ProductPageShell maxWidth={1080}>
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
          {tp("glossary.badge", { count: TERMS.length })}
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
          {tp("glossary.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 680,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("glossary.subtitle")}
        </p>
      </section>

      {/* Search + filters */}
      <section
        style={{
          marginBottom: 16,
          padding: "12px 14px",
          background: "rgba(13,148,136,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(13,148,136,0.12)",
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tp("glossary.searchPlaceholder")}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            color: "#0f172a",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.06em", alignSelf: "center" }}>
            {tp("glossary.filterCategory")}
          </span>
          <Chip
            active={filterCategory === null}
            onClick={() => setFilterCategory(null)}
            label={`${tp("glossary.filterAll")} · ${TERMS.length}`}
          />
          {(Object.keys(CATEGORY_META) as Term["category"][]).map((c) => {
            const meta = CATEGORY_META[c];
            return (
              <Chip
                key={c}
                active={filterCategory === c}
                onClick={() => setFilterCategory(filterCategory === c ? null : c)}
                label={`${meta.ru} · ${counts[c] ?? 0}`}
                color={meta.color}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.06em", alignSelf: "center", marginRight: 4 }}>
            {tp("glossary.filterLetter")}
          </span>
          <Chip
            active={filterLetter === null}
            onClick={() => setFilterLetter(null)}
            label={tp("glossary.filterAll")}
            small
          />
          {letters.map((l) => (
            <Chip
              key={l}
              active={filterLetter === l}
              onClick={() => setFilterLetter(filterLetter === l ? null : l)}
              label={l}
              small
            />
          ))}
        </div>
      </section>

      {/* Term list */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#64748b",
            background: "#f8fafc",
            borderRadius: 12,
            border: BORDER,
            marginBottom: 36,
          }}
        >
          {tp("glossary.empty")}
        </div>
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
          {filtered.map((t) => {
            const meta = CATEGORY_META[t.category];
            return (
              <article
                key={t.id}
                id={t.id}
                style={{
                  padding: 20,
                  background: "#fff",
                  border: BORDER,
                  borderRadius: 14,
                  boxShadow: CARD,
                  scrollMarginTop: 80,
                }}
              >
                <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <a
                    href={`#${t.id}`}
                    style={{ textDecoration: "none", color: "#0f172a" }}
                  >
                    <h2
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        margin: 0,
                        letterSpacing: "-0.02em",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {t.abbr}
                    </h2>
                  </a>
                  <span style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>
                    {t.full}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: meta.bg,
                      color: meta.color,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {meta.ru.toUpperCase()}
                  </span>
                </header>
                <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.6, margin: 0, marginBottom: 8 }}>
                  {t.ru}
                </p>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55, margin: 0, fontStyle: "italic" }}>
                  EN: {t.en}
                </p>
                {t.related && t.related.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>
                    {tp("glossary.related")}:{" "}
                    {t.related.map((rid, i) => {
                      const rt = TERMS.find((x) => x.id === rid);
                      if (!rt) return null;
                      return (
                        <span key={rid}>
                          {i > 0 && ", "}
                          <a
                            href={`#${rid}`}
                            style={{
                              color: "#0d9488",
                              fontWeight: 700,
                              textDecoration: "none",
                              fontFamily: "ui-monospace, monospace",
                            }}
                          >
                            {rt.abbr}
                          </a>
                        </span>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* Submit term CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 24,
          background: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(14,165,233,0.05))",
          border: "1px solid rgba(13,148,136,0.15)",
          borderRadius: 14,
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em", color: "#0f172a" }}>
          {tp("glossary.submit.title")}
        </h3>
        <p style={{ color: "#475569", margin: 0, marginBottom: 14, fontSize: 13, maxWidth: 540, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
          {tp("glossary.submit.subtitle")}
        </p>
        <a
          href="mailto:hello@aevion.io?subject=Glossary%20term%20suggestion"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 10,
            background: "#0d9488",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          hello@aevion.io
        </a>
      </section>
    </ProductPageShell>
  );
}

function Chip({
  active,
  onClick,
  label,
  color = "#0d9488",
  small,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? "4px 10px" : "6px 12px",
        fontSize: small ? 11 : 12,
        fontWeight: 800,
        borderRadius: 999,
        border: active ? "none" : "1px solid rgba(15,23,42,0.12)",
        cursor: "pointer",
        background: active ? color : "#fff",
        color: active ? "#fff" : "#475569",
        fontFamily: small ? "ui-monospace, monospace" : "inherit",
      }}
    >
      {label}
    </button>
  );
}
