"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Payout {
  id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  method: "card" | "bank_transfer" | "kaspi";
  destination: string;
  status: "requested" | "approved" | "paid" | "rejected";
  rejected_reason: string | null;
  paid_external_ref: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

interface Wallet { id: string; name: string; balance: number; currency: string; }

const METHOD_LABEL: Record<Payout["method"], string> = {
  card: "На карту",
  bank_transfer: "Банковский перевод",
  kaspi: "Kaspi",
};

const STATUS_CHIP: Record<Payout["status"], string> = {
  requested: "bg-amber-900 text-amber-300",
  approved:  "bg-blue-900 text-blue-300",
  paid:      "bg-emerald-900 text-emerald-300",
  rejected:  "bg-red-900 text-red-300",
};

const STATUS_LABEL: Record<Payout["status"], string> = {
  requested: "Запрошен",
  approved:  "Одобрен",
  paid:      "Выплачен",
  rejected:  "Отклонён",
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PayoutsPage() {
  const [token, setToken] = useState("");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Payout["method"]>("card");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    Promise.all([
      fetch("/api/qpaynet/payouts", { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch("/api/qpaynet/wallets", { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
    ]).then(([p, w]) => {
      setPayouts(p.payouts ?? []);
      setWallets(w.wallets ?? []);
      if (w.wallets?.[0]) setWalletId(w.wallets[0].id);
    }).finally(() => setLoading(false));
  }, []);

  async function submit() {
    if (!walletId || !amount || !destination) return;
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/qpaynet/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletId, amount: parseFloat(amount), method, destination }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ошибка");
      const list = await fetch("/api/qpaynet/payouts", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setPayouts(list.payouts ?? []);
      setAmount(""); setDestination("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSubmitting(false); }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Войдите чтобы запросить выплату</p>
          <Link href="/auth" className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">→ Войти</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">Выплаты</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* Request form */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
          <h2 className="font-bold mb-1">Запросить выплату</h2>
          <p className="text-xs text-slate-400 mb-3">
            Выплата уходит на ручную модерацию. Средства списываются сразу;
            при отказе деньги возвращаются автоматически.
          </p>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Кошелёк</label>
            <select value={walletId} onChange={e => setWalletId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({fmt(w.balance)} {w.currency})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Метод</label>
            <select value={method} onChange={e => setMethod(e.target.value as Payout["method"])}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              <option value="card">Банковская карта</option>
              <option value="bank_transfer">Банковский перевод (IBAN)</option>
              <option value="kaspi">Kaspi (телефон)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {method === "card" ? "Номер карты (16 цифр)" : method === "kaspi" ? "Номер телефона +7..." : "IBAN"}
            </label>
            <input value={destination} onChange={e => setDestination(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Сумма (₸)</label>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
            {amount && parseFloat(amount) > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                Комиссия 0.1%: {fmt(parseFloat(amount) * 0.001)} ₸ · к списанию {fmt(parseFloat(amount) * 1.001)} ₸
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={submitting || !amount || !destination}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg text-sm font-semibold">
            {submitting ? "..." : "Запросить выплату"}
          </button>
        </div>

        {/* History */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">История ({payouts.length})</h3>
          {loading && <div className="text-slate-500 text-sm py-8 text-center">Загрузка...</div>}
          {!loading && payouts.length === 0 && <div className="text-slate-600 text-sm py-8 text-center">Выплат нет</div>}
          <div className="space-y-2">
            {payouts.map(p => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      <span className="text-[10px] text-slate-500">{METHOD_LABEL[p.method]}</span>
                      <span className="text-[10px] text-slate-600">{fmtDate(p.created_at)}</span>
                    </div>
                    <div className="text-base font-bold">{fmt(p.amount)} {p.currency}</div>
                    <div className="text-[11px] text-slate-500 font-mono">→ {p.destination}</div>
                    {p.rejected_reason && <div className="text-[11px] text-red-400 mt-1">⚠ {p.rejected_reason}</div>}
                    {p.paid_external_ref && p.status === "paid" && (
                      <div className="text-[11px] text-emerald-500 mt-1">ref: {p.paid_external_ref}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
