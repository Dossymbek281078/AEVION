"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { externalRevenueAt } from "./externalRevenue";
import { useI18n } from "@/lib/i18n";
import { etaLabel, type GoalPace } from "@/lib/goalEta";
import { fmtNum, intlLocale, type NumLang } from "@/lib/locale";

interface RevenueOverview {
  totalApps: number;
  liveApps: number;
  channelCoverage: Record<string, number>;
  providers: {
    gumroad?: { configured: boolean; primary: boolean };
    lemonsqueezy?: { configured: boolean; primary: boolean };
    paddle: { configured: boolean; sandbox: boolean };
    youtube: { configured: boolean };
    twitch: { configured: boolean };
    paybox?: { configured: boolean };
  };
  apps: { appId: string; appName: string; channels: string[]; color: string }[];
}

interface GumroadSale {
  id: string;
  appId: string;
  product: string;
  email: string | null;
  amountUsd: number;
  currency: string;
  refunded: boolean;
  date: string | null;
}

interface GumroadRecent {
  sales: GumroadSale[];
  byApp: Record<string, { count: number; totalUsd: number }>;
  /** Разрез по ИСТОЧНИКУ ТРАФИКА (метка ?c= со страницы /go), не по платёжке.
   *  Продажи без метки приходят под ключом "unattributed". */
  bySource?: Record<string, { count: number; totalUsd: number }>;
  stub?: boolean;
  message?: string;
}

interface LsSale {
  id: string;
  appId: string;
  product: string;
  email: string | null;
  amountUsd: number;
  currency: string;
  refunded: boolean;
  date: string | null;
}

interface LsRecent {
  sales: LsSale[];
  stub?: boolean;
  message?: string;
}

/** A sale row tagged with which channel it came from, for the combined table. */
interface SaleRow {
  id: string;
  source: "gumroad" | "lemonsqueezy";
  appId: string;
  product: string;
  amountUsd: number;
  currency: string;
  refunded: boolean;
  date: string | null;
}

interface GumroadBalance {
  grossUsd?: number;
  feesUsd?: number;
  netUsd?: number;
  currency?: string;
  saleCount?: number;
  refundedCount?: number;
  /** Покупки с внутренних адресов: входят в gross канала, но не в выручку. */
  internalUsd?: number;
  internalCount?: number;
  stub?: boolean;
  error?: string;
  message?: string;
  setupGuide?: string;
}

interface RevenueGoals {
  primaryUsd: number;
  stretchUsd: number;
  deadline: string;
}

interface RevenuePace extends GoalPace {
  first?: { capturedAt: string };
}

const CHANNEL_LABELS: Record<string, string> = {
  gumroad_onetime: "Gumroad Pay",
  gumroad_membership: "Gumroad Sub",
  paddle_subscription: "Paddle Sub (legacy)",
  paddle_onetime: "Paddle Pay (legacy)",
  paybox: "PayBox",
  kaspi: "Kaspi",
  youtube_adsense: "YouTube",
  twitch_affiliate: "Twitch",
  twitch_partner: "Twitch+",
  in_app_purchase: "In-App",
  donation: "Donation",
  course_sale: "Курсы",
  marketplace: "Market",
};

const CHANNEL_COLORS: Record<string, string> = {
  gumroad_onetime: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  gumroad_membership: "bg-pink-600/20 text-pink-200 border-pink-600/30",
  paddle_subscription: "bg-gray-700/40 text-gray-500 border-gray-700",
  paddle_onetime: "bg-gray-700/40 text-gray-500 border-gray-700",
  paybox: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  kaspi: "bg-red-500/20 text-red-300 border-red-500/30",
  youtube_adsense: "bg-red-500/20 text-red-300 border-red-500/30",
  twitch_affiliate: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  twitch_partner: "bg-purple-600/20 text-purple-200 border-purple-600/30",
  in_app_purchase: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  donation: "bg-green-500/20 text-green-300 border-green-500/30",
  course_sale: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  marketplace: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

// Fallback if /api/revenue/goals is unreachable — matches the backend defaults.
const DEFAULT_GOALS: RevenueGoals = { primaryUsd: 1_000_000, stretchUsd: 20_000_000, deadline: "2027-01-01" };

function daysUntil(deadline: string): number {
  const target = Date.parse(`${deadline}T00:00:00Z`);
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

/** Compact form for large dollar amounts ($19,999,821 → $20.0M); small ones stay exact. */
function formatCompactUsd(n: number, lang: NumLang = "en"): string {
  if (n < 10_000) return `$${fmtNum(n, lang, { maximumFractionDigits: 2 })}`;
  return `$${Intl.NumberFormat(intlLocale(lang), { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
}

// Static "HH:MM:SS" — deliberately not a live-ticking "N sec ago": a text
// node that re-renders every few seconds inside AutoTranslate's observed
// subtree raced its live re-translation and produced garbled duplicated
// text (same class of bug already worked around for CyberChess's move
// clock). This only changes when new data actually lands (loadAll's 60s
// refresh), so it can't collide with the translator mid-render.
function clockLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function RevenuePage() {
  const { lang } = useI18n();
  const numLang: NumLang = lang === "ru" ? "ru" : "en";
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [balance, setBalance] = useState<GumroadBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [lsBalance, setLsBalance] = useState<GumroadBalance | null>(null);
  const [lsLoading, setLsLoading] = useState(true);
  const [recent, setRecent] = useState<GumroadRecent | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [lsRecent, setLsRecent] = useState<LsRecent | null>(null);
  const [lsRecentLoading, setLsRecentLoading] = useState(true);
  const [goals, setGoals] = useState<RevenueGoals>(DEFAULT_GOALS);
  const [pace, setPace] = useState<RevenuePace | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Each channel fetches independently — a slow/stuck one no longer blocks
  // the whole page; every section renders as soon as its own data lands.
  // Re-runs every 60s so a tab left open doesn't go stale under its own
  // "обновлено N назад" timestamp.
  useEffect(() => {
    const touch = () => setLastUpdatedAt(Date.now());
    const loadAll = () => {
      fetch(apiUrl("/api/revenue/overview")).then((r) => r.json()).catch(() => null)
        .then((d) => { setOverview(d); setOverviewLoading(false); touch(); });
      // Falls back to an explicit {error} shape (not null) on network failure —
      // null and "real zero" both render as $0.00, which hid genuine channel
      // outages behind an indistinguishable "no sales yet" state.
      fetch(apiUrl("/api/revenue/gumroad/balance")).then((r) => r.json()).catch(() => ({ error: "network_error" }))
        .then((d) => { setBalance(d); setBalanceLoading(false); touch(); });
      fetch(apiUrl("/api/revenue/gumroad/recent")).then((r) => r.json()).catch(() => null)
        .then((d) => { setRecent(d); setRecentLoading(false); touch(); });
      fetch(apiUrl("/api/revenue/lemonsqueezy/balance")).then((r) => r.json()).catch(() => ({ error: "network_error" }))
        .then((d) => { setLsBalance(d); setLsLoading(false); touch(); });
      fetch(apiUrl("/api/revenue/lemonsqueezy/recent")).then((r) => r.json()).catch(() => null)
        .then((d) => { setLsRecent(d); setLsRecentLoading(false); touch(); });
      fetch(apiUrl("/api/revenue/goals")).then((r) => r.json()).catch(() => null)
        .then((d) => { if (d && typeof d.primaryUsd === "number") setGoals(d); });
      fetch(apiUrl("/api/revenue/trend?windowDays=30")).then((r) => r.json()).catch(() => null)
        .then((d) => setPace(d));
    };
    loadAll();
    const t = setInterval(loadAll, 60_000);
    return () => clearInterval(t);
  }, []);

  const providers = overview?.providers;
  const gumroadConfigured = providers?.gumroad?.configured;
  const lemonsqueezyConfigured = providers?.lemonsqueezy?.configured;
  const anyChannelConfigured = gumroadConfigured || lemonsqueezyConfigured;

  // Совокупная выручка по всем живым чекаутам (Gumroad + LemonSqueezy).
  const gGross = balance?.grossUsd ?? 0;
  const lsGross = lsBalance?.grossUsd ?? 0;
  const gCount = balance?.saleCount ?? 0;
  const lsCount = lsBalance?.saleCount ?? 0;
  const totalGross = gGross + lsGross;
  const totalCount = gCount + lsCount;
  // Свои проверочные покупки входят в gross канала (он обязан сходиться с
  // кабинетом провайдера), но выручкой не являются. 27.07.2026 их было две
  // на $158.99 — 89% валовой суммы, и без этого разделения дашборд говорил
  // «$178.97 выручки» там, где снаружи пришло $19.98.
  const totalInternal = (balance?.internalUsd ?? 0) + (lsBalance?.internalUsd ?? 0);
  const totalInternalCount = (balance?.internalCount ?? 0) + (lsBalance?.internalCount ?? 0);
  const externalGross = totalGross - totalInternal;
  const externalCount = totalCount - totalInternalCount;
  const daysLeft = daysUntil(goals.deadline);

  // Merge both channels' recent sales — the backend now attributes LS
  // orders to an appId too (via LEMON_SQUEEZY_VARIANT_* env vars, same
  // idea as Gumroad's permalink mapping), falling back to "platform" for
  // generic plan-tier variants that aren't one specific app.
  const combinedSales: SaleRow[] = [
    ...(recent?.sales ?? []).map((s): SaleRow => ({ ...s, source: "gumroad" })),
    ...(lsRecent?.sales ?? []).map((s): SaleRow => ({ ...s, source: "lemonsqueezy" })),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  // Normalizes keys (trim + lowercase) while merging so two sources that
  // happen to spell the same appId differently land in one bucket instead
  // of two side-by-side entries.
  const combinedByApp: Record<string, { count: number; totalUsd: number }> = {};
  const addByApp = (appId: string, count: number, totalUsd: number) => {
    const key = appId.trim().toLowerCase();
    const cur = combinedByApp[key] ?? { count: 0, totalUsd: 0 };
    combinedByApp[key] = { count: cur.count + count, totalUsd: cur.totalUsd + totalUsd };
  };
  for (const [appId, data] of Object.entries(recent?.byApp ?? {})) {
    addByApp(appId, data.count, data.totalUsd);
  }
  for (const s of (lsRecent?.sales ?? []).filter((sale) => !sale.refunded)) {
    addByApp(s.appId, 1, s.amountUsd);
  }

  // Источники: размеченные вперёд и по убыванию суммы, «без метки» всегда последним —
  // он почти всегда крупнейший и, стоя первым, оттеснял бы то, ради чего блок нужен.
  const sourceEntries = Object.entries(recent?.bySource ?? {});
  const sourceRows = [
    ...sourceEntries.filter(([k]) => k !== "unattributed").sort((a, b) => b[1].totalUsd - a[1].totalUsd),
    ...sourceEntries.filter(([k]) => k === "unattributed"),
  ];
  const attributed = sourceEntries.filter(([k]) => k !== "unattributed");
  const attributedUsd = attributed.reduce((sum, [, d]) => sum + d.totalUsd, 0);
  // Видимость блока — по ЧИСЛУ размеченных продаж, а не по сумме: бесплатный лид-магнит
  // с меткой даёт totalUsd = 0, и условие «есть выручка» спрятало бы факт, что канал
  // вообще приводит людей. Сумма нужна только для долей ниже.
  const attributedCount = attributed.reduce((sum, [, d]) => sum + d.count, 0);
  const unattributedUsd = recent?.bySource?.unattributed?.totalUsd ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/60 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">AEVION Revenue Hub</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Gumroad · LemonSqueezy · PayBox · YouTube · Twitch · {overview?.liveApps ?? 0} приложений live
              {lastUpdatedAt && (
                <span className="ml-2 text-xs text-gray-500">
                  · обновлено в <span translate="no">{clockLabel(lastUpdatedAt)}</span>
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <ProviderBadge name="Gumroad" ok={providers?.gumroad?.configured} primary />
            <ProviderBadge name="LemonSqueezy" ok={providers?.lemonsqueezy?.configured} />
            <ProviderBadge name="PayBox" ok={providers?.paybox?.configured} />
            <ProviderBadge name="YouTube" ok={providers?.youtube?.configured} />
            <ProviderBadge name="Twitch" ok={providers?.twitch?.configured} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Цели до Нового года */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Цели до Нового года</span>
            <span className="text-xs text-amber-400 normal-case">{daysLeft} дн. осталось</span>
          </h2>
          {balanceLoading || lsLoading ? (
            <SkeletonGrid cols={2} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GoalBar
                label="$1M — первая цель"
                target={goals.primaryUsd}
                current={externalGross}
                colorClass="bg-gradient-to-r from-sky-500 to-cyan-300"
                eta={etaLabel(goals.primaryUsd, externalGross, pace, numLang)}
                lang={numLang}
              />
              <GoalBar
                label="$20M — стретч-цель"
                target={goals.stretchUsd}
                current={externalGross}
                colorClass="bg-gradient-to-r from-violet-500 to-fuchsia-400"
                eta={etaLabel(goals.stretchUsd, externalGross, pace, numLang)}
                lang={numLang}
              />
            </div>
          )}
          {pace && pace.points >= 2 && pace.first?.capturedAt && (
            <div className="mt-2 text-[11px] text-gray-500">
              Прогноз темпа — по {pace.points} снапшотам за 30 дней, с {new Date(pace.first.capturedAt).toLocaleDateString("ru")}
            </div>
          )}
        </section>

        {/* Всего по всем каналам (Gumroad + LemonSqueezy) */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Всего · все чекауты <span className="ml-2 text-xs text-emerald-400 normal-case">(live)</span>
          </h2>
          {!balanceLoading && !lsLoading && (balance?.error || lsBalance?.error) && (
            <div className="mb-3 text-xs rounded-lg px-3 py-2 border bg-rose-500/10 border-rose-500/30 text-rose-300">
              ⚠ {balance?.error && lsBalance?.error ? "Оба канала" : balance?.error ? "Gumroad" : "LemonSqueezy"} сейчас недоступны — цифры ниже могут быть занижены, это не обязательно «0 продаж»
            </div>
          )}
          {balanceLoading || lsLoading ? (
            <SkeletonGrid cols={3} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-emerald-500/25 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Выручка снаружи · все каналы</div>
                <div className="text-3xl font-semibold text-white">
                  ${externalGross.toFixed(2)}<span className="text-sm text-gray-400 ml-2">USD</span>
                </div>
                {totalInternal > 0 && (
                  <div className="text-xs text-amber-400/90 mt-1">
                    + ${totalInternal.toFixed(2)} свои проверочные покупки (не в выручке)
                  </div>
                )}
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Продаж снаружи</div>
                <div className="text-3xl font-semibold text-white">{externalCount}</div>
                {totalInternalCount > 0 && (
                  <div className="text-xs text-amber-400/90 mt-1">
                    + {totalInternalCount} своих
                  </div>
                )}
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">По каналам (gross · продажи)</div>
                <div className="text-sm text-gray-300 mt-1 space-y-0.5">
                  <div>Gumroad: <span className="text-white font-semibold">${gGross.toFixed(2)}</span> · {gCount}</div>
                  <div>LemonSqueezy: <span className="text-white font-semibold">${lsGross.toFixed(2)}</span> · {lsCount}</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Gumroad Balance */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Gumroad Balance <span className="ml-2 text-xs text-pink-400 normal-case">(live)</span>
          </h2>
          {balanceLoading ? (
            <SkeletonGrid cols={4} />
          ) : balance?.error ? (
            <div className="bg-gray-900 border border-rose-500/30 rounded-xl p-5 text-sm text-rose-300">
              ✗ Gumroad API сейчас недоступен ({balance.error}) — это не значит, что продаж не было, просто не смогли их получить прямо сейчас
            </div>
          ) : balance?.stub ? (
            <GumroadSetupCard />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-pink-500/20 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Net (после комиссий)</div>
                <div className="text-3xl font-semibold text-white">
                  ${(balance?.netUsd ?? 0).toFixed(2)}
                  <span className="text-sm text-gray-400 ml-2">USD</span>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Gross</div>
                <div className="text-3xl font-semibold text-gray-200">${(balance?.grossUsd ?? 0).toFixed(2)}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Комиссия Gumroad</div>
                <div className="text-3xl font-semibold text-rose-400/80">-${(balance?.feesUsd ?? 0).toFixed(2)}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Продаж</div>
                <div className="text-3xl font-semibold text-white">{balance?.saleCount ?? 0}</div>
                {(balance?.refundedCount ?? 0) > 0 && (
                  <div className="text-xs text-amber-400 mt-1">{balance?.refundedCount} возвратов</div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Revenue trend (Postgres snapshots) */}
        <RevenueTrend />

        {/* Recent Sales — merged Gumroad + LemonSqueezy */}
        {(overviewLoading || anyChannelConfigured) && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Последние продажи</h2>
            {overviewLoading || recentLoading || lsRecentLoading ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-sm text-gray-500 animate-pulse">Загружаем продажи…</div>
            ) : recent?.stub && lsRecent?.stub ? (
              <div className="bg-gray-900 border border-pink-500/20 rounded-xl p-4 text-sm text-pink-400">Ни один канал не настроен</div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {combinedSales.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">Нет продаж пока</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs">
                        <th className="text-left px-4 py-2.5">Продукт</th>
                        <th className="text-left px-4 py-2.5">Приложение</th>
                        <th className="text-left px-4 py-2.5">Канал</th>
                        <th className="text-left px-4 py-2.5">Сумма</th>
                        <th className="text-left px-4 py-2.5">Статус</th>
                        <th className="text-left px-4 py-2.5">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedSales.map((s) => (
                        <tr key={`${s.source}-${s.id}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-gray-200">{s.product}</td>
                          <td className="px-4 py-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{s.appId}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${s.source === "gumroad" ? "bg-pink-500/20 text-pink-300" : "bg-teal-500/20 text-teal-300"}`}>
                              {s.source === "gumroad" ? "Gumroad" : "LemonSqueezy"}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-medium">${s.amountUsd.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${s.refunded ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"}`}>
                              {s.refunded ? "refunded" : "paid"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{s.date ? new Date(s.date).toLocaleDateString("ru") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        )}

        {/* By-App breakdown — merged Gumroad + LemonSqueezy (LS orders have no
            per-app attribution backend-side, so they land in "platform"). */}
        {anyChannelConfigured && Object.keys(combinedByApp).length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">По приложениям</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(combinedByApp).map(([appId, data]) => (
                <div key={appId} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{appId}</div>
                  <div className="text-lg font-semibold text-white">${data.totalUsd.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{data.count} продаж</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Источники трафика — ради этого и заводились метки ?c= на /go.
            Показываем ТОЛЬКО когда есть хоть одна РАЗМЕЧЕННАЯ продажа: пока весь оборот
            без метки, блок сообщал бы одно «источник неизвестен» и занимал место.
            Он появится сам, когда первая продажа придёт с /go?c=. Долю считаем от
            размеченных, а не от всех — иначе доля канала падала бы просто потому,
            что много старых продаж пришло без метки. */}
        {attributedCount > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Источники трафика
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sourceRows.map(([source, data]) => (
                <div key={source} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">
                    {source === "unattributed" ? "без метки" : source}
                  </div>
                  <div className="text-lg font-semibold text-white">${data.totalUsd.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">
                    {data.count} продаж
                    {source !== "unattributed" && attributedUsd > 0 && (
                      <> · {Math.round((data.totalUsd / attributedUsd) * 100)}% размеченных</>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {unattributedUsd > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Без метки — продажи до введения атрибуции и прямые заходы мимо /go.
                Доли считаются от размеченных, поэтому эта сумма их не размывает.
              </p>
            )}
          </section>
        )}

        {/* Apps Registry */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            {overviewLoading ? "Реестр приложений" : `Реестр приложений (${overview?.apps.length ?? 0})`}
          </h2>
          {overviewLoading ? (
            <SkeletonGrid cols={3} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(overview?.apps ?? []).map((app) => (
                <AppCard key={app.appId} app={app} />
              ))}
            </div>
          )}
        </section>

        {/* Channel coverage */}
        {overview && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Покрытие каналов</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(overview.channelCoverage).sort((a, b) => b[1] - a[1]).map(([ch, count]) => (
                <div key={ch} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${CHANNEL_COLORS[ch] ?? "bg-gray-800 text-gray-300 border-gray-700"}`}>
                  <span>{CHANNEL_LABELS[ch] ?? ch}</span>
                  <span className="opacity-60">×{count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Setup Guide */}
        {!overviewLoading && !gumroadConfigured && <GumroadSetupCard full />}
      </div>
    </div>
  );
}

interface TrendPoint {
  capturedAt: string;
  netUsd: number;
  grossUsd: number;
  saleCount: number;
  /** true у снимков до 27.07.2026: в их суммах ещё сидели свои покупки. */
  includesInternal?: boolean;
  /** Сумма своих покупок на момент снимка; null — ещё не досчитана. */
  internalUsd?: number | null;
}
interface TrendResp {
  windowDays: number;
  points: number;
  first?: TrendPoint;
  latest?: TrendPoint;
  change?: { netUsd: number; grossUsd: number; saleCount: number; netGrowthPct: number; saleGrowthPct: number };
  series: TrendPoint[];
  message?: string;
}

function RevenueTrend() {
  const [trend, setTrend] = useState<TrendResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Synchronous guard alongside `capturing`: setState is async, so a very
  // fast double-click can fire two POSTs before the button re-renders
  // disabled. A plain ref updates immediately, closing that gap.
  const inFlightRef = useRef(false);

  const load = () => {
    setLoading(true);
    fetch(apiUrl("/api/revenue/trend?windowDays=90"))
      .then((r) => r.json())
      .then((d) => setTrend(d))
      .catch(() => setTrend(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const capture = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setCapturing(true); setNote(null);
    try {
      const r = await fetch(apiUrl("/api/revenue/snapshot"), { method: "POST", headers: { "Content-Type": "application/json" } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setNote(`✓ Снапшот снят: net $${(j.snapshot?.netUsd ?? 0).toFixed(2)} · каналы: ${(j.channelsUsed ?? []).join(", ") || "—"}`);
        load();
      } else if (r.status === 503) {
        setNote("✗ Нет живого канала (не настроены GUMROAD_ACCESS_TOKEN / LEMON_SQUEEZY_API_KEY)");
      } else if (r.status === 401) {
        setNote("✗ Требуется x-revenue-token (снапшоты снимает cron)");
      } else if (r.status === 429) {
        const retryAfter = r.headers.get("retry-after");
        setNote(retryAfter ? `✗ Слишком часто — подожди ${retryAfter} сек` : "✗ Слишком часто — лимит 6 снапшотов в минуту, попробуй через минуту");
      } else {
        setNote(`✗ ${j.error ?? "snapshot_failed"}`);
      }
    } catch { setNote("✗ Network error"); }
    finally { inFlightRef.current = false; setCapturing(false); }
  };

  const series = trend?.series ?? [];
  const change = trend?.change;
  // Снимки до 27.07.2026 считали свои проверочные покупки выручкой. Линия на
  // их границе падает не потому, что деньги ушли, а потому что их перестали
  // приписывать. Без подписи это читается как обвал — а Δ за окно уже читается
  // как убыток.
  // Линия рисуется по деньгам СНАРУЖИ на каждой точке: у снимков до правки
  // internalUsd досчитан по датам заказов, поэтому ступеньки нет — она была
  // артефактом того, что в старых точках свои покупки сидели внутри суммы.
  // Логика вынесена в externalRevenueAt и покрыта тестом на реальных строках
  // из прод-таблицы: вычитание внутри JSX уже дважды за день давало дефект,
  // который ловился только глазами на задеплоенной странице.
  const externalAt = externalRevenueAt;
  // Подпись остаётся, только пока есть точки, для которых свои покупки НЕ
  // досчитаны: там линия по-прежнему завышена, и молчать об этом нельзя.
  const unresolved = series.filter((p) => p.includesInternal && p.internalUsd == null).length;
  const externalFirst = series.length ? externalAt(series[0]) : 0;
  const externalLast = series.length ? externalAt(series[series.length - 1]) : 0;
  const externalChange = Math.round((externalLast - externalFirst) * 100) / 100;
  const externalGrowthPct =
    externalFirst === 0
      ? externalLast > 0
        ? 100
        : 0
      : Math.round(((externalLast - externalFirst) / externalFirst) * 10000) / 100;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Тренд выручки <span className="ml-2 text-xs text-emerald-400 normal-case">(снапшоты · 90 дней)</span>
        </h2>
        <button onClick={capture} disabled={capturing}
          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50">
          {capturing ? "Снимаю…" : "📸 Снять снапшот"}
        </button>
      </div>

      {note && (
        <div className={`mb-3 text-xs rounded-lg px-3 py-2 border ${note.startsWith("✓") ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
          {note}
        </div>
      )}

      {unresolved > 0 && (
        <div className="mb-3 text-xs rounded-lg px-3 py-2 border bg-amber-500/10 border-amber-500/30 text-amber-200">
          У {unresolved} точек свои проверочные покупки не досчитаны — там линия
          завышена на их сумму. Досчитать: POST /api/revenue/snapshots/backfill-internal.
        </div>
      )}

      {loading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-sm text-gray-500 animate-pulse">Загружаем тренд…</div>
      ) : series.length < 2 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-sm text-gray-500">
          {series.length === 1
            ? "Есть 1 снапшот — сними ещё один позже, чтобы построить линию тренда."
            : "Снапшотов пока нет. Нажми «Снять снапшот», чтобы зафиксировать первую точку. Периодические снапшоты (cron → POST /api/revenue/snapshot) построят историю."}
        </div>
      ) : (
        <div className="bg-gray-900 border border-emerald-500/20 rounded-xl p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div>
              <div className="text-xs text-gray-400 mb-1">Снаружи сейчас</div>
              <div className="text-2xl font-semibold text-white">
                ${(series.length ? externalAt(series[series.length - 1]) : 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Δ снаружи за окно</div>
              <div className={`text-2xl font-semibold ${externalChange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {externalChange >= 0 ? "+" : ""}${externalChange.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Рост снаружи</div>
              <div className={`text-2xl font-semibold ${externalGrowthPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {externalGrowthPct >= 0 ? "▲" : "▼"} {Math.abs(externalGrowthPct).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Продаж (Δ)</div>
              <div className="text-2xl font-semibold text-white">
                {trend?.latest?.saleCount ?? 0}
                <span className={`text-sm ml-2 ${(change?.saleCount ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {(change?.saleCount ?? 0) >= 0 ? "+" : ""}{change?.saleCount ?? 0}
                </span>
              </div>
            </div>
          </div>
          <Sparkline points={series.map(externalAt)} />
          <div className="flex justify-between text-[10px] text-gray-500 mt-1.5 font-mono">
            <span>{trend?.first ? new Date(trend.first.capturedAt).toLocaleDateString("ru") : ""}</span>
            <span>{trend?.points ?? 0} точек</span>
            <span>{trend?.latest ? new Date(trend.latest.capturedAt).toLocaleDateString("ru") : ""}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const W = 640, H = 80, PAD = 4;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const dx = (W - PAD * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = PAD + i * dx;
    const y = PAD + (H - PAD * 2) * (1 - (p - min) / span);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD} L${coords[0][0].toFixed(1)},${H - PAD} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="revTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#revTrendFill)" />
      <path d={line} fill="none" stroke="rgb(52 211 153)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="rgb(16 185 129)" />
      ))}
    </svg>
  );
}

// Literal class names (not interpolated) so Tailwind's scanner always picks them up.
const SKELETON_GRID_COLS: Record<number, string> = {
  2: "grid grid-cols-1 sm:grid-cols-2 gap-4",
  3: "grid grid-cols-2 sm:grid-cols-3 gap-4",
  4: "grid grid-cols-2 sm:grid-cols-4 gap-4",
};

function SkeletonGrid({ cols }: { cols: number }) {
  return (
    <div className={SKELETON_GRID_COLS[cols] ?? SKELETON_GRID_COLS[3]}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-[88px] animate-pulse" />
      ))}
    </div>
  );
}

function GoalBar({ label, target, current, colorClass, eta, lang = "en" }: { label: string; target: number; current: number; colorClass: string; eta?: string | null; lang?: NumLang }) {
  const [exact, setExact] = useState(false);
  const pct = Math.min(100, (current / target) * 100);
  const remaining = Math.max(0, target - current);
  const reached = pct >= 100;
  const currentStr = exact ? `$${fmtNum(current, lang, { maximumFractionDigits: 2 })}` : formatCompactUsd(current, lang);
  const remainingStr = exact ? `$${fmtNum(remaining, lang, { maximumFractionDigits: 2 })}` : formatCompactUsd(remaining, lang);

  // Pulse for a short celebration window, then settle into a plain static
  // glow — an indefinite animate-pulse reads as "something's wrong" to a
  // visitor who reopens the page months after the goal was actually hit.
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!reached) { setCelebrating(false); return; }
    setCelebrating(true);
    const t = setTimeout(() => setCelebrating(false), 10_000);
    return () => clearTimeout(t);
  }, [reached]);

  return (
    <div
      className={`bg-gray-900 border rounded-xl p-5 transition-shadow ${
        reached
          ? `border-emerald-400/60 shadow-[0_0_24px_rgba(52,211,153,0.35)]${celebrating ? " animate-pulse" : ""}`
          : "border-gray-800"
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-medium text-gray-300">{label}</div>
        <div className="text-xs text-gray-500 font-mono">{pct >= 0.1 ? pct.toFixed(1) : pct.toFixed(4)}%</div>
      </div>
      <div className="h-2.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${pct > 0 ? Math.max(pct, 0.6) : 0}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => setExact((v) => !v)}
        className="w-full flex items-baseline justify-between mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        title={exact ? "Скрыть точную сумму" : "Показать точную сумму"}
      >
        <span>{currentStr} собрано</span>
        <span>осталось {remainingStr}</span>
      </button>
      {eta && <div className="mt-1.5 text-[11px] text-emerald-400/80">{eta}</div>}
    </div>
  );
}

function ProviderBadge({ name, ok, sandbox, primary }: { name: string; ok?: boolean; sandbox?: boolean; primary?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${ok ? "bg-green-500/10 text-green-400 border-green-500/30" : primary ? "bg-pink-500/10 text-pink-400 border-pink-500/30" : "bg-gray-800 text-gray-500 border-gray-700"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-400" : primary ? "bg-pink-400" : "bg-gray-600"}`} />
      {name}{sandbox && ok ? " ·sandbox" : ""}{primary && !ok ? " ·setup" : ""}
    </div>
  );
}

function AppCard({ app }: { app: { appId: string; appName: string; channels: string[]; color: string } }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: app.color }} />
        <span className="text-sm font-medium text-white">{app.appName}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {app.channels.map((ch) => (
          <span key={ch} className={`text-xs px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[ch] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
            {CHANNEL_LABELS[ch] ?? ch}
          </span>
        ))}
      </div>
    </div>
  );
}

function GumroadSetupCard({ full }: { full?: boolean }) {
  return (
    <div className={`bg-gray-900 border border-pink-500/20 rounded-xl p-5 ${full ? "" : "text-sm"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-pink-300 mb-1">Gumroad не настроен</div>
          <div className="text-gray-400 text-sm mb-3">
            Gumroad — единственный живой процессинг (Stripe/Paddle/LemonSqueezy не прошли KYC).
            Merchant of Record, без US entity, вывод через Payoneer на KZ
            <span className="text-emerald-400"> (аккаунт Payoneer одобрен ✓)</span>.
          </div>
          {full && (
            <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
              <li>Зайди на <strong className="text-white">gumroad.com</strong> → Settings → Advanced → Applications</li>
              <li>Generate application → скопируй <strong className="text-white">access token</strong></li>
              <li>Railway → Variables → <code className="bg-gray-800 px-1 rounded text-pink-200">GUMROAD_ACCESS_TOKEN</code> = токен</li>
              <li>Атрибуция: <code className="bg-gray-800 px-1 rounded text-pink-200">GUMROAD_APP_&lt;PERMALINK&gt;</code> = appId</li>
              <li>Проверь: <code className="bg-gray-800 px-1 rounded text-gray-300">/api/revenue/gumroad/balance</code></li>
            </ol>
          )}
        </div>
        <a
          href="https://gumroad.com/settings/advanced"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs px-4 py-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-colors whitespace-nowrap"
        >
          Открыть Gumroad →
        </a>
      </div>
    </div>
  );
}
