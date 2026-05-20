"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

interface RevenueOverview {
  totalApps: number;
  liveApps: number;
  channelCoverage: Record<string, number>;
  providers: {
    paddle: { configured: boolean; sandbox: boolean };
    youtube: { configured: boolean };
    twitch: { configured: boolean };
    paybox?: { configured: boolean };
  };
  apps: { appId: string; appName: string; channels: string[]; color: string }[];
}

interface PaddleRecent {
  transactions: { id: string; appId: string; amountUsd: number; currency: string; status: string; date: string }[];
  byApp: Record<string, { count: number; totalUsd: number }>;
  sandbox?: boolean;
  stub?: boolean;
  message?: string;
  setupGuide?: string;
}

interface PaddleBalance {
  totalUsd?: number;
  currency?: string;
  sandbox?: boolean;
  transactionCount?: number;
  stub?: boolean;
  message?: string;
  setupGuide?: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  paddle_subscription: "Paddle Sub",
  paddle_onetime: "Paddle Pay",
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
  paddle_subscription: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  paddle_onetime: "bg-blue-400/20 text-blue-200 border-blue-400/30",
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
  const [balance, setBalance] = useState<PaddleBalance | null>(null);
  const [recent, setRecent] = useState<PaddleRecent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/revenue/overview")).then((r) => r.json()).catch(() => null),
      fetch(apiUrl("/api/revenue/paddle/balance")).then((r) => r.json()).catch(() => null),
      fetch(apiUrl("/api/revenue/paddle/recent")).then((r) => r.json()).catch(() => null),
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
  const paddleConfigured = providers?.paddle?.configured;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/60 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">AEVION Revenue Hub</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Paddle · PayBox · YouTube · Twitch · {overview?.liveApps ?? 0} приложений live
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <ProviderBadge name="Paddle" ok={providers?.paddle?.configured} sandbox={providers?.paddle?.sandbox} />
            <ProviderBadge name="PayBox" ok={providers?.paybox?.configured} />
            <ProviderBadge name="YouTube" ok={providers?.youtube?.configured} />
            <ProviderBadge name="Twitch" ok={providers?.twitch?.configured} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Paddle Balance */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Paddle Balance {balance?.sandbox && <span className="ml-2 text-xs text-amber-400 normal-case">(sandbox)</span>}
          </h2>
          {balance?.stub ? (
            <PaddleSetupCard />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Завершённые транзакции</div>
                <div className="text-3xl font-semibold text-white">
                  ${(balance?.totalUsd ?? 0).toFixed(2)}
                  <span className="text-sm text-gray-400 ml-2">USD</span>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-400 mb-2">Всего транзакций</div>
                <div className="text-3xl font-semibold text-white">{balance?.transactionCount ?? 0}</div>
              </div>
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        {paddleConfigured && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Последние транзакции</h2>
            {recent?.stub ? (
              <div className="bg-gray-900 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400">Paddle не настроен</div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {(recent?.transactions ?? []).length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">Нет транзакций пока</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs">
                        <th className="text-left px-4 py-2.5">ID</th>
                        <th className="text-left px-4 py-2.5">Приложение</th>
                        <th className="text-left px-4 py-2.5">Сумма</th>
                        <th className="text-left px-4 py-2.5">Статус</th>
                        <th className="text-left px-4 py-2.5">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recent?.transactions ?? []).map((t) => (
                        <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-2 font-mono text-xs text-gray-400">{t.id.slice(0, 16)}…</td>
                          <td className="px-4 py-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{t.appId}</span>
                          </td>
                          <td className="px-4 py-2 font-medium">${t.amountUsd.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{t.date ? new Date(t.date).toLocaleDateString("ru") : "—"}</td>
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
        {paddleConfigured && recent && !recent.stub && Object.keys(recent.byApp ?? {}).length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">По приложениям</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(recent.byApp).map(([appId, data]) => (
                <div key={appId} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{appId}</div>
                  <div className="text-lg font-semibold text-white">${data.totalUsd.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{data.count} транзакций</div>
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
        {!paddleConfigured && <PaddleSetupCard full />}
      </div>
    </div>
  );
}

function ProviderBadge({ name, ok, sandbox }: { name: string; ok?: boolean; sandbox?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${ok ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-gray-800 text-gray-500 border-gray-700"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-400" : "bg-gray-600"}`} />
      {name}{sandbox && ok ? " ·sandbox" : ""}
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

function PaddleSetupCard({ full }: { full?: boolean }) {
  return (
    <div className={`bg-gray-900 border border-amber-500/20 rounded-xl p-5 ${full ? "" : "text-sm"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-amber-300 mb-1">Paddle не настроен</div>
          <div className="text-gray-400 text-sm mb-3">
            Paddle — лучшая замена Stripe для Казахстана. Merchant of Record, выплаты на KZ банк, не нужен US entity.
          </div>
          {full && (
            <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
              <li>Зарегистрируйся на <strong className="text-white">paddle.com</strong> (Individual + Kazakhstan)</li>
              <li>Dashboard → Developer → Authentication → Generate API Key</li>
              <li>Railway → Variables → <code className="bg-gray-800 px-1 rounded text-amber-200">PADDLE_API_KEY</code> = ключ</li>
              <li>Railway → Variables → <code className="bg-gray-800 px-1 rounded text-amber-200">PADDLE_SANDBOX</code> = true</li>
              <li>Проверь: <code className="bg-gray-800 px-1 rounded text-gray-300">/api/paddle/health</code></li>
            </ol>
          )}
        </div>
        <a
          href="https://paddle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
        >
          Открыть Paddle →
        </a>
      </div>
    </div>
  );
}
