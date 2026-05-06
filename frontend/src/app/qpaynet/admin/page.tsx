"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReconcileSummary {
  ok: boolean;
  drift_tiin: string;
  negative_wallet_count: number;
  checked_at: string;
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

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) {
      setAuthed("anon");
      return;
    }
    void loadAll(t);
  }, []);

  async function loadAll(t: string) {
    try {
      const headers = { Authorization: `Bearer ${t}` };
      const [rec, pay, kycR, stuck] = await Promise.all([
        fetch("/api/qpaynet/admin/reconcile", { headers }),
        fetch("/api/qpaynet/admin/payouts/stats", { headers }),
        fetch("/api/qpaynet/admin/kyc/pending", { headers }).catch(() => null),
        fetch("/api/qpaynet/admin/webhook-deliveries?status=stuck&limit=200", { headers }),
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
    } catch {
      // network errors fall through to base state
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

  const tiles: Tile[] = [
    reconcileTile,
    deliveriesTile,
    refundTile,
    freezeTile,
    payoutsTile,
    kycTile,
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
        <div className="space-y-1">
          <h2 className="text-2xl font-black">Operations dashboard</h2>
          <p className="text-sm text-slate-500">
            Шесть инструментов для удержания сети в платёжно-готовом состоянии.
          </p>
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
