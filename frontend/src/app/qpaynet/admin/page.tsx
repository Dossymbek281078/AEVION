"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reportError } from "@/lib/reporter";

interface ReconcileSummary {
  ok: boolean;
  drift_tiin: string;
  negative_wallet_count: number;
  checked_at: string;
}

interface Analytics {
  days: number;
  refundsByDay: Array<{ day: string; count: number; totalKzt: number }>;
  deliveriesByDay: Array<{ day: string; delivered: number; stuck: number; total: number }>;
  wallets: { active: number; frozen: number; closed: number; total: number };
}

function Sparkline({
  values,
  color,
  height = 28,
  width = 120,
}: {
  values: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  if (values.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const max = Math.max(...values, 1);
  const step = values.length === 1 ? width : width / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

interface PayoutsStats {
  requested?: { count: number; totalKzt: number };
  approved?: { count: number; totalKzt: number };
}

interface KycPending {
  count?: number;
}

interface Tile {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  badge?: { text: string; className: string };
  borderClass?: string;
}

interface LiveEvent {
  kind: string;
  at: string;
  by?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

const EVENT_LABEL: Record<string, { label: string; chip: string }> = {
  refund_issued: { label: "REFUND", chip: "bg-red-900 text-red-300" },
  wallet_frozen: { label: "FROZEN", chip: "bg-cyan-900 text-cyan-300" },
  wallet_unfrozen: { label: "UNFROZEN", chip: "bg-emerald-900 text-emerald-300" },
  delivery_force_retry: { label: "RETRY", chip: "bg-violet-900 text-violet-300" },
  drift_alert: { label: "DRIFT 🚨", chip: "bg-red-900 text-red-300 font-bold" },
};

function describeEvent(ev: LiveEvent): string {
  const d = ev.data ?? {};
  switch (ev.kind) {
    case "refund_issued":
      return `${d.amountKzt?.toLocaleString?.("ru-RU") ?? d.amountKzt} ₸ · ${d.reason ?? ""}`;
    case "wallet_frozen":
    case "wallet_unfrozen":
      return `${(d.walletId ?? "").slice(0, 8)}… · ${d.reason ?? ""}`;
    case "delivery_force_retry":
      return `delivery ${(d.deliveryId ?? "").slice(0, 8)}…`;
    case "drift_alert":
      return `${d.drift_kzt} ₸ drift · ${d.negative_wallet_count} neg wallets`;
    default:
      return JSON.stringify(d);
  }
}

function fmtTiin(t: string): string {
  try {
    const tiin = BigInt(t);
    const zero = BigInt(0);
    const sign = tiin < zero ? "−" : tiin > zero ? "+" : "";
    const abs = tiin < zero ? -tiin : tiin;
    return sign + (Number(abs) / 100).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}

export default function AdminIndexPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState<"loading" | "ok" | "denied" | "anon">("loading");
  const [reconcile, setReconcile] = useState<ReconcileSummary | null>(null);
  const [payouts, setPayouts] = useState<PayoutsStats | null>(null);
  const [kyc, setKyc] = useState<KycPending | null>(null);
  const [stuckCount, setStuckCount] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [live, setLive] = useState<LiveEvent[]>([]);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "open" | "closed" | "error">(
    "connecting",
  );

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) {
      setAuthed("anon");
      return;
    }
    void loadAll(t);
  }, []);

  useEffect(() => {
    if (authed !== "ok" || !token) return;
    const url = `/api/qpaynet/admin/events?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(url);
    } catch {
      setLiveStatus("error");
      return;
    }
    es.onopen = () => setLiveStatus("open");
    es.onerror = () => setLiveStatus("error");
    const handle = (kind: string) => (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as LiveEvent;
        ev.kind = kind as LiveEvent["kind"];
        setLive(prev => [ev, ...prev].slice(0, 40));
      } catch {
        // ignore malformed payload
      }
    };
    for (const kind of [
      "refund_issued",
      "wallet_frozen",
      "wallet_unfrozen",
      "delivery_force_retry",
      "drift_alert",
    ]) {
      es.addEventListener(kind, handle(kind) as EventListener);
    }
    return () => {
      setLiveStatus("closed");
      es?.close();
    };
  }, [authed, token]);

  async function loadAll(t: string) {
    try {
      const headers = { Authorization: `Bearer ${t}` };
      const [rec, pay, kycR, stuck, ana] = await Promise.all([
        fetch("/api/qpaynet/admin/reconcile", { headers }),
        fetch("/api/qpaynet/admin/payouts/stats", { headers }),
        fetch("/api/qpaynet/admin/kyc/pending", { headers }).catch(() => null),
        fetch("/api/qpaynet/admin/webhook-deliveries?status=stuck&limit=200", { headers }),
        fetch("/api/qpaynet/admin/analytics?days=30", { headers }),
      ]);
      if (rec.status === 403) {
        setAuthed("denied");
        return;
      }
      setAuthed("ok");
      if (rec.ok) setReconcile(await rec.json());
      if (pay.ok) {
        const d = await pay.json();
        setPayouts(d.stats ?? {});
      }
      if (kycR && kycR.ok) {
        const d = await kycR.json();
        setKyc({ count: Array.isArray(d.items) ? d.items.length : d.count });
      }
      if (stuck.ok) {
        const d = await stuck.json();
        setStuckCount((d.items ?? []).length);
      }
      if (ana.ok) setAnalytics(await ana.json());
    } catch (err) {
      reportError(err, "qpaynet/admin");
    }
  }

  if (authed === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-500 text-sm">Загрузка...</p>
      </div>
    );
  }

  if (authed === "anon") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Войдите как админ.</p>
      </div>
    );
  }

  if (authed === "denied") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-4xl">🚫</div>
          <h1 className="text-xl font-bold">Доступ запрещён</h1>
          <p className="text-sm text-slate-400">
            Этот пользователь не входит в список админов QPayNet. Добавьте свой email в
            переменную <code className="bg-slate-900 px-1.5 py-0.5 rounded">QPAYNET_ADMIN_EMAILS</code>{" "}
            на бэкенде.
          </p>
          <Link
            href="/qpaynet"
            className="inline-block mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
          >
            ← Назад в QPayNet
          </Link>
        </div>
      </div>
    );
  }

  const reconcileTile: Tile = (() => {
    if (!reconcile) {
      return {
        href: "/qpaynet/admin/reconcile",
        emoji: "📊",
        title: "Reconciliation",
        desc: "Money supply equation, drift detection, breakdown по типам.",
      };
    }
    const drift = BigInt(reconcile.drift_tiin);
    const negCount = reconcile.negative_wallet_count;
    if (drift === BigInt(0) && negCount === 0) {
      return {
        href: "/qpaynet/admin/reconcile",
        emoji: "📊",
        title: "Reconciliation",
        desc: `Drift = 0 ₸ · Wallets OK · Last check: ${new Date(
          reconcile.checked_at,
        ).toLocaleTimeString("ru-RU")}`,
        badge: { text: "✓ HEALTHY", className: "bg-emerald-900 text-emerald-300" },
        borderClass: "border-emerald-800/40",
      };
    }
    return {
      href: "/qpaynet/admin/reconcile",
      emoji: "🚨",
      title: "Reconciliation",
      desc: `Drift: ${fmtTiin(reconcile.drift_tiin)} ₸${
        negCount > 0 ? ` · ${negCount} negative wallet(s)` : ""
      }`,
      badge: { text: "⚠ DRIFT", className: "bg-red-900 text-red-300" },
      borderClass: "border-red-800/60",
    };
  })();

  const payoutsTile: Tile = {
    href: "/qpaynet/admin/payouts",
    emoji: "💸",
    title: "Payouts",
    desc: payouts
      ? `Запрошено: ${payouts.requested?.count ?? 0} · Одобрено: ${
          payouts.approved?.count ?? 0
        }`
      : "Одобрение и подтверждение выплат на карты / банк / Kaspi.",
    badge:
      payouts && (payouts.requested?.count ?? 0) > 0
        ? {
            text: `${payouts.requested?.count} new`,
            className: "bg-amber-900 text-amber-300",
          }
        : undefined,
  };

  const kycTile: Tile = {
    href: "/qpaynet/admin/kyc",
    emoji: "🪪",
    title: "KYC",
    desc: "Подтверждение soft-KYC: документы, лимиты, threshold.",
    badge:
      kyc && (kyc.count ?? 0) > 0
        ? { text: `${kyc.count} pending`, className: "bg-amber-900 text-amber-300" }
        : undefined,
  };

  const refundTile: Tile = {
    href: "/qpaynet/admin/refund",
    emoji: "↩",
    title: "Refund",
    desc: "Возврат deposit / transfer_in / merchant_charge с аудит-цепочкой.",
  };

  const freezeTile: Tile = {
    href: "/qpaynet/admin/freeze",
    emoji: "🧊",
    title: "Freeze / Unfreeze",
    desc: "Блокировка кошелька при fraud / chargeback / KYC-споре.",
  };

  const deliveriesTile: Tile = {
    href: "/qpaynet/admin/webhook-deliveries",
    emoji: "📡",
    title: "Webhook deliveries",
    desc:
      stuckCount != null
        ? `Stuck: ${stuckCount}`
        : "Триаж pending / stuck доставок, force-retry.",
    badge:
      stuckCount && stuckCount > 0
        ? { text: `${stuckCount} stuck`, className: "bg-red-900 text-red-300" }
        : undefined,
    borderClass: stuckCount && stuckCount > 0 ? "border-red-800/60" : undefined,
  };

  const auditTile: Tile = {
    href: "/qpaynet/admin/audit",
    emoji: "📜",
    title: "Audit log",
    desc: "Кросс-овнерская immutable-история действий: фильтр по action / owner.",
  };

  const tiles: Tile[] = [
    reconcileTile,
    deliveriesTile,
    refundTile,
    freezeTile,
    payoutsTile,
    kycTile,
    auditTile,
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">⚙ Admin</h1>
        </div>
        <button
          onClick={() => void loadAll(token)}
          className="text-xs text-slate-400 hover:text-white"
        >
          ↻
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <h2 className="text-2xl font-black">Operations dashboard</h2>
            <p className="text-sm text-slate-500">
              Семь инструментов для удержания сети в платёжно-готовом состоянии.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                liveStatus === "open"
                  ? "bg-emerald-400 animate-pulse"
                  : liveStatus === "error"
                  ? "bg-red-500"
                  : "bg-slate-500"
              }`}
            />
            <span className="text-slate-400">
              Live:{" "}
              {liveStatus === "open"
                ? "подключено"
                : liveStatus === "connecting"
                ? "соединение..."
                : liveStatus === "error"
                ? "разорвано"
                : "закрыто"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tiles.map(t => (
            <Link
              key={t.href}
              href={t.href}
              className={`block p-5 rounded-xl bg-slate-900 border transition-colors hover:bg-slate-800/60 hover:border-slate-700 ${
                t.borderClass ?? "border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-2xl">{t.emoji}</div>
                {t.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${t.badge.className}`}
                  >
                    {t.badge.text}
                  </span>
                )}
              </div>
              <div className="text-base font-bold mb-1">{t.title}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{t.desc}</div>
            </Link>
          ))}
        </div>

        {analytics && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              📈 30-day analytics
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Refunds (count / day)
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline
                    values={analytics.refundsByDay.map(r => r.count)}
                    color="#f87171"
                  />
                  <div className="text-sm">
                    <div className="font-bold">
                      {analytics.refundsByDay.reduce((s, r) => s + r.count, 0)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {analytics.refundsByDay
                        .reduce((s, r) => s + r.totalKzt, 0)
                        .toLocaleString("ru-RU", { maximumFractionDigits: 0 })}{" "}
                      ₸
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Webhook delivery success
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline
                    values={analytics.deliveriesByDay.map(d =>
                      d.total === 0 ? 0 : (d.delivered / d.total) * 100,
                    )}
                    color="#34d399"
                  />
                  <div className="text-sm">
                    {(() => {
                      const total = analytics.deliveriesByDay.reduce((s, r) => s + r.total, 0);
                      const delivered = analytics.deliveriesByDay.reduce(
                        (s, r) => s + r.delivered,
                        0,
                      );
                      const rate = total === 0 ? 100 : (delivered / total) * 100;
                      return (
                        <>
                          <div className="font-bold">{rate.toFixed(1)}%</div>
                          <div className="text-[10px] text-slate-500">
                            {delivered}/{total}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Wallets
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-300 font-semibold">
                    active {analytics.wallets.active}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-900 text-cyan-300 font-semibold">
                    frozen {analytics.wallets.frozen}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold">
                    closed {analytics.wallets.closed}
                  </span>
                  <span className="text-slate-500">/ Σ {analytics.wallets.total}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              📡 Live activity
            </div>
            {live.length > 0 && (
              <button
                onClick={() => setLive([])}
                className="text-[10px] text-slate-600 hover:text-slate-400"
              >
                очистить
              </button>
            )}
          </div>
          {live.length === 0 ? (
            <div className="text-xs text-slate-600">
              События появятся здесь по мере действий админа (refund / freeze / retry / drift).
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {live.map((ev, i) => {
                const meta = EVENT_LABEL[ev.kind] ?? {
                  label: ev.kind,
                  chip: "bg-slate-800 text-slate-400",
                };
                return (
                  <div
                    key={`${ev.at}-${i}`}
                    className="flex items-center gap-3 text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
                  >
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-slate-400 truncate flex-1">{describeEvent(ev)}</span>
                    {ev.by && (
                      <span className="text-[10px] font-mono text-slate-600 shrink-0">
                        {ev.by}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {new Date(ev.at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Backend ops cheatsheet
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-slate-300">Reconcile cron:</strong>{" "}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded">
                node scripts/qpaynet-reconcile.mjs
              </code>{" "}
              — exit non-zero on drift; wire to{" "}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded">QPAYNET_ALERT_URL</code>.
            </li>
            <li>
              <strong className="text-slate-300">Webhook backoff:</strong> 30s → 2m → 10m → 30m
              → 2h. Stuck = 5 неудач.
            </li>
            <li>
              <strong className="text-slate-300">Refund idempotency:</strong> POST{" "}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded">/admin/refund</code>{" "}
              принимает <code className="bg-slate-950 px-1.5 py-0.5 rounded">Idempotency-Key</code>;
              двойной вызов отдаёт 409{" "}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded">tx_already_refunded</code>.
            </li>
            <li>
              <strong className="text-slate-300">Smoke:</strong>{" "}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded">
                node scripts/qpaynet-smoke.js
              </code>{" "}
              — 39 секций, прогон ~30s.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
