"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Wallet { id: string; name: string; currency: string; balance: number; }

function RequestForm() {
  const params = useSearchParams();
  const initialWallet = params.get("wallet") ?? "";
  const [token, setToken] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState(initialWallet);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [generated, setGenerated] = useState<{ link: string; qrPath: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) return;
    fetch("/api/qpaynet/wallets", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        setWallets(d.wallets ?? []);
        if (!walletId && d.wallets?.[0]) setWalletId(d.wallets[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (!walletId || !amount) return;
    // Try the tracked backend request first; fall back to QR-only deep link
    // if the endpoint is not deployed yet.
    let link: string | null = null;
    try {
      const r = await fetch("/api/qpaynet/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          toWalletId: walletId,
          amount: parseFloat(amount),
          description: description || "Запрос на оплату",
        }),
      });
      if (r.ok) {
        const d = await r.json();
        link = `${window.location.origin}/qpaynet/r/${d.token}`;
      }
    } catch { /* fall through */ }

    if (!link) {
      const url = new URL(`${window.location.origin}/qpaynet/send`);
      url.searchParams.set("toWallet", walletId);
      url.searchParams.set("amount", amount);
      if (description) url.searchParams.set("description", description);
      link = url.toString();
    }
    const qrPath = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}`;
    setGenerated({ link, qrPath });
  }

  if (!token) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">🔐</div>
        <p className="text-slate-400 mb-4">Войдите чтобы создать запрос на оплату</p>
        <Link href="/auth" className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">→ Войти</Link>
      </div>
    );
  }

  if (generated) {
    return (
      <div className="max-w-md mx-auto py-10 px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Запрос готов</h1>
        <p className="text-slate-400 text-sm mb-6">Поделитесь ссылкой или QR-кодом</p>

        <div className="bg-white rounded-2xl p-4 inline-block mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={generated.qrPath} alt="QR-код для оплаты" width={240} height={240} className="block" />
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4">
          <code className="text-xs text-emerald-400 break-all">{generated.link}</code>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { navigator.clipboard.writeText(generated.link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold"
          >
            {copied ? "✓ Скопировано" : "Копировать ссылку"}
          </button>
          <button
            onClick={() => setGenerated(null)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
          >
            Заново
          </button>
        </div>
        <Link href="/qpaynet" className="block text-center text-xs text-slate-500 hover:text-slate-300 mt-4">← К кошельку</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10 px-6">
      <h1 className="text-xl font-bold mb-6">Запросить оплату</h1>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Кошелёк (получатель)</label>
          <select value={walletId} onChange={e => setWalletId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500">
            {wallets.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.balance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {w.currency})</option>
            ))}
            {wallets.length === 0 && <option value="">Нет кошельков</option>}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Сумма (тенге)</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {[1000, 5000, 10000, 50000].map(n => (
              <button key={n} onClick={() => setAmount(String(n))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${amount === String(n) ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                {n.toLocaleString("ru-RU")} ₸
              </button>
            ))}
          </div>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Назначение (опционально)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Оплата за услуги..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        </div>
        <button onClick={generate} disabled={!walletId || !amount}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl font-semibold">
          Создать ссылку и QR →
        </button>
        <Link href="/qpaynet" className="block text-center text-xs text-slate-500 hover:text-slate-300">← Назад</Link>
      </div>
    </div>
  );
}

export default function RequestPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
      </header>
      <Suspense><RequestForm /></Suspense>
    </div>
  );
}
