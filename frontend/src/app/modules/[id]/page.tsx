import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";
import { pickLang } from "@/lib/qrightServerI18n";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type Detail = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  priority: number;
  tags: string[];
  effectiveStatus: string;
  effectiveTier: string;
  effectiveHint: string;
  baseStatus: string;
  baseTier: string;
  baseHint: string;
  primaryPath: string | null;
  apiHints: string[];
  isOverridden: boolean;
  overrideUpdatedAt: string | null;
  updatedAt: string;
};

type ChangelogItem = {
  id: string;
  moduleId: string;
  oldState: { status: string; tier: string; hint: string; hadOverride: boolean } | null;
  newState: { status: string; tier: string; hint: string; hadOverride: boolean } | null;
  at: string;
};

type GraphResponse = {
  nodes: { id: string; type: "module" | "api"; label: string }[];
  edges: { from: string; to: string }[];
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TIER_COLOR: Record<string, string> = {
  mvp_live: "#0d9488",
  platform_api: "#2563eb",
  portal_only: "#94a3b8",
};

type CopyT = {
  back: string;
  notFoundTitle: string;
  notFoundDetail: string;
  failedTitle: string;
  failedDetail: string;
  overridden: string;
  overrideUpdated: string;
  sectionIdentity: string;
  sectionState: string;
  sectionSurfaces: string;
  sectionBadge: string;
  sectionDeps: string;
  sectionHistory: string;
  fieldId: string;
  fieldCode: string;
  fieldName: string;
  fieldKind: string;
  fieldPriority: string;
  fieldTags: string;
  fieldStatus: string;
  fieldTier: string;
  fieldHint: string;
  fieldBaseStatus: string;
  fieldBaseTier: string;
  fieldBaseHint: string;
  fieldPrimaryPath: string;
  fieldApiHints: string;
  openModule: string;
  embedConfigurator: string;
  embedJson: string;
  badgeNote: string;
  historyEmpty: string;
  historyChanged: string;
  historyAddedOverride: string;
  historyClearedOverride: string;
  none: string;
};

const COPY: Record<"en" | "ru", CopyT> = {
  en: {
    back: "← All modules",
    notFoundTitle: "Module not found",
    notFoundDetail: "No registry entry with id {id}.",
    failedTitle: "Failed to load",
    failedDetail: "The registry is temporarily unreachable.",
    overridden: "Admin override active",
    overrideUpdated: "Last override edit",
    sectionIdentity: "Identity",
    sectionState: "Live state",
    sectionSurfaces: "Surfaces",
    sectionBadge: "Embed badge",
    sectionDeps: "API dependencies",
    sectionHistory: "History",
    fieldId: "ID",
    fieldCode: "Code",
    fieldName: "Name",
    fieldKind: "Kind",
    fieldPriority: "Priority",
    fieldTags: "Tags",
    fieldStatus: "Status",
    fieldTier: "Tier",
    fieldHint: "Hint",
    fieldBaseStatus: "Base (code) status",
    fieldBaseTier: "Base (code) tier",
    fieldBaseHint: "Base (code) hint",
    fieldPrimaryPath: "Primary path",
    fieldApiHints: "API endpoints",
    openModule: "Open module →",
    embedConfigurator: "Embed configurator →",
    embedJson: "Embed JSON →",
    badgeNote: "Badges auto-update when tier or status changes.",
    historyEmpty: "No changes recorded yet.",
    historyChanged: "Changed:",
    historyAddedOverride: "Override applied",
    historyClearedOverride: "Override cleared",
    none: "—",
  },
  ru: {
    back: "← Все модули",
    notFoundTitle: "Модуль не найден",
    notFoundDetail: "В реестре нет записи с id {id}.",
    failedTitle: "Не удалось загрузить",
    failedDetail: "Реестр временно недоступен.",
    overridden: "Активен админ-override",
    overrideUpdated: "Последнее изменение override",
    sectionIdentity: "Идентификация",
    sectionState: "Текущее состояние",
    sectionSurfaces: "Поверхности",
    sectionBadge: "Встраиваемый бейдж",
    sectionDeps: "Зависимости API",
    sectionHistory: "История",
    fieldId: "ID",
    fieldCode: "Код",
    fieldName: "Имя",
    fieldKind: "Тип",
    fieldPriority: "Приоритет",
    fieldTags: "Теги",
    fieldStatus: "Статус",
    fieldTier: "Tier",
    fieldHint: "Подсказка",
    fieldBaseStatus: "Базовый статус (код)",
    fieldBaseTier: "Базовый tier (код)",
    fieldBaseHint: "Базовая подсказка (код)",
    fieldPrimaryPath: "Основной путь",
    fieldApiHints: "API эндпоинты",
    openModule: "Открыть модуль →",
    embedConfigurator: "Конфигуратор бейджа →",
    embedJson: "Embed JSON →",
    badgeNote: "Бейджи обновляются автоматически при смене tier/статуса.",
    historyEmpty: "Изменений пока нет.",
    historyChanged: "Изменено:",
    historyAddedOverride: "Override применён",
    historyClearedOverride: "Override снят",
    none: "—",
  },
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
  marginBottom: 14,
};
const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 10,
};
const fieldRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, max-content) 1fr",
  gap: 10,
  fontSize: 13,
  padding: "5px 0",
};
const fieldKey: CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};
const fieldVal: CSSProperties = {
  color: "#0f172a",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  wordBreak: "break-all",
};

async function loadDetail(id: string): Promise<Detail | "not_found" | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/modules/${encodeURIComponent(id)}/detail`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 404) return "not_found";
    if (!r.ok) return null;
    const j = (await r.json()) as Detail | { status: "not_found" };
    if ("status" in j && (j as any).status === "not_found") return "not_found";
    return j as Detail;
  } catch {
    return null;
  }
}

async function loadHistory(id: string): Promise<ChangelogItem[]> {
  try {
    const r = await fetch(
      `${getApiBase()}/api/modules/changelog?moduleId=${encodeURIComponent(id)}&limit=50`,
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.items) ? (j.items as ChangelogItem[]) : [];
  } catch {
    return [];
  }
}

async function loadGraph(): Promise<GraphResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/modules/dependency-graph`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as GraphResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadDetail(id);
  if (!data || data === "not_found") {
    return { title: `Module ${id} — AEVION` };
  }
  // OG card lives on the backend so it inherits live tier/status colors
  // without a client-side rebuild step. Absolute URL only matters when the
  // browser scrapes — getApiBase() resolves the right one in both worlds.
  const ogImage = `${getApiBase()}/api/modules/${encodeURIComponent(id)}/og.svg`;
  const rssUrl = `${getApiBase()}/api/modules/${encodeURIComponent(id)}/changelog.rss`;
  const title = `${data.name} — AEVION module`;
  return {
    title,
    description: data.description,
    alternates: {
      types: {
        "application/rss+xml": rssUrl,
      },
    },
    openGraph: {
      type: "article",
      title,
      description: data.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: data.description,
      images: [ogImage],
    },
  };
}

export default async function ModuleDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const h = await headers();
  const lang = pickLang(sp, h);
  const t = COPY[lang as "en" | "ru"];

  const [detail, history, graph] = await Promise.all([
    loadDetail(id),
    loadHistory(id),
    loadGraph(),
  ]);

  if (detail === "not_found") {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/modules"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              {t.back}
            </Link>
          </div>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{t.notFoundTitle}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              {t.notFoundDetail.replace("{id}", id)}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/modules"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              {t.back}
            </Link>
          </div>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{t.failedTitle}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{t.failedDetail}</div>
          </div>
        </div>
      </main>
    );
  }

  const tierColor = TIER_COLOR[detail.effectiveTier] || "#94a3b8";

  // API edges originating from this module — derived from the dep-graph nodes.
  const apiEdges = (graph?.edges || []).filter((e) => e.from === detail.id);
  const apiLabelById = new Map(
    (graph?.nodes || []).filter((n) => n.type === "api").map((n) => [n.id, n.label])
  );

  const apiBase = getApiBase();
  const badgeUrlDark = `${apiBase}/api/modules/${encodeURIComponent(detail.id)}/badge.svg?theme=dark`;
  const badgeUrlLight = `${apiBase}/api/modules/${encodeURIComponent(detail.id)}/badge.svg?theme=light`;
  const embedJsonUrl = `${apiBase}/api/modules/${encodeURIComponent(detail.id)}/embed`;

  // Structured data — BreadcrumbList + WebPage. Search engines parse this
  // and (Google in particular) render breadcrumb chips in SERPs.
  const ldJson = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "AEVION modules", item: "/modules" },
        {
          "@type": "ListItem",
          position: 2,
          name: detail.name,
          item: `/modules/${detail.id}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${detail.name} — AEVION module`,
      description: detail.description,
      keywords: detail.tags.join(", "),
      url: `/modules/${detail.id}`,
    },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/modules"
            style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
          >
            {t.back}
          </Link>
        </div>

        {/* Header */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                background: tierColor + "22",
                color: tierColor,
                fontSize: 11,
                fontWeight: 800,
                fontFamily: "monospace",
              }}
            >
              {detail.effectiveTier}
            </span>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                background: "rgba(15,23,42,0.06)",
                color: "#475569",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              {detail.effectiveStatus}
            </span>
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                background: "rgba(15,23,42,0.04)",
                color: "#94a3b8",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "monospace",
                textTransform: "uppercase",
              }}
            >
              {detail.kind}
            </span>
            {detail.isOverridden && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(234,88,12,0.1)",
                  color: "#ea580c",
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: "monospace",
                }}
                title={
                  detail.overrideUpdatedAt
                    ? `${t.overrideUpdated}: ${detail.overrideUpdatedAt}`
                    : undefined
                }
              >
                {t.overridden}
              </span>
            )}
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {detail.name}
          </h1>
          <div
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              color: "#64748b",
              marginTop: 4,
            }}
          >
            {detail.code} · {detail.id}
          </div>
          <p style={{ color: "#475569", fontSize: 14, marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
            {detail.description}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {detail.primaryPath && (
              <Link
                href={detail.primaryPath}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "#0f172a",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                {t.openModule}
              </Link>
            )}
            <Link
              href={`/modules/${encodeURIComponent(detail.id)}/badge`}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${tierColor}`,
                color: tierColor,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                background: "#fff",
              }}
            >
              {t.embedConfigurator}
            </Link>
            <a
              href={embedJsonUrl}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.15)",
                color: "#0f172a",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                background: "#fff",
              }}
            >
              {t.embedJson}
            </a>
          </div>
        </div>

        {/* Identity */}
        <div style={card}>
          <div style={sectionLabel}>{t.sectionIdentity}</div>
          <div>
            <Field k={t.fieldId} v={detail.id} />
            <Field k={t.fieldCode} v={detail.code} />
            <Field k={t.fieldName} v={detail.name} />
            <Field k={t.fieldKind} v={detail.kind} />
            <Field k={t.fieldPriority} v={String(detail.priority)} />
            <div style={fieldRow}>
              <span style={fieldKey}>{t.fieldTags}</span>
              <span style={fieldVal}>
                {detail.tags.length === 0 ? (
                  t.none
                ) : (
                  <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                    {detail.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/modules?tag=${encodeURIComponent(tag)}`}
                        style={{
                          color: "#0d9488",
                          textDecoration: "none",
                          fontSize: 12,
                        }}
                      >
                        #{tag}
                      </Link>
                    ))}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Live state */}
        <div style={card}>
          <div style={sectionLabel}>{t.sectionState}</div>
          <div>
            <Field
              k={t.fieldStatus}
              v={detail.effectiveStatus}
              hint={detail.effectiveStatus !== detail.baseStatus ? `← ${detail.baseStatus}` : undefined}
            />
            <Field
              k={t.fieldTier}
              v={detail.effectiveTier}
              hint={detail.effectiveTier !== detail.baseTier ? `← ${detail.baseTier}` : undefined}
            />
            <Field
              k={t.fieldHint}
              v={detail.effectiveHint || t.none}
              hint={detail.effectiveHint !== detail.baseHint ? `← ${detail.baseHint || t.none}` : undefined}
            />
            <Field k={t.fieldBaseStatus} v={detail.baseStatus} />
            <Field k={t.fieldBaseTier} v={detail.baseTier} />
            <Field k={t.fieldBaseHint} v={detail.baseHint || t.none} />
            {detail.overrideUpdatedAt && (
              <Field k={t.overrideUpdated} v={detail.overrideUpdatedAt} />
            )}
          </div>
        </div>

        {/* Surfaces */}
        <div style={card}>
          <div style={sectionLabel}>{t.sectionSurfaces}</div>
          <div style={fieldRow}>
            <span style={fieldKey}>{t.fieldPrimaryPath}</span>
            <span style={fieldVal}>
              {detail.primaryPath ? (
                <Link
                  href={detail.primaryPath}
                  style={{ color: "#0d9488", textDecoration: "none" }}
                >
                  {detail.primaryPath}
                </Link>
              ) : (
                t.none
              )}
            </span>
          </div>
          <div style={fieldRow}>
            <span style={fieldKey}>{t.fieldApiHints}</span>
            <span style={fieldVal}>
              {detail.apiHints.length ? detail.apiHints.join("\n") : t.none}
            </span>
          </div>
        </div>

        {/* Badge preview */}
        <div style={card}>
          <div style={sectionLabel}>{t.sectionBadge}</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                background: "linear-gradient(135deg, #0f172a, #1e293b)",
                borderRadius: 10,
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeUrlDark} alt="AEVION module badge — dark" height={22} />
            </div>
            <div
              style={{
                background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
                borderRadius: 10,
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeUrlLight} alt="AEVION module badge — light" height={22} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>{t.badgeNote}</div>
        </div>

        {/* Dependencies */}
        <div style={card}>
          <div style={sectionLabel}>{t.sectionDeps}</div>
          {apiEdges.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{t.none}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {apiEdges.map((e, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "#0f172a",
                    background: "#f1f5f9",
                    padding: "6px 10px",
                    borderRadius: 6,
                  }}
                >
                  {apiLabelById.get(e.to) || e.to}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ ...sectionLabel, marginBottom: 0 }}>{t.sectionHistory}</div>
            <a
              href={`${apiBase}/api/modules/${encodeURIComponent(detail.id)}/changelog.rss`}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#ea580c",
                textDecoration: "none",
                fontFamily: "monospace",
              }}
              title="RSS feed scoped to this module"
            >
              RSS →
            </a>
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{t.historyEmpty}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((h) => (
                <HistoryRow key={h.id} h={h} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div style={fieldRow}>
      <span style={fieldKey}>{k}</span>
      <span style={fieldVal}>
        {v}
        {hint ? (
          <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 11 }}>{hint}</span>
        ) : null}
      </span>
    </div>
  );
}

function HistoryRow({
  h,
  t,
}: {
  h: ChangelogItem;
  t: CopyT;
}) {
  const before = h.oldState;
  const after = h.newState;
  const diffs: { k: string; from: string; to: string }[] = [];
  if (before && after) {
    if (before.status !== after.status) diffs.push({ k: t.fieldStatus, from: before.status, to: after.status });
    if (before.tier !== after.tier) diffs.push({ k: t.fieldTier, from: before.tier, to: after.tier });
    if (before.hint !== after.hint)
      diffs.push({ k: t.fieldHint, from: before.hint || t.none, to: after.hint || t.none });
  }
  const lifecycle =
    before && after && !before.hadOverride && after.hadOverride
      ? t.historyAddedOverride
      : before && after && before.hadOverride && !after.hadOverride
        ? t.historyClearedOverride
        : null;

  return (
    <div
      style={{
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 10,
        padding: "10px 12px",
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginBottom: 6 }}>
        {h.at}
      </div>
      {lifecycle && (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#ea580c", marginBottom: 6 }}>
          {lifecycle}
        </div>
      )}
      {diffs.length === 0 ? (
        !lifecycle && (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{t.none}</div>
        )
      ) : (
        <div style={{ fontSize: 12, color: "#0f172a" }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#475569" }}>{t.historyChanged}</div>
          {diffs.map((d, i) => (
            <div key={i} style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: "#64748b" }}>{d.k}:</span>{" "}
              <span style={{ color: "#94a3b8", textDecoration: "line-through" }}>{d.from}</span>
              <span style={{ color: "#94a3b8" }}> → </span>
              <span style={{ color: "#0d9488", fontWeight: 700 }}>{d.to}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
