"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import type { Account } from "../_lib/types";

// Web Speech API typings — not in lib.dom.d.ts everywhere.
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number; [n: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SRCtor = new () => SR;

function getRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type TabId = "overview" | "earn" | "send" | "grow" | "security";

type CommandResult =
  | { kind: "balance"; reply: string }
  | { kind: "openTab"; tab: TabId; reply: string }
  | { kind: "scroll"; anchor: string; reply: string }
  | { kind: "unknown"; raw: string };

const TAB_KEYWORDS: Record<TabId, string[]> = {
  overview: ["overview", "обзор", "главн", "шолу"],
  earn: ["earn", "earnings", "income", "зарабат", "доход", "табыс", "кіріс"],
  send: ["send", "transfer", "pay", "отправ", "перевод", "платеж", "жібер", "аудар"],
  grow: ["grow", "growth", "trust", "goal", "savings", "рост", "цел", "довер", "өс"],
  security: ["security", "audit", "device", "безопасн", "аудит", "устрой", "қауіпсіз"],
};

const ANCHOR_KEYWORDS: Array<{ id: string; keys: string[] }> = [
  { id: "bank-anchor-wallet", keys: ["wallet", "balance", "кошел", "баланс", "әмиян"] },
  { id: "bank-anchor-flow", keys: ["flow", "sankey", "поток", "ағын"] },
  { id: "bank-anchor-timetravel", keys: ["time", "history", "истор", "тарих", "машин"] },
  { id: "bank-anchor-heatmap", keys: ["heatmap", "calendar", "карт", "теплов"] },
  { id: "bank-anchor-forecast", keys: ["forecast", "future", "прогноз", "болжам"] },
  { id: "bank-anchor-trust", keys: ["trust", "довер", "сенім"] },
  { id: "bank-anchor-tiers", keys: ["tier", "уров", "дең"] },
  { id: "bank-anchor-achievements", keys: ["achiev", "badge", "награ", "достижен", "марап"] },
  { id: "bank-anchor-ecosystem", keys: ["ecosystem", "pulse", "экосис", "пульс"] },
  { id: "bank-anchor-statement", keys: ["statement", "autopilot", "автопил"] },
  { id: "bank-anchor-audit-unified", keys: ["audit", "feed", "журнал"] },
  { id: "bank-anchor-constellation", keys: ["constell", "созвезд"] },
];

function parse(transcript: string): CommandResult {
  const t = transcript.trim().toLowerCase();
  if (!t) return { kind: "unknown", raw: transcript };

  // Balance — short circuit
  if (/\b(balance|баланс|әмиян)\b/.test(t)) {
    return { kind: "balance", reply: "balance" };
  }

  // Tab switch
  for (const tab of Object.keys(TAB_KEYWORDS) as TabId[]) {
    for (const kw of TAB_KEYWORDS[tab]) {
      if (t.includes(kw)) {
        return { kind: "openTab", tab, reply: tab };
      }
    }
  }

  // Anchor scroll
  for (const a of ANCHOR_KEYWORDS) {
    for (const kw of a.keys) {
      if (t.includes(kw)) {
        return { kind: "scroll", anchor: a.id, reply: a.id };
      }
    }
  }

  return { kind: "unknown", raw: transcript };
}

export function VoiceCommand({
  account,
  setActiveTab,
  notify,
}: {
  account: Account;
  setActiveTab: (id: TabId) => void;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t, lang } = useI18n();
  const { code } = useCurrency();
  const ctorRef = useRef<SRCtor | null>(null);
  const recRef = useRef<SR | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    const ctor = getRecognitionCtor();
    ctorRef.current = ctor;
    setSupported(!!ctor);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined") return;
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";
        synth.cancel();
        synth.speak(u);
      } catch {
        // ignore — TTS is a nice-to-have
      }
    },
    [lang],
  );

  const handleResult = useCallback(
    (raw: string) => {
      setTranscript(raw);
      const cmd = parse(raw);
      if (cmd.kind === "balance") {
        const sentence = t("voice.balanceReply", {
          amount: formatCurrency(account.balance, code),
        });
        notify(sentence, "info");
        speak(sentence);
        setLastResult(sentence);
      } else if (cmd.kind === "openTab") {
        setActiveTab(cmd.tab);
        const sentence = t("voice.tabReply", { tab: t(`tab.${cmd.tab}`) });
        notify(sentence, "success");
        speak(sentence);
        setLastResult(sentence);
      } else if (cmd.kind === "scroll") {
        const el =
          typeof document !== "undefined" ? document.getElementById(cmd.anchor) : null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          const sentence = t("voice.scrollReply");
          notify(sentence, "success");
          setLastResult(sentence);
        } else {
          const sentence = t("voice.notFound");
          notify(sentence, "error");
          setLastResult(sentence);
        }
      } else {
        const sentence = t("voice.unknownReply", { heard: raw });
        notify(sentence, "info");
        setLastResult(sentence);
      }
    },
    [account.balance, code, notify, setActiveTab, speak, t],
  );

  const start = useCallback(() => {
    const ctor = ctorRef.current;
    if (!ctor) return;
    try {
      const rec = new ctor();
      rec.lang = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          const text = r[0]?.transcript ?? "";
          if (r.isFinal) final += text;
          else interim += text;
        }
        setTranscript(final || interim);
        if (final) handleResult(final);
      };
      rec.onerror = (e) => {
        notify(t("voice.errorReply", { kind: e.error ?? "unknown" }), "error");
        setListening(false);
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
      setTranscript("");
      setLastResult(null);
    } catch (err) {
      notify(t("voice.errorReply", { kind: "start" }), "error");
      setListening(false);
    }
  }, [handleResult, lang, notify, t]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  if (supported === null) return null; // SSR / pre-mount

  const disabled = !supported;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 88,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {(transcript || lastResult) && (listening || lastResult) ? (
        <div
          style={{
            background: "#0f172a",
            color: "#f1f5f9",
            padding: "10px 14px",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(15,23,42,0.32)",
            fontSize: 12,
            maxWidth: 280,
            pointerEvents: "auto",
          }}
        >
          {listening && transcript ? (
            <div style={{ opacity: 0.85 }}>
              <span style={{ fontSize: 10, opacity: 0.6, marginRight: 6 }}>
                {t("voice.listening")}
              </span>
              {transcript}
            </div>
          ) : null}
          {lastResult && !listening ? (
            <div style={{ fontWeight: 600 }}>{lastResult}</div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={listening ? stop : start}
        title={
          disabled
            ? t("voice.unsupported")
            : listening
              ? t("voice.stopHint")
              : t("voice.startHint")
        }
        aria-label={listening ? t("voice.stopHint") : t("voice.startHint")}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: disabled
            ? "#cbd5e1"
            : listening
              ? "linear-gradient(135deg, #dc2626, #f97316)"
              : "linear-gradient(135deg, #0d9488, #0ea5e9)",
          color: "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: "0 8px 20px rgba(15,23,42,0.32)",
          fontSize: 22,
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 120ms ease",
          animation: listening ? "aevion-voice-pulse 1.2s ease-in-out infinite" : "none",
        }}
      >
        {listening ? "■" : "🎙"}
      </button>
      <style>{`
        @keyframes aevion-voice-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 20px rgba(220,38,38,0.45); }
          50% { transform: scale(1.08); box-shadow: 0 8px 28px rgba(220,38,38,0.65); }
        }
      `}</style>
    </div>
  );
}
