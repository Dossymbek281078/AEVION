"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Tx {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  fee: number;
  currency: string;
  description: string;
  status: string;
  created_at: string;
}

const TYPE_META: Record<string, { key: string; color: string; bg: string; sign: string }> = {
  deposit:        { key: "qpaynet.tx.type.deposit",      color: "text-emerald-400", bg: "bg-emerald-900/20",  sign: "+" },
  withdraw:       { key: "qpaynet.tx.type.withdraw",     color: "text-red-400",     bg: "bg-red-900/20",      sign: "−" },
  transfer_out:   { key: "qpaynet.tx.type.transferOut",  color: "text-amber-400",   bg: "bg-amber-900/20",   sign: "−" },
  transfer_in:    { key: "qpaynet.tx.type.transferIn",   color: "text-emerald-400", bg: "bg-emerald-900/20", sign: "+" },
  merchant_charge:{ key: "qpaynet.tx.type.merchantCharge",color: "text-red-400",    bg: "bg-red-900/20",      sign: "−" },
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string, lang: string) {
  const localeTag = lang === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleString(localeTag, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TransactionsPage() {
  const { t: translate, lang } = useI18n();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [token, setToken] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("aevion_token") ?? "";
    setToken(saved);
    if (!saved) { setError(translate("qpaynet.tx.err.auth")); setLoading(false); return; }
    fetch(apiUrl("/api/qpaynet/transactions?limit=100"), {
      headers: { Authorization: `Bearer ${saved}` },
    })
      .then(r => r.json())
      .then(d => setTxs(d.transactions ?? []))
      .catch(() => setError(translate("qpaynet.tx.err.load")))
      .finally(() => setLoading(false));
  }, []);

  async function exportCsv() {
    if (!token) return;
    const r = await fetch(apiUrl("/api/qpaynet/transactions.csv"), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qpaynet-transactions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = filter === "all" ? txs : txs.filter(t => t.type === filter);

  const totalIn = txs
    .filter(t => t.type === "deposit" || t.type === "transfer_in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = txs
    .filter(t => t.type === "withdraw" || t.type === "transfer_out" || t.type === "merchant_charge")
    .reduce((s, t) => s + t.amount + t.fee, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">{translate("qpaynet.tx.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          {token && txs.length > 0 && (
            <button onClick={exportCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700">
              ⬇ CSV
            </button>
          )}
          <div className="text-xs text-slate-500">{translate("qpaynet.tx.count", { count: txs.length })}</div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4">
            <div className="text-xs text-emerald-400 mb-1">{translate("qpaynet.tx.in")}</div>
            <div className="text-lg font-bold text-emerald-300">+{fmt(totalIn)} ₸</div>
          </div>
          <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
            <div className="text-xs text-red-400 mb-1">{translate("qpaynet.tx.out")}</div>
            <div className="text-lg font-bold text-red-300">−{fmt(totalOut)} ₸</div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 col-span-2 sm:col-span-1">
            <div className="text-xs text-slate-400 mb-1">{translate("qpaynet.tx.net")}</div>
            <div className={`text-lg font-bold ${totalIn - totalOut >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {totalIn - totalOut >= 0 ? "+" : "−"}{fmt(Math.abs(totalIn - totalOut))} ₸
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {[["all",translate("qpaynet.tx.filter.all")],["deposit",translate("qpaynet.tx.filter.deposit")],["withdraw",translate("qpaynet.tx.filter.withdraw")],["transfer_out",translate("qpaynet.tx.filter.transfers")],["merchant_charge",translate("qpaynet.tx.filter.charges")]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === v ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading && <div className="text-slate-500 text-sm py-8 text-center">{translate("qpaynet.tx.loading")}</div>}
        {error && <div className="text-red-400 text-sm py-4">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-slate-600 text-sm text-center py-12">{translate("qpaynet.tx.empty")}</div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="space-y-1.5">
            {filtered.map(tx => {
              const meta = TYPE_META[tx.type];
              const label = meta ? translate(meta.key) : tx.type;
              const color = meta?.color ?? "text-slate-400";
              const bg = meta?.bg ?? "bg-slate-900";
              const sign = meta?.sign ?? "";
              return (
                <div key={tx.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border border-slate-800 ${bg}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold ${color}`}>{label}</span>
                      <span className="text-xs text-slate-300 truncate">{tx.description || "—"}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {fmtDate(tx.created_at, lang)}
                      {tx.fee > 0 && <span className="ml-2 text-slate-700">{translate("qpaynet.tx.fee")} {fmt(tx.fee)} ₸</span>}
                    </div>
                  </div>
                  <div className={`font-bold text-sm ml-4 shrink-0 ${color}`}>
                    {sign}{fmt(tx.amount)} ₸
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
