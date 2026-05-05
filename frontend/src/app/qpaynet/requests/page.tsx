"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PayRequest {
  id: string;
  to_wallet_id: string;
  token: string;
  amount: number;
  currency: string;
  description: string;
  status: "pending" | "paid" | "cancelled" | "expired";
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  payUrl: string;
}

const STATUS: Record<PayRequest["status"], { label: string; chip: string }> = {
  pending:   { label: "Ожидает",   chip: "bg-amber-900 text-amber-300" },
  paid:      { label: "Оплачено",  chip: "bg-emerald-900 text-emerald-300" },
  cancelled: { label: "Отменён",   chip: "bg-slate-800 text-slate-500" },
  expired:   { label: "Истёк",     chip: "bg-slate-800 text-slate-500" },
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MyRequestsPage() {
  const [token, setToken] = useState("");
  const [reqs, setReqs] = useState<PayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setError("Необходима авторизация"); setLoading(false); return; }
    fetch("/api/qpaynet/requests", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => setReqs(d.requests ?? []))
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  async function cancel(id: string) {
    if (!confirm("Отменить запрос? Ссылка перестанет работать.")) return;
    const r = await fetch(`/api/qpaynet/requests/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      setReqs(prev => prev.map(x => x.id === id ? { ...x, status: "cancelled" } : x));
    }
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const filtered = filter === "all" ? reqs : reqs.filter(r => r.status === filter);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">Запросы оплаты</h1>
        </div>
        <div className="flex items-center gap-2">
          {token && reqs.length > 0 && (
            <button
              onClick={async () => {
                const r = await fetch("/api/qpaynet/requests.csv", { headers: { Authorization: `Bearer ${token}` } });
                if (!r.ok) return;
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `qpaynet-requests-${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700"
            >
              ⬇ CSV
            </button>
          )}
          <Link href="/qpaynet/request" className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg">
            + Создать
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {/* Filter chips */}
        {reqs.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {[["all", "Все"], ["pending", "Ожидают"], ["paid", "Оплачены"], ["cancelled", "Отменены"], ["expired", "Истекли"]].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === v ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                {l}
              </button>
            ))}
          </div>
        )}

        {loading && <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>}
        {error && <div className="text-red-400 text-sm py-4">{error}</div>}
        {!loading && !error && reqs.length === 0 && (
          <div className="text-center py-16 text-slate-600">
            <div className="text-4xl mb-4">📥</div>
            <p className="text-sm">Запросов пока нет</p>
            <Link href="/qpaynet/request" className="text-violet-400 hover:text-violet-300 text-sm underline mt-2 inline-block">
              Создать первый →
            </Link>
          </div>
        )}

        {!loading && filtered.length === 0 && reqs.length > 0 && (
          <div className="text-center py-12 text-slate-600 text-sm">Нет запросов в этой категории</div>
        )}

        <div className="space-y-2">
          {filtered.map(r => {
            const s = STATUS[r.status];
            return (
              <div key={r.id}
                className={`border border-slate-800 bg-slate-900 rounded-xl p-4 transition-colors ${r.status !== "pending" ? "opacity-70" : "hover:border-slate-700"}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.chip}`}>{s.label}</span>
                      <span className="text-xs text-slate-500">{fmtDate(r.created_at)}</span>
                      {r.expires_at && <span className="text-xs text-slate-600">истекает {fmtDate(r.expires_at)}</span>}
                    </div>
                    <div className="text-lg font-bold text-white">{fmt(r.amount)} <span className="text-sm text-slate-400 font-normal">{r.currency}</span></div>
                    <div className="text-sm text-slate-300 truncate">{r.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => copyLink(r.payUrl, r.id)}
                      className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                      {copied === r.id ? "✓ Скопировано" : "Ссылка"}
                    </button>
                    {r.status === "pending" && (
                      <button onClick={() => cancel(r.id)}
                        className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg transition-colors">
                        Отменить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
