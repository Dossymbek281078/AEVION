"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_admin_token";

interface Lead {
  id: string;
  ts: string;
  name: string;
  email: string;
  company?: string;
  industry?: string;
  tier?: string;
  modules?: string[];
  seats?: number;
  message?: string;
  source?: string;
}

interface EventsSummary {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byTier: Record<string, number>;
  byIndustry: Record<string, number>;
  sessionCount: number;
  windowHours: number;
}

interface RecentEvent {
  ts: string;
  type: string;
  sid?: string;
  path?: string;
  source?: string;
  tier?: string;
  industry?: string;
  value?: number;
}

export default function PricingAdminPage() {
  const [token, setToken] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<EventsSummary | null>(null);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Восстановление токена из localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthed(true);
    }
  }, []);

  async function tryAuth(t: string) {
    setAuthError(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/leads") + "?limit=1", {
        headers: { "x-admin-token": t },
      });
      if (r.status === 401) {
        setAuthError("Неверный или несконфигурированный токен");
        return false;
      }
      if (!r.ok) {
        setAuthError(`HTTP ${r.status}`);
        return false;
      }
      return true;
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    const ok = await tryAuth(tokenInput.trim());
    if (ok) {
      try {
        localStorage.setItem(TOKEN_KEY, tokenInput.trim());
      } catch {
        // ignore
      }
      setToken(tokenInput.trim());
      setAuthed(true);
      setTokenInput("");
    }
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    setToken("");
    setAuthed(false);
    setLeads([]);
    setSummary(null);
    setEvents([]);
  }

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [leadsR, summaryR, eventsR] = await Promise.all([
        fetch(apiUrl("/api/pricing/leads") + "?limit=100", { headers: { "x-admin-token": token } }),
        fetch(apiUrl("/api/pricing/events/summary") + `?hours=${hours}`, { headers: { "x-admin-token": token } }),
        fetch(apiUrl("/api/pricing/events/recent") + "?limit=50", { headers: { "x-admin-token": token } }),
      ]);

      if (leadsR.status === 401 || summaryR.status === 401 || eventsR.status === 401) {
        logout();
        setError("Сессия истекла или токен сменился");
        return;
      }

      const leadsJ = await leadsR.json();
      const summaryJ = await summaryR.json();
      const eventsJ = await eventsR.json();

      setLeads(leadsJ.items ?? []);
      setSummary(summaryJ);
      setEvents(eventsJ.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, hours]);

  if (!authed) {
    return (
      <ProductPageShell maxWidth={460}>
        <div style={{ marginTop: 40 }}>
          <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            ← Все тарифы
          </Link>
        </div>
        <form
          onSubmit={handleLogin}
          style={{
            marginTop: 24,
            background: "#0f172a",
            color: "#f8fafc",
            borderRadius: 16,
            padding: 32,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 12 }}>
            ADMIN AREA
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Pricing Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, marginBottom: 24, lineHeight: 1.5 }}>
            Введите ADMIN_TOKEN из <code>aevion-globus-backend/.env</code>. Токен сохраняется в
            localStorage этого браузера.
          </p>
          <input
            type="password"
            placeholder="x-admin-token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 14,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "#f8fafc",
              boxSizing: "border-box",
              fontFamily: "ui-monospace, monospace",
            }}
          />
          {authError && (
            <div style={{ marginTop: 12, padding: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#fca5a5", fontSize: 12 }}>
              {authError}
            </div>
          )}
          <button
            type="submit"
            disabled={!tokenInput.trim()}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              border: "none",
              cursor: tokenInput.trim() ? "pointer" : "not-allowed",
              background: tokenInput.trim() ? "linear-gradient(135deg, #0d9488, #0ea5e9)" : "#475569",
              color: "#fff",
            }}
          >
            Войти
          </button>
        </form>
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={1200}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← /pricing
        </Link>
        <button
          onClick={logout}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 6,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            color: "#475569",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.025em" }}>
        Pricing Admin
      </h1>
      <p style={{ color: "#64748b", margin: 0, marginBottom: 24, fontSize: 14 }}>
        GTM-метрики и заявки. Данные читаются прямо из JSONL.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>ОКНО:</span>
        {[1, 24, 168, 720].map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: "1px solid rgba(15,23,42,0.12)",
              background: hours === h ? "#0d9488" : "#fff",
              color: hours === h ? "#fff" : "#475569",
              cursor: "pointer",
            }}
          >
            {h === 1 ? "1ч" : h === 24 ? "24ч" : h === 168 ? "7д" : "30д"}
          </button>
        ))}
        <button
          onClick={loadAll}
          disabled={loading}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 6,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            color: "#475569",
            cursor: loading ? "wait" : "pointer",
            marginLeft: "auto",
          }}
        >
          {loading ? "Обновление..." : "↻ Обновить"}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 20, background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
          Ошибка: {error}
        </div>
      )}

      {/* Metric tiles */}
      {summary && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <Tile label="ВСЕГО СОБЫТИЙ" value={summary.total.toLocaleString("ru-RU")} />
          <Tile label="СЕССИЙ" value={summary.sessionCount.toLocaleString("ru-RU")} />
          <Tile label="PAGE VIEWS" value={(summary.byType.page_view ?? 0).toLocaleString("ru-RU")} />
          <Tile label="CHECKOUT START" value={(summary.byType.checkout_start ?? 0).toLocaleString("ru-RU")} />
          <Tile label="CHECKOUT SUCCESS" value={(summary.byType.checkout_success ?? 0).toLocaleString("ru-RU")} accent="#0d9488" />
          <Tile label="LEAD SUBMIT" value={(summary.byType.lead_submit ?? 0).toLocaleString("ru-RU")} accent="#7c3aed" />
        </section>
      )}

      {/* Breakdowns */}
      {summary && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          <Breakdown title="По типам событий" data={summary.byType} />
          <Breakdown title="По tier" data={summary.byTier} />
          <Breakdown title="По индустриям" data={summary.byIndustry} />
          <Breakdown title="По источникам" data={summary.bySource} />
        </section>
      )}

      {/* Leads */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          Заявки ({leads.length})
        </h2>
        {leads.length === 0 ? (
          <div style={{ padding: 20, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, color: "#64748b", fontSize: 13, textAlign: "center" }}>
            Заявок пока нет.
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={th}>Время</th>
                    <th style={th}>Имя</th>
                    <th style={th}>Email</th>
                    <th style={th}>Компания</th>
                    <th style={th}>Индустрия</th>
                    <th style={th}>Tier</th>
                    <th style={th}>Seats</th>
                    <th style={th}>Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => (
                    <tr
                      key={l.id}
                      style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}
                      title={l.message ?? undefined}
                    >
                      <td style={td}>{new Date(l.ts).toLocaleString("ru-RU")}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{l.name}</td>
                      <td style={td}>
                        <a href={`mailto:${l.email}`} style={{ color: "#0d9488", textDecoration: "none" }}>
                          {l.email}
                        </a>
                      </td>
                      <td style={td}>{l.company ?? "—"}</td>
                      <td style={td}>{l.industry ?? "—"}</td>
                      <td style={td}>
                        {l.tier ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 6px",
                              background: "#e0f2fe",
                              color: "#075985",
                              borderRadius: 4,
                              letterSpacing: "0.04em",
                            }}
                          >
                            {l.tier.toUpperCase()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={td}>{l.seats ?? "—"}</td>
                      <td style={td}>{l.source ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Recent events */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          Последние события
        </h2>
        {events.length === 0 ? (
          <div style={{ padding: 20, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, color: "#64748b", fontSize: 13, textAlign: "center" }}>
            Событий пока нет.
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={th}>Время</th>
                    <th style={th}>Тип</th>
                    <th style={th}>Tier / Industry</th>
                    <th style={th}>Path</th>
                    <th style={th}>Value</th>
                    <th style={th}>SID</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}>
                      <td style={td}>{new Date(ev.ts).toLocaleTimeString("ru-RU")}</td>
                      <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{ev.type}</td>
                      <td style={td}>{ev.tier ?? ev.industry ?? "—"}</td>
                      <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#64748b" }}>
                        {ev.path ?? "—"}
                      </td>
                      <td style={td}>{ev.value ?? "—"}</td>
                      <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#94a3b8" }}>
                        {ev.sid?.slice(0, 14) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </ProductPageShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", color: accent ?? "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries[0]?.[1] ?? 1;
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", marginBottom: 12 }}>
        {title.toUpperCase()}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>—</div>
      ) : (
        entries.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", minWidth: 100 }}>{k}</span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: "#f1f5f9",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(v / max) * 100}%`,
                  background: "linear-gradient(90deg, #0d9488, #0ea5e9)",
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", minWidth: 40, textAlign: "right" }}>
              {v}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 800,
  color: "#475569",
  fontSize: 11,
  letterSpacing: "0.04em",
};
const td: React.CSSProperties = {
  padding: "8px 12px",
  color: "#0f172a",
  whiteSpace: "nowrap",
};
