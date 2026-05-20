"use client";

/**
 * SpectatorVoiceFeed.tsx
 *
 * Spectator-side subscription to AI VoiceCoach commentary for a live game.
 * Subscribes to the same SSE stream as the board/chat
 * (/api/cyberchess-spectator/:gameId) but only reacts to the named "voice"
 * event emitted by /api/cyberchess-voice-coach/broadcast → spectator router
 * → SSE fan-out.
 *
 * Renders a compact panel with the most recent comment + a short history,
 * auto-plays inline TTS audio when present (via data: URL) unless the viewer
 * mutes it. Mute state persists in localStorage.
 */

import { useEffect, useRef, useState } from "react";

export interface SpectatorVoiceFeedProps {
  gameId: string;
  surface: string;
  text: string;
  textDim: string;
  brand: string;
}

interface VoiceEvent {
  id: string;
  text: string;
  audioUrl?: string;
  fromHost?: boolean;
  ts: number;
}

const MAX_HISTORY = 6;
const MUTE_KEY = "cc_spectator_voice_muted";

export default function SpectatorVoiceFeed({
  gameId,
  surface,
  text,
  textDim,
  brand,
}: SpectatorVoiceFeedProps) {
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);

  // keep ref in sync so the SSE callback can read latest mute state
  useEffect(() => {
    mutedRef.current = muted;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      }
    } catch {
      /* ignore */
    }
    // If user mutes mid-playback, stop the current clip.
    if (muted && audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      setPlaying(false);
    }
  }, [muted]);

  useEffect(() => {
    if (!gameId) return;
    const url = `/api/cyberchess-spectator/${encodeURIComponent(gameId)}`;
    const es = new EventSource(url);

    const onVoice = (ev: MessageEvent) => {
      let payload: VoiceEvent | null = null;
      try {
        payload = JSON.parse(ev.data) as VoiceEvent;
      } catch {
        return;
      }
      if (!payload || typeof payload.text !== "string" || !payload.text) return;

      setEvents((prev) => {
        const next = [...prev, payload!];
        if (next.length > MAX_HISTORY) {
          return next.slice(next.length - MAX_HISTORY);
        }
        return next;
      });

      // Auto-play TTS if not muted and audioUrl is present.
      if (!mutedRef.current && payload.audioUrl && typeof Audio !== "undefined") {
        try {
          if (audioRef.current) {
            try {
              audioRef.current.pause();
            } catch {
              /* ignore */
            }
          }
          const a = new Audio(payload.audioUrl);
          audioRef.current = a;
          a.onended = () => setPlaying(false);
          a.onerror = () => setPlaying(false);
          setPlaying(true);
          // Browsers may block autoplay until user interacts — swallow that.
          a.play().catch(() => setPlaying(false));
        } catch {
          setPlaying(false);
        }
      }
    };

    es.addEventListener("voice", onVoice as EventListener);

    return () => {
      es.removeEventListener("voice", onVoice as EventListener);
      es.close();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* ignore */
        }
        audioRef.current = null;
      }
    };
  }, [gameId]);

  const latest = events.length > 0 ? events[events.length - 1] : null;
  const history = events.slice(0, -1).reverse(); // older below latest

  return (
    <div
      style={{
        background: surface,
        border: `1px solid ${brand}`,
        borderRadius: 10,
        padding: 12,
        boxShadow: latest ? `0 0 12px ${brand}33` : "none",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: brand,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span aria-hidden>🎙</span>
          <span>AI комментарий</span>
          {playing && !muted && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: brand,
                boxShadow: `0 0 6px ${brand}`,
                animation: "voice-pulse 1s ease-in-out infinite",
              }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => setMuted((v) => !v)}
          title={muted ? "Включить голос" : "Отключить голос"}
          style={{
            border: "none",
            background: "transparent",
            color: muted ? textDim : brand,
            fontSize: 16,
            cursor: "pointer",
            padding: "2px 6px",
            lineHeight: 1,
          }}
        >
          {muted ? "🔇" : "📢"}
        </button>
      </div>

      {!latest ? (
        <div
          style={{
            fontSize: 12,
            color: textDim,
            textAlign: "center",
            padding: "10px 4px",
            lineHeight: 1.5,
          }}
        >
          ждём комментарий тренера к следующему ходу…
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 13,
              color: text,
              lineHeight: 1.45,
              padding: "6px 8px",
              background: `${brand}15`,
              borderRadius: 6,
              marginBottom: history.length > 0 ? 8 : 0,
            }}
          >
            {latest.text}
            {latest.audioUrl && muted && (
              <span style={{ color: textDim, fontSize: 11, marginLeft: 6 }}>
                · 🔇 аудио отключено
              </span>
            )}
          </div>

          {history.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                maxHeight: 140,
                overflowY: "auto",
              }}
            >
              {history.map((e) => (
                <div
                  key={e.id}
                  style={{
                    fontSize: 11,
                    color: textDim,
                    lineHeight: 1.4,
                    padding: "2px 6px",
                    borderLeft: `2px solid ${brand}55`,
                  }}
                >
                  {e.text}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes voice-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
