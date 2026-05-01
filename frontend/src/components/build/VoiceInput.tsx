"use client";

import { useEffect, useRef, useState } from "react";

// Browser-side Web Speech API. Chrome/Edge support webkitSpeechRecognition.
// Firefox/Safari currently don't — we render a disabled button with a
// tooltip in that case.

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

export type VoiceInputProps = {
  /** Called with the cumulative final transcript (appended chunks). */
  onAppend: (chunk: string) => void;
  lang?: "ru-RU" | "en-US" | "kk-KZ";
  size?: "sm" | "md";
  className?: string;
};

export function VoiceInput({
  onAppend,
  lang = "ru-RU",
  size = "sm",
  className = "",
}: VoiceInputProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState(lang);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(!!ctor);
  }, []);

  function start() {
    setError(null);
    const ctor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : null;
    if (!ctor) {
      setSupported(false);
      return;
    }
    const rec = new ctor();
    rec.lang = activeLang;
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal && r[0]?.transcript) {
          onAppend(r[0].transcript);
        }
      }
    };
    rec.onerror = (e) => {
      setError(e.error || "speech_error");
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
    };
    try {
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
    setRecording(false);
  }

  function cycleLang() {
    setActiveLang((l) => (l === "ru-RU" ? "en-US" : l === "en-US" ? "kk-KZ" : "ru-RU"));
  }

  const sz = size === "md" ? "h-9 px-3 text-sm" : "h-7 px-2 text-xs";

  if (supported === false) {
    return (
      <button
        type="button"
        disabled
        title="Web Speech API not supported in this browser. Try Chrome or Edge."
        className={`inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 text-slate-500 ${sz} ${className}`}
      >
        🎙 voice
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={recording ? stop : start}
        title={
          recording
            ? "Stop recording"
            : `Dictate (${activeLang}). Final transcripts append to the field.`
        }
        className={`inline-flex items-center gap-1 rounded-md border ${sz} ${
          recording
            ? "border-rose-500/50 bg-rose-500/15 text-rose-200 animate-pulse"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
        }`}
      >
        {recording ? "⏹ stop" : "🎙 voice"}
      </button>
      <button
        type="button"
        onClick={cycleLang}
        disabled={recording}
        title="Cycle dictation language"
        className={`rounded-md border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-50 ${sz}`}
      >
        {activeLang.split("-")[0]}
      </button>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
    </div>
  );
}
