"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

interface RevenueOverview {
  totalApps: number;
  liveApps: number;
  channelCoverage: Record<string, number>;
  providers: {
    gumroad?: { configured: boolean; primary: boolean };
    paddle: { configured: boolean; sandbox: boolean };
    youtube: { configured: boolean };
    twitch: { configured: boolean };
    paybox?: { configured: boolean };
  };
  apps: { appId: string; appName: string; channels: string[]; color: string }[];
}

interface GumroadRecent {
  sales: {
    id: string;
    appId: string;
    product: string;
    email: string | null;
    amountUsd: number;
    currency: string;
    refunded: boolean;
    date: string | null;
  }[];
  byApp: Record<string, { count: number; totalUsd: number }>;
  stub?: boolean;
  message?: string;
}

interface GumroadBalance {
  grossUsd?: number;
  feesUsd?: number;
  netUsd?: number;
  currency?: string;
  saleCount?: number;
  refundedCount?: number;
  stub?: boolean;
  message?: string;
  setupGuide?: string;
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

export default function RevenuePage() {
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [balance, setBalance] = useState<GumroadBalance | null>(null);
  const [recent, setRecent] = useState<GumroadRecent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/revenue/overview")).then((r) => r.json()).catch(() => null),
      fetch(apiUrl("/api/revenue/gumroad/balance")).then((r) => r.json()).catch(() => null),
      fetch(apiUrl("/api/revenue/gumroad/recent")).then((r) => r.json()).catch(() => null),
    ]).then(([ov, bal, rec]) => {
      setOverview(ov);
      setBalance(bal);
      setRecent(rec);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Загружаем Revenue Hub...</div>
      </div>
    );
  }

  const providers = overview?.providers;
  const gumroadConfigured = providers?.gumroad?.configured;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/60 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">AEVION Revenue Hub</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Gumroad · PayBox · YouTube · Twitch · {overview?.liveApps ?? 0} приложений live
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <ProviderBadge name="Gumroad" ok={providers?.gumroad?.configured} primary />
            <ProviderBadge name="PayBox" ok={providers?.paybox?.configured} />
            <ProviderBadge name="YouTube" ok={providers?.youtube?.configured} />
            <ProviderBadge name="Twitch" ok={providers?.twitch?.configured} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Gumroad Balance */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Gumroad Balance <span className="ml-2 text-xs text-pink-400 normal-case">(live)</span>
          </h2>
          {balance?.stub ? (
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
                <div className="text-3xl font-semibold text-gray-400">${(balance?.feesUsd ?? 0).toFixed(2)}</div>
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

        {/* Recent Sales */}
        {gumroadConfigured && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Последние продажи</h2>
            {recent?.stub ? (
              <div className="bg-gray-900 border border-pink-500/20 rounded-xl p-4 text-sm text-pink-400">Gumroad не настроен</div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {(recent?.sales ?? []).length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">Нет продаж пока</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs">
                        <th className="text-left px-4 py-2.5">Продукт</th>
                        <th className="text-left px-4 py-2.5">Приложение</th>
                        <th className="text-left px-4 py-2.5">Сумма</th>
                        <th className="text-left px-4 py-2.5">Статус</th>
                        <th className="text-left px-4 py-2.5">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recent?.sales ?? []).map((s) => (
                        <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-gray-200">{s.product}</td>
                          <td className="px-4 py-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{s.appId}</span>
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

        {/* By-App breakdown */}
        {gumroadConfigured && recent && !recent.stub && Object.keys(recent.byApp ?? {}).length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">По приложениям</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(recent.byApp).map(([appId, data]) => (
                <div key={appId} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{appId}</div>
                  <div className="text-lg font-semibold text-white">${data.totalUsd.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{data.count} продаж</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Apps Registry */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Реестр приложений ({overview?.apps.length ?? 0})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(overview?.apps ?? []).map((app) => (
              <AppCard key={app.appId} app={app} />
            ))}
          </div>
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
        {!gumroadConfigured && <GumroadSetupCard full />}
      </div>
    </div>
  );
}

interface TrendPoint { capturedAt: string; netUsd: number; grossUsd: number; saleCount: number }
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
      } else {
        setNote(`✗ ${j.error ?? "snapshot_failed"}`);
      }
    } catch { setNote("✗ Network error"); }
    finally { setCapturing(false); }
  };

  const series = trend?.series ?? [];
  const change = trend?.change;

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
              <div className="text-xs text-gray-400 mb-1">Net сейчас</div>
              <div className="text-2xl font-semibold text-white">${(trend?.latest?.netUsd ?? 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Δ Net за окно</div>
              <div className={`text-2xl font-semibold ${(change?.netUsd ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {(change?.netUsd ?? 0) >= 0 ? "+" : ""}${(change?.netUsd ?? 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Рост Net</div>
              <div className={`text-2xl font-semibold ${(change?.netGrowthPct ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {(change?.netGrowthPct ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(change?.netGrowthPct ?? 0).toFixed(1)}%
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
          <Sparkline points={series.map((s) => s.netUsd)} />
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
      <div className="flex items-start justify-between gap-4">
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
