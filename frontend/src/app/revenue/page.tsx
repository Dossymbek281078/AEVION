"use client";

import { useEffect, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface RevenueOverview {
  totalApps: number;
  liveApps: number;
  channelCoverage: Record<string, number>;
  providers: {
    stripe: { configured: boolean };
    youtube: { configured: boolean };
    twitch: { configured: boolean };
  };
  apps: {
    appId: string;
    appName: string;
    channels: string[];
    color: string;
  }[];
}

interface StripeBalance {
  available?: { amount: number; currency: string }[];
  pending?: { amount: number; currency: string }[];
  stub?: boolean;
  message?: string;
}

interface StripeRecent {
  payments: { id: string; appId: string; amountUsd: number; currency: string; status: string; date: string }[];
  byApp: Record<string, { count: number; totalUsd: number }>;
  stub?: boolean;
}

const CHANNEL_LABELS: Record<string, string> = {
  stripe_subscription: "Stripe Sub",
  stripe_onetime: "Stripe Pay",
  paybox: "PayBox",
  kaspi: "Kaspi",
  youtube_adsense: "YouTube",
  twitch_affiliate: "Twitch",
  twitch_partner: "Twitch+",
  in_app_purchase: "In-App",
  donation: "Donation",
  course_sale: "Courses",
  marketplace: "Market",
};

const CHANNEL_COLORS: Record<string, string> = {
  stripe_subscription: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  stripe_onetime: "bg-violet-500/20 text-violet-300 border-violet-500/30",
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
  const [balance, setBalance] = useState<StripeBalance | null>(null);
  const [recent, setRecent] = useState<StripeRecent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = BACKEND ? `${BACKEND}/api/revenue` : "/api/revenue";
    Promise.all([
      fetch(`${base}/overview`).then((r) => r.json()).catch(() => null),
      fetch(`${base}/stripe/balance`).then((r) => r.json()).catch(() => null),
      fetch(`${base}/stripe/recent`).then((r) => r.json()).catch(() => null),
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/60 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">AEVION Revenue Hub</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Централизованная монетизация · {overview?.liveApps ?? 0} приложений live
            </p>
          </div>
          <div className="flex gap-2">
            <ProviderBadge name="Stripe" ok={providers?.stripe.configured} />
            <ProviderBadge name="YouTube" ok={providers?.youtube.configured} />
            <ProviderBadge name="Twitch" ok={providers?.twitch.configured} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stripe Balance */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Stripe Balance</h2>
          {balance?.stub ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-amber-400">
              {balance.message || "STRIPE_SECRET_KEY не настроен. Добавьте в Railway → Variables."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <BalanceCard
                label="Доступно"
                items={balance?.available ?? []}
              />
              <BalanceCard
                label="В ожидании"
                items={balance?.pending ?? []}
              />
            </div>
          )}
        </section>

        {/* Recent Stripe Payments */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Последние платежи</h2>
          {recent?.stub ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-amber-400">
              Stripe не настроен
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {(recent?.payments ?? []).length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Нет платежей</div>
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
                    {(recent?.payments ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-2 font-mono text-xs text-gray-400">{p.id.slice(0, 14)}…</td>
                        <td className="px-4 py-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{p.appId}</span>
                        </td>
                        <td className="px-4 py-2 font-medium">${p.amountUsd.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "succeeded" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{new Date(p.date).toLocaleDateString("ru")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {/* By-App breakdown */}
        {recent && !recent.stub && Object.keys(recent.byApp ?? {}).length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">По приложениям</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(recent.byApp).map(([appId, data]) => (
                <div key={appId} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{appId}</div>
                  <div className="text-lg font-semibold text-white">${data.totalUsd.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{data.count} платежей</div>
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
        <SetupGuide providers={providers} />
      </div>
    </div>
  );
}

function ProviderBadge({ name, ok }: { name: string; ok?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${ok ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-gray-800 text-gray-500 border-gray-700"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-400" : "bg-gray-600"}`} />
      {name}
    </div>
  );
}

function BalanceCard({ label, items }: { label: string; items: { amount: number; currency: string }[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-600">—</div>
      ) : (
        items.map((item, i) => (
          <div key={i} className="text-2xl font-semibold text-white">
            {(item.amount / 100).toFixed(2)} <span className="text-sm text-gray-400 uppercase">{item.currency}</span>
          </div>
        ))
      )}
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

function SetupGuide({ providers }: { providers?: { stripe: { configured: boolean }; youtube: { configured: boolean }; twitch: { configured: boolean } } }) {
  const missing = [
    !providers?.stripe.configured && { key: "STRIPE_SECRET_KEY", label: "Stripe", url: "https://dashboard.stripe.com/apikeys", hint: "Developers → API keys → Secret key" },
    !providers?.youtube.configured && { key: "YOUTUBE_API_KEY", label: "YouTube", url: "https://console.cloud.google.com/apis/credentials", hint: "APIs → YouTube Data API v3 → API Key" },
    !providers?.twitch.configured && { key: "TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET", label: "Twitch", url: "https://dev.twitch.tv/console/apps", hint: "Register App → Client ID + Secret" },
  ].filter(Boolean) as { key: string; label: string; url: string; hint: string }[];

  if (missing.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Настройка доступов</h2>
      <div className="space-y-2">
        {missing.map((m) => (
          <div key={m.key} className="bg-gray-900 border border-amber-500/20 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-amber-300">{m.label} — не настроен</div>
              <div className="text-xs text-gray-400 mt-1">
                Railway → Variables → <code className="bg-gray-800 px-1 rounded text-amber-200">{m.key}</code>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{m.hint}</div>
            </div>
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              Открыть →
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
