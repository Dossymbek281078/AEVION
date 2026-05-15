"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

/**
 * Admin dashboard для глобальной шины событий AEVION:
 *   - Live-просмотр последних N событий с фильтрами
 *   - Time-bucketed агрегация (час/день) с разбивкой по source/type
 *
 * Использует `/api/pricing/events/recent` + `/api/pricing/events/aggregate`.
 * Требует ADMIN_TOKEN из localStorage (ключ: aevion_admin_token).
 */

const ADMIN_TOKEN_KEY = "aevion_admin_token";

type EventItem = {
  ts: string;
  type: string;
  sid?: string | null;
  path?: string | null;
  source?: string | null;
  tier?: string | null;
  industry?: string | null;
  value?: number | null;
  ip?: string | null;
  ua?: string | null;
  meta?: Record<string, unknown> | null;
};

type RecentResp = {
  items: EventItem[];
  total: number;
  matched: number;
  filtered: boolean;
  scanCap: number;
};

type AggregateBucket = {
  t: string;
  total: number;
  groups: Record<string, number>;
};

type AggregateResp = {
  period: "hour" | "day";
  groupBy: "source" | "type" | "tier" | "industry";
  windowHours: number;
  buckets: AggregateBucket[];
  groups: string[];
  totals: Record<string, number>;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};
const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
  display: "block",
};
const inputStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};
const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const btnGhost: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.2)",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

// Стабильная палитра 10 цветов для групп в стеке
const PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#ea580c", "#9333ea",
  "#0891b2", "#ca8a04", "#db2777", "#475569", "#0d9488",
];

export default function AdminEventsPage() {
  const { showToast } = useToast();
  const [adminToken, setAdminToken] = useState("");
  const [hasToken, setHasToken] = useState(false);

  // Фильтры
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");

  // Aggregate-параметры
  const [period, setPeriod] = useState<"hour" | "day">("hour");
  const [hours, setHours] = useState(24);
  const [groupBy, setGroupBy] = useState<"source" | "type" | "tier" | "industry">("source");
  const [recentLimit, setRecentLimit] = useState(100);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Данные
  const [recent, setRecent] = useState<RecentResp | null>(null);
  const [agg, setAgg] = useState<AggregateResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
    setAdminToken(saved);
    setHasToken(saved.length > 0);
  }, []);

  const saveToken = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_TOKEN_KEY, adminToken.trim());
    setHasToken(adminToken.trim().length > 0);
    showToast("Admin token сохранён локально", "success");
  }, [adminToken, showToast]);

  const clearToken = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken("");
    setHasToken(false);
    setRecent(null);
    setAgg(null);
  }, []);

  const buildQuery = useCallback((base: Record<string, string | number>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) {
      if (v !== "" && v !== null && v !== undefined) qs.set(k, String(v));
    }
    if (sourceFilter.trim()) qs.set("source", sourceFilter.trim());
    if (typeFilter.trim()) qs.set("type", typeFilter.trim());
    if (tierFilter.trim()) qs.set("tier", tierFilter.trim());
    if (industryFilter.trim()) qs.set("industry", industryFilter.trim());
    return qs.toString();
  }, [sourceFilter, typeFilter, tierFilter, industryFilter]);

  const fetchAll = useCallback(async () => {
    if (!adminToken.trim()) {
      setErr("Введите admin token");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const headers = { "X-Admin-Token": adminToken.trim() };

      const recentQs = buildQuery({ limit: recentLimit });
      const aggQs = buildQuery({ period, hours, groupBy });

      const [rRecent, rAgg] = await Promise.all([
        fetch(apiUrl(`/api/pricing/events/recent?${recentQs}`), { headers }),
        fetch(apiUrl(`/api/pricing/events/aggregate?${aggQs}`), { headers }),
      ]);

      if (rRecent.status === 401 || rAgg.status === 401) {
        setErr("Unauthorized — проверьте admin token");
        setRecent(null);
        setAgg(null);
        return;
      }
      if (!rRecent.ok) throw new Error(`/recent HTTP ${rRecent.status}`);
      if (!rAgg.ok) throw new Error(`/aggregate HTTP ${rAgg.status}`);

      const recentJson = (await rRecent.json()) as RecentResp;
      const aggJson = (await rAgg.json()) as AggregateResp;
      setRecent(recentJson);
      setAgg(aggJson);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminToken, buildQuery, recentLimit, period, hours, groupBy]);

  // Auto-refresh каждые 15с
  useEffect(() => {
    if (!autoRefresh || !hasToken) return;
    const id = setInterval(() => {
      fetchAll();
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, hasToken, fetchAll]);

  // Палитра group → цвет (стабильная по индексу в agg.groups)
  const groupColor = useMemo(() => {
    const m = new Map<string, string>();
    if (!agg) return m;
    agg.groups.forEach((g, i) => m.set(g, PALETTE[i % PALETTE.length]));
    return m;
  }, [agg]);

  const maxBucketTotal = useMemo(() => {
    if (!agg || agg.buckets.length === 0) return 0;
    return agg.buckets.reduce((m, b) => Math.max(m, b.total), 0);
  }, [agg]);

  return (
    <ProductPageShell>
      <Wave1Nav />

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Ecosystem Events Console</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
          Глобальная шина событий AEVION: live-просмотр + time-bucketed аналитика по source / type.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {/* Token gate */}
        <div style={card}>
          <span style={labelStyle}>Admin token (X-Admin-Token header)</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Введите ADMIN_TOKEN из .env бэка"
              style={{ ...inputStyle, flex: 1, minWidth: 280 }}
            />
            <button type="button" onClick={saveToken} style={btnPrimary}>
              Сохранить
            </button>
            {hasToken && (
              <button type="button" onClick={clearToken} style={btnGhost}>
                Очистить
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
            Хранится только в localStorage этого браузера, никуда не отправляется.
          </div>
        </div>

        {/* Filters */}
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div>
              <span style={labelStyle}>Source (CSV)</span>
              <input
                style={inputStyle}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                placeholder="qmedia,qsocial"
              />
            </div>
            <div>
              <span style={labelStyle}>Type (CSV)</span>
              <input
                style={inputStyle}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                placeholder="cta_click,lead_submit"
              />
            </div>
            <div>
              <span style={labelStyle}>Tier (CSV)</span>
              <input
                style={inputStyle}
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                placeholder="pro,enterprise"
              />
            </div>
            <div>
              <span style={labelStyle}>Industry (CSV)</span>
              <input
                style={inputStyle}
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                placeholder="saas,retail"
              />
            </div>
            <div>
              <span style={labelStyle}>Recent limit</span>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={1000}
                value={recentLimit}
                onChange={(e) => setRecentLimit(Math.max(1, Math.min(1000, Number(e.target.value) || 100)))}
              />
            </div>
            <div>
              <span style={labelStyle}>Window (hours)</span>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={720}
                value={hours}
                onChange={(e) => setHours(Math.max(1, Math.min(720, Number(e.target.value) || 24)))}
              />
            </div>
            <div>
              <span style={labelStyle}>Bucket</span>
              <select
                style={inputStyle}
                value={period}
                onChange={(e) => setPeriod(e.target.value as "hour" | "day")}
              >
                <option value="hour">hour</option>
                <option value="day">day</option>
              </select>
            </div>
            <div>
              <span style={labelStyle}>Group by</span>
              <select
                style={inputStyle}
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              >
                <option value="source">source</option>
                <option value="type">type</option>
                <option value="tier">tier</option>
                <option value="industry">industry</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={fetchAll} disabled={loading || !hasToken} style={btnPrimary}>
              {loading ? "Загрузка…" : "Обновить"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155" }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh 15s
            </label>
            {err && <span style={{ color: "#dc2626", fontSize: 12 }}>⚠ {err}</span>}
          </div>
        </div>

        {/* Aggregate chart */}
        {agg && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                Aggregate · {agg.period} · groupBy={agg.groupBy}
              </h2>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                window {agg.windowHours}h · {agg.buckets.length} buckets · {agg.groups.length} groups
              </span>
            </div>

            {agg.buckets.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, padding: "20px 0" }}>
                Нет событий за выбранное окно.
              </div>
            ) : (
              <>
                {/* Stacked bars: для каждого bucket — bar высотой total, сегменты по группам */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 160, padding: "8px 0", borderBottom: "1px solid #e2e8f0" }}>
                  {agg.buckets.map((b) => {
                    const h = maxBucketTotal > 0 ? (b.total / maxBucketTotal) * 100 : 0;
                    return (
                      <div
                        key={b.t}
                        title={`${b.t}\ntotal=${b.total}\n${Object.entries(b.groups).map(([k, v]) => `${k}: ${v}`).join("\n")}`}
                        style={{
                          flex: 1,
                          minWidth: 4,
                          height: `${h}%`,
                          display: "flex",
                          flexDirection: "column-reverse",
                          borderRadius: 2,
                          overflow: "hidden",
                          background: "#f1f5f9",
                        }}
                      >
                        {agg.groups.map((g) => {
                          const v = b.groups[g] ?? 0;
                          if (v === 0) return null;
                          const seg = b.total > 0 ? (v / b.total) * 100 : 0;
                          return (
                            <div
                              key={g}
                              style={{
                                height: `${seg}%`,
                                background: groupColor.get(g) ?? "#cbd5e1",
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Legend + totals */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                  {agg.groups.map((g) => (
                    <div key={g} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ display: "inline-block", width: 12, height: 12, background: groupColor.get(g) ?? "#cbd5e1", borderRadius: 2 }} />
                      <span style={{ fontWeight: 600 }}>{g}</span>
                      <span style={{ color: "#64748b" }}>{agg.totals[g] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Recent events table */}
        {recent && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Recent events</h2>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                shown {recent.items.length}
                {recent.filtered ? ` (matched ${recent.matched})` : ""} of {recent.total} total
              </span>
            </div>

            {recent.items.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, padding: "20px 0" }}>Нет событий.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "8px 6px" }}>Time</th>
                      <th style={{ padding: "8px 6px" }}>Type</th>
                      <th style={{ padding: "8px 6px" }}>Source</th>
                      <th style={{ padding: "8px 6px" }}>Tier</th>
                      <th style={{ padding: "8px 6px" }}>Industry</th>
                      <th style={{ padding: "8px 6px" }}>Path</th>
                      <th style={{ padding: "8px 6px" }}>Sid</th>
                      <th style={{ padding: "8px 6px", textAlign: "right" }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.items.map((it, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 6px", color: "#475569", whiteSpace: "nowrap" }}>
                          {new Date(it.ts).toLocaleString()}
                        </td>
                        <td style={{ padding: "6px 6px", fontWeight: 600 }}>{it.type}</td>
                        <td style={{ padding: "6px 6px" }}>{it.source ?? "—"}</td>
                        <td style={{ padding: "6px 6px" }}>{it.tier ?? "—"}</td>
                        <td style={{ padding: "6px 6px" }}>{it.industry ?? "—"}</td>
                        <td style={{ padding: "6px 6px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }} title={it.path ?? ""}>
                          {it.path ?? "—"}
                        </td>
                        <td style={{ padding: "6px 6px", color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>
                          {it.sid ? it.sid.slice(0, 10) : "—"}
                        </td>
                        <td style={{ padding: "6px 6px", textAlign: "right" }}>
                          {typeof it.value === "number" ? it.value : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: "#64748b" }}>
          <Link href="/admin/modules" style={{ color: "#0f172a", textDecoration: "underline" }}>← admin index</Link>
          {" · "}
          API: <code>/api/pricing/events/recent</code> · <code>/api/pricing/events/aggregate</code>
        </div>
      </div>
    </ProductPageShell>
  );
}
