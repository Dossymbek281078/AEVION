"use client";

import { useCallback, useEffect, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import ModulePricingChip from "@/components/ModulePricingChip";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import { ListingWizard } from "./components/ListingWizard";
import { ListingCard } from "./components/ListingCard";
import { InterestModal } from "./components/InterestModal";
import { ExampleListing } from "./components/ExampleListing";
import { TIER_ACCENT, startupxApi, usd, type Listing, type Tier, type TierSpec } from "./lib";

const PAGE_SIZE = 10;

type TierFilter = "" | Tier;

interface Stats {
  total: number;
  byTier: Record<string, number>;
  recentCount: number;
  assessed: number;
  avgScore: number;
}

export default function StartupExchangePage() {
  const [tiers, setTiers] = useState<TierSpec[]>([]);
  const [sectors, setSectors] = useState<Array<{ id: string; label: string }>>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>("");
  const [sort, setSort] = useState<"recent" | "score">("recent");
  const [sectorFilter, setSectorFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [interestFor, setInterestFor] = useState<Listing | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const fetchListings = useCallback(async (tier: TierFilter, off: number, s: "recent" | "score", sector: string) => {
    setLoading(true);
    try {
      const data = await startupxApi.list({ tier, sector: sector || undefined, limit: PAGE_SIZE, offset: off, sort: s });
      setListings(data.listings ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await startupxApi.stats());
    } catch {
      /* the feed still works without the counters */
    }
  }, []);

  useEffect(() => {
    startupxApi
      .tiers()
      .then((r) => {
        setTiers(r.tiers);
        setSectors(r.sectors ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchListings(tierFilter, offset, sort, sectorFilter);
  }, [tierFilter, offset, sort, sectorFilter, fetchListings]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function handlePublished(listing: Listing) {
    setToast(`Опубликовано: «${listing.title}» — заявка №${listing.id}`);
    // The wizard stays mounted on purpose. It has just been handed the founder's
    // one-time link to their offers, and collapsing the form here would take that
    // link off the screen before it could be copied.
    setOffset(0);
    setTierFilter("");
    setSectorFilter("");
    fetchListings("", 0, sort, "");
    fetchStats();
  }

  const tabs: Array<{ id: TierFilter; label: string; count?: number }> = [
    { id: "", label: "Все", count: stats?.total },
    ...tiers.map((t) => ({ id: t.id as TierFilter, label: t.label, count: stats?.byTier?.[t.id] })),
  ];

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <ModulePricingChip moduleId="startup-exchange" theme="light" />
        </div>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 22 }}>
          <div
            style={{
              display: "inline-block",
              padding: "3px 12px",
              borderRadius: 20,
              background: "#f5f3ff",
              color: "#7c3aed",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            Биржа стартапов
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1.2, maxWidth: 760 }}>
            Идея, MVP или готовый продукт — с ценой, долей и бесплатным разбором
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: 14.5, color: "#475569", lineHeight: 1.65, maxWidth: 720 }}>
            Хорошие идеи гибнут не потому, что они плохие, а потому, что их не с чем сравнить: инвестор
            видит текст без условий и не понимает, о чём разговор. Здесь у каждой заявки есть уровень,
            названные условия сделки и бесплатный разбор, который сравнивает эти условия с рынком.
          </p>

          {!showWizard && (
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              style={{
                padding: "13px 24px",
                borderRadius: 11,
                border: "none",
                background: "#0f172a",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Опишите проект — покажу бесплатный разбор
            </button>
          )}
        </header>

        {/* ── Tier explainer ───────────────────────────────────────────────── */}
        {tiers.length > 0 && !showWizard && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 24 }}>
            {tiers.map((t) => (
              <div key={t.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, borderTop: `3px solid ${TIER_ACCENT[t.id]}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 5 }}>{t.label}</div>
                <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>{t.offer}</p>
                <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Вход инвестора: {usd(t.ticketUsd.low)} – {usd(t.ticketUsd.high)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Wizard ───────────────────────────────────────────────────────── */}
        {showWizard && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a" }}>Подать заявку</h2>
              <button
                type="button"
                onClick={() => setShowWizard(false)}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              >
                Свернуть
              </button>
            </div>
            <ListingWizard tiers={tiers} sectors={sectors} onPublished={handlePublished} />
          </section>
        )}

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatTile label="Заявок" value={String(stats.total)} accent="#0f172a" />
            <StatTile label="За 7 дней" value={String(stats.recentCount)} accent="#0d9488" />
            <StatTile label="С разбором" value={String(stats.assessed)} accent="#7c3aed" />
            <StatTile label="Средний балл" value={stats.assessed > 0 ? String(stats.avgScore) : "—"} accent="#b45309" />
          </div>
        )}

        {/* ── Feed ─────────────────────────────────────────────────────────── */}
        <section>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            {tabs.map((tab) => {
              const active = tierFilter === tab.id;
              return (
                <button
                  key={tab.id || "all"}
                  type="button"
                  onClick={() => {
                    setTierFilter(tab.id);
                    setOffset(0);
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    background: active ? "#0f172a" : "#f1f5f9",
                    color: active ? "#fff" : "#475569",
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && <span style={{ opacity: 0.65, marginLeft: 6 }}>{tab.count}</span>}
                </button>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={sectorFilter}
                onChange={(e) => {
                  setSectorFilter(e.target.value);
                  setOffset(0);
                }}
                aria-label="Отрасль"
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12.5, fontWeight: 600, color: "#334155", cursor: "pointer" }}
              >
                <option value="">Все отрасли</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Сортировка:</span>
              <button
                type="button"
                onClick={() => {
                  setSort(sort === "recent" ? "score" : "recent");
                  setOffset(0);
                }}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12.5, fontWeight: 600, color: "#334155", cursor: "pointer" }}
              >
                {sort === "recent" ? "сначала новые" : "по баллу разбора"}
              </button>
            </div>
          </div>

          {loading && <p style={{ color: "#94a3b8", textAlign: "center", padding: 36 }}>Загружаю заявки…</p>}

          {!loading && listings.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 36, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>○</div>
              <div>В этой категории пока пусто.</div>
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                style={{ marginTop: 12, padding: "9px 18px", borderRadius: 9, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Стать первым
              </button>
            </div>
          )}

          {/* An empty feed used to be a dead end. One worked example — scored
              live by the same engine — shows what the exchange actually does. */}
          {!loading && listings.length === 0 && !showWizard && <ExampleListing />}

          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} onInterest={setInterestFor} />
          ))}

          {total > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
              <PageBtn disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>← Назад</PageBtn>
              <span style={{ alignSelf: "center", fontSize: 12, color: "#64748b" }}>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} из {total}
              </span>
              <PageBtn disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Вперёд →</PageBtn>
            </div>
          )}
        </section>

        <div style={{ marginTop: 32 }}>
          <MvpConceptBoard
            moduleId="startupx"
            noun="concept/messages"
            accent="amber"
            sectionTitle="Что ещё должно быть на бирже"
            sectionHint="Каких данных не хватает инвестору? Что мешает основателю подать заявку?"
            titleField="idea"
            summaryField="rationale"
            fields={[
              { key: "idea", label: "Идея / фича", placeholder: "напр.: эскроу для сделок по выкупу", required: true },
              { key: "rationale", label: "Какую дыру это закрывает", type: "textarea", placeholder: "Что не дают существующие площадки" },
              { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
            ]}
          />
        </div>
      </ProductPageShell>

      {interestFor && (
        <InterestModal
          listing={interestFor}
          onClose={() => setInterestFor(null)}
          onSubmitted={(id) => {
            setInterestFor(null);
            setToast(`Предложение отправлено основателю заявки №${id}`);
            fetchListings(tierFilter, offset, sort, sectorFilter);
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}

function PageBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#fff",
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#0f172a",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        fontSize: 13,
        fontWeight: 600,
        zIndex: 1100,
        maxWidth: 360,
      }}
    >
      {message}
    </div>
  );
}
