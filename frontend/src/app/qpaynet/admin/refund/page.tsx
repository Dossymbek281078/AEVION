"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Refund {
  refundId: string;
  walletId: string;
  ownerId: string;
  amountKzt: number;
  description: string;
  originalTxId: string;
  originalAmountKzt: number | null;
  originalType: string | null;
  originalCreatedAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  deposit: "Депозит",
  transfer_in: "Входящий перевод",
  merchant_charge: "Списание мерчанта",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminRefundPage() {
  const [token, setToken] = useState("");
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [txId, setTxId] = useState("");
  const [reason, setReason] = useState("");
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    void load(t, null);
  }, []);

  async function load(t: string, before: string | null) {
    setLoading(true);
    setError("");
    try {
      const url = `/api/qpaynet/admin/refunds?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      if (r.status === 403) {
        setError("Не админ. Добавьте email в QPAYNET_ADMIN_EMAILS.");
        return;
      }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      const d = await r.json();
      setRefunds(prev => (before ? [...prev, ...(d.items ?? [])] : (d.items ?? [])));
      setNextCursor(d.nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    if (!txId.trim() || reason.trim().length < 5) {
      setFormMsg({ kind: "err", text: "Заполните Tx ID и причину (мин. 5 символов)" });
      return;
    }
    if (!confirm(`Подтвердите возврат по транзакции ${txId.slice(0, 8)}…?\nПричина: ${reason}`)) {
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        txId: txId.trim(),
        reason: reason.trim(),
      };
      if (partial && amount.trim()) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
          setFormMsg({ kind: "err", text: "Сумма должна быть положительным числом" });
          setSubmitting(false);
          return;
        }
        body.amount = n;
      }
      const idemKey = `refund-${txId.trim()}-${Date.now()}`;
      const r = await fetch("/api/qpaynet/admin/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFormMsg({ kind: "err", text: `Ошибка: ${d.error ?? r.status}` });
        return;
      }
      setFormMsg({
        kind: "ok",
        text: `Возврат ${fmt(d.refundedKzt)} ₸ создан. Новый баланс кошелька: ${fmt(d.newBalance)} ₸`,
      });
      setTxId("");
      setReason("");
      setPartial(false);
      setAmount("");
      void load(token, null);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Войдите как админ.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet/admin" className="text-slate-400 hover:text-white text-sm">← Admin</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">↩ Refund</h1>
        </div>
        <Link href="/qpaynet/admin/reconcile" className="text-xs text-slate-400 hover:text-white">
          Reconcile →
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Issue refund form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Выпустить возврат
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tx ID (UUID транзакции)</label>
              <input
                type="text"
                value={txId}
                onChange={e => setTxId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono focus:border-violet-600 focus:outline-none"
              />
              <div className="text-[10px] text-slate-600 mt-1">
                Поддерживаются: deposit, transfer_in, merchant_charge
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Причина (5–500 символов)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="Чарджбек / ошибка клиента / fraud-флаг"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={partial}
                onChange={e => setPartial(e.target.checked)}
                className="accent-violet-600"
              />
              Частичный возврат
            </label>
            {partial && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Сумма (₸)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="1500.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono focus:border-violet-600 focus:outline-none"
                />
                <div className="text-[10px] text-slate-600 mt-1">
                  Не больше суммы оригинальной транзакции
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 rounded-lg text-sm font-semibold"
              >
                {submitting ? "..." : "↩ Выпустить возврат"}
              </button>
              {formMsg && (
                <div
                  className={`text-xs ${
                    formMsg.kind === "ok" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formMsg.text}
                </div>
              )}
            </div>
          </form>
          <div className="text-[10px] text-slate-600 mt-4 leading-relaxed">
            ⚠ Возврат создаёт <strong>новую</strong> транзакцию (type=&quot;refund&quot;) с
            обратной ссылкой на оригинал. Двойной вызов вернёт 409
            <code className="bg-slate-950 px-1 mx-1 rounded">tx_already_refunded</code>.
            Используется Idempotency-Key для защиты от двойных кликов.
          </div>
        </div>

        {/* Refund history */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              История возвратов
            </div>
            <button
              onClick={() => void load(token, null)}
              disabled={loading}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs"
            >
              {loading && refunds.length === 0 ? "..." : "↻"}
            </button>
          </div>

          {loading && refunds.length === 0 && (
            <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>
          )}
          {!loading && refunds.length === 0 && (
            <div className="text-slate-600 text-sm py-12 text-center">Возвратов ещё не было</div>
          )}

          <div className="space-y-2">
            {refunds.map(r => (
              <div
                key={r.refundId}
                className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-900 text-red-300">
                        REFUND
                      </span>
                      <span className="text-[10px] text-slate-500">{fmtDate(r.createdAt)}</span>
                    </div>
                    <div className="text-base font-bold text-red-400">−{fmt(r.amountKzt)} ₸</div>
                    <div className="text-xs text-slate-400 mt-1">{r.description}</div>
                    <div className="text-[10px] text-slate-600 font-mono mt-1">
                      refund: {r.refundId.slice(0, 8)}… · wallet: {r.walletId.slice(0, 8)}… ·
                      owner: {r.ownerId.slice(0, 12)}…
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Оригинал</div>
                    <div className="text-xs text-slate-400">
                      {r.originalType ? TYPE_LABEL[r.originalType] ?? r.originalType : "—"}
                    </div>
                    <div className="text-xs font-mono">{fmt(r.originalAmountKzt)} ₸</div>
                    <div className="text-[10px] text-slate-600">
                      {fmtDate(r.originalCreatedAt)}
                    </div>
                    <div className="text-[10px] text-slate-700 font-mono mt-1">
                      {r.originalTxId.slice(0, 8)}…
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nextCursor && (
            <div className="pt-4 text-center">
              <button
                onClick={() => void load(token, nextCursor)}
                disabled={loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs"
              >
                {loading ? "..." : "Загрузить ещё"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
