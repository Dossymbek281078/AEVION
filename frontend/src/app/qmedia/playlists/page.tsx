"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { useQMediaT, saveErrorKey } from "../i18n";

function ah(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = getAuthToken() ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface Playlist { id: string; name: string; description: string | null; isPublic: boolean; trackIds: string[]; createdAt: string; }

export default function PlaylistsPage() {
  const { t, tn } = useQMediaT();
  const [guest, setGuest] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setGuest(mR.status === 401);
      if (mR.ok) { const d = await mR.json(); setMine(d.items ?? []); }
      if (pR.ok) { const d = await pR.json(); setPublic(d.items ?? []); }
      setLoadFailed((!mR.ok && mR.status !== 401) || !pR.ok);
    } catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/qmedia/me/playlists"), {
        method: "POST", headers: { "Content-Type": "application/json", ...ah() },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || null, isPublic: pub }),
      });
      if (!r.ok) { setError(t(saveErrorKey(r.status))); return; }
      setName(""); setDesc(""); setCreating(false); await load();
    } catch { setError(t("err.saveFailed")); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm(t("pl.confirmDel"))) return;
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/qmedia/me/playlists/${id}`), { method: "DELETE", headers: ah() });
      // убираем из списка только то, что сервер действительно удалил
      if (!r.ok) { setError(t("err.deleteFailed")); return; }
      setMine(prev => prev.filter(p => p.id !== id));
    } catch { setError(t("err.deleteFailed")); }
  }

  const list = tab === "mine" ? mine : public_;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qmedia" className="text-slate-400 hover:text-white text-sm">← QMedia</Link>
          <span className="text-slate-700">·</span>
          <h1 className="text-sm font-semibold m-0">{t("pl.h1")}</h1>
        </div>
        <button onClick={() => setCreating(true)} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-semibold">{t("pl.create")}</button>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6 border border-slate-800">
          {(["mine", "public"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === k ? "bg-slate-700 text-white" : "text-slate-400"}`}>{k === "mine" ? t("pl.mine") : t("pl.public")}</button>
          ))}
        </div>

        {creating && (
          <div className="bg-slate-900 border border-violet-700/40 rounded-2xl p-5 mb-6 space-y-3">
            <h3 className="text-sm font-bold">{t("pl.new")}</h3>
            <input value={name} onChange={e => setName(e.target.value)} aria-label={t("pl.nameA")} placeholder={t("pl.name")} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <input value={desc} onChange={e => setDesc(e.target.value)} aria-label={t("pl.descA")} placeholder={t("pl.desc")} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pub} onChange={e => setPub(e.target.checked)} className="w-4 h-4 accent-violet-500" />
              <span className="text-sm text-slate-300">{t("pl.isPublic")}</span>
            </label>
            <div className="flex gap-2">
              <button onClick={create} disabled={saving || !name.trim()} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl text-sm font-bold">{t("pl.createBtn")}</button>
              <button onClick={() => setCreating(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm">{t("common.cancel")}</button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>}
        {loading && <div className="text-center py-12 text-slate-500 animate-pulse text-sm">{t("common.loading")}</div>}
        {!loading && loadFailed && <p role="alert" className="text-sm text-red-400 mb-4">{t("err.loadFailed")}</p>}
        {!loading && list.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">🎵</div>
            <p className="text-sm">{tab === "mine" ? (guest ? t("pl.signIn") : t("pl.emptyMine")) : t("pl.emptyPublic")}</p>
          </div>
        )}
        <div className="space-y-3">
          {list.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-900/40 flex items-center justify-center text-xl shrink-0">🎵</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{p.name}</p>
                <p className="text-xs text-slate-500">{tn("pl.tracks", p.trackIds.length)} · {p.isPublic ? t("pl.isPublic") : t("pl.private")}</p>
              </div>
              {tab === "mine" && (
                <button onClick={() => del(p.id)} className="text-xs text-slate-600 hover:text-red-400 transition-colors shrink-0">{t("common.delete")}</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
