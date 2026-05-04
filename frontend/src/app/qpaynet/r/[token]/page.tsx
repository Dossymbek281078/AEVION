"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PayRequest {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: "pending" | "paid" | "cancelled" | "expired";
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Wallet { id: string; name: string; balance: number; currency: string; }

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<PayRequest["status"], { label: string; className: string }> = {
  pending:   { label: "Ожидает оплаты", className: "bg-amber-900 text-amber-300" },
  paid:      { label: "Оплачено",       className: "bg-emerald-900 text-emerald-300" },
  cancelled: { label: "Отменён",        className: "bg-slate-800 text-slate-400" },
  expired:   { label: "Истёк",          className: "bg-slate-800 text-slate-400" },
};

export default function PayRequestPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [req, setReq] = useState<PayRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [fromWalletId, setFromWalletId] = useState<string>("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ newBalance: number; fee: number } | null>(null);

  useEffect(() => {
    fetch(`/api/qpaynet/requests/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setReq(d))
      .catch(() => setError("Запрос не найден или недоступен"))
      .finally(() => setLoading(false));

    const t = localStorage.getItem("aevion_token") ?? "";
    setAuthToken(t);
    if (!t) return;
    fetch("/api/qpaynet/wallets", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        const ws: Wallet[] = d.wallets ?? [];
        setWallets(ws);
        if (ws[0]) setFromWalletId(ws[0].id);
      });
  }, [token]);

  async function pay() {
    if (!fromWalletId || !req) return;
    setPaying(true); setError("");
    try {
      const r = await fetch(`/api/qpaynet/requests/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ fromWalletId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ошибка оплаты");
      setDone({ newBalance: d.newBalance, fee: d.fee });
      setReq({ ...req, status: "paid", paidAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center"><div className="text-3xl mb-3 animate-pulse">💳</div><p className="text-sm">Загрузка запроса...</p></div>
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-slate-400">{error || "Запрос не найден"}</p>
          <Link href="/qpaynet" className="text-xs text-violet-400 hover:text-violet-300 mt-4 inline-block underline">← К QPayNet</Link>
        </div>
      </div>
    );
  }

  const status = STATUS_LABEL[req.status];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${status.className}`}>{status.label}</span>
      </header>

      <div className="max-w-md mx-auto py-12 px-6">
        {done ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-2">Оплачено!</h1>
            <p className="text-slate-400 text-sm mb-1">Комиссия: <strong className="text-amber-400">{fmt(done.fee)} ₸</strong></p>
            <p className="text-slate-400 text-sm mb-6">Ваш баланс: <strong className="text-emerald-400">{fmt(done.newBalance)} ₸</strong></p>
            <button onClick={() => router.push("/qpaynet")} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold">← К кошельку</button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2 text-slate-200">Запрос на оплату</h1>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
              <div className="text-3xl font-black mb-2">{fmt(req.amount)} <span className="text-base text-slate-400 font-normal">{req.currency}</span></div>
              <p className="text-sm text-slate-400">{req.description}</p>
              {req.expiresAt && (
                <p className="text-[11px] text-slate-600 mt-3">
                  Действителен до: {new Date(req.expiresAt).toLocaleString("ru-RU")}
                </p>
              )}
            </div>

            {req.status !== "pending" && (
              <div className="text-center text-sm text-slate-500">
                Этот запрос {status.label.toLowerCase()}.
              </div>
            )}

            {req.status === "pending" && !authToken && (
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-4">Войдите чтобы оплатить</p>
                <Link href="/auth" className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-bold">→ Войти в AEVION</Link>
              </div>
            )}

            {req.status === "pending" && authToken && wallets.length > 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Списать с кошелька</label>
                  <select value={fromWalletId} onChange={e => setFromWalletId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500">
                    {wallets.map(w => (
                      <option key={w.id} value={w.id} disabled={w.balance < req.amount * 1.001}>
                        {w.name} ({fmt(w.balance)} {w.currency}){w.balance < req.amount * 1.001 ? " — недостаточно" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">К списанию: <strong>{fmt(req.amount)} ₸</strong> + комиссия 0.1% ({fmt(req.amount * 0.001)} ₸)</p>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button onClick={pay} disabled={paying || !fromWalletId}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl font-bold">
                  {paying ? "Оплата..." : `Оплатить ${fmt(req.amount)} ₸ →`}
                </button>
              </div>
            )}

            {req.status === "pending" && authToken && wallets.length === 0 && (
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-4">У вас нет кошельков</p>
                <Link href="/qpaynet" className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-bold">+ Создать кошелёк</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
