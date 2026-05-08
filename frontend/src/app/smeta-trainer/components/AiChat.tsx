"use client";

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import type { AiNotice, Lsr, LsrCalc } from "../lib/types";
import { QUICK_QUESTIONS, type AiMessage } from "../lib/aiConsultant";
import {
  checkBackend,
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
  streamLLM,
  type BackendStatus,
  type ProviderInfo,
} from "../lib/aiBackend";

interface Props {
  notices: AiNotice[];
  lsr: Lsr;
  calc: LsrCalc;
}

/** Внешний API: открыть чат с предзаполненным вопросом про конкретную позицию. */
export interface AiChatHandle {
  askAboutPosition: (rateCode: string, positionId: string) => void;
}

const PROVIDER_KEY = "aevion-smeta-aichat-provider-v1";

const SEVERITY_STYLE = {
  error:   "bg-red-50 border-red-200 text-red-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info:    "bg-blue-50 border-blue-200 text-blue-800",
};

const WELCOME_MESSAGE: AiMessage = {
  role: "assistant",
  text:
    "Привет! Я — AI-консультант по сметному делу РК. Вижу твою текущую смету и могу " +
    "объяснить любое правило, проверить объёмы или подсказать что добавить. Задавай " +
    "вопросы или нажми быструю кнопку ниже.",
  ts: 0, // 0 — приветственное, не сохраняется в history
};

export const AiChat = forwardRef<AiChatHandle, Props>(function AiChat({ notices, lsr, calc }, ref) {
  // History persisted per LSR id
  const [messages, setMessages] = useState<AiMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streamingText, setStreamingText] = useState(""); // текущий incremental ответ
  const [tab, setTab] = useState<"chat" | "notices">("notices");
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load history on mount + when LSR changes
  useEffect(() => {
    const saved = loadChatHistory(lsr.id);
    if (saved.length > 0) setMessages([WELCOME_MESSAGE, ...saved]);
    else setMessages([WELCOME_MESSAGE]);
  }, [lsr.id]);

  // Persist history (без приветственного сообщения с ts=0)
  useEffect(() => {
    const real = messages.filter((m) => m.ts !== 0);
    if (real.length > 0) saveChatHistory(lsr.id, real);
  }, [messages, lsr.id]);

  // Probe backend on mount + restore selected provider
  useEffect(() => {
    checkBackend().then((r) => {
      setBackendStatus(r.status);
      setProviders(r.providers);
      // Restore выбор из localStorage, если он configured; иначе первый configured
      const saved = typeof window !== "undefined" ? localStorage.getItem(PROVIDER_KEY) : null;
      const validSaved = saved && r.providers.find((p) => p.id === saved && p.configured) ? saved : null;
      const fallback = r.providers.find((p) => p.configured)?.id ?? null;
      setSelectedProvider(validSaved ?? fallback);
    });
  }, []);

  function changeProvider(id: string) {
    setSelectedProvider(id);
    if (typeof window !== "undefined") {
      try { localStorage.setItem(PROVIDER_KEY, id); } catch {}
    }
  }

  // Внешний API через ref — открыть чат с вопросом про позицию
  useImperativeHandle(ref, () => ({
    askAboutPosition(rateCode: string, positionId: string) {
      setTab("chat");
      const found = lsr.sections
        .flatMap((s) => s.positions)
        .find((p) => p.id === positionId);
      const sectionTitle = lsr.sections.find((s) => s.positions.some((p) => p.id === positionId))?.title;
      const overrideHint = found?.resourceOverrides ? " (с изменёнными ресурсами)" : "";
      const q = `Расскажи про позицию ${rateCode} (объём ${found?.volume ?? "?"}) в разделе «${sectionTitle ?? "?"}»${overrideHint}: что это за работа, какие могут быть подводные камни, и правильно ли я её применил в этой смете?`;
      setInput(q);
      // Auto-focus input через requestAnimationFrame
      requestAnimationFrame(() => {
        const el = document.getElementById("ai-chat-input") as HTMLInputElement | null;
        el?.focus();
      });
    },
  }), [lsr]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, streamingText]);

  async function send(question: string) {
    if (!question.trim() || thinking) return;
    const userMsg: AiMessage = { role: "user", text: question, ts: Date.now() };
    const historyBefore = messages.filter((m) => m.ts !== 0);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);
    setStreamingText("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let buffer = "";
      const result = await streamLLM(question, historyBefore, lsr, calc, notices, {
        provider: selectedProvider ?? undefined,
        signal: ac.signal,
        onChunk: (txt) => {
          buffer += txt;
          setStreamingText(buffer);
        },
      });
      // финализируем — добавляем cleane сообщение в history, очищаем стрим-буфер
      setMessages((prev) => [...prev, { role: "assistant", text: result.text, ts: Date.now() }]);
      setStreamingText("");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Ошибка обращения к AI. Попробуйте ещё раз.", ts: Date.now() },
        ]);
      }
      setStreamingText("");
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function resetChat() {
    if (!confirm("Очистить всю историю чата?")) return;
    clearChatHistory(lsr.id);
    setMessages([WELCOME_MESSAGE]);
  }

  const configuredProviders = providers.filter((p) => p.configured);

  const errorCount = notices.filter((n) => n.severity === "error").length;
  const warnCount  = notices.filter((n) => n.severity === "warning").length;

  return (
    <aside className="w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Шапка */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-900 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">AI</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white">Консультант</div>
            <div className="text-[10px] truncate">
              {backendStatus === "live" && <span className="text-emerald-400">● live</span>}
              {backendStatus === "stub" && <span className="text-amber-400">● local · нет API-ключа</span>}
              {backendStatus === "offline" && <span className="text-slate-500">● offline</span>}
              {backendStatus === null && <span className="text-slate-500">проверка…</span>}
            </div>
          </div>
          {messages.filter((m) => m.ts !== 0).length > 0 && (
            <button
              onClick={resetChat}
              className="text-slate-500 hover:text-red-400 text-[10px] shrink-0"
              title="Очистить историю чата"
            >
              ⟲
            </button>
          )}
        </div>
        {/* Переключатель моделей — только если есть выбор (>1 configured) */}
        {configuredProviders.length > 1 && backendStatus === "live" && (
          <select
            value={selectedProvider ?? ""}
            onChange={(e) => changeProvider(e.target.value)}
            className="w-full bg-slate-800 text-white text-[10px] border border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-emerald-500"
            disabled={thinking}
          >
            {configuredProviders.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {configuredProviders.length === 1 && backendStatus === "live" && (
          <div className="text-[10px] text-slate-400">
            Модель: <span className="text-white">{configuredProviders[0].name}</span>
          </div>
        )}
      </div>

      {/* Табы */}
      <div className="shrink-0 flex border-b border-slate-200">
        <button
          onClick={() => setTab("notices")}
          className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${tab === "notices" ? "bg-white text-slate-800 border-b-2 border-emerald-500" : "bg-slate-50 text-slate-500 hover:text-slate-700"}`}
        >
          Замечания
          {(errorCount + warnCount) > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${errorCount > 0 ? "bg-red-500 text-white" : "bg-amber-400 text-white"}`}>
              {errorCount + warnCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${tab === "chat" ? "bg-white text-slate-800 border-b-2 border-emerald-500" : "bg-slate-50 text-slate-500 hover:text-slate-700"}`}
        >
          💬 Спросить AI
        </button>
      </div>

      {/* Замечания */}
      {tab === "notices" && (
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {notices.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-xs">Замечаний нет</div>
              <div className="text-[11px] text-slate-300 mt-1">Переключись на «Спросить AI»</div>
            </div>
          ) : (
            notices.map((n) => (
              <div key={n.id} className={`border rounded-lg p-2.5 text-xs ${SEVERITY_STYLE[n.severity]}`}>
                <div className="font-semibold">{n.title}</div>
                <div className="mt-0.5 leading-relaxed text-[11px]">{n.message}</div>
                {n.suggestion && (
                  <div className="mt-1.5 p-1.5 bg-white/60 rounded text-[11px]">
                    <span className="font-semibold">Как исправить: </span>{n.suggestion}
                  </div>
                )}
                {n.reference && <div className="text-[10px] opacity-60 mt-1 italic">{n.reference}</div>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Чат */}
      {tab === "chat" && (
        <>
          {/* История */}
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}>
                  <div>{m.text}</div>
                  {m.refs && m.refs.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 space-y-0.5">
                      {m.refs.map((r, ri) => <div key={ri}>📖 {r}</div>)}
                    </div>
                  )}
                  {m.tip && (
                    <div className="mt-1.5 pt-1.5 border-t border-amber-200 text-[10px] text-amber-700 bg-amber-50/80 rounded px-1.5 py-1">
                      💡 {m.tip}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-800 max-w-[90%] leading-relaxed">
                  {streamingText
                    ? <>{streamingText}<span className="inline-block w-1.5 h-3 bg-slate-500 ml-0.5 animate-pulse" /></>
                    : <span className="text-slate-400 animate-pulse">подключаюсь…</span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Быстрые вопросы */}
          <div className="shrink-0 px-2 py-1.5 border-t border-slate-100 flex flex-wrap gap-1">
            {QUICK_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-full text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Инпут */}
          <div className="shrink-0 p-2 border-t border-slate-200 flex gap-1.5">
            <input
              id="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={thinking ? "Печатает ответ…" : "Задайте вопрос…"}
              disabled={thinking}
              className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
            />
            {thinking ? (
              <button
                onClick={stopStreaming}
                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                title="Прервать ответ"
              >
                ◼
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                ↑
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
});
