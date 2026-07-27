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
import { Toast } from "./components/Toast";
import { apiUrl } from "@/lib/apiBase";
import { ApiError, TIER_ACCENT, startupxApi, usd, type Listing, type Tier, type TierSpec } from "./lib";

const PAGE_SIZE = 10;

/**
 * Число в плитке — или прочерк, если сервер его не прислал.
 *
 * `String(undefined)` даёт на экране слово «undefined», и оно там было: фронт и
 * бэкенд переезжают не одновременно (Vercel и Railway — разные деплои), и в
 * окне между ними новая страница читает старый ответ без новых полей. Замерено
 * живым кликом 27.07.2026: плитка «С разбором» показывала «undefined».
 */
function num(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? String(n) : "—";
}

type TierFilter = "" | Tier;

interface Stats {
  total?: number;
  byTier?: Record<string, number>;
  recentCount?: number;
  assessed?: number;
  avgScore?: number;
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
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [interestFor, setInterestFor] = useState<Listing | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchListings = useCallback(async (tier: TierFilter, off: number, s: "recent" | "score", sector: string, q: string) => {
    setLoading(true);
    try {
      const data = await startupxApi.list({ tier, sector: sector || undefined, q: q || undefined, limit: PAGE_SIZE, offset: off, sort: s });
      setListings(data.listings ?? []);
      setTotal(data.total ?? 0);
      setLoadError(null);
    } catch (e) {
      // Сорванная загрузка и пустая лента — это два разных сообщения. Раньше
      // оба показывали «в этой категории пока пусто»: при недоступном бэкенде
      // биржа выглядела мёртвой, а посетитель уходил, считая, что заявок нет.
      setListings([]);
      setLoadError(e instanceof ApiError ? e.message : "Не удалось загрузить ленту. Проверьте связь.");
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
    fetchListings(tierFilter, offset, sort, sectorFilter, searchApplied);
  }, [tierFilter, offset, sort, sectorFilter, searchApplied, fetchListings]);

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
    setSearch("");
    setSearchApplied("");
    fetchListings("", 0, sort, "", "");
    fetchStats();
  }

  // Подписка повторяет то, что человек уже отфильтровал: если он смотрит идеи в
  // логистике, лента должна приходить такая же, а не «всё подряд».
  const rssHref = (() => {
    const q = new URLSearchParams();
    if (tierFilter) q.set("tier", tierFilter);
    if (sectorFilter) q.set("sector", sectorFilter);
    if (searchApplied) q.set("q", searchApplied);
    const qs = q.toString();
    return apiUrl(`/api/startupx/rss.xml${qs ? `?${qs}` : ""}`);
  })();

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
                <div style={{ fontSize: 11.5, color: "#64748b" }}>
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
                style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", fontWeight: 600, minHeight: 36, padding: "8px 6px" }}
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
            <StatTile label="Заявок" value={num(stats.total)} accent="#0f172a" />
            <StatTile label="За 7 дней" value={num(stats.recentCount)} accent="#0d9488" />
            <StatTile label="С разбором" value={num(stats.assessed)} accent="#7c3aed" />
            <StatTile label="Средний балл" value={(stats.assessed ?? 0) > 0 ? num(stats.avgScore) : "—"} accent="#b45309" />
          </div>
        )}

        {/* ── Feed ─────────────────────────────────────────────────────────── */}
        <section aria-labelledby="startupx-feed-heading">
          {/* Карточки заявок — h3, а ближайший заголовок выше был h1 страницы:
              для скринридера это пропуск уровня, а лента — главный список на
              странице. Заголовок нужен и глазу: он отделяет витрину от подачи. */}
          <h2
            id="startupx-feed-heading"
            style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 800, color: "#0f172a" }}
          >
            Заявки на бирже
          </h2>

          {/* Инвестор ищет словами из заявки — «логистика», «юристы», «подписка», —
              а не нашими категориями. Применяется по Enter и по кнопке: поиск на
              каждую букву гонял бы запрос на сервер без пользы. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearchApplied(search.trim());
              setOffset(0);
            }}
            style={{ display: "flex", gap: 8, marginBottom: 12 }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск по заявкам"
              placeholder="Поиск по словам из заявки: логистика, юристы, подписка…"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "9px 12px",
                borderRadius: 9,
                border: "1px solid #e2e8f0",
                fontSize: 13.5,
                fontFamily: "inherit",
                color: "#0f172a",
              }}
            />
            <button
              type="submit"
              style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Найти
            </button>
            {searchApplied && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchApplied("");
                  setOffset(0);
                }}
                style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Сбросить
              </button>
            )}
          </form>
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
              <a
                href={rssHref}
                title="Подписаться на этот срез заявок в читалке — без аккаунта и без писем"
                style={{ display: "inline-flex", alignItems: "center", minHeight: 34, padding: "6px 4px", fontSize: 12.5, fontWeight: 600, color: "#7c3aed", textDecoration: "none" }}
              >
                RSS этого среза
              </a>
              <span style={{ fontSize: 12, color: "#64748b" }}>Сортировка:</span>
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

          {loading && <p style={{ color: "#64748b", textAlign: "center", padding: 36 }}>Загружаю заявки…</p>}

          {!loading && loadError && (
            <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 14, padding: 28, textAlign: "center", color: "#7f1d1d" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Лента не загрузилась</div>
              <div style={{ fontSize: 13.5, color: "#334155" }}>{loadError}</div>
              <button
                type="button"
                onClick={() => fetchListings(tierFilter, offset, sort, sectorFilter, searchApplied)}
                style={{ marginTop: 14, padding: "9px 18px", borderRadius: 9, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Попробовать снова
              </button>
            </div>
          )}

          {!loading && !loadError && listings.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 36, textAlign: "center", color: "#64748b" }}>
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
          {!loading && !loadError && listings.length === 0 && !showWizard && <ExampleListing />}

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

        {/* Доска идей платформы рисуется в тёмной палитре и на светлой странице
            выглядела оторванным куском чужого интерфейса. Общий компонент трогать
            нельзя — им пользуются полтора десятка модулей, — поэтому она подана
            как сознательный тёмный блок со своим заголовком. */}
        <div
          style={{
            marginTop: 36,
            background: "#0f172a",
            borderRadius: 18,
            padding: "22px 6px 6px",
          }}
        >
          <div style={{ padding: "0 18px 4px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Что достроить на бирже</div>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.55, maxWidth: 620 }}>
              Это не заявка и не отклик — сюда пишут, чего не хватает самой площадке. Читаем и
              достраиваем.
            </p>
          </div>
          <MvpConceptBoard
            moduleId="startupx"
            noun="concept/messages"
            accent="amber"
            sectionTitle="Предложения по площадке"
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
            fetchListings(tierFilter, offset, sort, sectorFilter, searchApplied);
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

