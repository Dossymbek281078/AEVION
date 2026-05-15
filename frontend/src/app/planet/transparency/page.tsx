import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";
import { revokeReasonLabel } from "@/lib/qrightRevokeReasons";
import { pickLang } from "@/lib/qrightServerI18n";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type TransparencyView = {
  generatedAt: string;
  totals: {
    certificates: number;
    active: number;
    revoked: number;
    firstIssuedAt: string | null;
    lastIssuedAt: string | null;
  };
  revokesByReasonCode: { code: string; count: number }[];
  certificatesByArtifactType: { type: string; count: number }[];
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function loadTransparency(): Promise<TransparencyView | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/planet/transparency`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as TransparencyView;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "Planet transparency — AEVION",
  description:
    "Public aggregate stats for the AEVION Planet certificate registry: total issued, active vs revoked, by revocation reason and artifact type.",
  openGraph: {
    type: "article",
    title: "Planet transparency — AEVION",
    description: "Public aggregate stats for the AEVION Planet certificate registry.",
  },
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 22,
  background: "#fff",
};
const stat: CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.02em",
  margin: 0,
};
const statLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginTop: 4,
};

const COPY = {
  en: {
    back: "← AEVION Planet",
    title: "Planet transparency",
    subtitle:
      "Public aggregate counts for the Planet certificate registry. Updates every ~5 min. No personally identifying data is exposed here.",
    headIssued: "Certificates issued",
    headActive: "Currently active",
    headRevoked: "Revoked",
    headFirst: "First issued",
    byReason: "Revocations by reason",
    noRevokes: "No revocations on record.",
    summary: "Total revocations: {total} of {issued} ({pct}%).",
    byType: "Certificates by artifact type",
    noCerts: "No certificates yet.",
    generated: "Generated {ts}",
    failedTitle: "Failed to load",
    failedDetail: "The aggregate is temporarily unreachable. Try again later.",
  },
  ru: {
    back: "← AEVION Planet",
    title: "Прозрачность Planet",
    subtitle:
      "Публичные агрегированные счётчики реестра сертификатов Planet. Обновляется примерно каждые 5 минут. Здесь не раскрываются персональные данные.",
    headIssued: "Выдано сертификатов",
    headActive: "Активных сейчас",
    headRevoked: "Отозвано",
    headFirst: "Первый сертификат",
    byReason: "Отозвано по причинам",
    noRevokes: "Отзывов пока нет.",
    summary: "Всего отзывов: {total} из {issued} ({pct}%).",
    byType: "Сертификаты по типу артефакта",
    noCerts: "Сертификатов пока нет.",
    generated: "Сгенерировано {ts}",
    failedTitle: "Не удалось загрузить",
    failedDetail: "Агрегатор временно недоступен. Попробуйте позже.",
  },
} as const;

function fmt(n: number, lang: "en" | "ru") {
  return n.toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
}

function Bar({
  label,
  count,
  total,
  accent,
  lang,
}: {
  label: string;
  count: number;
  total: number;
  accent: string;
  lang: "en" | "ru";
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: "#0f172a", fontWeight: 700 }}>{label}</span>
        <span style={{ color: "#64748b" }}>
          {fmt(count, lang as "en" | "ru")}
          <span style={{ marginLeft: 6, color: "#94a3b8" }}>{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(2, pct)}%`, background: accent, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export default async function PlanetTransparencyPage({ searchParams }: Props) {
  const sp = (await searchParams) || {};
  const h = await headers();
  const lang = pickLang(sp, h);
  const t = COPY[lang as "en" | "ru"];
  const data = await loadTransparency();

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{t.failedTitle}</div>
            <div style={{ fontSize: 13 }}>{t.failedDetail}</div>
          </div>
        </div>
      </main>
    );
  }

  const totalRevokes = data.revokesByReasonCode.reduce((s, r) => s + r.count, 0);
  const totalTypes = data.certificatesByArtifactType.reduce((s, r) => s + r.count, 0);

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/planet" style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>
            {t.back}
          </Link>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", margin: 0 }}>
          {t.title}
        </h1>
        <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24, lineHeight: 1.6 }}>
          {t.subtitle}
        </p>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 20 }}>
          <div style={card}>
            <p style={stat}>{fmt(data.totals.certificates, lang as "en" | "ru")}</p>
            <div style={statLabel}>{t.headIssued}</div>
          </div>
          <div style={{ ...card, borderColor: "rgba(13,148,136,0.25)" }}>
            <p style={{ ...stat, color: "#0d9488" }}>{fmt(data.totals.active, lang as "en" | "ru")}</p>
            <div style={statLabel}>{t.headActive}</div>
          </div>
          <div style={{ ...card, borderColor: "rgba(220,38,38,0.25)" }}>
            <p style={{ ...stat, color: "#dc2626" }}>{fmt(data.totals.revoked, lang as "en" | "ru")}</p>
            <div style={statLabel}>{t.headRevoked}</div>
          </div>
          <div style={card}>
            <p style={{ ...stat, fontSize: 18, fontWeight: 800 }}>
              {data.totals.firstIssuedAt
                ? new Date(data.totals.firstIssuedAt).toISOString().slice(0, 10)
                : "—"}
            </p>
            <div style={statLabel}>{t.headFirst}</div>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 14 }}>
            {t.byReason}
          </h2>
          {data.revokesByReasonCode.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{t.noRevokes}</p>
          ) : (
            <>
              {data.revokesByReasonCode.map((r) => (
                <Bar
                  key={r.code}
                  label={revokeReasonLabel(r.code, lang as "en" | "ru")}
                  count={r.count}
                  total={totalRevokes}
                  accent="#dc2626"
                  lang={lang as "en" | "ru"}
                />
              ))}
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                {t.summary
                  .replace("{total}", fmt(totalRevokes, lang as "en" | "ru"))
                  .replace("{issued}", fmt(data.totals.certificates, lang as "en" | "ru"))
                  .replace(
                    "{pct}",
                    data.totals.certificates > 0
                      ? ((totalRevokes / data.totals.certificates) * 100).toFixed(2)
                      : "0.00"
                  )}
              </div>
            </>
          )}
        </div>

        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 14 }}>
            {t.byType}
          </h2>
          {data.certificatesByArtifactType.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{t.noCerts}</p>
          ) : (
            data.certificatesByArtifactType.map((r) => (
              <Bar
                key={r.type}
                label={r.type.toUpperCase()}
                count={r.count}
                total={totalTypes}
                accent="#0d9488"
                lang={lang as "en" | "ru"}
              />
            ))
          )}
        </div>

        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 24 }}>
          {t.generated.replace("{ts}", new Date(data.generatedAt).toUTCString())}
        </div>
      </div>
    </main>
  );
}
