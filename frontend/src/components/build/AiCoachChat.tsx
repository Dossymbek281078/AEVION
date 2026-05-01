"use client";

import { useEffect, useRef, useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";

type Turn = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Помоги переписать summary, чтобы звучало сильнее",
  "Какие вакансии мне подходят больше всего?",
  "Что у меня в профиле слабо, и что улучшить за неделю?",
  "Подскажи зарплатную вилку для моей роли в моём городе",
];

export function AiCoachChat({
  initialPrompt,
  height = 520,
}: {
  initialPrompt?: string;
  height?: number;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setError(null);
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const r = await buildApi.aiConsult(next);
      setTurns([...next, { role: "assistant", content: r.reply }]);
    } catch (e) {
      const err = e as BuildApiError;
      const msg =
        err.code === "ANTHROPIC_API_KEY not configured"
          ? "AI coach not configured (no ANTHROPIC_API_KEY on backend)."
          : err.message || "AI failed";
      setError(msg);
      // Roll back the user turn so they can retry without re-typing.
      setTurns(turns);
      setInput(content);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-emerald-500/20 bg-slate-900/50" style={{ height }}>
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200">
            🤖
          </span>
          <div>
            <div className="text-sm font-bold text-white">AEVION AI Coach</div>
            <div className="text-[11px] text-slate-400">
              На связи с твоим профилем + текущими вакансиями. Спрашивай что угодно про карьеру и резюме.
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">
              Привет 👋 Что подсказать сегодня? Можешь начать так:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                t.role === "user"
                  ? "bg-emerald-500 text-emerald-950"
                  : "bg-white/5 text-slate-100"
              }`}
            >
              {t.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white/5 px-3.5 py-2 text-sm text-slate-400">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse [animation-delay:200ms]">●</span>
                <span className="animate-pulse [animation-delay:400ms]">●</span>
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Напиши вопрос. Enter — отправить, Shift+Enter — новая строка."
            className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
