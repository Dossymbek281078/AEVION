"use client";
import { apiUrl } from "@/lib/apiBase";

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
  const [notifyUrl, setNotifyUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generated, setGenerated] = useState<{ link: string; qrPath: string; notifySecret?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) return;
    fetch(apiUrl("/api/qpaynet/wallets"), { headers: { Authorization: `Bearer ${t}` } })
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
    let notifySecret: string | undefined;
    try {
      const r = await fetch(apiUrl("/api/qpaynet/requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          toWalletId: walletId,
          amount: parseFloat(amount),
          description: description || "Запрос на оплату",
          ...(notifyUrl.trim() ? { notifyUrl: notifyUrl.trim() } : {}),
        }),
      });
      if (r.ok) {
        const d = await r.json();
        link = `${window.location.origin}/qpaynet/r/${d.token}`;
        notifySecret = d.notifySecret;
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
    setGenerated({ link, qrPath, notifySecret });
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

  async function shareLink() {
    if (!generated) return;
    // Web Share API where available (most mobile browsers + Safari)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Запрос на оплату QPayNet", text: description || "Оплата", url: generated.link });
        return;
      } catch { /* user cancelled or unsupported — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(generated.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  if (generated) {
    return (
      <div className="max-w-md mx-auto py-8 sm:py-10 px-4 sm:px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Запрос готов</h1>
        <p className="text-slate-400 text-sm mb-6">Поделитесь ссылкой или QR-кодом</p>

        <div className="bg-white rounded-2xl p-4 inline-block mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={generated.qrPath} alt="QR-код запроса на оплату" width={240} height={240} className="block" />
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4">
          <code className="text-xs text-emerald-400 break-all">{generated.link}</code>
        </div>

        {generated.notifySecret && (
          <div className="bg-amber-950/50 border border-amber-800/60 rounded-xl p-3 mb-4 text-left">
            <div className="text-[10px] text-amber-400 font-semibold mb-1 uppercase tracking-wide">Секрет webhook (показан 1 раз)</div>
            <code className="text-[11px] text-amber-200 break-all block select-all">{generated.notifySecret}</code>
            <div className="text-[10px] text-amber-500/80 mt-1">
              Сохраните для верификации HMAC: <code>HMAC-SHA256(secret, ts.body)</code>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={shareLink}
            className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold min-h-[44px]"
          >
            {copied ? "✓ Скопировано" : "Поделиться / Копировать"}
          </button>
          <button
            onClick={() => setGenerated(null)}
            className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm min-h-[44px]"
          >
            Заново
          </button>
        </div>
        <Link href="/qpaynet" className="block text-center text-xs text-slate-500 hover:text-slate-300 mt-4 py-2">← К кошельку</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 sm:py-10 px-4 sm:px-6">
      <h1 className="text-xl font-bold mb-6">Запросить оплату</h1>
      <div className="space-y-4">
        <div>
          <label htmlFor="qpaynet-req-wallet" className="text-xs text-slate-400 mb-1 block">Кошелёк (получатель)</label>
          <select id="qpaynet-req-wallet" value={walletId} onChange={e => setWalletId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40 min-h-[48px]">
            {wallets.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.balance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {w.currency})</option>
            ))}
            {wallets.length === 0 && <option value="">Нет кошельков</option>}
          </select>
        </div>
        <div>
          <label htmlFor="qpaynet-req-amount" className="text-xs text-slate-400 mb-1 block">Сумма (тенге)</label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[1000, 5000, 10000, 50000].map(n => (
              <button key={n} type="button" onClick={() => setAmount(String(n))}
                aria-pressed={amount === String(n)}
                className={`px-2 py-2.5 rounded-lg text-xs font-semibold min-h-[40px] ${amount === String(n) ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                {n >= 1000 ? `${n / 1000}k` : n}<span className="hidden xs:inline"> ₸</span>
              </button>
            ))}
          </div>
          <input id="qpaynet-req-amount" type="number" min="1" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40" />
        </div>
        <div>
          <label htmlFor="qpaynet-req-desc" className="text-xs text-slate-400 mb-1 block">Назначение (опционально)</label>
          <input id="qpaynet-req-desc" type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Оплата за услуги..."
            maxLength={500}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40" />
        </div>
        <div>
          <button type="button" onClick={() => setShowAdvanced(s => !s)}
            aria-expanded={showAdvanced}
            className="text-xs text-slate-500 hover:text-slate-300 py-1">
            {showAdvanced ? "− Скрыть webhook" : "+ Webhook на оплату (для мерчанта)"}
          </button>
          {showAdvanced && (
            <input type="url" inputMode="url" value={notifyUrl} onChange={e => setNotifyUrl(e.target.value)}
              placeholder="https://your-site.kz/webhook/qpaynet"
              className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40" />
          )}
        </div>
        <button onClick={generate} disabled={!walletId || !amount}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl font-semibold min-h-[48px]">
          Создать ссылку и QR →
        </button>
        <Link href="/qpaynet" className="block text-center text-xs text-slate-500 hover:text-slate-300 py-2">← Назад</Link>
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
