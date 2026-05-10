"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Conversation {
  id: string;
  title: string;
  shareToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Usage {
  conversationId: string;
  calls: number;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MultichatLibraryPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [usageMap, setUsageMap] = useState<Record<string, Usage>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    void load(t, "");
  }, []);

  async function load(t: string, query: string) {
    setLoading(true);
    setError("");
    try {
      const url = query
        ? `/api/multichat/search?q=${encodeURIComponent(query)}&limit=200`
        : `/api/multichat/conversations`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
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

  async function loadUsage(id: string) {
    if (usageMap[id]) return;
    try {
      const r = await fetch(`/api/multichat/conversations/${id}/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const u = (await r.json()) as Usage;
      setUsageMap(prev => ({ ...prev, [id]: u }));
    } catch {
      // ignore
    }
  }

  async function rename(id: string) {
    const current = items.find(i => i.id === id);
    const next = prompt("Новое название:", current?.title ?? "")?.trim();
    if (!next || next === current?.title) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/multichat/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: next }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, title: next } : i)));
    } finally {
      setBusyId(null);
    }
  }

  async function del(id: string) {
    const conv = items.find(i => i.id === id);
    if (!confirm(`Удалить "${conv?.title}"? Это необратимо.`)) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/multichat/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function share(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/multichat/conversations/${id}/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      const url = `${window.location.origin}${d.shareUrl}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(`Public URL скопирован:\n${url}`);
      setItems(prev => prev.map(i => (i.id === id ? { ...i, shareToken: d.shareToken } : i)));
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Отозвать public-ссылку? Старая перестанет работать.")) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/multichat/conversations/${id}/share`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        alert(`Ошибка: ${r.status}`);
        return;
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, shareToken: null } : i)));
    } finally {
      setBusyId(null);
    }
  }

  function downloadExport(id: string, fmt: "json" | "csv") {
    const url = `/api/multichat/conversations/${id}/export.${fmt}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `multichat-${id}.${fmt}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert("Не удалось скачать"));
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Войдите чтобы видеть свои чаты.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/multichat-engine" className="text-slate-400 hover:text-white text-sm">
            ← Multichat
          </Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">📚 Library</h1>
        </div>
        <button
          onClick={() => void load(token, q)}
          disabled={loading}
          className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-lg text-xs font-semibold"
        >
          {loading ? "..." : "↻"}
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск по названию..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
            onKeyDown={e => {
              if (e.key === "Enter") void load(token, q);
            }}
          />
          <button
            onClick={() => void load(token, q)}
            className="px-4 py-2 bg-violet-700 hover:bg-violet-600 rounded-lg text-sm font-semibold"
          >
            Найти
          </button>
          {q && (
            <button
              onClick={() => {
                setQ("");
                void load(token, "");
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {loading && items.length === 0 && (
          <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-slate-600 text-sm py-12 text-center">
            {q ? "По запросу ничего не найдено" : "У вас пока нет чатов"}
          </div>
        )}

        <div className="space-y-2">
          {items.map(c => {
            const u = usageMap[c.id];
            return (
              <div
                key={c.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4"
                onMouseEnter={() => void loadUsage(c.id)}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/multichat-engine?conv=${c.id}`}
                      className="font-bold text-base hover:text-violet-300 truncate block"
                    >
                      {c.title}
                    </Link>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Updated: {fmtDate(c.updatedAt)} · Created: {fmtDate(c.createdAt)}
                    </div>
                    {u && (
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        {u.calls} calls · {u.tokens.total.toLocaleString("ru-RU")} tokens · ${u.costUsd.toFixed(4)}
                      </div>
                    )}
                    {c.shareToken && (
                      <div className="text-[11px] text-emerald-400 mt-1">
                        🔗 Public:{" "}
                        <code className="bg-slate-950 px-1 rounded">
                          /multichat-engine/shared/{c.shareToken.slice(0, 12)}…
                        </code>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <button
                      onClick={() => rename(c.id)}
                      disabled={busyId === c.id}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-xs"
                    >
                      ✎ Rename
                    </button>
                    <button
                      onClick={() => downloadExport(c.id, "json")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs"
                    >
                      ↓ JSON
                    </button>
                    <button
                      onClick={() => downloadExport(c.id, "csv")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs"
                    >
                      ↓ CSV
                    </button>
                    {c.shareToken ? (
                      <button
                        onClick={() => revoke(c.id)}
                        disabled={busyId === c.id}
                        className="px-2 py-1 bg-amber-900 hover:bg-amber-800 text-amber-300 disabled:opacity-40 rounded text-xs"
                      >
                        🚫 Revoke
                      </button>
                    ) : (
                      <button
                        onClick={() => share(c.id)}
                        disabled={busyId === c.id}
                        className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded text-xs"
                      >
                        🔗 Share
                      </button>
                    )}
                    <button
                      onClick={() => del(c.id)}
                      disabled={busyId === c.id}
                      className="px-2 py-1 bg-red-900 hover:bg-red-800 text-red-300 disabled:opacity-40 rounded text-xs"
                    >
                      🗑 Delete
                    </button>
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
