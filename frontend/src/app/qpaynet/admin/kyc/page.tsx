"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Submission {
  owner_id: string;
  status: "pending" | "verified" | "rejected";
  full_name: string;
  iin: string;
  address: string | null;
  submitted_at: string;
  verified_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
}

const STATUS_CHIP: Record<Submission["status"], string> = {
  pending:  "bg-amber-900 text-amber-300",
  verified: "bg-emerald-900 text-emerald-300",
  rejected: "bg-red-900 text-red-300",
};
const STATUS_LABEL: Record<Submission["status"], string> = {
  pending: "На проверке", verified: "Верифицирован", rejected: "Отклонён",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminKycPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    void refresh(t);
  }, []);

  async function refresh(t: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/qpaynet/admin/kyc${filter === "all" ? "" : `?status=${filter}`}`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.status === 403) { setError("Не админ. Добавьте email в QPAYNET_ADMIN_EMAILS."); return; }
      const d = await r.json();
      setItems(d.submissions ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (token) void refresh(token); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function action(ownerId: string, kind: "verify" | "reject") {
    let body: Record<string, string> = {};
    if (kind === "reject") {
      const reason = prompt("Причина отказа (видна пользователю):") ?? "";
      if (!reason.trim()) return;
      body = { reason: reason.trim() };
    }
    setBusyId(ownerId);
    try {
      const r = await fetch(`/api/qpaynet/admin/kyc/${encodeURIComponent(ownerId)}/${kind}`, {
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
          <h1 className="text-sm font-bold">🪪 KYC</h1>
        </div>
        <Link href="/qpaynet/admin/payouts" className="text-xs text-slate-400 hover:text-white">Payouts →</Link>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {error && <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-sm text-red-300">{error}</div>}

        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "verified", "rejected"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {s === "all" ? "Все" : STATUS_LABEL[s as Submission["status"]]}
            </button>
          ))}
        </div>

        {loading && <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>}
        {!loading && items.length === 0 && <div className="text-slate-600 text-sm py-12 text-center">Заявок в этой категории нет</div>}

        <div className="space-y-2">
          {items.map(s => (
            <div key={s.owner_id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_CHIP[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    <span className="text-[10px] text-slate-600">{fmtDate(s.submitted_at)}</span>
                  </div>
                  <div className="text-base font-bold text-white">{s.full_name}</div>
                  <div className="text-xs text-slate-400 font-mono">ИИН: {s.iin}</div>
                  {s.address && <div className="text-xs text-slate-500 mt-0.5">{s.address}</div>}
                  <div className="text-[10px] text-slate-600 mt-1">owner: {s.owner_id.slice(0, 16)}...</div>
                  {s.rejected_reason && <div className="text-[11px] text-red-400 mt-1">⚠ {s.rejected_reason}</div>}
                </div>
                {s.status === "pending" && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => action(s.owner_id, "verify")} disabled={busyId === s.owner_id}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded-lg text-xs font-semibold">
                      ✓ Верифицировать
                    </button>
                    <button onClick={() => action(s.owner_id, "reject")} disabled={busyId === s.owner_id}
                      className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 disabled:opacity-40 rounded-lg text-xs">
                      ✗ Отклонить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
