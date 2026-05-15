"use client";

import React, { useEffect, useRef, useState } from "react";

// Музыкальный плеер CyberChess.
// Источники: пользовательские треки (drag-drop файлов через FileReader URL),
// произвольный URL (mp3/ogg/stream), и список рекомендованных публичных
// источников (без хардкода чужих файлов — даём кнопку открыть библиотеку
// royalty-free и пользователь сам подберёт URL).
//
// Список треков хранится в localStorage, blob: URL'ы воссоздаются при загрузке
// файлов заново.

const PLAYLIST_KEY = "cyberchess_music_playlist_v1";

export interface MusicTrack {
  id: string;
  name: string;
  url: string;        // http(s):// или blob: URL (blob теряется после reload)
  isLocal: boolean;
  addedAt: number;
}

function loadPlaylist(): MusicTrack[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLAYLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MusicTrack[];
    // blob: URL'ы не выживают после reload — отфильтровываем
    return Array.isArray(parsed) ? parsed.filter(t => !t.url.startsWith("blob:")) : [];
  } catch { return []; }
}

function savePlaylist(list: MusicTrack[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PLAYLIST_KEY, JSON.stringify(list.filter(t => !t.url.startsWith("blob:")))); } catch {}
}

// Рекомендуемые источники royalty-free музыки — открываются во внешней вкладке,
// пользователь копирует прямой URL и вставляет в "Добавить URL".
const SOURCES = [
  { name: "Pixabay Music (CC0)", url: "https://pixabay.com/music/", hint: "Бесплатно, без attribution" },
  { name: "Free Music Archive", url: "https://freemusicarchive.org/", hint: "CC лицензии, можно фильтровать по типу" },
  { name: "Incompetech (Kevin MacLeod)", url: "https://incompetech.com/music/royalty-free/", hint: "CC BY 4.0, классика и cinematic" },
  { name: "Bensound", url: "https://www.bensound.com/", hint: "Free with attribution" },
  { name: "YouTube Audio Library", url: "https://studio.youtube.com/channel/audio", hint: "Требует YT-аккаунт, есть no-attribution треки" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MusicPlayer({ open, onClose }: Props) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [urlInput, setUrlInput] = useState("");
  const [urlName, setUrlName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setTracks(loadPlaylist()); }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (currentIdx === null || !audioRef.current) return;
    const t = tracks[currentIdx];
    if (!t) return;
    audioRef.current.src = t.url;
    audioRef.current.volume = volume;
    if (playing) audioRef.current.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  const playTrack = (idx: number) => {
    setCurrentIdx(idx);
    setPlaying(true);
    setTimeout(() => { audioRef.current?.play().catch(() => setPlaying(false)); }, 50);
  };

  const togglePlay = () => {
    if (!audioRef.current || currentIdx === null) {
      if (tracks.length > 0) playTrack(0);
      return;
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setPlaying(true); }
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    const next = currentIdx === null ? 0 : (currentIdx + 1) % tracks.length;
    playTrack(next);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    const prev = currentIdx === null ? 0 : (currentIdx - 1 + tracks.length) % tracks.length;
    playTrack(prev);
  };

  const removeTrack = (idx: number) => {
    const t = tracks[idx];
    if (t.url.startsWith("blob:")) URL.revokeObjectURL(t.url);
    const next = tracks.filter((_, i) => i !== idx);
    setTracks(next); savePlaylist(next);
    if (currentIdx === idx) { audioRef.current?.pause(); setCurrentIdx(null); setPlaying(false); }
    else if (currentIdx !== null && idx < currentIdx) setCurrentIdx(currentIdx - 1);
  };

  const addLocalFiles = (files: FileList) => {
    const added: MusicTrack[] = [];
    Array.from(files).forEach(f => {
      if (!f.type.startsWith("audio/")) return;
      added.push({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name.replace(/\.[^.]+$/, ""),
        url: URL.createObjectURL(f),
        isLocal: true,
        addedAt: Date.now(),
      });
    });
    if (added.length > 0) {
      const next = [...tracks, ...added];
      setTracks(next);
      // local blob: URL'ы не сохраняем — они теряются после reload
      savePlaylist(next);
    }
  };

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url || !/^https?:\/\//.test(url)) return;
    const name = urlName.trim() || url.split("/").pop()?.split("?")[0] || "URL track";
    const next = [...tracks, {
      id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name, url, isLocal: false, addedAt: Date.now(),
    }];
    setTracks(next); savePlaylist(next);
    setUrlInput(""); setUrlName("");
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 280,
        background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto",
          background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.32)",
          padding: 24, color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🎵 Музыкальный плеер</h2>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Player controls */}
        <div style={{ background: "linear-gradient(135deg,#f8fafc,#e2e8f0)", border: "1px solid #cbd5e1", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, minHeight: 18 }}>
            {currentIdx !== null && tracks[currentIdx] ? `▶ ${tracks[currentIdx].name}` : "Ничего не играет"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <button onClick={prevTrack} disabled={tracks.length === 0} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: tracks.length ? "pointer" : "not-allowed", fontWeight: 700 }}>⏮</button>
            <button onClick={togglePlay} disabled={tracks.length === 0} style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#059669", color: "#fff", cursor: tracks.length ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 14 }}>{playing ? "⏸ Пауза" : "▶ Играть"}</button>
            <button onClick={nextTrack} disabled={tracks.length === 0} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: tracks.length ? "pointer" : "not-allowed", fontWeight: 700 }}>⏭</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>🔊</span>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(parseFloat(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "#64748b", minWidth: 36, textAlign: "right" }}>{Math.round(volume * 100)}%</span>
          </div>
          <audio ref={audioRef} onEnded={nextTrack} preload="metadata" />
        </div>

        {/* Add tracks */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>📁 Добавить локальный файл</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={e => { if (e.target.files) addLocalFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            style={{ width: "100%", padding: 8, border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc", fontSize: 13 }}
          />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>mp3/ogg/wav. Файлы остаются только в этой сессии (privacy — не загружаются на сервер).</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>🔗 Добавить URL</div>
          <input
            type="text"
            placeholder="Имя трека (опционально)"
            value={urlName}
            onChange={e => setUrlName(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 6, fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder="https://example.com/track.mp3"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addUrl(); }}
              style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
            />
            <button onClick={addUrl} style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#059669", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>+</button>
          </div>
        </div>

        {/* Recommended sources */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>🌐 Рекомендуемые источники royalty-free</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SOURCES.map(s => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener"
                 title={s.hint}
                 style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 999, background: "#f8fafc", color: "#0f172a", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                {s.name} ↗
              </a>
            ))}
          </div>
        </div>

        {/* Playlist */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>📋 Плейлист ({tracks.length})</div>
          {tracks.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8", padding: 16, textAlign: "center", border: "1px dashed #e2e8f0", borderRadius: 8 }}>
              Пока пусто — добавь файл или URL выше
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
              {tracks.map((t, idx) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: currentIdx === idx ? "#dcfce7" : "#fff",
                  border: `1px solid ${currentIdx === idx ? "#22c55e" : "#e2e8f0"}`,
                  borderRadius: 8,
                }}>
                  <button onClick={() => playTrack(idx)} title="Играть" style={{ width: 28, height: 28, border: "none", borderRadius: "50%", background: currentIdx === idx && playing ? "#22c55e" : "#f1f5f9", cursor: "pointer", fontSize: 12 }}>▶</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{t.isLocal ? "📁 локальный" : "🔗 URL"}</div>
                  </div>
                  <button onClick={() => removeTrack(idx)} title="Удалить" style={{ width: 28, height: 28, border: "1px solid #fecaca", borderRadius: 6, background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
