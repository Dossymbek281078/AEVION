import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";
import { pickLang } from "@/lib/qrightServerI18n";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type RegistryItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  effectiveStatus: string;
  effectiveTier: string;
  effectiveHint: string;
  tags: string[];
  priority: number;
  override: { updatedAt: string } | null;
  runtime: {
    primaryPath: string | null;
    apiHints: string[];
    tier: string;
    hint: string;
  };
};

type RegistryResponse = {
  generatedAt: string;
  total: number;
  matched: number;
  filter: {
    tier: string | null;
    status: string | null;
    kind: string | null;
    q: string | null;
    limit: number;
  };
  items: RegistryItem[];
};

type StatsResponse = {
  total: number;
  withApi: number;
  withPath: number;
  overridden: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
};

type TrendingItem = {
  moduleId: string;
  hits: number;
  code: string | null;
  name: string | null;
  effectiveTier: string | null;
};

type TrendingResponse = {
  window: "24h" | "7d";
  items: TrendingItem[];
};

type TagsResponse = {
  total: number;
  items: { tag: string; count: number }[];
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function loadRegistry(params: URLSearchParams): Promise<RegistryResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/modules/registry?${params}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as RegistryResponse;
  } catch {
    return null;
  }
}

async function loadStats(): Promise<StatsResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/modules/stats`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as StatsResponse;
  } catch {
    return null;
  }
}

async function loadTrending(window: "24h" | "7d"): Promise<TrendingResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/modules/trending?window=${window}&limit=5`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as TrendingResponse;
  } catch {
    return null;
  }
}

async function loadTags(): Promise<TagsResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/modules/tags`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as TagsResponse;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "AEVION ecosystem modules",
  description:
    "27 nodes of the AEVION ecosystem with live tier and status. Filter by tier, status, kind, or search by name.",
  openGraph: {
    type: "article",
    title: "AEVION ecosystem modules",
    description: "27 nodes with live tier and status — filter, search, export CSV.",
  },
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
};
const stat: CSSProperties = {
  fontSize: 28,
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

const TIER_COLOR: Record<string, string> = {
  mvp_live: "#0d9488",
  platform_api: "#2563eb",
  portal_only: "#94a3b8",
};

const COPY = {
  en: {
    title: "AEVION ecosystem modules",
    subtitle:
      "All 27 nodes with live tier and status. Use filters to drill down or download the full CSV.",
    headTotal: "Total modules",
    headLive: "MVP live",
    headApi: "Platform API",
    headPortal: "Portal only",
    filtersTier: "Tier:",
    filtersStatus: "Status:",
    filtersKind: "Kind:",
    all: "All",
    csv: "Download CSV →",
    showing: "Showing {n} of {total}",
    nothing: "Nothing matches the current filter.",
    apis: "APIs:",
    primary: "Primary path:",
    overridden: "(admin override)",
    trendingTitle: "Trending now",
    trendingWindow24h: "Last 24h",
    trendingNone: "Not enough public traffic yet — register an embed/badge or open a detail page.",
    trendingHits: "hits",
    sortLabel: "Sort:",
    sortDefault: "Priority",
    sortTrending: "Trending 24h",
    tagsLabel: "Tags:",
    tagAll: "All",
    tagClear: "Clear tag",
  },
  ru: {
    title: "Модули экосистемы AEVION",
    subtitle:
      "Все 27 узлов с актуальным tier и статусом. Используйте фильтры или скачайте CSV.",
    headTotal: "Всего модулей",
    headLive: "MVP live",
    headApi: "Platform API",
    headPortal: "Только портал",
    filtersTier: "Tier:",
    filtersStatus: "Статус:",
    filtersKind: "Тип:",
    all: "Все",
    csv: "Скачать CSV →",
    showing: "Показано {n} из {total}",
    nothing: "Ничего не найдено по текущему фильтру.",
    apis: "API:",
    primary: "Основной путь:",
    overridden: "(админ override)",
    trendingTitle: "Сейчас в тренде",
    trendingWindow24h: "За 24 часа",
    trendingNone: "Публичных запросов пока мало — зарегистрируйте embed/badge или откройте страницу модуля.",
    trendingHits: "запросов",
    sortLabel: "Сортировка:",
    sortDefault: "По приоритету",
    sortTrending: "Тренд 24ч",
    tagsLabel: "Теги:",
    tagAll: "Все",
    tagClear: "Сбросить тег",
  },
} as const;

function buildHref(
  current: { tier?: string; status?: string; kind?: string; q?: string; sort?: string; tag?: string },
  override: Partial<typeof current>
): string {
  const merged = { ...current, ...override };
  const sp = new URLSearchParams();
  for (const k of Object.keys(merged) as (keyof typeof merged)[]) {
    const v = merged[k];
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `/modules?${s}` : "/modules";
}

export default async function ModulesPage({ searchParams }: Props) {
  const sp = (await searchParams) || {};
  const h = await headers();
  const lang = pickLang(sp, h);
  const t = COPY[lang];

  const tier = typeof sp.tier === "string" ? sp.tier : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const kind = typeof sp.kind === "string" ? sp.kind : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const sort = typeof sp.sort === "string" && sp.sort === "trending" ? "trending" : "";
  const tag = typeof sp.tag === "string" ? sp.tag.toLowerCase() : "";

  const params = new URLSearchParams();
  if (tier) params.set("tier", tier);
  if (status) params.set("status", status);
  if (kind) params.set("kind", kind);
  if (q) params.set("q", q);
  if (sort) params.set("sort", sort);
  if (tag) params.set("tag", tag);
  params.set("limit", "200");

  const [registry, stats, trending, tagsList] = await Promise.all([
    loadRegistry(params),
    loadStats(),
    loadTrending("24h"),
    loadTags(),
  ]);
  // CSV href mirrors the same filter set sans sort (CSV is order-agnostic).
  const csvParams = new URLSearchParams(params);
  csvParams.delete("sort");
  const csvHref = `${getApiBase()}/api/modules/registry.csv?${csvParams}`;

  if (!registry) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800 }}>Failed to load registry</div>
            <div style={{ fontSize: 13 }}>The backend is temporarily unreachable.</div>
          </div>
        </div>
      </main>
    );
  }

  const current = { tier, status, kind, q, sort, tag };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", margin: 0 }}>
          {t.title}
        </h1>
        <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24, lineHeight: 1.6 }}>
          {t.subtitle}
        </p>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 18 }}>
            <div style={card}>
              <p style={stat}>{stats.total}</p>
              <div style={statLabel}>{t.headTotal}</div>
            </div>
            <div style={{ ...card, borderColor: "rgba(13,148,136,0.25)" }}>
              <p style={{ ...stat, color: "#0d9488" }}>{stats.byTier.mvp_live || 0}</p>
              <div style={statLabel}>{t.headLive}</div>
            </div>
            <div style={{ ...card, borderColor: "rgba(37,99,235,0.25)" }}>
              <p style={{ ...stat, color: "#2563eb" }}>{stats.byTier.platform_api || 0}</p>
              <div style={statLabel}>{t.headApi}</div>
            </div>
            <div style={card}>
              <p style={{ ...stat, color: "#94a3b8" }}>{stats.byTier.portal_only || 0}</p>
              <div style={statLabel}>{t.headPortal}</div>
            </div>
          </div>
        )}

        {/* Trending strip — surfaced above filters because it's the freshest signal */}
        <TrendingStrip trending={trending} t={t} />

        {/* Tag chips — discovery surface for the taxonomy. Active chip pulls
            ?tag= into the URL; clicking it again clears. */}
        <TagsStrip tags={tagsList} active={tag} current={current} t={t} />

        {/* Filters */}
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <FilterRow
              label={t.filtersTier}
              current={tier}
              options={[
                { v: "", label: t.all },
                { v: "mvp_live", label: "mvp_live" },
                { v: "platform_api", label: "platform_api" },
                { v: "portal_only", label: "portal_only" },
              ]}
              hrefFor={(v) => buildHref(current, { tier: v })}
            />
            <FilterRow
              label={t.filtersStatus}
              current={status}
              options={[
                { v: "", label: t.all },
                { v: "idea", label: "idea" },
                { v: "planning", label: "planning" },
                { v: "in_progress", label: "in_progress" },
                { v: "mvp", label: "mvp" },
                { v: "launched", label: "launched" },
              ]}
              hrefFor={(v) => buildHref(current, { status: v })}
            />
            <FilterRow
              label={t.filtersKind}
              current={kind}
              options={[
                { v: "", label: t.all },
                { v: "core", label: "core" },
                { v: "product", label: "product" },
                { v: "service", label: "service" },
                { v: "experiment", label: "experiment" },
              ]}
              hrefFor={(v) => buildHref(current, { kind: v })}
            />
            <FilterRow
              label={t.sortLabel}
              current={sort}
              options={[
                { v: "", label: t.sortDefault },
                { v: "trending", label: t.sortTrending },
              ]}
              hrefFor={(v) => buildHref(current, { sort: v })}
            />
            <form
              method="GET"
              action="/modules"
              style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}
            >
              {tier && <input type="hidden" name="tier" value={tier} />}
              {status && <input type="hidden" name="status" value={status} />}
              {kind && <input type="hidden" name="kind" value={kind} />}
              {sort && <input type="hidden" name="sort" value={sort} />}
              {tag && <input type="hidden" name="tag" value={tag} />}
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name / code / description / tags…"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.15)",
                  fontSize: 13,
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Search
              </button>
              <a
                href={csvHref}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(13,148,136,0.4)",
                  color: "#0d9488",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                {t.csv}
              </a>
            </form>
          </div>
        </div>

        <div style={{ marginBottom: 14, fontSize: 12, color: "#64748b" }}>
          {t.showing
            .replace("{n}", String(registry.matched))
            .replace("{total}", String(registry.total))}
        </div>

        {/* List */}
        {registry.items.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>{t.nothing}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {registry.items.map((m) => (
              <ModuleCard key={m.id} m={m} t={t} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TrendingStrip({
  trending,
  t,
}: {
  trending: TrendingResponse | null;
  t: Record<string, string>;
}) {
  // Skip the strip entirely if the backend is unreachable. If the call
  // succeeded but no hits exist yet (fresh deploy), show a one-liner so
  // the section's purpose is discoverable.
  if (!trending) return null;
  const items = trending.items.filter((i) => i.hits > 0);
  if (items.length === 0) {
    return (
      <div
        style={{
          ...card,
          marginBottom: 18,
          padding: "12px 16px",
          background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(37,99,235,0.04))",
          borderColor: "rgba(13,148,136,0.18)",
        }}
      >
        <div style={statLabel}>
          {t.trendingTitle} · {t.trendingWindow24h}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{t.trendingNone}</div>
      </div>
    );
  }
  return (
    <div
      style={{
        ...card,
        marginBottom: 18,
        padding: "14px 16px",
        background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(37,99,235,0.04))",
        borderColor: "rgba(13,148,136,0.18)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={statLabel}>
          {t.trendingTitle} · {t.trendingWindow24h}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((i, idx) => {
          const tierColor = TIER_COLOR[i.effectiveTier || ""] || "#94a3b8";
          return (
            <Link
              key={i.moduleId}
              href={`/modules/${encodeURIComponent(i.moduleId)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: "#fff",
                border: `1px solid ${tierColor}55`,
                fontSize: 12,
                color: "#0f172a",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 10 }}>
                #{idx + 1}
              </span>
              <span>{i.name || i.moduleId}</span>
              <span style={{ color: tierColor, fontFamily: "monospace", fontSize: 10 }}>
                {i.hits} {t.trendingHits}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TagsStrip({
  tags,
  active,
  current,
  t,
}: {
  tags: TagsResponse | null;
  active: string;
  current: { tier?: string; status?: string; kind?: string; q?: string; sort?: string; tag?: string };
  t: Record<string, string>;
}) {
  if (!tags || tags.items.length === 0) return null;
  // Cap at 14 chips so the strip stays single-row on most viewports; rest
  // remain reachable via search.
  const top = tags.items.slice(0, 14);
  return (
    <div style={{ ...card, marginBottom: 18, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", minWidth: 60 }}>
          {t.tagsLabel}
        </span>
        {!active && (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "#0f172a",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "monospace",
            }}
          >
            {t.tagAll}
          </span>
        )}
        {top.map((tt) => {
          const isActive = active === tt.tag;
          // Active chip: clicking it again clears the tag filter.
          const href = buildHref(current, { tag: isActive ? "" : tt.tag });
          return (
            <Link
              key={tt.tag}
              href={href}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid ${isActive ? "#0d9488" : "rgba(15,23,42,0.15)"}`,
                background: isActive ? "#0d9488" : "#fff",
                color: isActive ? "#fff" : "#475569",
                fontSize: 11,
                fontWeight: 700,
                textDecoration: "none",
                fontFamily: "monospace",
              }}
            >
              #{tt.tag}{" "}
              <span style={{ color: isActive ? "rgba(255,255,255,0.7)" : "#94a3b8", fontSize: 10 }}>
                {tt.count}
              </span>
            </Link>
          );
        })}
        {active && (
          <Link
            href={buildHref(current, { tag: "" })}
            style={{
              marginLeft: "auto",
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(185,28,28,0.3)",
              color: "#b91c1c",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t.tagClear} ✕
          </Link>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  current,
  options,
  hrefFor,
}: {
  label: string;
  current: string;
  options: { v: string; label: string }[];
  hrefFor: (v: string) => string;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", minWidth: 60 }}>
        {label}
      </span>
      {options.map((o) => {
        const active = current === o.v || (!current && o.v === "");
        return (
          <Link
            key={o.v || "all"}
            href={hrefFor(o.v)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(15,23,42,0.15)",
              background: active ? "#0f172a" : "#fff",
              color: active ? "#fff" : "#475569",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              fontFamily: "monospace",
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

function ModuleCard({ m, t }: { m: RegistryItem; t: Record<string, string> }) {
  const tierColor = TIER_COLOR[m.effectiveTier] || "#94a3b8";
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{m.name}</span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                background: tierColor + "22",
                color: tierColor,
                fontSize: 10,
                fontWeight: 800,
                fontFamily: "monospace",
              }}
            >
              {m.effectiveTier}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                background: "rgba(15,23,42,0.06)",
                color: "#475569",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              {m.effectiveStatus}
            </span>
            <span
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(15,23,42,0.04)",
                color: "#94a3b8",
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "monospace",
                textTransform: "uppercase",
              }}
            >
              {m.kind}
            </span>
            {m.override && (
              <span style={{ fontSize: 9, color: "#ea580c", fontWeight: 700 }}>
                {t.overridden}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 6, lineHeight: 1.5 }}>
            {m.description}
          </div>
          {m.tags && m.tags.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {m.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "rgba(13,148,136,0.08)",
                    color: "#0d9488",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
            {m.runtime.primaryPath && (
              <span>
                {t.primary}{" "}
                <Link
                  href={m.runtime.primaryPath}
                  style={{ color: "#0d9488", textDecoration: "none", fontFamily: "monospace" }}
                >
                  {m.runtime.primaryPath}
                </Link>
              </span>
            )}
            {m.runtime.apiHints && m.runtime.apiHints.length > 0 && (
              <span style={{ marginLeft: m.runtime.primaryPath ? 12 : 0 }}>
                {t.apis}{" "}
                <code style={{ fontSize: 10 }}>{m.runtime.apiHints.join(", ")}</code>
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Link
            href={`/modules/${m.id}/badge`}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: `1px solid ${tierColor}`,
              color: tierColor,
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Embed badge →
          </Link>
          <Link
            href={`/modules/${m.id}`}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid rgba(15,23,42,0.15)",
              color: "#0f172a",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Detail →
          </Link>
        </div>
      </div>
    </div>
  );
}
