"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Delivery {
  id: string;
  sub_id: string;
  owner_id: string;
  event: string;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

type StatusFilter = "all" | "stuck" | "pending" | "delivered";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Все",
  pending: "В очереди",
  stuck: "Залипшие",
  delivered: "Доставлены",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusOf(d: Delivery): { label: string; chip: string } {
  if (d.delivered_at) return { label: "DELIVERED", chip: "bg-emerald-900 text-emerald-300" };
  if (d.attempts >= 5) return { label: "STUCK", chip: "bg-red-900 text-red-300" };
  if (d.next_retry_at) return { label: "PENDING", chip: "bg-amber-900 text-amber-300" };
  return { label: "QUEUED", chip: "bg-slate-800 text-slate-400" };
}

export default function AdminWebhookDeliveriesPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Delivery[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("stuck");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    void load(t, filter);
  }, []);

  useEffect(() => {
    if (token) void load(token, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function load(t: string, f: StatusFilter) {
    setLoading(true);
    setError("");
    try {
      const url = `/api/qpaynet/admin/webhook-deliveries?limit=100${
        f === "all" ? "" : `&status=${f}`
      }`;
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
      setItems(d.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function retry(id: string) {
    if (!confirm(`Принудительно повторить доставку ${id.slice(0, 8)}…?`)) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/qpaynet/admin/webhook-deliveries/${id}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Ошибка: ${d.error ?? r.status}`);
      } else {
        await load(token, filter);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Войдите как админ.</p>
      </div>
    );
  }

  const counts = {
    all: items.length,
    stuck: items.filter(d => !d.delivered_at && d.attempts >= 5).length,
    pending: items.filter(d => !d.delivered_at && d.next_retry_at).length,
    delivered: items.filter(d => d.delivered_at).length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet/admin" className="text-slate-400 hover:text-white text-sm">← Admin</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">📡 Webhook deliveries</h1>
        </div>
        <button
          onClick={() => void load(token, filter)}
          disabled={loading}
          className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-lg text-xs font-semibold"
        >
          {loading ? "..." : "↻ Refresh"}
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "stuck", "delivered"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                filter === s
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {STATUS_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>

        {loading && items.length === 0 && (
          <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-slate-600 text-sm py-12 text-center">
            В этой категории доставок нет
          </div>
        )}

        <div className="space-y-2">
          {items.map(d => {
            const s = statusOf(d);
            const stuck = !d.delivered_at && d.attempts >= 5;
            return (
              <div
                key={d.id}
                className={`bg-slate-900 border rounded-xl p-4 ${
                  stuck ? "border-red-900/60" : "border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.chip}`}
                      >
                        {s.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{d.event}</span>
                      <span className="text-[10px] text-slate-600">
                        attempts: <span className={stuck ? "text-red-400 font-bold" : ""}>{d.attempts}</span>
                      </span>
                      <span className="text-[10px] text-slate-600">
                        created: {fmtDate(d.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mb-1">
                      delivery: {d.id} · sub: {d.sub_id.slice(0, 8)}… · owner: {d.owner_id.slice(0, 12)}…
                    </div>
                    {d.next_retry_at && !d.delivered_at && (
                      <div className="text-[11px] text-amber-400">
                        ⏱ Next retry: {fmtDate(d.next_retry_at)}
                      </div>
                    )}
                    {d.delivered_at && (
                      <div className="text-[11px] text-emerald-400">
                        ✓ Delivered: {fmtDate(d.delivered_at)}
                      </div>
                    )}
                    {d.last_error && (
                      <div className="text-[11px] text-red-400 mt-1 font-mono break-all">
                        ⚠ {d.last_error}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!d.delivered_at && (
                      <button
                        onClick={() => retry(d.id)}
                        disabled={busyId === d.id}
                        className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-lg text-xs font-semibold"
                      >
                        🔁 Retry now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[10px] text-slate-600 leading-relaxed">
          Backoff: 30s → 2m → 10m → 30m → 2h. После 5 неудач доставка считается{" "}
          <strong className="text-red-400">залипшей</strong> и появляется здесь. Force-retry
          сбрасывает <code className="bg-slate-900 px-1 rounded">attempts=0</code> и планирует
          немедленное повторение.
        </div>
      </div>
    </div>
  );
}
