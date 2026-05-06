"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reportError } from "@/lib/reporter";

interface Reconcile {
  ok: boolean;
  checked_at: string;
  actual_tiin: string;
  expected_tiin: string;
  drift_tiin: string;
  drift_kzt: number;
  negative_wallet_count: number;
  breakdown: {
    deposits_tiin: string | number;
    withdraw_total_tiin: string | number;
    transfer_fees_tiin: string | number;
    merchant_fees_tiin: string | number;
    refunds_tiin: string | number;
  };
}

function fmtTiin(t: string | number): string {
  const tiin = typeof t === "string" ? BigInt(t) : BigInt(Math.round(Number(t)));
  return (Number(tiin) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AdminReconcilePage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Reconcile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    void refresh(t);
  }, []);

  useEffect(() => {
    if (!autoRefresh || !token) return;
    const id = setInterval(() => void refresh(token), 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, token]);

  async function refresh(t: string) {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/qpaynet/admin/reconcile", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (r.status === 403) {
        setError("Не админ. Добавьте email в QPAYNET_ADMIN_EMAILS.");
        return;
      }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      setData(await r.json());
      setLastRefreshed(new Date());
    } catch (err) {
      reportError(err, "qpaynet/admin/reconcile");
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Войдите как админ.</p>
      </div>
    );
  }

  const ZERO = BigInt(0);
  const drift = data ? BigInt(data.drift_tiin) : ZERO;
  const isHealthy = data?.ok === true;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet/admin" className="text-slate-400 hover:text-white text-sm">← Admin</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">📊 Reconciliation</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-violet-600" />
            Auto 30s
          </label>
          <button onClick={() => void refresh(token)} disabled={loading}
            className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-lg text-xs font-semibold">
            {loading ? "..." : "↻ Refresh"}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Big status banner */}
            <div className={`rounded-2xl border p-6 ${
              isHealthy
                ? "bg-emerald-950/30 border-emerald-800"
                : "bg-red-950/30 border-red-800"
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{isHealthy ? "✅" : "🚨"}</span>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider opacity-70">
                    {isHealthy ? "RECONCILED" : "DRIFT DETECTED"}
                  </div>
                  <div className="text-3xl font-black">
                    {drift === ZERO ? "0" : (drift > ZERO ? "+" : "") + fmtTiin(data.drift_tiin)} ₸
                  </div>
                </div>
              </div>
              <div className="text-xs opacity-60">
                Last checked: {new Date(data.checked_at).toLocaleString("ru-RU")}
                {lastRefreshed && ` · Frontend refresh: ${lastRefreshed.toLocaleTimeString("ru-RU")}`}
              </div>
              {!isHealthy && (
                <div className="mt-4 text-sm text-red-200">
                  ⚠ Investigate immediately. Drift = bug or hand-written SQL. Check
                  the breakdown below + recent <Link href="/qpaynet/admin/refund" className="underline">refunds</Link>.
                </div>
              )}
            </div>

            {/* Negative wallet count */}
            {data.negative_wallet_count > 0 && (
              <div className="bg-amber-950/30 border border-amber-800 rounded-xl p-4">
                <div className="text-amber-300 font-bold text-sm">
                  ⚠ {data.negative_wallet_count} wallet(s) have negative balance
                </div>
                <div className="text-xs text-amber-400/70 mt-1">
                  Usually a chargeback in flight. Acceptable for short windows;
                  alert ops if persistent.
                </div>
              </div>
            )}

            {/* Money supply equation */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                Money supply equation
              </div>

              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Actual (Σ wallet balances)</span>
                  <span className="font-bold">{fmtTiin(data.actual_tiin)} ₸</span>
                </div>
                <div className="border-t border-slate-800 my-2" />
                <div className="flex justify-between">
                  <span className="text-slate-400">+ Deposits</span>
                  <span className="text-emerald-400">+{fmtTiin(data.breakdown.deposits_tiin)} ₸</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− Withdrawals (incl. fees)</span>
                  <span className="text-amber-400">−{fmtTiin(data.breakdown.withdraw_total_tiin)} ₸</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− Transfer fees collected</span>
                  <span className="text-amber-400">−{fmtTiin(data.breakdown.transfer_fees_tiin)} ₸</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− Merchant charge fees</span>
                  <span className="text-amber-400">−{fmtTiin(data.breakdown.merchant_fees_tiin)} ₸</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− Refunds issued</span>
                  <span className="text-amber-400">−{fmtTiin(data.breakdown.refunds_tiin)} ₸</span>
                </div>
                <div className="border-t border-slate-800 my-2" />
                <div className="flex justify-between font-bold">
                  <span className="text-slate-400">Expected</span>
                  <span>{fmtTiin(data.expected_tiin)} ₸</span>
                </div>
                <div className="border-t border-slate-800 my-2" />
                <div className="flex justify-between font-bold text-base">
                  <span className={drift === ZERO ? "text-emerald-400" : "text-red-400"}>
                    Drift (Actual − Expected)
                  </span>
                  <span className={drift === ZERO ? "text-emerald-400" : "text-red-400"}>
                    {drift === ZERO ? "0.00" : (drift > ZERO ? "+" : "") + fmtTiin(data.drift_tiin)} ₸
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600">
              Backend cron equivalent: <code className="bg-slate-900 px-1.5 py-0.5 rounded">
                node scripts/qpaynet-reconcile.mjs
              </code> (exits non-zero on drift; wire to ALERT_URL).
            </div>
          </>
        )}
      </div>
    </div>
  );
}
