"use client";

import { useRef, useState, useEffect } from "react";
import type { AiNotice, Lsr, LsrCalc } from "../lib/types";
import { askConsultant, QUICK_QUESTIONS, type AiMessage } from "../lib/aiConsultant";

interface Props {
  notices: AiNotice[];
  lsr: Lsr;
  calc: LsrCalc;
}

const SEVERITY_STYLE = {
  error:   "bg-red-50 border-red-200 text-red-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info:    "bg-blue-50 border-blue-200 text-blue-800",
};

export function AiChat({ notices, lsr, calc }: Props) {
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      role: "assistant",
      text: "Привет! Я — AI-консультант по сметному делу РК. Вижу твою текущую смету и могу объяснить любое правило, проверить объёмы или подсказать что добавить. Задавай вопросы или нажми кнопку ниже.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [tab, setTab] = useState<"chat" | "notices">("notices");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(question: string) {
    if (!question.trim()) return;
    const userMsg: AiMessage = { role: "user", text: question, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    // Симулируем задержку "печатает..."
    setTimeout(() => {
      const reply = askConsultant(question, lsr, calc);
      setMessages((prev) => [...prev, reply]);
      setThinking(false);
    }, 600 + Math.random() * 400);
  }

  const errorCount = notices.filter((n) => n.severity === "error").length;
  const warnCount  = notices.filter((n) => n.severity === "warning").length;

  return (
    <aside className="w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Шапка */}
      <div className="shrink-0 px-3 py-2.5 border-b border-slate-200 bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">AI</div>
          <div>
            <div className="text-xs font-semibold text-white">Консультант</div>
            <div className="text-[10px] text-slate-400">Сметное дело РК</div>
          </div>
        </div>
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
                <div className="bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-400">
                  <span className="animate-pulse">печатает...</span>
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Задайте вопрос…"
              className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || thinking}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
