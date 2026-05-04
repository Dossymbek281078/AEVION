"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SendForm() {
  const params = useSearchParams();
  const router = useRouter();
  const walletId = params.get("wallet") ?? "";
  const [toWalletId, setToWalletId] = useState(params.get("toWallet") ?? "");
  const [amount, setAmount] = useState(params.get("amount") ?? "");
  const [description, setDescription] = useState(params.get("description") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ newBalance: number; fee: number } | null>(null);
  const [recipient, setRecipient] = useState<{ name: string; active: boolean } | "loading" | "notfound" | null>(null);

  useEffect(() => {
    const id = toWalletId.trim();
    if (id.length < 8) { setRecipient(null); return; }
    setRecipient("loading");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/qpaynet/wallets/${encodeURIComponent(id)}/public`, { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setRecipient({ name: d.name, active: d.active }))
        .catch(() => { if (!ctrl.signal.aborted) setRecipient("notfound"); });
    }, 350);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [toWalletId]);

  async function handleSend() {
    const token = localStorage.getItem("aevion_token") ?? "";
    if (!token) { setError("Необходима авторизация"); return; }
    if (!toWalletId.trim()) { setError("Введите ID получателя"); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("Введите сумму"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/qpaynet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromWalletId: walletId, toWalletId: toWalletId.trim(), amount: parseFloat(amount), description }),
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
      <h2 className="text-xl font-bold mb-2">Перевод отправлен</h2>
      <p className="text-slate-400 text-sm mb-1">Комиссия: <strong className="text-amber-400">{done.fee.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₸</strong></p>
      <p className="text-slate-400 text-sm mb-6">Ваш баланс: <strong className="text-emerald-400">{done.newBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₸</strong></p>
      <button onClick={() => router.push("/qpaynet")} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">← К кошельку</button>
    </div>
  );

  return (
    <div className="max-w-sm mx-auto py-12 px-6">
      <h1 className="text-xl font-bold mb-6">Отправить</h1>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">ID кошелька получателя</label>
          <input type="text" value={toWalletId} onChange={e => setToWalletId(e.target.value)}
            placeholder="UUID кошелька..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-violet-500" />
          {recipient === "loading" && <p className="text-[11px] text-slate-500 mt-1">Проверка получателя...</p>}
          {recipient === "notfound" && <p className="text-[11px] text-red-400 mt-1">⚠ Кошелёк не найден</p>}
          {recipient && typeof recipient === "object" && (
            <p className={`text-[11px] mt-1 ${recipient.active ? "text-emerald-400" : "text-amber-400"}`}>
              {recipient.active ? "✓" : "⚠"} {recipient.name}{!recipient.active && " (неактивен)"}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Сумма (тенге)</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
          {amount && parseFloat(amount) > 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              Комиссия 0.1%: {(parseFloat(amount) * 0.001).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₸
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Описание</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Оплата услуг..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={handleSend} disabled={loading || !toWalletId || !amount}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl font-semibold">
          {loading ? "Отправка..." : "Отправить →"}
        </button>
        <Link href="/qpaynet" className="block text-center text-xs text-slate-500 hover:text-slate-300">← Назад</Link>
      </div>
    </div>
  );
}

export default function SendPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
      </header>
      <Suspense><SendForm /></Suspense>
    </div>
  );
}
