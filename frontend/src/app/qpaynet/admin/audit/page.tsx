"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reportError } from "@/lib/reporter";

interface AuditEvent {
  id: string;
  ownerId: string | null;
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_PRESETS = [
  "",
  "refund_issued",
  "wallet_frozen",
  "wallet_unfrozen",
  "webhook_delivery_force_retry",
  "deposit",
  "withdraw",
  "transfer",
  "merchant_charge",
  "stripe_deposit_credited",
  "request_pay",
];

const ACTION_CHIP: Record<string, string> = {
  refund_issued: "bg-red-900 text-red-300",
  wallet_frozen: "bg-cyan-900 text-cyan-300",
  wallet_unfrozen: "bg-emerald-900 text-emerald-300",
  webhook_delivery_force_retry: "bg-violet-900 text-violet-300",
  deposit: "bg-emerald-900/60 text-emerald-300",
  withdraw: "bg-amber-900 text-amber-300",
  transfer: "bg-blue-900 text-blue-300",
  merchant_charge: "bg-indigo-900 text-indigo-300",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminAuditPage() {
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [owner, setOwner] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    void load(t, null, action, owner);
  }, []);

  async function load(t: string, before: string | null, a: string, o: string) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (before) params.set("before", before);
      if (a) params.set("action", a);
      if (o) params.set("owner", o);
      const r = await fetch(`/api/qpaynet/admin/audit?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
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
      setEvents(prev => (before ? [...prev, ...(d.items ?? [])] : (d.items ?? [])));
      setNextCursor(d.nextCursor ?? null);
    } catch (err) {
      reportError(err, "qpaynet/admin/audit");
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    setExpandedId(null);
    void load(token, null, action.trim(), owner.trim());
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
          <h1 className="text-sm font-bold">📜 Audit log</h1>
        </div>
        <button
          onClick={applyFilters}
          disabled={loading}
          className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-lg text-xs font-semibold"
        >
          {loading ? "..." : "↻ Refresh"}
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Action
              </label>
              <select
                value={action}
                onChange={e => setAction(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs"
              >
                {ACTION_PRESETS.map(a => (
                  <option key={a} value={a}>
                    {a || "— все —"}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Owner (email / sub — частичное совпадение)
              </label>
              <input
                type="text"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono focus:border-violet-600 focus:outline-none"
                onKeyDown={e => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={applyFilters}
              className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-xs font-semibold"
            >
              Применить фильтр
            </button>
            <button
              onClick={() => {
                setAction("");
                setOwner("");
                void load(token, null, "", "");
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs"
            >
              Сбросить
            </button>
          </div>
        </div>

        {loading && events.length === 0 && (
          <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>
        )}
        {!loading && events.length === 0 && (
          <div className="text-slate-600 text-sm py-12 text-center">Событий не найдено</div>
        )}

        <div className="space-y-1.5">
          {events.map(e => {
            const expanded = expandedId === e.id;
            return (
              <div
                key={e.id}
                className="bg-slate-900 border border-slate-800 rounded-lg text-xs"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                  className="w-full text-left p-3 hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        ACTION_CHIP[e.action] ?? "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {e.action}
                    </span>
                    <span className="text-slate-600 shrink-0">{fmtDate(e.createdAt)}</span>
                    {e.ownerId && (
                      <span className="font-mono text-slate-400 truncate">
                        {e.ownerId.length > 30 ? e.ownerId.slice(0, 30) + "…" : e.ownerId}
                      </span>
                    )}
                    {e.ip && (
                      <span className="text-[10px] font-mono text-slate-600">{e.ip}</span>
                    )}
                    <span className="ml-auto text-slate-600">{expanded ? "▾" : "▸"}</span>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-slate-800 p-3 bg-slate-950 rounded-b-lg space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Details</div>
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(e.details, null, 2)}
                    </pre>
                    {e.userAgent && (
                      <div className="text-[10px] text-slate-600">UA: {e.userAgent}</div>
                    )}
                    <div className="text-[10px] text-slate-600 font-mono">id: {e.id}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {nextCursor && (
          <div className="pt-2 text-center">
            <button
              onClick={() => void load(token, nextCursor, action.trim(), owner.trim())}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs"
            >
              {loading ? "..." : "Загрузить ещё"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
