"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { useQMediaT } from "../i18n";

function ah(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = getAuthToken() ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface LikeItem { type: "track" | "video"; id: string; title: string; artist?: string; category?: string; playCount?: number; viewCount?: number; coverUrl?: string | null; thumbnailUrl?: string | null; }

export default function QMediaLikesPage() {
  const { t, label } = useQMediaT();
  const [guest, setGuest] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likes, setLikes] = useState<LikeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/qmedia/me/likes"), { headers: ah() })
      .then(r => {
        // гость (401) и отказ сервера — не «понравившегося нет»
        if (r.status === 401) setGuest(true);
        else if (!r.ok) setLoadFailed(true);
        return r.ok ? r.json() : null;
      })
      .then(d => d && setLikes(d.items ?? []))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  async function unlike(type: string, id: string) {
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/qmedia/${type}s/${id}/like`), { method: "POST", headers: ah() });
      if (!r.ok) { setError(t("err.saveFailed")); return; }
      setLikes(prev => prev.filter(l => !(l.id === id && l.type === type)));
    } catch { setError(t("err.saveFailed")); }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/qmedia" className="text-slate-400 hover:text-white text-sm">← QMedia</Link>
        <span className="text-slate-700">·</span>
        <h1 className="text-sm font-semibold m-0">{t("likes.h1")}</h1>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {error && <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>}
        {loading && <div className="text-center py-12 text-slate-500 animate-pulse text-sm">{t("common.loading")}</div>}
        {!loading && loadFailed && <p role="alert" className="text-sm text-red-400 mb-4">{t("err.loadFailed")}</p>}
        {!loading && !loadFailed && likes.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">❤️</div>
            <p className="text-sm">{guest ? t("likes.signIn") : t("likes.empty")}</p>
            <Link href="/qmedia" className="text-violet-400 underline text-sm mt-2 inline-block">{t("likes.listen")}</Link>
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
                  {item.type === "track" ? item.artist || t("common.unknown") : item.category ? label("vcat", item.category) : t("type.video")}
                  {" · "}
                  <span className="text-violet-400">{item.type === "track" ? t("type.track") : t("type.video")}</span>
                </p>
              </div>
              <button onClick={() => unlike(item.type, item.id)} title={t("likes.unlike")} aria-label={t("likes.unlike")} className="text-rose-400 hover:text-rose-300 transition-colors shrink-0 text-lg">❤️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
