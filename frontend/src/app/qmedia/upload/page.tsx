"use client";

import { useState } from "react";
import { getAuthToken } from "@/lib/auth";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { useQMediaT, saveErrorKey } from "../i18n";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = getAuthToken() ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const GENRES = ["pop", "rock", "electronic", "hip-hop", "jazz", "classical", "folk", "rnb", "other"];
const VIDEO_CATS = ["music-video", "tutorial", "live", "documentary", "shortfilm", "other"];
type MediaType = "track" | "video";

export default function QMediaUploadPage() {
  const { t, label } = useQMediaT();
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

  async function submit() {
    if (!title.trim() || !url.trim()) { setError(t("upload.required")); return; }
    setSubmitting(true); setError("");
    try {
      const endpoint = type === "track" ? "/api/qmedia/me/tracks" : "/api/qmedia/me/videos";
      const body = type === "track"
        ? { title: title.trim(), artist: artist.trim(), genre, url: url.trim(), coverUrl: coverUrl.trim() || null, isPublic, tags: tags.split(",").map(s => s.trim()).filter(Boolean) }
        : { title: title.trim(), description: description.trim() || null, category, url: url.trim(), thumbnailUrl: coverUrl.trim() || null, isPublic, tags: tags.split(",").map(s => s.trim()).filter(Boolean) };
      const r = await fetch(apiUrl(endpoint), { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify(body) });
      // сырой ответ сервера человеку не показываем: 401 → «войдите», прочее → «не удалось сохранить»
      if (!r.ok) { setError(t(saveErrorKey(r.status))); return; }
      setSuccess(true);
      setTitle(""); setUrl(""); setCoverUrl(""); setDescription(""); setArtist(""); setTags("");
    } catch { setError(t("err.saveFailed")); }
    finally { setSubmitting(false); }
  }

  if (success) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">{type === "track" ? "🎵" : "🎬"}</div>
        <h1 className="text-xl font-bold mb-2">{type === "track" ? t("upload.doneTrack") : t("upload.doneVideo")}</h1>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => setSuccess(false)} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold">{t("upload.more")}</button>
          <Link href="/qmedia" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm">{t("upload.catalog")}</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/qmedia" className="text-slate-400 hover:text-white text-sm">← QMedia</Link>
        <span className="text-slate-700">·</span>
        <h1 className="text-sm font-semibold m-0">{t("upload.h1")}</h1>
      </header>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(["track", "video"] as const).map((k) => (
            <button key={k} onClick={() => setType(k)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${type === k ? "bg-slate-700 text-white" : "text-slate-400"}`}>{k === "track" ? t("upload.track") : t("upload.video")}</button>
          ))}
        </div>
        <input aria-label={type === "track" ? t("upload.trackTitleA") : t("upload.videoTitleA")} value={title} onChange={e => setTitle(e.target.value)} placeholder={type === "track" ? t("upload.trackTitle") : t("upload.videoTitle")} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        {type === "track" ? (
          <>
            <input aria-label={t("common.artist")} value={artist} onChange={e => setArtist(e.target.value)} placeholder={t("common.artist")} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
            <select aria-label={t("common.genre")} value={genre} onChange={e => setGenre(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
              {GENRES.map(g => <option key={g} value={g}>{label("genre", g)}</option>)}
            </select>
          </>
        ) : (
          <>
            <select aria-label={t("common.category")} value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
              {VIDEO_CATS.map(c => <option key={c} value={c}>{label("vcat", c)}</option>)}
            </select>
            <textarea rows={3} aria-label={t("upload.desc")} value={description} onChange={e => setDescription(e.target.value)} placeholder={t("upload.desc")} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
          </>
        )}
        <input aria-label={t("upload.urlA")} value={url} onChange={e => setUrl(e.target.value)} placeholder={t("upload.url")} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        <input aria-label={t("upload.coverA")} value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder={t("upload.cover")} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        <input aria-label={t("upload.tagsA")} value={tags} onChange={e => setTags(e.target.value)} placeholder={t("upload.tags")} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-violet-500" />
          <span className="text-sm text-slate-300">{t("upload.public")}</span>
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button onClick={submit} disabled={submitting || !title.trim() || !url.trim()} className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors">
          {submitting ? t("upload.saving") : t("upload.submit")}
        </button>
      </div>
    </div>
  );
}
