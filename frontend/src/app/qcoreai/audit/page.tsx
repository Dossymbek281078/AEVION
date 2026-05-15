"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_auth_token_v1") ?? localStorage.getItem("aevion_token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  "session.created": "text-teal-400",
  "run.started": "text-blue-400",
  "run.completed": "text-emerald-400",
  "run.failed": "text-red-400",
  "template.created": "text-violet-400",
  "template.used": "text-purple-400",
  "batch.created": "text-amber-400",
  "batch.completed": "text-amber-300",
  "webhook.triggered": "text-cyan-400",
  "key.created": "text-green-400",
  "key.revoked": "text-rose-400",
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "только что";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(50);

  async function load(l = limit) {
    setLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/me/audit-log?limit=${l}`), { headers: bearerHeader() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setEntries(d.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qcoreai" className="text-slate-400 hover:text-white text-sm">← QCoreAI</Link>
          <span className="text-slate-700">·</span>
          <span className="text-sm font-semibold">Audit Log</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => { setLimit(+e.target.value); load(+e.target.value); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n} записей</option>
            ))}
          </select>
          <button onClick={() => load()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-semibold transition-colors">
            Обновить
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Аудит действий</h1>
          <p className="text-slate-400 text-sm mt-0.5">История операций вашего аккаунта QCoreAI</p>
        </div>

        {loading && <div className="text-center py-16 text-slate-500 animate-pulse text-sm">Загрузка аудита…</div>}
        {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>}

        {!loading && entries.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">Нет событий в аудит-логе</p>
          </div>
        )}

        {entries.length > 0 && (
          <div className="space-y-1">
            {entries.map((e) => {
              const color = ACTION_COLORS[e.action] ?? "text-slate-400";
              return (
                <div key={e.id} className="flex items-center gap-3 py-2.5 px-4 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-mono font-semibold ${color}`}>{e.action}</span>
                    {e.resourceType && (
                      <span className="text-xs text-slate-500 ml-2">
                        {e.resourceType}
                        {e.resourceId && ` · ${e.resourceId.slice(0, 8)}`}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-600 shrink-0">{fmtRelative(e.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}

        {entries.length >= limit && (
          <button
            onClick={() => { const n = limit + 50; setLimit(n); load(n); }}
            className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            Загрузить ещё
          </button>
        )}
      </div>
    </div>
  );
}
