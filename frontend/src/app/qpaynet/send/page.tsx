"use client";
import { apiUrl } from "@/lib/apiBase";

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
      const r = await fetch(apiUrl("/api/qpaynet/transfer"), {
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

  async function pasteRecipient() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setToWalletId(text.trim());
    } catch {
      /* clipboard not available */
    }
  }

  function repeatFlow() {
    setDone(null);
    setAmount("");
    setDescription("");
    setError("");
  }

  if (done) return (
    <div className="text-center py-12 px-4">
      <div className="text-5xl mb-4" aria-hidden>✅</div>
      <h2 className="text-xl font-bold mb-2">Перевод отправлен</h2>
      <p className="text-slate-400 text-sm mb-1">Комиссия: <strong className="text-amber-400">{done.fee.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₸</strong></p>
      <p className="text-slate-400 text-sm mb-6">Ваш баланс: <strong className="text-emerald-400">{done.newBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₸</strong></p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto">
        <button onClick={() => router.push("/qpaynet")} className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold min-h-[44px]">← К кошельку</button>
        <button onClick={repeatFlow} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold min-h-[44px]">Отправить ещё</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-sm mx-auto py-8 sm:py-12 px-4 sm:px-6">
      <h1 className="text-xl font-bold mb-6">Отправить</h1>
      <div className="space-y-4">
        <div>
          <label htmlFor="qpaynet-send-to" className="text-xs text-slate-400 mb-1 block">ID кошелька получателя</label>
          <div className="relative">
            <input id="qpaynet-send-to" type="text" value={toWalletId} onChange={e => setToWalletId(e.target.value)}
              placeholder="UUID кошелька..."
              autoComplete="off" autoCapitalize="off" spellCheck={false}
              aria-describedby="qpaynet-send-to-help"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-14 py-3 text-white font-mono text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40" />
            <button
              type="button"
              onClick={pasteRecipient}
              title="Вставить из буфера обмена"
              aria-label="Вставить ID получателя из буфера обмена"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-[10px] text-slate-300 min-h-[28px]"
            >
              Вставить
            </button>
          </div>
          <p id="qpaynet-send-to-help" className="sr-only">UUID кошелька в формате 8-4-4-4-12 символов</p>
          {recipient === "loading" && <p className="text-[11px] text-slate-500 mt-1">Проверка получателя...</p>}
          {recipient === "notfound" && <p className="text-[11px] text-red-400 mt-1" role="alert">⚠ Кошелёк не найден</p>}
          {recipient && typeof recipient === "object" && (
            <p className={`text-[11px] mt-1 ${recipient.active ? "text-emerald-400" : "text-amber-400"}`}>
              {recipient.active ? "✓" : "⚠"} {recipient.name}{!recipient.active && " (неактивен)"}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="qpaynet-send-amount" className="text-xs text-slate-400 mb-1 block">Сумма (тенге)</label>
          <input id="qpaynet-send-amount" type="number" min="1" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40" />
          {amount && parseFloat(amount) > 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              Комиссия 0.1%: {(parseFloat(amount) * 0.001).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₸
            </p>
          )}
        </div>
        <div>
          <label htmlFor="qpaynet-send-desc" className="text-xs text-slate-400 mb-1 block">Описание</label>
          <input id="qpaynet-send-desc" type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Оплата услуг..."
            maxLength={500}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40" />
        </div>
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <button onClick={handleSend} disabled={loading || !toWalletId || !amount}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl font-semibold min-h-[48px]">
          {loading ? "Отправка..." : "Отправить →"}
        </button>
        <Link href="/qpaynet" className="block text-center text-xs text-slate-500 hover:text-slate-300 py-2">← Назад</Link>
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
