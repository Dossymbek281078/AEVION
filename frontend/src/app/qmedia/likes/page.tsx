"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

function ah(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_auth_token_v1") ?? localStorage.getItem("aevion_token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface LikeItem { type: "track" | "video"; id: string; title: string; artist?: string; category?: string; playCount?: number; viewCount?: number; coverUrl?: string | null; thumbnailUrl?: string | null; }

export default function QMediaLikesPage() {
  const [likes, setLikes] = useState<LikeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(apiUrl("/api/qmedia/me/likes"), { headers: ah() })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setLikes(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function unlike(type: string, id: string) {
    const key = `${type}-${id}`;
    if (pending.has(key)) return;
    const snapshot = likes;
    setPending(prev => new Set(prev).add(key));
    setLikes(prev => prev.filter(l => !(l.id === id && l.type === type)));
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/qmedia/${type}s/${id}/like`), { method: "POST", headers: ah() });
      if (!r.ok) throw new Error("failed");
    } catch {
      setLikes(snapshot);
      setError("Не удалось убрать. Попробуйте ещё раз.");
    } finally {
      setPending(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/qmedia" className="text-slate-400 hover:text-white text-sm">← QMedia</Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Понравившееся</span>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}
        {loading && <div className="text-center py-12 text-slate-500 animate-pulse text-sm">Загрузка…</div>}
        {!loading && likes.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">❤️</div>
            <p className="text-sm">Нет понравившихся треков или видео</p>
            <Link href="/qmedia" className="text-violet-400 underline text-sm mt-2 inline-block">Слушать музыку →</Link>
          </div>
        )}
        <div className="space-y-2">
          {likes.map(item => (
            <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg shrink-0">
                {item.coverUrl || item.thumbnailUrl
                  ? <img src={item.coverUrl ?? item.thumbnailUrl!} alt="" className="w-full h-full object-cover rounded-lg" />
                  : item.type === "track" ? "🎵" : "🎬"
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.type === "track" ? item.artist ?? "Unknown" : item.category ?? "video"}
                  {" · "}
                  <span className="text-violet-400 capitalize">{item.type}</span>
                </p>
              </div>
              <button
                onClick={() => unlike(item.type, item.id)}
                disabled={pending.has(`${item.type}-${item.id}`)}
                aria-label={`Убрать «${item.title}» из понравившихся`}
                title="Убрать из понравившихся"
                className="text-rose-400 hover:text-rose-300 disabled:opacity-40 disabled:cursor-wait transition-colors shrink-0 text-lg"
              >
                ❤️
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
