"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string; sign: string }> = {
  deposit:        { label: "Пополнение",       color: "text-emerald-400", bg: "bg-emerald-900/20",  sign: "+" },
  withdraw:       { label: "Вывод",            color: "text-red-400",     bg: "bg-red-900/20",      sign: "−" },
  transfer_out:   { label: "Перевод исходящий",color: "text-amber-400",   bg: "bg-amber-900/20",   sign: "−" },
  transfer_in:    { label: "Перевод входящий", color: "text-emerald-400", bg: "bg-emerald-900/20", sign: "+" },
  merchant_charge:{ label: "Списание",         color: "text-red-400",     bg: "bg-red-900/20",      sign: "−" },
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const token = localStorage.getItem("aevion_token") ?? "";
    if (!token) { setError("Необходима авторизация"); setLoading(false); return; }
    fetch("/api/qpaynet/transactions?limit=100", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setTxs(d.transactions ?? []))
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

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
          <h1 className="text-sm font-bold">История транзакций</h1>
        </div>
        <div className="text-xs text-slate-500">{txs.length} транзакций</div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4">
            <div className="text-xs text-emerald-400 mb-1">Поступило</div>
            <div className="text-lg font-bold text-emerald-300">+{fmt(totalIn)} ₸</div>
          </div>
          <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
            <div className="text-xs text-red-400 mb-1">Списано</div>
            <div className="text-lg font-bold text-red-300">−{fmt(totalOut)} ₸</div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 col-span-2 sm:col-span-1">
            <div className="text-xs text-slate-400 mb-1">Нетто</div>
            <div className={`text-lg font-bold ${totalIn - totalOut >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {totalIn - totalOut >= 0 ? "+" : "−"}{fmt(Math.abs(totalIn - totalOut))} ₸
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {[["all","Все"],["deposit","Пополнения"],["withdraw","Выводы"],["transfer_out","Переводы"],["merchant_charge","Списания"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === v ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading && <div className="text-slate-500 text-sm py-8 text-center">Загрузка...</div>}
        {error && <div className="text-red-400 text-sm py-4">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-slate-600 text-sm text-center py-12">Транзакций нет</div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="space-y-1.5">
            {filtered.map(tx => {
              const t = TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-slate-400", bg: "bg-slate-900", sign: "" };
              return (
                <div key={tx.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border border-slate-800 ${t.bg}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold ${t.color}`}>{t.label}</span>
                      <span className="text-xs text-slate-300 truncate">{tx.description || "—"}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {fmtDate(tx.created_at)}
                      {tx.fee > 0 && <span className="ml-2 text-slate-700">комиссия {fmt(tx.fee)} ₸</span>}
                    </div>
                  </div>
                  <div className={`font-bold text-sm ml-4 shrink-0 ${t.color}`}>
                    {t.sign}{fmt(tx.amount)} ₸
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
