"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

function ah(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_auth_token_v1") ?? localStorage.getItem("aevion_token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface Playlist { id: string; name: string; description: string | null; isPublic: boolean; trackIds: string[]; createdAt: string; }

export default function PlaylistsPage() {
  const [mine, setMine] = useState<Playlist[]>([]);
  const [public_, setPublic] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [pub, setPub] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [mR, pR] = await Promise.all([
        fetch(apiUrl("/api/qmedia/me/playlists"), { headers: ah() }),
        fetch(apiUrl("/api/qmedia/playlists")),
      ]);
      if (mR.ok) { const d = await mR.json(); setMine(d.items ?? []); }
      if (pR.ok) { const d = await pR.json(); setPublic(d.items ?? []); }
    } catch { /**/ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(apiUrl("/api/qmedia/me/playlists"), {
        method: "POST", headers: { "Content-Type": "application/json", ...ah() },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || null, isPublic: pub }),
      });
      if (r.ok) { setName(""); setDesc(""); setCreating(false); await load(); }
    } catch { /**/ }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Удалить плейлист?")) return;
    await fetch(apiUrl(`/api/qmedia/me/playlists/${id}`), { method: "DELETE", headers: ah() });
    setMine(prev => prev.filter(p => p.id !== id));
  }

  const list = tab === "mine" ? mine : public_;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qmedia" className="text-slate-400 hover:text-white text-sm">← QMedia</Link>
          <span className="text-slate-700">·</span>
          <span className="text-sm font-semibold">Плейлисты</span>
        </div>
        <button onClick={() => setCreating(true)} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-semibold">+ Создать</button>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6 border border-slate-800">
          {([["mine", "Мои"], ["public", "Публичные"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === k ? "bg-slate-700 text-white" : "text-slate-400"}`}>{l}</button>
          ))}
        </div>

        {creating && (
          <div className="bg-slate-900 border border-violet-700/40 rounded-2xl p-5 mb-6 space-y-3">
            <h3 className="text-sm font-bold">Новый плейлист</h3>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Название *" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание (опционально)" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pub} onChange={e => setPub(e.target.checked)} className="w-4 h-4 accent-violet-500" />
              <span className="text-sm text-slate-300">Публичный</span>
            </label>
            <div className="flex gap-2">
              <button onClick={create} disabled={saving || !name.trim()} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl text-sm font-bold">Создать</button>
              <button onClick={() => setCreating(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm">Отмена</button>
            </div>
          </div>
        )}

        {loading && <div className="text-center py-12 text-slate-500 animate-pulse text-sm">Загрузка…</div>}
        {!loading && list.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">🎵</div>
            <p className="text-sm">{tab === "mine" ? "У вас нет плейлистов" : "Публичных плейлистов нет"}</p>
          </div>
        )}
        <div className="space-y-3">
          {list.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-900/40 flex items-center justify-center text-xl shrink-0">🎵</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{p.name}</p>
                <p className="text-xs text-slate-500">{p.trackIds.length} треков · {p.isPublic ? "Публичный" : "Приватный"}</p>
              </div>
              {tab === "mine" && (
                <button onClick={() => del(p.id)} className="text-xs text-slate-600 hover:text-red-400 transition-colors shrink-0">Удалить</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
