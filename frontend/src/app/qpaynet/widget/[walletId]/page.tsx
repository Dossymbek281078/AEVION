"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface WalletPub { name: string; currency: string; active: boolean; }

function WidgetInner() {
  const { walletId } = useParams<{ walletId: string }>();
  const params = useSearchParams();
  const presetAmount = params.get("amount") ?? "";
  const presetDesc = params.get("desc") ?? "";
  const compact = params.get("compact") === "1";

  const [wallet, setWallet] = useState<WalletPub | null>(null);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(presetAmount);

  useEffect(() => {
    fetch(`/api/qpaynet/wallets/${walletId}/public`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setWallet({ name: d.name, currency: d.currency, active: d.active }))
      .catch(() => setError("Кошелёк не найден"));
  }, [walletId]);

  function open(target: "send" | "request") {
    const url = new URL(`${window.location.origin}/qpaynet/${target}`);
    if (target === "send") url.searchParams.set("toWallet", walletId);
    else url.searchParams.set("wallet", walletId);
    if (amount) url.searchParams.set("amount", amount);
    if (presetDesc) url.searchParams.set("description", presetDesc);
    window.open(url.toString(), "_blank", "noopener");
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
        <div className="text-center text-slate-500">
          <div className="text-3xl mb-2">⚠</div>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-600 text-sm animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${compact ? "bg-transparent" : "bg-slate-950"}`}>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-violet-400 font-black">₸</span>
          <span className="text-xs font-bold text-slate-300">QPayNet</span>
          {wallet.active ? (
            <span className="ml-auto text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">активен</span>
          ) : (
            <span className="ml-auto text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">неактивен</span>
          )}
        </div>

        <div className="text-xs text-slate-400 mb-1">Получатель</div>
        <div className="text-base font-semibold text-white mb-4 truncate">{wallet.name}</div>

        <label className="text-xs text-slate-400 mb-1 block">Сумма ({wallet.currency})</label>
        <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="0"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm mb-3 focus:outline-none focus:border-violet-500" />

        <div className="flex gap-2">
          <button onClick={() => open("send")} disabled={!wallet.active}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold text-white">
            Оплатить →
          </button>
        </div>

        {presetDesc && (
          <p className="text-[11px] text-slate-500 mt-3 truncate">📝 {presetDesc}</p>
        )}

        <a href="https://aevion.kz/qpaynet" target="_blank" rel="noopener noreferrer"
          className="block text-center mt-4 text-[10px] text-slate-600 hover:text-slate-400">
          Безопасно через AEVION QPayNet ↗
        </a>
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense>
      <WidgetInner />
    </Suspense>
  );
}
