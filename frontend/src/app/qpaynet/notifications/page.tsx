"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  ref_id: string | null;
  amount: number | null;
  read_at: string | null;
  created_at: string;
}

const KIND_ICON: Record<string, string> = {
  payment_received: "💸",
  deposit_received: "💳",
  payout_approved: "✅",
  payout_paid: "🏦",
  payout_rejected: "✗",
  kyc_verified: "🛡",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NotificationsPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    fetch("/api/qpaynet/notifications", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => setItems(d.notifications ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/qpaynet/notifications/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function markAll() {
    await fetch("/api/qpaynet/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
  }

  const filtered = filter === "all" ? items : items.filter(n => !n.read_at);
  const unreadCount = items.filter(n => !n.read_at).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">Уведомления {unreadCount > 0 && <span className="text-amber-400">({unreadCount})</span>}</h1>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAll}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg">
              Прочитать все
            </button>
          )}
          <Link href="/qpaynet/notifications/preferences"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg">
            ⚙ Настройки
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-3">
        <div className="flex gap-2">
          {[["all", "Все"], ["unread", `Непрочитанные (${unreadCount})`]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v as "all" | "unread")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === v ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {l}
            </button>
          ))}
        </div>

        {loading && <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>}
        {!loading && filtered.length === 0 && <div className="text-slate-600 text-sm py-12 text-center">Нет уведомлений</div>}

        {filtered.map(n => (
          <button key={n.id} onClick={() => !n.read_at && markRead(n.id)}
            className={`w-full text-left p-3 rounded-xl border transition-colors ${
              n.read_at ? "border-slate-800 bg-slate-900/50 opacity-60" : "border-slate-700 bg-slate-900 hover:border-slate-600"
            }`}>
            <div className="flex items-start gap-3">
              <div className="text-xl shrink-0 mt-0.5">{KIND_ICON[n.kind] ?? "🔔"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-white truncate">{n.title}</span>
                  {!n.read_at && <span className="w-2 h-2 bg-amber-400 rounded-full shrink-0" />}
                </div>
                {n.body && <div className="text-[12px] text-slate-400 truncate">{n.body}</div>}
                <div className="text-[10px] text-slate-600 mt-1">{fmtDate(n.created_at)}</div>
                {n.amount != null && (
                  <div className="text-[12px] text-emerald-400 font-bold mt-1">+{fmt(n.amount)} ₸</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
