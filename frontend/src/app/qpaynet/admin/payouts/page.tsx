"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Payout {
  id: string;
  owner_id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  method: "card" | "bank_transfer" | "kaspi";
  destination: string;
  status: "requested" | "approved" | "paid" | "rejected";
  rejected_reason: string | null;
  approved_by: string | null;
  paid_external_ref: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

const STATUS_CHIP: Record<Payout["status"], string> = {
  requested: "bg-amber-900 text-amber-300",
  approved:  "bg-blue-900 text-blue-300",
  paid:      "bg-emerald-900 text-emerald-300",
  rejected:  "bg-red-900 text-red-300",
};
const STATUS_LABEL: Record<Payout["status"], string> = {
  requested: "Запрошен", approved: "Одобрен", paid: "Выплачен", rejected: "Отклонён",
};
const METHOD_LABEL: Record<Payout["method"], string> = {
  card: "Карта", bank_transfer: "Банк", kaspi: "Kaspi",
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPayoutsPage() {
  const [token, setToken] = useState("");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Record<string, { count: number; totalKzt: number }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("requested");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    void refresh(t);
  }, []);

  async function refresh(t: string) {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        fetch(`/api/qpaynet/admin/payouts${filter === "all" ? "" : `?status=${filter}`}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/qpaynet/admin/payouts/stats", { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (list.status === 403 || st.status === 403) { setError("Не админ. Добавьте email в QPAYNET_ADMIN_EMAILS."); return; }
      const ld = await list.json();
      const sd = await st.json();
      setPayouts(ld.payouts ?? []);
      setStats(sd.stats ?? {});
    } finally { setLoading(false); }
  }

  useEffect(() => { if (token) void refresh(token); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function action(id: string, kind: "approve" | "mark-paid" | "reject") {
    let body: Record<string, string> = {};
    if (kind === "reject") {
      const reason = prompt("Причина отказа:") ?? "";
      if (!reason.trim()) return;
      body = { reason: reason.trim() };
    } else if (kind === "mark-paid") {
      const ref = prompt("Внешний референс (banking ref, screenshot id):") ?? "";
      body = ref ? { externalRef: ref.trim() } : {};
    }
    setBusyId(id);
    try {
      const r = await fetch(`/api/qpaynet/admin/payouts/${id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Ошибка: ${d.error ?? r.status}`);
      } else {
        await refresh(token);
      }
    } finally { setBusyId(null); }
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
          <h1 className="text-sm font-bold">💸 Payouts</h1>
        </div>
        <Link href="/qpaynet/admin/kyc" className="text-xs text-slate-400 hover:text-white">KYC →</Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {error && <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-sm text-red-300">{error}</div>}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["requested", "approved", "paid", "rejected"] as const).map(s => {
            const v = stats[s] ?? { count: 0, totalKzt: 0 };
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  filter === s ? "border-violet-600 bg-violet-900/20" : "border-slate-800 bg-slate-900 hover:border-slate-700"
                }`}>
                <div className={`text-[10px] font-bold uppercase mb-1 ${filter === s ? "text-violet-400" : "text-slate-500"}`}>{STATUS_LABEL[s]}</div>
                <div className="text-2xl font-black">{v.count}</div>
                <div className="text-[11px] text-slate-500">{fmt(v.totalKzt)} ₸</div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === "all" ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
            Все
          </button>
          {(["requested", "approved", "paid", "rejected"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {STATUS_LABEL[s]} ({stats[s]?.count ?? 0})
            </button>
          ))}
        </div>

        {loading && <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>}
        {!loading && payouts.length === 0 && <div className="text-slate-600 text-sm py-12 text-center">Выплат в этой категории нет</div>}

        <div className="space-y-2">
          {payouts.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    <span className="text-[10px] text-slate-500">{METHOD_LABEL[p.method]}</span>
                    <span className="text-[10px] text-slate-600">{fmtDate(p.created_at)}</span>
                  </div>
                  <div className="text-lg font-bold">{fmt(p.amount)} {p.currency}</div>
                  <div className="text-[11px] text-slate-500 font-mono mb-1">→ {p.destination}</div>
                  <div className="text-[10px] text-slate-600">owner: {p.owner_id.slice(0, 12)}... · wallet: {p.wallet_id.slice(0, 8)}...</div>
                  {p.rejected_reason && <div className="text-[11px] text-red-400 mt-1">⚠ {p.rejected_reason}</div>}
                  {p.paid_external_ref && p.status === "paid" && <div className="text-[11px] text-emerald-500 mt-1">ref: {p.paid_external_ref}</div>}
                  {p.approved_by && <div className="text-[10px] text-slate-600 mt-1">by {p.approved_by}</div>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {p.status === "requested" && (
                    <>
                      <button onClick={() => action(p.id, "approve")} disabled={busyId === p.id}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-lg text-xs font-semibold">
                        ✓ Одобрить
                      </button>
                      <button onClick={() => action(p.id, "mark-paid")} disabled={busyId === p.id}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded-lg text-xs font-semibold">
                        💸 Выплачено
                      </button>
                      <button onClick={() => action(p.id, "reject")} disabled={busyId === p.id}
                        className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 disabled:opacity-40 rounded-lg text-xs">
                        ✗ Отклонить
                      </button>
                    </>
                  )}
                  {p.status === "approved" && (
                    <button onClick={() => action(p.id, "mark-paid")} disabled={busyId === p.id}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded-lg text-xs font-semibold">
                      💸 Выплачено
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
