"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";

const TOKEN_KEY = "aevion_admin_token";

type Tab = "overview" | "leads" | "affiliate" | "partners" | "edu" | "newsletter";

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

interface Application {
  id: string;
  ts: string;
  kind: "affiliate" | "partner" | "edu";
  name: string;
  email: string;
  organization?: string;
  country?: string;
  details?: string;
  channel?: string;
  partnerType?: string;
  institutionDomain?: string;
}

interface NewsletterEntry {
  id: string;
  ts: string;
  email: string;
  source?: string;
}

interface EventsSummary {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byTier: Record<string, number>;
  /** Только checkout_start — «откуда идут платить», а не «где больше просмотров». */
  checkoutBySource?: Record<string, number>;
  /** Канал привлечения из метки ?c= (BuyLink кладёт его в meta.channel). */
  checkoutByChannel?: Record<string, number>;
  purchaseByChannel?: Record<string, number>;
  purchaseRevenueByChannel?: Record<string, number>;
  purchaseCount?: number;
  purchaseWithKnownAmount?: number;
  byIndustry: Record<string, number>;
  /** Канал раздачи (tt / ig / yt …) — по нему видно, какая раздача привела людей. */
  byChannel?: Record<string, number>;
  /** Товар, по которому нажали «купить». */
  byProduct?: Record<string, number>;
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

type FunnelType = "page_view" | "cta_click" | "lead_submit" | "checkout_start" | "checkout_success";

interface ByVariantPayload {
  keys: string[];
  windowHours: number;
  variants: Record<string, Record<string, Record<FunnelType, number>>>;
}

const TAB_META: Record<Tab, { labelKey: string; color: string }> = {
  overview: { labelKey: "pricing.admin.tabs.overview", color: "#0d9488" },
  leads: { labelKey: "pricing.admin.tabs.leads", color: "#0ea5e9" },
  affiliate: { labelKey: "pricing.admin.tabs.affiliate", color: "#be185d" },
  partners: { labelKey: "pricing.admin.tabs.partners", color: "#7c3aed" },
  edu: { labelKey: "pricing.admin.tabs.edu", color: "#065f46" },
  newsletter: { labelKey: "pricing.admin.tabs.newsletter", color: "#f59e0b" },
};

export default function PricingAdminPage() {
  const { t } = useI18n();
  const [token, setToken] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [affiliate, setAffiliate] = useState<Application[]>([]);
  const [partners, setPartners] = useState<Application[]>([]);
  const [edu, setEdu] = useState<Application[]>([]);
  const [newsletter, setNewsletter] = useState<NewsletterEntry[]>([]);
  const [counts, setCounts] = useState({ leads: 0, affiliate: 0, partners: 0, edu: 0, newsletter: 0 });
  const [summary, setSummary] = useState<EventsSummary | null>(null);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [byVariant, setByVariant] = useState<ByVariantPayload | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthed(true);
    }
  }, []);

  async function tryAuth(token: string) {
    setAuthError(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/leads") + "?limit=1", {
        headers: { "x-admin-token": token },
      });
      if (r.status === 401) {
        setAuthError(t("pricing.admin.auth.invalidToken"));
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
        /* ignore */
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
      /* ignore */
    }
    setToken("");
    setAuthed(false);
    setLeads([]);
    setAffiliate([]);
    setPartners([]);
    setEdu([]);
    setNewsletter([]);
    setSummary(null);
    setEvents([]);
    setByVariant(null);
  }

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { "x-admin-token": token };
      const [
        leadsR,
        affR,
        prtR,
        eduR,
        nlR,
        summaryR,
        eventsR,
        byVariantR,
      ] = await Promise.all([
        fetch(apiUrl("/api/pricing/leads") + "?limit=100", { headers }),
        fetch(apiUrl("/api/pricing/applications") + "?kind=affiliate&limit=100", { headers }),
        fetch(apiUrl("/api/pricing/applications") + "?kind=partner&limit=100", { headers }),
        fetch(apiUrl("/api/pricing/applications") + "?kind=edu&limit=100", { headers }),
        fetch(apiUrl("/api/pricing/newsletter/list") + "?limit=100", { headers }),
        fetch(apiUrl("/api/pricing/events/summary") + `?hours=${hours}`, { headers }),
        fetch(apiUrl("/api/pricing/events/recent") + "?limit=50", { headers }),
        fetch(apiUrl("/api/pricing/events/by-variant") + `?hours=${hours}`, { headers }),
      ]);

      const responses = [leadsR, affR, prtR, eduR, nlR, summaryR, eventsR, byVariantR];
      if (responses.some((r) => r.status === 401)) {
        logout();
        setError(t("pricing.admin.error.sessionExpired"));
        return;
      }

      const leadsJ = await leadsR.json();
      const affJ = await affR.json();
      const prtJ = await prtR.json();
      const eduJ = await eduR.json();
      const nlJ = await nlR.json();
      const summaryJ = await summaryR.json();
      const eventsJ = await eventsR.json();
      const byVariantJ = byVariantR.ok ? ((await byVariantR.json()) as ByVariantPayload) : null;

      setLeads(leadsJ.items ?? []);
      setAffiliate(affJ.items ?? []);
      setPartners(prtJ.items ?? []);
      setEdu(eduJ.items ?? []);
      setNewsletter(nlJ.items ?? []);
      setCounts({
        leads: leadsJ.total ?? 0,
        affiliate: affJ.total ?? 0,
        partners: prtJ.total ?? 0,
        edu: eduJ.total ?? 0,
        newsletter: nlJ.total ?? 0,
      });
      setSummary(summaryJ);
      setEvents(eventsJ.items ?? []);
      setByVariant(byVariantJ);
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
            {t("pricing.admin.nav.allPricing")}
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
            {/* Файла .env на диске НЕТ — проверено 19.08.2026: токен живёт только в
                переменных сервиса Railway. Прежняя подсказка отправляла искать
                несуществующий файл, а в .env.example переменная не упомянута вовсе. */}
            {t("pricing.admin.auth.tokenHintPre")} <code>railway variables</code>
            {t("pricing.admin.auth.tokenHintPost")}
          </p>
          <input
            type="password"
            aria-label="Admin token" placeholder="x-admin-token"
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
            {t("pricing.admin.auth.submit")}
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
      <p style={{ color: "#64748b", margin: 0, marginBottom: 20, fontSize: 14 }}>
        {t("pricing.admin.subtitle")}
      </p>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          padding: 4,
          background: "#f1f5f9",
          borderRadius: 10,
          flexWrap: "wrap",
        }}
      >
        {(Object.keys(TAB_META) as Tab[]).map((tabKey) => {
          const meta = TAB_META[tabKey];
          const count =
            tabKey === "overview" ? null
              : tabKey === "leads" ? counts.leads
                : tabKey === "affiliate" ? counts.affiliate
                  : tabKey === "partners" ? counts.partners
                    : tabKey === "edu" ? counts.edu
                      : counts.newsletter;
          return (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: tab === tabKey ? "#fff" : "transparent",
                color: tab === tabKey ? meta.color : "#64748b",
                boxShadow: tab === tabKey ? "0 2px 6px rgba(15,23,42,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t(meta.labelKey)}
              {count !== null && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "1px 6px",
                    background: tab === tabKey ? meta.color : "rgba(15,23,42,0.08)",
                    color: tab === tabKey ? "#fff" : "#475569",
                    borderRadius: 999,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
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
          {loading ? t("pricing.admin.refresh.loading") : t("pricing.admin.refresh.button")}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 20, background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
          {t("pricing.admin.error.label", { error })}
        </div>
      )}

      {tab === "overview" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{t("pricing.admin.overview.windowLabel")}</span>
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
                {h === 1
                  ? t("pricing.admin.overview.hours1")
                  : h === 24
                    ? t("pricing.admin.overview.hours24")
                    : h === 168
                      ? t("pricing.admin.overview.days7")
                      : t("pricing.admin.overview.days30")}
              </button>
            ))}
          </div>

          {summary && (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 24,
              }}
            >
              <Tile label={t("pricing.admin.tiles.totalEvents")} value={summary.total.toLocaleString("ru-RU")} />
              <Tile label={t("pricing.admin.tiles.sessions")} value={summary.sessionCount.toLocaleString("ru-RU")} />
              <Tile label="PAGE VIEWS" value={(summary.byType.page_view ?? 0).toLocaleString("ru-RU")} />
              <Tile label="CHECKOUT START" value={(summary.byType.checkout_start ?? 0).toLocaleString("ru-RU")} />
              <Tile label="CHECKOUT SUCCESS" value={(summary.byType.checkout_success ?? 0).toLocaleString("ru-RU")} accent="#0d9488" />
              <Tile label="LEAD SUBMIT" value={(summary.byType.lead_submit ?? 0).toLocaleString("ru-RU")} accent="#7c3aed" />
            </section>
          )}

          {/* Pipeline counts */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginBottom: 32,
            }}
          >
            <Tile label="SALES LEADS" value={counts.leads.toString()} accent="#0ea5e9" />
            <Tile label="AFFILIATE" value={counts.affiliate.toString()} accent="#be185d" />
            <Tile label="PARTNERS" value={counts.partners.toString()} accent="#7c3aed" />
            <Tile label="EDU APPLICATIONS" value={counts.edu.toString()} accent="#065f46" />
            <Tile label="NEWSLETTER" value={counts.newsletter.toString()} accent="#f59e0b" />
          </section>

          {summary && (
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
              <Breakdown title={t("pricing.admin.breakdown.byType")} data={summary.byType} />
              <Breakdown title={t("pricing.admin.breakdown.byTier")} data={summary.byTier} />
              <Breakdown title={t("pricing.admin.breakdown.byIndustry")} data={summary.byIndustry} />
              <Breakdown title={t("pricing.admin.breakdown.bySource")} data={summary.bySource} />
              {/* bySource выше считает все события, поэтому в нём доминируют просмотры.
                  Эти две панели показывают только начала оплаты — единственный срез,
                  по которому видно, какие поверхности реально приводят к покупке. */}
              <Breakdown
                title={t("pricing.admin.breakdown.checkoutBySource")}
                data={summary.checkoutBySource ?? {}}
                accent="#0d9488"
              />
              <Breakdown
                title={t("pricing.admin.breakdown.checkoutByChannel")}
                data={summary.checkoutByChannel ?? {}}
                accent="#7c3aed"
              />
              {/* Панели выше считают НАЧАЛА оплаты. Этого мало, чтобы решать,
                  куда тратить: канал приводит много заходов в кассу и ноль
                  покупок — и выглядит лучшим. Общий срез «по каналам» ещё
                  хуже: он складывает просмотры, нажатия и заходы, то есть
                  вознаграждает трафик, а не выручку.

                  Ниже — то, чем платят. Выручка отдельно от счёта покупок и
                  честно подписана: у возврата PayBox в адрес уходит ref, а не
                  сумма, поэтому известна она не у всех. Сколько покупок с
                  известной суммой — в подписи, иначе частичная выручка
                  читается как полная и молча занижает канал. */}
              <Breakdown
                title={t("pricing.admin.breakdown.purchaseByChannel")}
                data={summary.purchaseByChannel ?? {}}
                accent="#0f766e"
              />
              <Breakdown
                title={`${t("pricing.admin.breakdown.purchaseRevenueByChannel")} · ${summary.purchaseWithKnownAmount ?? 0}/${summary.purchaseCount ?? 0}`}
                data={summary.purchaseRevenueByChannel ?? {}}
                accent="#166534"
              />
              {/* Их две панели выше считают НАЧАЛА ОПЛАТЫ. Эта — клики по кнопке
                  «купить» в разрезе товаров: при 26 товарах и трёх продажах за
                  всё время это единственный способ понять, что вообще пробуют
                  купить, а что не трогают. Срез другой, поэтому панель третья,
                  а не вместо. */}
              <Breakdown
                title={t("pricing.admin.breakdown.byProduct")}
                data={summary.byProduct ?? {}}
                accent="#b45309"
              />
            </section>
          )}

          {byVariant && byVariant.keys.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 4, letterSpacing: "-0.02em" }}>
                {t("pricing.admin.abTest.title")}
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0, marginBottom: 12 }}>
                {t("pricing.admin.abTest.description", { hours: byVariant.windowHours })}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
                {byVariant.keys.map((k) => (
                  <ABFunnelCard key={k} variantKey={k} data={byVariant.variants[k] ?? {}} />
                ))}
              </div>
            </section>
          )}

          {/* Recent events */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
              {t("pricing.admin.recentEvents.title")}
            </h2>
            {events.length === 0 ? (
              <Empty text={t("pricing.admin.recentEvents.empty")} />
            ) : (
              <Table>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={th}>{t("pricing.admin.table.time")}</th>
                    <th style={th}>{t("pricing.admin.table.type")}</th>
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
              </Table>
            )}
          </section>
        </>
      )}

      {tab === "leads" && (
        <section>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <ExportCsvButton
              count={leads.length}
              onClick={() =>
                downloadCSV(
                  `aevion-leads-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["ts", "name", "email", "company", "industry", "tier", "seats", "source", "message", "modules"],
                  leads.map((l) => [
                    l.ts,
                    l.name,
                    l.email,
                    l.company ?? "",
                    l.industry ?? "",
                    l.tier ?? "",
                    l.seats ?? "",
                    l.source ?? "",
                    l.message ?? "",
                    (l.modules ?? []).join("; "),
                  ]),
                )
              }
            />
          </div>
          {leads.length === 0 ? (
            <Empty text={t("pricing.admin.leads.empty")} />
          ) : (
            <Table>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={th}>{t("pricing.admin.table.time")}</th>
                  <th style={th}>{t("pricing.admin.table.name")}</th>
                  <th style={th}>Email</th>
                  <th style={th}>{t("pricing.admin.table.company")}</th>
                  <th style={th}>{t("pricing.admin.table.industry")}</th>
                  <th style={th}>Tier</th>
                  <th style={th}>Seats</th>
                  <th style={th}>{t("pricing.admin.table.source")}</th>
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
                    <td style={td}>{l.tier ? <Pill text={l.tier.toUpperCase()} bg="#e0f2fe" fg="#075985" /> : "—"}</td>
                    <td style={td}>{l.seats ?? "—"}</td>
                    <td style={td}>{l.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      )}

      {tab === "affiliate" && (
        <section>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <ExportCsvButton
              count={affiliate.length}
              onClick={() =>
                downloadCSV(
                  `aevion-affiliate-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["ts", "name", "email", "organization", "country", "channel", "details"],
                  affiliate.map((a) => [
                    a.ts,
                    a.name,
                    a.email,
                    a.organization ?? "",
                    a.country ?? "",
                    a.channel ?? "",
                    a.details ?? "",
                  ]),
                )
              }
            />
          </div>
          <ApplicationTable
            items={affiliate}
            empty={t("pricing.admin.affiliateTab.empty")}
            extraColumns={[
              { label: t("pricing.admin.affiliateTab.channelColumn"), get: (a) => a.channel ?? "—" },
            ]}
          />
        </section>
      )}

      {tab === "partners" && (
        <section>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <ExportCsvButton
              count={partners.length}
              onClick={() =>
                downloadCSV(
                  `aevion-partners-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["ts", "name", "email", "organization", "country", "partner_type", "details"],
                  partners.map((a) => [
                    a.ts,
                    a.name,
                    a.email,
                    a.organization ?? "",
                    a.country ?? "",
                    a.partnerType ?? "",
                    a.details ?? "",
                  ]),
                )
              }
            />
          </div>
          <ApplicationTable
            items={partners}
            empty={t("pricing.admin.partnersTab.empty")}
            extraColumns={[
              {
                label: t("pricing.admin.table.type"),
                get: (a) =>
                  a.partnerType ? (
                    <Pill
                      text={a.partnerType.replace("_", " ").toUpperCase()}
                      bg="#f5f3ff"
                      fg="#6d28d9"
                    />
                  ) : "—",
              },
            ]}
          />
        </section>
      )}

      {tab === "edu" && (
        <section>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <ExportCsvButton
              count={edu.length}
              onClick={() =>
                downloadCSV(
                  `aevion-edu-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["ts", "name", "email", "organization", "country", "institution_domain", "details"],
                  edu.map((a) => [
                    a.ts,
                    a.name,
                    a.email,
                    a.organization ?? "",
                    a.country ?? "",
                    a.institutionDomain ?? "",
                    a.details ?? "",
                  ]),
                )
              }
            />
          </div>
          <ApplicationTable
            items={edu}
            empty={t("pricing.admin.eduTab.empty")}
            extraColumns={[
              { label: t("pricing.admin.eduTab.domainColumn"), get: (a) => a.institutionDomain ?? "—" },
            ]}
          />
        </section>
      )}

      {tab === "newsletter" && (
        <section>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <ExportCsvButton
              count={newsletter.length}
              onClick={() =>
                downloadCSV(
                  `aevion-newsletter-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["ts", "email", "source"],
                  newsletter.map((n) => [n.ts, n.email, n.source ?? ""]),
                )
              }
            />
          </div>
          {newsletter.length === 0 ? (
            <Empty text={t("pricing.admin.newsletterTab.empty")} />
          ) : (
            <Table>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={th}>{t("pricing.admin.table.time")}</th>
                  <th style={th}>Email</th>
                  <th style={th}>{t("pricing.admin.table.source")}</th>
                </tr>
              </thead>
              <tbody>
                {newsletter.map((n, i) => (
                  <tr key={n.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}>
                    <td style={td}>{new Date(n.ts).toLocaleString("ru-RU")}</td>
                    <td style={td}>
                      <a href={`mailto:${n.email}`} style={{ color: "#0d9488", textDecoration: "none" }}>
                        {n.email}
                      </a>
                    </td>
                    <td style={td}>{n.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      )}
    </ProductPageShell>
  );
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

function downloadCSV(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportCsvButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      style={{
        padding: "6px 12px",
        fontSize: 11,
        fontWeight: 800,
        borderRadius: 6,
        border: "1px solid rgba(13,148,136,0.3)",
        background: count === 0 ? "#f1f5f9" : "#fff",
        color: count === 0 ? "#94a3b8" : "#0d9488",
        cursor: count === 0 ? "not-allowed" : "pointer",
        letterSpacing: "0.04em",
      }}
    >
      ⬇ Export CSV ({count})
    </button>
  );
}

function ApplicationTable({
  items,
  empty,
  extraColumns,
}: {
  items: Application[];
  empty: string;
  extraColumns: Array<{ label: string; get: (a: Application) => React.ReactNode }>;
}) {
  const { t } = useI18n();
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <Table>
      <thead>
        <tr style={{ background: "#f8fafc" }}>
          <th style={th}>{t("pricing.admin.table.time")}</th>
          <th style={th}>{t("pricing.admin.table.name")}</th>
          <th style={th}>Email</th>
          <th style={th}>{t("pricing.admin.table.company")}</th>
          <th style={th}>{t("pricing.admin.table.country")}</th>
          {extraColumns.map((c) => (
            <th key={c.label} style={th}>
              {c.label}
            </th>
          ))}
          <th style={th}>{t("pricing.admin.table.details")}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((a, i) => (
          <tr key={a.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}>
            <td style={td}>{new Date(a.ts).toLocaleString("ru-RU")}</td>
            <td style={{ ...td, fontWeight: 700 }}>{a.name}</td>
            <td style={td}>
              <a href={`mailto:${a.email}`} style={{ color: "#0d9488", textDecoration: "none" }}>
                {a.email}
              </a>
            </td>
            <td style={td}>{a.organization ?? "—"}</td>
            <td style={td}>{a.country ?? "—"}</td>
            {extraColumns.map((c) => (
              <td key={c.label} style={td}>
                {c.get(a)}
              </td>
            ))}
            <td style={{ ...td, maxWidth: 240, whiteSpace: "normal", color: "#64748b" }} title={a.details}>
              {a.details ? (a.details.length > 60 ? `${a.details.slice(0, 60)}…` : a.details) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>{children}</table>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: 20, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, color: "#64748b", fontSize: 13, textAlign: "center" }}>
      {text}
    </div>
  );
}

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        padding: "2px 6px",
        background: bg,
        color: fg,
        borderRadius: 4,
        letterSpacing: "0.04em",
      }}
    >
      {text}
    </span>
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

function Breakdown({ title, data, accent }: { title: string; data: Record<string, number>; accent?: string }) {
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
                  background: accent
                    ? `linear-gradient(90deg, ${accent}, ${accent}99)`
                    : "linear-gradient(90deg, #0d9488, #0ea5e9)",
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

function ABFunnelCard({
  variantKey,
  data,
}: {
  variantKey: string;
  data: Record<string, Record<FunnelType, number>>;
}) {
  const { t } = useI18n();
  const variants = Object.keys(data).sort();
  const FUNNEL: { key: FunnelType; label: string; color: string }[] = [
    { key: "page_view", label: "Page views", color: "#0ea5e9" },
    { key: "cta_click", label: "CTA clicks", color: "#7c3aed" },
    { key: "lead_submit", label: "Leads", color: "#be185d" },
    { key: "checkout_start", label: "Checkout start", color: "#f59e0b" },
    { key: "checkout_success", label: "Checkout ✓", color: "#0d9488" },
  ];

  function rate(num: number, den: number): string {
    if (den === 0) return "—";
    return `${((num / den) * 100).toFixed(1)}%`;
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em" }}>
          {t("pricing.admin.abTest.variantLabel", { variant: variantKey.toUpperCase() })}
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>n = {variants.length}</div>
      </div>
      {variants.length === 0 ? (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("pricing.admin.abTest.noData")}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ ...th, fontSize: 10 }}>Variant</th>
                {FUNNEL.map((f) => (
                  <th key={f.key} style={{ ...th, fontSize: 10, color: f.color }}>
                    {f.label}
                  </th>
                ))}
                <th style={{ ...th, fontSize: 10 }}>CR view→success</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                const c = data[v];
                return (
                  <tr key={v} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}>
                    <td style={{ ...td, fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>{v}</td>
                    {FUNNEL.map((f) => (
                      <td key={f.key} style={{ ...td, fontFamily: "ui-monospace, monospace" }}>
                        {c[f.key] ?? 0}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 800, color: "#0d9488" }}>
                      {rate(c.checkout_success ?? 0, c.page_view ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
