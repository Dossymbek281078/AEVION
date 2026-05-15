'use client';

/**
 * VoiceCoach.tsx
 *
 * Floating bottom-right panel that plays AI voice commentary
 * for CyberChess moves via the backend voice-coach router
 * (LLM-backed: /api/cyberchess-voice-coach/comment + /ask + /tts).
 *
 * Features:
 *   - Per-move commentary (LLM via QCoreAI, with rule-based fallback)
 *   - Chat-style Q&A panel (collapsible) — user types "почему?" → /ask → TTS
 *   - Recent commentary list (last 5 moves) — clickable to re-listen
 *   - Streaming indicator (typed-out text while LLM/TTS resolve)
 *   - Settings: model selector, temperature slider
 *   - Persisted prefs (mute, voice, volume, model, temperature) in localStorage
 *
 * Props:
 *   enabled  — global feature toggle from parent
 *   fen      — current FEN string
 *   lastMove — most recent move
 *   eval     — current engine evaluation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

interface ModelOption {
  id: string;
  name: string;
}

interface RecentItem {
  id: string;
  san: string;
  text: string;
  source: 'llm' | 'fallback';
  ts: number;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export interface VoiceCoachProps {
  enabled: boolean;
  fen: string;
  lastMove: LastMove | null;
  eval: EvalInfo | null;
  phase?: 'opening' | 'middlegame' | 'endgame';
  /** Recent SAN history (newest last). Used as context for Q&A. */
  history?: string[];
  /** Which side the local user plays as. */
  userSide?: 'w' | 'b';
  /** Override API base; defaults to '/api/cyberchess-voice-coach'. */
  apiBase?: string;
}

// ─── localStorage keys ───────────────────────────────────────────────────
const LS_ENABLED = 'cc_voice_coach_enabled';
const LS_VOICE = 'cc_voice_coach_voice';
const LS_VOLUME = 'cc_voice_coach_volume';
const LS_MODEL = 'cc_voice_coach_model';
const LS_TEMP = 'cc_voice_coach_temp';
const LS_SESSION = 'cc_voice_coach_session_id';

// ─── Fallback voice list (used until /voices loads) ─────────────────────
const FALLBACK_VOICES: VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'multilingual', gender: 'female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',   language: 'multilingual', gender: 'female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',  language: 'multilingual', gender: 'female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'multilingual', gender: 'male' },
];

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'default', name: 'QCoreAI (default)' },
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

function makeSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Typed-out streaming text hook ──────────────────────────────────────
function useTypedText(target: string, speedMs = 18): string {
  const [shown, setShown] = useState<string>('');
  useEffect(() => {
    if (!target) {
      setShown('');
      return;
    }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) window.clearInterval(id);
    }, speedMs);
    return () => window.clearInterval(id);
  }, [target, speedMs]);
  return shown;
}

// ─── Component ───────────────────────────────────────────────────────────
export default function VoiceCoach({
  enabled,
  fen,
  lastMove,
  eval: evalInfo,
  phase,
  history,
  userSide,
  apiBase = '/api/cyberchess-voice-coach',
}: VoiceCoachProps): React.ReactElement | null {
  // ─── Persisted user preferences ──────────────────────────────────────
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
  const [model, setModel] = useState<string>(() =>
    readLocal(LS_MODEL, 'default', (raw) => raw),
  );
  const [temperature, setTemperature] = useState<number>(() =>
    readLocal(LS_TEMP, 0.4, (raw) => {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.4;
    }),
  );

  // ─── Session id (persisted so Q&A history survives reload) ──────────
  const sessionIdRef = useRef<string>(
    readLocal(LS_SESSION, '', (raw) => raw) || makeSessionId(),
  );
  useEffect(() => {
    writeLocal(LS_SESSION, sessionIdRef.current);
  }, []);

  // ─── UI state ───────────────────────────────────────────────────────
  const [voices, setVoices] = useState<VoiceOption[]>(FALLBACK_VOICES);
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [transcript, setTranscript] = useState<string>('');
  const [transcriptSource, setTranscriptSource] = useState<'llm' | 'fallback' | ''>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isLoadingComment, setIsLoadingComment] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  const [recent, setRecent] = useState<RecentItem[]>([]);

  // ─── Refs ──────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastSanRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Typed-out streaming for the active transcript (gives a "thinking" feel).
  const typedTranscript = useTypedText(transcript);

  // ─── Persist prefs ─────────────────────────────────────────────────
  useEffect(() => writeLocal(LS_ENABLED, muted ? 'false' : 'true'), [muted]);
  useEffect(() => writeLocal(LS_VOICE, voiceId), [voiceId]);
  useEffect(() => writeLocal(LS_VOLUME, String(volume)), [volume]);
  useEffect(() => writeLocal(LS_MODEL, model), [model]);
  useEffect(() => writeLocal(LS_TEMP, String(temperature)), [temperature]);

  // ─── Apply volume to <audio> ───────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ─── Load /voices catalogue ───────────────────────────────────────
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
        if (Array.isArray(data?.models) && data.models.length > 0) {
          setModels(data.models as ModelOption[]);
        }
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  // ─── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();
      if (chatAbortRef.current) chatAbortRef.current.abort();
    };
  }, []);

  // ─── Play arbitrary text via TTS ─────────────────────────────────
  const playTTS = useCallback(
    async (text: string, signal?: AbortSignal): Promise<void> => {
      if (!text) return;
      const ttsRes = await fetch(`${apiBase}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
        signal,
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
      if (signal?.aborted) return;

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.volume = volume;
      audio.src = url;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => {
        setIsSpeaking(false);
        setErrorMsg('Ошибка воспроизведения аудио');
      };
      try {
        await audio.play();
      } catch {
        setErrorMsg('Нажмите кнопку, чтобы разрешить звук в браузере');
      }
    },
    [apiBase, voiceId, volume],
  );

  // ─── React to new move: fetch comment → TTS ──────────────────────
  useEffect(() => {
    if (!enabled || muted) return;
    if (!lastMove || !lastMove.san) return;
    if (lastSanRef.current === lastMove.san) return;
    lastSanRef.current = lastMove.san;

    const ctrl = new AbortController();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = ctrl;

    (async () => {
      setErrorMsg(null);
      setIsLoadingComment(true);
      try {
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
            model,
            temperature,
          }),
          signal: ctrl.signal,
        });
        if (!commentRes.ok) throw new Error(`comment ${commentRes.status}`);
        const json = (await commentRes.json()) as {
          text: string;
          source?: 'llm' | 'fallback';
        };
        const text = json?.text ?? '';
        if (!text) return;
        setTranscript(text);
        setTranscriptSource(json?.source ?? 'fallback');

        // append to recent list (cap 5)
        setRecent((prev) => {
          const next: RecentItem[] = [
            {
              id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              san: lastMove.san,
              text,
              source: json?.source ?? 'fallback',
              ts: Date.now(),
            },
            ...prev,
          ].slice(0, 5);
          return next;
        });

        await playTTS(text, ctrl.signal);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setErrorMsg((e as Error)?.message ?? 'Ошибка коуча');
      } finally {
        setIsLoadingComment(false);
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMove?.san]);

  // ─── Manual stop ─────────────────────────────────────────────────
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

  function replayRecent(item: RecentItem) {
    setTranscript(item.text);
    setTranscriptSource(item.source);
    const ctrl = new AbortController();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = ctrl;
    playTTS(item.text, ctrl.signal).catch(() => {
      /* surfaced via errorMsg already */
    });
  }

  // ─── Chat / Q&A submit ───────────────────────────────────────────
  const submitQuestion = useCallback(async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setErrorMsg(null);

    const ctrl = new AbortController();
    if (chatAbortRef.current) chatAbortRef.current.abort();
    chatAbortRef.current = ctrl;

    setChatTurns((prev) => [
      ...prev,
      { role: 'user', content: q, ts: Date.now() },
    ]);
    setChatLoading(true);
    try {
      const r = await fetch(`${apiBase}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          fen,
          lastMove: lastMove?.san ?? null,
          history,
          userSide,
          eval: evalInfo,
          sessionId: sessionIdRef.current,
          model,
          temperature,
        }),
        signal: ctrl.signal,
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`ask ${r.status}: ${detail.slice(0, 120)}`);
      }
      const data = (await r.json()) as { text: string; sessionId?: string };
      if (data?.sessionId) sessionIdRef.current = data.sessionId;
      const answer = data?.text ?? '';
      setChatTurns((prev) => [
        ...prev,
        { role: 'assistant', content: answer, ts: Date.now() },
      ]);
      if (!muted && answer) {
        playTTS(answer, ctrl.signal).catch(() => {});
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setErrorMsg((e as Error)?.message ?? 'Ошибка диалога');
    } finally {
      setChatLoading(false);
    }
  }, [
    apiBase,
    chatInput,
    chatLoading,
    fen,
    lastMove?.san,
    history,
    userSide,
    evalInfo,
    model,
    temperature,
    muted,
    playTTS,
  ]);

  async function clearChat() {
    setChatTurns([]);
    try {
      await fetch(
        `${apiBase}/sessions/${encodeURIComponent(sessionIdRef.current)}/clear`,
        { method: 'POST' },
      );
    } catch {
      /* best effort */
    }
    // rotate session id so the server starts fresh on next /ask
    sessionIdRef.current = makeSessionId();
    writeLocal(LS_SESSION, sessionIdRef.current);
  }

  // ─── Don't render if feature globally disabled ───────────────────
  if (!enabled) return null;

  const selectedVoice = useMemoSelectedVoice(voices, voiceId);

  // ─── Styles ─────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: 16,
    bottom: 16,
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
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
  const btnBase: React.CSSProperties = {
    background: '#2a2f3a',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
  };
  const btnActive: React.CSSProperties = { ...btnBase, background: '#1f6feb' };
  const muteBtnStyle: React.CSSProperties = muted ? btnBase : btnActive;
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  };
  const labelStyle: React.CSSProperties = {
    color: '#9aa4b2',
    fontSize: 11,
    minWidth: 64,
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
    position: 'relative',
  };
  const sourceTagStyle: React.CSSProperties = {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: transcriptSource === 'llm' ? '#7ee787' : '#d29922',
    opacity: 0.85,
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
  const sectionTitleStyle: React.CSSProperties = {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#7a8694',
  };
  const recentItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: '6px 8px',
    marginTop: 4,
    color: '#cfd6df',
    fontSize: 11,
    cursor: 'pointer',
    lineHeight: 1.35,
  };
  const chatLogStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 8,
    maxHeight: 200,
    overflowY: 'auto',
    fontSize: 12,
    lineHeight: 1.4,
  };
  const chatInputRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    marginTop: 6,
  };
  const chatInputStyle: React.CSSProperties = {
    flex: 1,
    background: '#0f131c',
    color: '#e6edf3',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
  };

  return (
    <div style={panelStyle} role="region" aria-label="AI Voice Coach">
      <div style={headerStyle}>
        <span style={titleStyle}>
          <span aria-hidden>🎙️</span> AI Voice Coach
          {isLoadingComment && (
            <span style={indicatorStyle}>
              <span aria-hidden>⏳</span> думает…
            </span>
          )}
          {isSpeaking && (
            <span style={indicatorStyle}>
              <span aria-hidden>🔊</span> говорит…
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setShowChat((v) => !v)}
            style={showChat ? btnActive : btnBase}
            title="Q&A с коучем"
            aria-pressed={showChat}
          >
            💬
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            style={showSettings ? btnActive : btnBase}
            title="Настройки"
            aria-pressed={showSettings}
          >
            ⚙
          </button>
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

      {showSettings && (
        <>
          <div style={rowStyle}>
            <span style={labelStyle}>Model</span>
            <select
              style={selectStyle}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Choose LLM model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Temp</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ flex: 1 }}
              aria-label="Temperature"
            />
            <span style={{ width: 32, textAlign: 'right', color: '#9aa4b2' }}>
              {temperature.toFixed(2)}
            </span>
          </div>
        </>
      )}

      <div style={transcriptStyle} aria-live="polite">
        {transcript ? (
          <>
            {typedTranscript || transcript}
            {transcriptSource && (
              <span style={sourceTagStyle}>{transcriptSource}</span>
            )}
          </>
        ) : muted ? (
          'Голос выключен — комментарии не озвучиваются.'
        ) : (
          `Готов к комментарию. Голос: ${selectedVoice?.name ?? 'default'}.`
        )}
      </div>

      {recent.length > 0 && (
        <>
          <div style={sectionTitleStyle}>Последние ходы</div>
          {recent.map((item) => (
            <button
              type="button"
              key={item.id}
              style={recentItemStyle}
              onClick={() => replayRecent(item)}
              title="Послушать снова"
            >
              <strong style={{ color: '#e6edf3' }}>{item.san}</strong>{' '}
              <span style={{ color: '#7a8694' }}>·</span> {item.text}
            </button>
          ))}
        </>
      )}

      {showChat && (
        <>
          <div style={sectionTitleStyle}>
            Вопрос коучу
            {chatTurns.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                style={{
                  ...btnBase,
                  marginLeft: 8,
                  padding: '2px 6px',
                  fontSize: 10,
                }}
                title="Очистить историю"
              >
                ✕ clear
              </button>
            )}
          </div>
          <div style={chatLogStyle}>
            {chatTurns.length === 0 ? (
              <span style={{ color: '#7a8694', fontStyle: 'italic' }}>
                Спроси: «почему мой ход плохой?», «какой план?», «что лучше?»
              </span>
            ) : (
              chatTurns.map((t, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      color: t.role === 'user' ? '#79c0ff' : '#7ee787',
                      fontWeight: 600,
                      marginRight: 4,
                    }}
                  >
                    {t.role === 'user' ? 'Вы:' : 'Коуч:'}
                  </span>
                  <span style={{ color: '#cfd6df' }}>{t.content}</span>
                </div>
              ))
            )}
            {chatLoading && (
              <div style={{ color: '#d29922', fontStyle: 'italic' }}>
                коуч думает…
              </div>
            )}
          </div>
          <div style={chatInputRowStyle}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitQuestion();
                }
              }}
              placeholder="почему этот ход?"
              style={chatInputStyle}
              aria-label="Question to coach"
              disabled={chatLoading}
            />
            <button
              type="button"
              onClick={submitQuestion}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                ...btnActive,
                opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                cursor:
                  chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Send
            </button>
          </div>
        </>
      )}

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
