"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function DepositForm() {
  const params = useSearchParams();
  const router = useRouter();
  const walletId = params.get("wallet") ?? "";
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ newBalance: number } | null>(null);

  async function handleDeposit() {
    const token = localStorage.getItem("aevion_token") ?? "";
    if (!token || !amount || parseFloat(amount) <= 0) { setError("Введите сумму и авторизуйтесь"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/qpaynet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletId, amount: parseFloat(amount), description }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ошибка");
      setDone(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setLoading(false); }
  }

  if (done) return (
    <div className="text-center py-12">
      <div className="text-4xl mb-4">✅</div>
      <h2 className="text-xl font-bold mb-2">Пополнено!</h2>
      <p className="text-slate-400 text-sm mb-6">Новый баланс: <strong className="text-emerald-400">{done.newBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₸</strong></p>
      <button onClick={() => router.push("/qpaynet")} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">← К кошельку</button>
    </div>
  );

  return (
    <div className="max-w-sm mx-auto py-12 px-6">
      <h1 className="text-xl font-bold mb-6">Пополнить кошелёк</h1>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Сумма (тенге)</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {[1000,5000,10000,50000].map(n => (
              <button key={n} onClick={() => setAmount(String(n))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${amount === String(n) ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                {n.toLocaleString("ru-RU")} ₸
              </button>
            ))}
          </div>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Сумма в тенге"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Описание (опционально)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Пополнение через карту"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={handleDeposit} disabled={loading || !amount}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl font-semibold">
          {loading ? "Пополнение..." : `Пополнить${amount ? ` ${parseFloat(amount).toLocaleString("ru-RU")} ₸` : ""}`}
        </button>
        <Link href="/qpaynet" className="block text-center text-xs text-slate-500 hover:text-slate-300">← Назад</Link>
      </div>
    </div>
  );
}

export default function DepositPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
      </header>
      <Suspense><DepositForm /></Suspense>
    </div>
  );
}
