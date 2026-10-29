"use client";
import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { reportError } from "@/lib/reporter";
import { useQMediaT, type QMediaKey } from "./i18n";

/*
 * 29.10.2026 (окно «Приложения», решение Оркестратора): ручки лайка и плейлиста на бэке были, кнопок в
 * интерфейсе не было — /qmedia/likes у человека был пуст всегда. Ручки проверены на проде 7b16f03ce
 * (ПРИЛОЖЕНИЯ/qmedia-…/ruchki-like-playlist.mjs, 6/6). Отказ ручки — текст человеку и строка в журнал.
 */

type Fetch = typeof fetch;
export type ActResult = { ok: true; liked?: boolean } | { ok: false; status: number };

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
  return t ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` } : { "Content-Type": "application/json" };
}

async function call(f: Fetch, path: string, init: RequestInit, what: string): Promise<{ ok: boolean; status: number; body: any }> {
  try {
    const r = await f(apiUrl(path), { ...init, headers: authHeaders() });
    const body = await r.json().catch(() => null);
    const вЖурнал = `qmedia ${what} ${r.status}`; // журнал, не экран: человеку — текст из словаря в кнопке
    if (!r.ok) reportError(new Error(вЖурнал), "/qmedia");
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    reportError(e, "/qmedia");
    return { ok: false, status: 0, body: null };
  }
}

/** Лайк-переключатель: POST /api/qmedia/:type/:id/like → { liked } (type — track | video). */
export async function likeResource(f: Fetch, type: "track" | "video", id: string): Promise<ActResult> {
  const r = await call(f, `/api/qmedia/${type}/${encodeURIComponent(id)}/like`, { method: "POST" }, `like-${type}`);
  return r.ok ? { ok: true, liked: Boolean(r.body?.liked) } : { ok: false, status: r.status };
}
export const likeTrack = (f: Fetch, trackId: string) => likeResource(f, "track", trackId);

/** Мои плейлисты: GET /api/qmedia/me/playlists. */
export async function myPlaylists(f: Fetch): Promise<{ ok: true; items: { id: string; name: string }[] } | { ok: false; status: number }> {
  const r = await call(f, "/api/qmedia/me/playlists", { method: "GET" }, "playlists");
  if (!r.ok) return { ok: false, status: r.status };
  const items = Array.isArray(r.body) ? r.body : r.body?.items ?? [];
  return { ok: true, items };
}

/** В плейлист: POST /api/qmedia/me/playlists/:id/tracks { trackId }. */
export async function addToPlaylist(f: Fetch, playlistId: string, trackId: string): Promise<ActResult> {
  const r = await call(f, `/api/qmedia/me/playlists/${encodeURIComponent(playlistId)}/tracks`, { method: "POST", body: JSON.stringify({ trackId }) }, "add-to-playlist");
  return r.ok ? { ok: true } : { ok: false, status: r.status };
}

export function actErrorKey(status: number): QMediaKey {
  return status === 401 ? "err.signInToLike" : "err.saveFailed";
}

/** Одна кнопка «Нравится» (карточка видео): тот же переключатель, отказ — текст + журнал. */
export function LikeButton({ type, id }: { type: "track" | "video"; id: string }) {
  const { t } = useQMediaT();
  const [liked, setLiked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onLike = async () => {
    setBusy(true);
    const r = await likeResource(fetch, type, id);
    setBusy(false);
    if (r.ok) { setLiked(Boolean(r.liked)); setErr(null); } else setErr(t(actErrorKey(r.status)));
  };
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" disabled={busy} onClick={onLike} aria-pressed={liked} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 8, border: "1px solid #e2e8f0", background: liked ? "rgba(225,29,72,0.08)" : "#fff", color: liked ? "#e11d48" : "#475569", cursor: "pointer" }}>
        {liked ? t("act.liked") : t("act.like")}
      </button>
      {err && <span role="alert" style={{ fontSize: 11, color: "#b91c1c" }}>{err}</span>}
    </span>
  );
}

export function TrackActions({ trackId }: { trackId: string }) {
  const { t } = useQMediaT();
  const [liked, setLiked] = useState(false);
  const [lists, setLists] = useState<{ id: string; name: string }[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const onLike = async () => {
    setBusy(true);
    const r = await likeTrack(fetch, trackId);
    setBusy(false);
    if (r.ok) { setLiked(Boolean(r.liked)); setMsg(null); } else setMsg({ text: t(actErrorKey(r.status)), error: true });
  };
  const openLists = async () => {
    setBusy(true);
    const r = await myPlaylists(fetch);
    setBusy(false);
    if (r.ok) { setLists(r.items); setMsg(r.items.length ? null : { text: t("act.noPlaylists"), error: false }); } else setMsg({ text: t(actErrorKey(r.status)), error: true });
  };
  const onAdd = async (playlistId: string) => {
    setBusy(true);
    const r = await addToPlaylist(fetch, playlistId, trackId);
    setBusy(false);
    setLists(null);
    setMsg(r.ok ? { text: t("act.added"), error: false } : { text: t(actErrorKey(r.status)), error: true });
  };

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button type="button" disabled={busy} onClick={onLike} aria-pressed={liked} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: liked ? "rgba(225,29,72,0.08)" : "#fff", color: liked ? "#e11d48" : "#475569", cursor: "pointer" }}>
        {liked ? t("act.liked") : t("act.like")}
      </button>
      {lists && lists.length > 0 ? (
        <select aria-label={t("act.choosePlaylist")} defaultValue="" onChange={(e) => e.target.value && onAdd(e.target.value)} style={{ fontSize: 11, padding: "3px 6px", borderRadius: 8 }}>
          <option value="" disabled>{t("act.choosePlaylist")}</option>
          {lists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      ) : (
        <button type="button" disabled={busy} onClick={openLists} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer" }}>
          {t("act.toPlaylist")}
        </button>
      )}
      {msg && <span role={msg.error ? "alert" : "status"} style={{ fontSize: 11, color: msg.error ? "#b91c1c" : "#0f766e" }}>{msg.text}</span>}
    </span>
  );
}
