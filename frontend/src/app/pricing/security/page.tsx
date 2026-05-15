import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const CERTIFICATIONS = [
  {
    name: "SOC 2 Type II",
    scope: "Security, Availability, Confidentiality",
    status: "Certified",
    color: "#0d9488",
    bg: "#ecfdf5",
    icon: "✓",
  },
  {
    name: "GDPR",
    scope: "EU General Data Protection Regulation",
    status: "Compliant",
    color: "#0ea5e9",
    bg: "#e0f2fe",
    icon: "✓",
  },
  {
    name: "152-ФЗ",
    scope: "Федеральный закон о персональных данных (РФ)",
    status: "Compliant",
    color: "#7c3aed",
    bg: "#f5f3ff",
    icon: "✓",
  },
  {
    name: "PCI DSS",
    scope: "Payment Card Industry Data Security Standard",
    status: "Level 1",
    color: "#d97706",
    bg: "#fefce8",
    icon: "✓",
  },
];

const PILLARS = [
  {
    title: "Шифрование данных",
    icon: "🔒",
    body: "Данные в покое шифруются с помощью AES-256. Транзитные данные защищены TLS 1.3. Ключи хранятся в HSM-совместимых хранилищах с ротацией раз в 90 дней. Поддержка BYOK (Bring Your Own Key) для Enterprise-клиентов.",
  },
  {
    title: "Контроль доступа",
    icon: "👤",
    body: "Role-Based Access Control (RBAC) с granular-разрешениями на уровне объекта. Обязательная MFA для всех аккаунтов. SSO через SAML 2.0 / OIDC. Принцип наименьших привилегий применяется ко всем сервисным аккаунтам.",
  },
  {
    title: "Аудит и логирование",
    icon: "📋",
    body: "Иммутабельный журнал аудита для каждого действия в системе: кто, когда, с какого IP, что изменил. Логи хранятся минимум 365 дней. Экспорт в SIEM (Splunk, Datadog, ELK) через webhook или S3.",
  },
  {
    title: "Инфраструктура",
    icon: "🏗",
    body: "Мультиарендная инфраструктура с жёсткой изоляцией на уровне namespace. Kubernetes с network policy, pod security standards. Все образы сканируются Trivy и Snyk до деплоя. Runtime-защита через Falco.",
  },
  {
    title: "BCP / Disaster Recovery",
    icon: "♻",
    body: "RPO ≤ 1 час, RTO ≤ 4 часа. Репликация данных в 2+ зоны доступности. Ежедневные бэкапы с проверкой восстановления. Учения DR проводятся ежеквартально. SLA uptime 99.9% (Enterprise — 99.95%).",
  },
  {
    title: "Безопасная разработка",
    icon: "🛡",
    body: "OWASP Top-10 проверки в CI. Статический анализ (SonarQube, Semgrep) и DAST на staging. Обязательный security review для изменений в auth, billing и data access слоях. Dependency audit еженедельно.",
  },
];

const RESIDENCY_ROWS = [
  {
    region: "EU (Frankfurt)",
    flag: "🇪🇺",
    tiers: "Free, Pro, Business",
    primary: true,
    notes: "GDPR-compliant, стандартный регион",
  },
  {
    region: "RU (Москва)",
    flag: "🇷🇺",
    tiers: "Business, Enterprise",
    primary: false,
    notes: "152-ФЗ, зеркало + первичное хранение для RU-клиентов",
  },
  {
    region: "KZ (Алматы)",
    flag: "🇰🇿",
    tiers: "Enterprise",
    primary: false,
    notes: "Локальная резидентность по требованию регулятора",
  },
  {
    region: "Your VPC",
    flag: "🏢",
    tiers: "Enterprise",
    primary: false,
    notes: "On-premise / private cloud, BYOK, полная изоляция",
  },
];

const DOC_CARDS = [
  {
    title: "SOC 2 Report",
    description: "Полный отчёт Type II доступен по запросу под NDA для Enterprise и Business клиентов.",
    cta: "Запросить отчёт",
    href: "/pricing/contact?topic=soc2",
    accent: "#0d9488",
  },
  {
    title: "Политика обработки данных (DPA)",
    description: "Data Processing Agreement для соответствия GDPR Article 28. Подписывается электронно за 1 рабочий день.",
    cta: "Получить DPA",
    href: "/pricing/contact?topic=dpa",
    accent: "#0ea5e9",
  },
  {
    title: "Penetration Test Summary",
    description: "Сводный отчёт о ежегодном penetration test от независимой фирмы. Доступен для Business и Enterprise.",
    cta: "Запросить pentest summary",
    href: "/pricing/contact?topic=pentest",
    accent: "#7c3aed",
  },
];

export default function SecurityPage() {
  return (
    <ProductPageShell maxWidth={1100}>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Все тарифы
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 28px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #065f46, #0d9488)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          SECURITY &amp; COMPLIANCE
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
          Безопасность и соответствие требованиям
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#475569",
            maxWidth: 660,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          AEVION проектировался с фокусом на enterprise-grade защиту с первого дня. Данные клиентов хранятся в
          изолированных namespace, шифруются AES-256 в покое и TLS 1.3 в транзите. Мы проходим независимые аудиты
          SOC 2 Type II, выполняем требования GDPR, 152-ФЗ и PCI DSS, и публично раскрываем политики безопасности.
        </p>
      </section>

      {/* Certifications row */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            margin: 0,
            marginBottom: 20,
            letterSpacing: "-0.02em",
            textAlign: "center",
            color: "#0f172a",
          }}
        >
          Сертификаты и соответствие
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {CERTIFICATIONS.map((cert) => (
            <div
              key={cert.name}
              style={{
                background: cert.bg,
                border: `1px solid ${cert.color}30`,
                borderRadius: 14,
                padding: "20px 18px",
                textAlign: "center",
                boxShadow: CARD,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: cert.color,
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                {cert.icon}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: cert.color, marginBottom: 4 }}>
                {cert.name}
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  background: cert.color,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 999,
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {cert.status}
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{cert.scope}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Security pillars */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            color: "#0f172a",
          }}
        >
          6 уровней защиты
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 24, fontSize: 14 }}>
          Комплексная защита на каждом слое — от кода до железа.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 14,
                padding: "20px 18px",
                boxShadow: CARD,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 10 }}>{pillar.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                {pillar.title}
              </div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{pillar.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Data residency table */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            color: "#0f172a",
          }}
        >
          Резидентность данных
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20, fontSize: 14 }}>
          Выберите регион хранения данных в соответствии с требованиями вашего регулятора.
        </p>
        <div
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: CARD,
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    Регион
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    Доступно для тарифов
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    Примечание
                  </th>
                </tr>
              </thead>
              <tbody>
                {RESIDENCY_ROWS.map((row, i) => (
                  <tr
                    key={row.region}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                      background: row.primary ? "rgba(13,148,136,0.03)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 700, whiteSpace: "nowrap" }}>
                      <span style={{ marginRight: 8 }}>{row.flag}</span>
                      {row.region}
                      {row.primary && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 6px",
                            background: "#0d9488",
                            color: "#fff",
                            borderRadius: 4,
                            letterSpacing: "0.04em",
                          }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>{row.tiers}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Bug bounty CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 32,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              padding: "3px 10px",
              background: "rgba(245,158,11,0.18)",
              border: "1px solid rgba(245,158,11,0.4)",
              color: "#fbbf24",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              borderRadius: 6,
              marginBottom: 10,
            }}
          >
            BUG BOUNTY
          </div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 900,
              margin: 0,
              marginBottom: 8,
              letterSpacing: "-0.02em",
            }}
          >
            Нашли уязвимость? Мы платим за это.
          </h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 640 }}>
            Программа Bug Bounty открыта для всех. Вознаграждение до $5 000 за критические уязвимости
            (RCE, SQL-инъекции, утечки данных, обходы аутентификации). Ответ в течение 48 часов.
            Responsible disclosure — обязательное условие.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/pricing/contact?topic=bug-bounty"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "linear-gradient(135deg, #d97706, #f59e0b)",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Сообщить об уязвимости
          </Link>
          <a
            href="mailto:security@aevion.io"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#cbd5e1",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            security@aevion.io
          </a>
        </div>
      </section>

      {/* Security document request cards */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            color: "#0f172a",
          }}
        >
          Запрос документов безопасности
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20, fontSize: 14 }}>
          Документы предоставляются действующим и потенциальным клиентам Business и Enterprise тарифов.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {DOC_CARDS.map((doc) => (
            <div
              key={doc.title}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 14,
                padding: "20px 18px",
                boxShadow: CARD,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: doc.accent,
                  marginBottom: 2,
                }}
              />
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{doc.title}</div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, flex: 1 }}>
                {doc.description}
              </div>
              <Link
                href={doc.href}
                style={{
                  display: "inline-block",
                  padding: "9px 16px",
                  background: doc.accent,
                  color: "#fff",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  alignSelf: "flex-start",
                }}
              >
                {doc.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Back to pricing */}
      <div
        style={{
          borderTop: "1px solid rgba(15,23,42,0.08)",
          paddingTop: 24,
          marginTop: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Link href="/pricing" style={{ color: "#0d9488", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          ← Вернуться к тарифам
        </Link>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Вопросы?{" "}
          <a href="mailto:security@aevion.io" style={{ color: "#0d9488", fontWeight: 700 }}>
            security@aevion.io
          </a>
        </div>
      </div>
    </ProductPageShell>
  );
}
