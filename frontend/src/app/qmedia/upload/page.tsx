"use client";

import { useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_auth_token_v1") ?? localStorage.getItem("aevion_token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const GENRES = ["pop", "rock", "electronic", "hip-hop", "jazz", "classical", "folk", "rnb", "other"];
const VIDEO_CATS = ["music-video", "tutorial", "live", "documentary", "shortfilm", "other"];
type MediaType = "track" | "video";

export default function QMediaUploadPage() {
  const [type, setType] = useState<MediaType>("track");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("other");
  const [category, setCategory] = useState("music-video");
  const [url, setUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function isValidUrl(s: string): boolean {
    try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; }
    catch { return false; }
  }

  async function submit() {
    if (!title.trim() || !url.trim()) { setError("Название и URL обязательны"); return; }
    if (!isValidUrl(url.trim())) { setError("URL должен начинаться с https:// или http://"); return; }
    if (coverUrl.trim() && !isValidUrl(coverUrl.trim())) { setError("URL обложки невалиден"); return; }
    setSubmitting(true); setError("");
    try {
      const endpoint = type === "track" ? "/api/qmedia/me/tracks" : "/api/qmedia/me/videos";
      const body = type === "track"
        ? { title: title.trim(), artist: artist.trim(), genre, url: url.trim(), coverUrl: coverUrl.trim() || null, isPublic, tags: tags.split(",").map(s => s.trim()).filter(Boolean) }
        : { title: title.trim(), description: description.trim() || null, category, url: url.trim(), thumbnailUrl: coverUrl.trim() || null, isPublic, tags: tags.split(",").map(s => s.trim()).filter(Boolean) };
      const r = await fetch(apiUrl(endpoint), { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setSuccess(true);
      setTitle(""); setUrl(""); setCoverUrl(""); setDescription(""); setArtist(""); setTags("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setSubmitting(false); }
  }

  if (success) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">{type === "track" ? "🎵" : "🎬"}</div>
        <h1 className="text-xl font-bold mb-2">{type === "track" ? "Трек загружен!" : "Видео добавлено!"}</h1>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => setSuccess(false)} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold">+ Ещё</button>
          <Link href="/qmedia" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm">Каталог</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/qmedia" className="text-slate-400 hover:text-white text-sm">← QMedia</Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Загрузить</span>
      </header>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {([["track", "🎵 Трек"], ["video", "🎬 Видео"]] as const).map(([t, l]) => (
            <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${type === t ? "bg-slate-700 text-white" : "text-slate-400"}`}>{l}</button>
          ))}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} aria-label={type === "track" ? "Название трека" : "Название видео"} placeholder={type === "track" ? "Название трека *" : "Название видео *"} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        {type === "track" ? (
          <>
            <input value={artist} onChange={e => setArtist(e.target.value)} maxLength={200} aria-label="Исполнитель" placeholder="Исполнитель" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <select value={genre} onChange={e => setGenre(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </>
        ) : (
          <>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
              {VIDEO_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} aria-label="Описание видео" placeholder="Описание видео" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
          </>
        )}
        <input type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} maxLength={2048} aria-label="URL медиа-файла" placeholder="URL файла * (https://...)" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        <input type="url" inputMode="url" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} maxLength={2048} aria-label="URL обложки" placeholder="URL обложки (опционально)" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        <input value={tags} onChange={e => setTags(e.target.value)} maxLength={500} aria-label="Теги через запятую" placeholder="Теги через запятую: jazz, piano, acoustic" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-violet-500" />
          <span className="text-sm text-slate-300">Публичный доступ</span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={submit} disabled={submitting || !title.trim() || !url.trim()} className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors">
          {submitting ? "Загрузка…" : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}
