"use client";
/**
 * StreamSourceModal — единая точка выбора источника YouTube/Twitch «смотреть».
 *
 * Заменяет разрозненные window.prompt(...) (открыть PiP из StreamMenu +
 * «включить стрим любимого стримера» из daily-подсказки). Один модал с:
 *  - живой валидацией URL (detectMediaSource → youtube/twitch/url),
 *  - чипом любимого стримера (загрузить / сохранить Twitch-канал),
 *  - подсказкой поддерживаемых форматов.
 *
 * Всё, что делает «смотреть», проходит здесь и вызывает onPlay(src). Куда
 * именно направить (PiP / медиа-панель) — решает вызывающая сторона.
 */

import React, { useEffect, useRef, useState } from "react";
import { detectMediaSource, type PiPSource } from "./WorkspacePiP";

const FAV_KEY = "cc_fav_streamer_v1";

function loadFav(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(FAV_KEY) || ""; } catch { return ""; }
}
function saveFav(channel: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(FAV_KEY, channel); } catch {}
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Пользователь подтвердил источник — открыть его (PiP/панель — на усмотрение родителя). */
  onPlay: (src: PiPSource) => void;
  /** Необязательный префилл поля URL. */
  initialUrl?: string;
}

export default function StreamSourceModal({ open, onClose, onPlay, initialUrl }: Props) {
  const [url, setUrl] = useState("");
  const [fav, setFav] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFav(loadFav());
    setUrl(initialUrl || "");
    // фокус на поле при открытии
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, initialUrl]);

  if (!open) return null;

  const src = detectMediaSource(url.trim());
  const kindLabel =
    src?.kind === "youtube" ? "YouTube ✓" :
    src?.kind === "twitch" ? "Twitch ✓" :
    src?.kind === "url" ? "Прямая ссылка ✓" : "";
  const kindColor =
    src?.kind === "youtube" ? "#dc2626" :
    src?.kind === "twitch" ? "#7c3aed" :
    src?.kind === "url" ? "#0891b2" : "#94a3b8";

  const play = () => {
    const s = detectMediaSource(url.trim());
    if (!s) return;
    if (s.kind === "twitch") saveFav(s.url); // авто-запоминаем последний Twitch как любимый
    onPlay(s);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 8200,
        background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460,
          background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.32)",
          padding: 22, color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📺</span> Смотреть стрим
          </h2>
          <button onClick={onClose} aria-label="Закрыть" style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 15 }}>✕</button>
        </div>

        {/* URL input + live-detect badge */}
        <div style={{ position: "relative", marginBottom: 6 }}>
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && src) play(); }}
            placeholder="Ссылка YouTube / Twitch или канал"
            style={{
              width: "100%", padding: "11px 90px 11px 12px", boxSizing: "border-box",
              border: `1px solid ${src ? kindColor : "#cbd5e1"}`, borderRadius: 10,
              fontSize: 14, outline: "none",
            }}
          />
          {kindLabel && (
            <span style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              fontSize: 11, fontWeight: 900, color: kindColor, whiteSpace: "nowrap",
            }}>{kindLabel}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>
          Поддерживается: youtube.com/watch, youtu.be, youtube.com/live, twitch.tv/канал, или просто ник канала.
        </div>

        {/* Favorite streamer chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {fav ? (
            <button
              onClick={() => setUrl(`https://www.twitch.tv/${fav}`)}
              title="Загрузить любимый Twitch-канал"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999, border: "1px solid #ddd6fe",
                background: "#f5f3ff", color: "#6d28d9", fontSize: 12, fontWeight: 800, cursor: "pointer",
              }}
            >⭐ {fav}</button>
          ) : (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Любимый стример пока не сохранён</span>
          )}
          {src?.kind === "twitch" && src.url !== fav && (
            <button
              onClick={() => { saveFav(src.url); setFav(src.url); }}
              style={{
                padding: "6px 12px", borderRadius: 999, border: "1px solid #cbd5e1",
                background: "#fff", color: "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >⭐ Сохранить «{src.url}»</button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Отмена</button>
          <button
            onClick={play}
            disabled={!src}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: src ? "#7c3aed" : "#e5e7eb", color: src ? "#fff" : "#9ca3af",
              fontSize: 13, fontWeight: 800, cursor: src ? "pointer" : "not-allowed",
            }}
          >▶ Смотреть</button>
        </div>
      </div>
    </div>
  );
}
