'use client';

/**
 * VoiceCoach.tsx
 *
 * Floating bottom-right panel that plays AI voice commentary
 * for CyberChess moves via the backend voice-coach router
 * (/api/cyberchess-voice-coach/comment + /tts → ElevenLabs).
 *
 * Props:
 *   enabled  — global feature toggle from parent
 *   fen      — current FEN string
 *   lastMove — most recent move { san, from, to }
 *   eval     — current engine evaluation { cp, mate }
 *
 * Persists user preferences (on/off, voice, volume) to localStorage.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────
interface LastMove {
  san: string;
  from: string;
  to: string;
  piece?: string;
  color?: 'w' | 'b';
  isCheck?: boolean;
  isCapture?: boolean;
  isCastling?: boolean;
  isPromotion?: boolean;
}

interface EvalInfo {
  cp?: number | null;
  mate?: number | null;
}

interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: string;
}

export interface VoiceCoachProps {
  enabled: boolean;
  fen: string;
  lastMove: LastMove | null;
  eval: EvalInfo | null;
  phase?: 'opening' | 'middlegame' | 'endgame';
  /** Override API base; defaults to '/api/cyberchess-voice-coach'. */
  apiBase?: string;
}

// ─── localStorage keys ───────────────────────────────────────────────────
const LS_ENABLED = 'cc_voice_coach_enabled';
const LS_VOICE = 'cc_voice_coach_voice';
const LS_VOLUME = 'cc_voice_coach_volume';

// ─── Fallback voice list (used until /voices loads) ─────────────────────
const FALLBACK_VOICES: VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'multilingual', gender: 'female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',   language: 'multilingual', gender: 'female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',  language: 'multilingual', gender: 'female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'multilingual', gender: 'male' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
function readLocal<T>(key: string, fallback: T, parser: (raw: string) => T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return parser(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / disabled — ignore */
  }
}

// ─── Component ───────────────────────────────────────────────────────────
export default function VoiceCoach({
  enabled,
  fen,
  lastMove,
  eval: evalInfo,
  phase,
  apiBase = '/api/cyberchess-voice-coach',
}: VoiceCoachProps): React.ReactElement | null {
  // — User preferences (persisted) —
  const [muted, setMuted] = useState<boolean>(() =>
    readLocal(LS_ENABLED, false, (raw) => raw === 'false' || raw === '0'),
  );
  const [voiceId, setVoiceId] = useState<string>(() =>
    readLocal(LS_VOICE, FALLBACK_VOICES[0].id, (raw) => raw),
  );
  const [volume, setVolume] = useState<number>(() =>
    readLocal(LS_VOLUME, 0.8, (raw) => {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8;
    }),
  );

  // — UI state —
  const [voices, setVoices] = useState<VoiceOption[]>(FALLBACK_VOICES);
  const [transcript, setTranscript] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // — Refs —
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastSanRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Persist prefs ──────────────────────────────────────────────────────
  useEffect(() => writeLocal(LS_ENABLED, muted ? 'false' : 'true'), [muted]);
  useEffect(() => writeLocal(LS_VOICE, voiceId), [voiceId]);
  useEffect(() => writeLocal(LS_VOLUME, String(volume)), [volume]);

  // ─── Apply volume to <audio> ───────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ─── Load voice list from backend ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/voices`);
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        if (Array.isArray(data?.voices) && data.voices.length > 0) {
          setVoices(data.voices as VoiceOption[]);
        }
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  // ─── Cleanup blob URLs on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ─── Main effect: react to new move ────────────────────────────────────
  useEffect(() => {
    if (!enabled || muted) return;
    if (!lastMove || !lastMove.san) return;
    // Skip duplicates (same SAN). Replace with a stricter key if you have ply count.
    if (lastSanRef.current === lastMove.san) return;
    lastSanRef.current = lastMove.san;

    const ctrl = new AbortController();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = ctrl;

    (async () => {
      setErrorMsg(null);
      try {
        // 1. fetch comment text
        const commentRes = await fetch(`${apiBase}/comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fen,
            lastMove,
            eval: evalInfo,
            isCheck: !!lastMove.isCheck,
            isCapture: !!lastMove.isCapture,
            isCastling: !!lastMove.isCastling,
            isPromotion: !!lastMove.isPromotion,
            phase,
          }),
          signal: ctrl.signal,
        });
        if (!commentRes.ok) throw new Error(`comment ${commentRes.status}`);
        const { text } = (await commentRes.json()) as { text: string };
        if (!text) return;
        setTranscript(text);

        // 2. fetch TTS audio
        const ttsRes = await fetch(`${apiBase}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceId }),
          signal: ctrl.signal,
        });
        if (!ttsRes.ok) {
          if (ttsRes.status === 503) {
            setErrorMsg('ElevenLabs не настроен на сервере');
          } else {
            setErrorMsg(`TTS error ${ttsRes.status}`);
          }
          return;
        }
        const blob = await ttsRes.blob();
        if (ctrl.signal.aborted) return;

        // 3. play
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const audio = audioRef.current;
        audio.volume = volume;
        audio.src = url;

        const onPlay = () => setIsSpeaking(true);
        const onEnd = () => setIsSpeaking(false);
        const onErr = () => {
          setIsSpeaking(false);
          setErrorMsg('Ошибка воспроизведения аудио');
        };
        audio.onplay = onPlay;
        audio.onended = onEnd;
        audio.onerror = onErr;

        try {
          await audio.play();
        } catch (e) {
          // autoplay blocked — surface a friendly hint
          setErrorMsg('Нажмите кнопку, чтобы разрешить звук в браузере');
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setErrorMsg((e as Error)?.message ?? 'Ошибка коуча');
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMove?.san]); // re-run only when SAN changes

  // ─── Manual stop ───────────────────────────────────────────────────────
  function stopAudio() {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setIsSpeaking(false);
  }

  function toggleMute() {
    if (!muted) stopAudio();
    setMuted((m) => !m);
  }

  // ─── Don't render if feature globally disabled ─────────────────────────
  if (!enabled) return null;

  // ─── Styles ────────────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: 16,
    bottom: 16,
    width: 320,
    maxWidth: 'calc(100vw - 32px)',
    background: 'rgba(15, 18, 28, 0.92)',
    color: '#e6edf3',
    border: '1px solid rgba(99, 130, 200, 0.35)',
    borderRadius: 12,
    padding: 12,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(8px)',
    zIndex: 9999,
  };
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  };
  const titleStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
  const muteBtnStyle: React.CSSProperties = {
    background: muted ? '#2a2f3a' : '#1f6feb',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  };
  const labelStyle: React.CSSProperties = {
    color: '#9aa4b2',
    fontSize: 11,
    minWidth: 52,
  };
  const selectStyle: React.CSSProperties = {
    flex: 1,
    background: '#0f131c',
    color: '#e6edf3',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '4px 6px',
    fontSize: 12,
  };
  const transcriptStyle: React.CSSProperties = {
    marginTop: 10,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    minHeight: 38,
    fontSize: 12,
    lineHeight: 1.4,
    color: '#cfd6df',
    fontStyle: transcript ? 'normal' : 'italic',
  };
  const indicatorStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: '#7ee787',
    marginLeft: 6,
  };
  const errStyle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 11,
    color: '#ff7b72',
  };

  const selectedVoice = useMemoSelectedVoice(voices, voiceId);

  return (
    <div style={panelStyle} role="region" aria-label="AI Voice Coach">
      <div style={headerStyle}>
        <span style={titleStyle}>
          <span aria-hidden>🎙️</span> AI Voice Coach
          {isSpeaking && (
            <span style={indicatorStyle}>
              <span aria-hidden>🔊</span> говорит…
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={toggleMute}
          style={muteBtnStyle}
          aria-pressed={!muted}
          title={muted ? 'Включить голос' : 'Выключить голос'}
        >
          {muted ? 'Mute' : 'On'}
        </button>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Voice</span>
        <select
          style={selectStyle}
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          aria-label="Choose voice"
        >
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.gender === 'male' ? '♂' : '♀'})
            </option>
          ))}
        </select>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{ flex: 1 }}
          aria-label="Volume"
        />
        <span style={{ width: 28, textAlign: 'right', color: '#9aa4b2' }}>
          {Math.round(volume * 100)}
        </span>
      </div>

      <div style={transcriptStyle} aria-live="polite">
        {transcript ||
          (muted
            ? 'Голос выключен — комментарии не озвучиваются.'
            : `Готов к комментарию. Голос: ${selectedVoice?.name ?? 'default'}.`)}
      </div>

      {errorMsg && <div style={errStyle}>⚠ {errorMsg}</div>}
    </div>
  );
}

// Tiny helper hook for readability above.
function useMemoSelectedVoice(
  voices: VoiceOption[],
  voiceId: string,
): VoiceOption | undefined {
  return useMemo(() => voices.find((v) => v.id === voiceId), [voices, voiceId]);
}
