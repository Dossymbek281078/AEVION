"use client";

import { useMemo, useState } from "react";
import { LEVEL5_LSR } from "../lib/levels";
import { EXPERT_ERRORS } from "../lib/expertErrors";
import { calcLsr } from "../lib/calc";
import { runAiAdvisor } from "../lib/ai";
import { findObject } from "../lib/corpus";
import { useProgress } from "../lib/useProgress";
import { LsrFormHeader } from "./LsrFormHeader";
import { LsrFormTable } from "./LsrFormTable";
import { SsrView } from "./SsrView";

const PASS_THRESHOLD = 5;

export function Level5View() {
  const { setLevel } = useProgress();
  const [found, setFound] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showHints, setShowHints] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<"smeta" | "ssr" | "checklist">("smeta");

  const calc = useMemo(() => calcLsr(LEVEL5_LSR), []);
  const object = useMemo(() => findObject(LEVEL5_LSR.objectId), []);
  const aiNotices = useMemo(
    () => (object ? runAiAdvisor(LEVEL5_LSR, object) : []),
    [object]
  );

  function toggleFound(id: string) {
    if (submitted) return;
    setFound((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleHint(id: string) {
    setShowHints((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setSubmitted(true);
    const score = Math.round((found.size / EXPERT_ERRORS.length) * 100);
    const passed = found.size >= PASS_THRESHOLD;
    setLevel(5, {
      status: passed ? "done" : "in-progress",
      score,
      completedAt: new Date().toISOString(),
    });
  }

  const impactColor = { critical: "text-red-700 bg-red-50 border-red-300", major: "text-amber-700 bg-amber-50 border-amber-300", minor: "text-blue-700 bg-blue-50 border-blue-200" };
  const impactLabel = { critical: "Критическая", major: "Существенная", minor: "Незначительная" };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Левая панель — роль эксперта */}
      <aside className="w-64 shrink-0 bg-slate-900 text-white flex flex-col overflow-auto">
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Уровень 5</div>
          <div className="text-sm font-bold mt-0.5">Эксперт</div>
          <div className="text-xs text-slate-400 mt-1">Экспертиза сметной документации</div>
        </div>

        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Задание</div>
          <p className="text-xs text-slate-300 leading-relaxed">
            В этой смете специально заложено <strong className="text-white">{EXPERT_ERRORS.length} ошибок</strong> — от критических до незначительных.
            Найдите их все и опишите нарушение с нормативным обоснованием.
          </p>
          <div className="text-[10px] text-amber-300 mt-2">Зачёт: ≥ {PASS_THRESHOLD} ошибок с обоснованием.</div>
        </div>

        <div className="px-4 py-3 flex-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">
            AI-советник нашёл: {aiNotices.length} замечаний
          </div>
          {aiNotices.map((n) => (
            <div key={n.id} className="text-[11px] text-amber-300 mb-1">
              ⚠ {n.title}
            </div>
          ))}
          {aiNotices.length === 0 && (
            <div className="text-[11px] text-slate-500 italic">AI не нашёл — ищите сами!</div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-700 space-y-2">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Найдено: {found.size}/{EXPERT_ERRORS.length}</span>
            {submitted && (
              <span className={found.size >= PASS_THRESHOLD ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                {found.size >= PASS_THRESHOLD ? "✓ Зачёт" : "✗ Пересдача"}
              </span>
            )}
          </div>
          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={found.size === 0}
              className="w-full py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-40"
            >
              Отправить заключение
            </button>
          ) : (
            <button
              onClick={() => { setSubmitted(false); setFound(new Set()); setNotes({}); }}
              className="w-full py-2 bg-slate-600 text-white text-xs rounded hover:bg-slate-500"
            >
              Начать заново
            </button>
          )}
        </div>
      </aside>

      {/* Основная область */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="shrink-0 border-b border-slate-200 bg-white flex px-4">
          {([["smeta", "Смета (читать)"], ["ssr", "НР + СП"], ["checklist", "Чеклист ошибок"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 ${activeTab === key ? "border-red-500 text-red-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {label}
              {key === "checklist" && found.size > 0 && (
                <span className="ml-1 text-emerald-600 font-bold">{found.size}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === "smeta" && (
            <div className="p-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
                <strong>Режим эксперта.</strong> В этой смете {EXPERT_ERRORS.length} заложенных ошибок. Найдите их через чеклист на вкладке «Чеклист ошибок». AI-советник справа подскажет часть.
              </div>
              <LsrFormHeader meta={LEVEL5_LSR.meta ?? {}} calc={calc} onChange={() => {}} />
              <LsrFormTable calc={calc} notices={aiNotices} onChangeVolume={() => {}} onRemove={() => {}} />
            </div>
          )}

          {activeTab === "ssr" && <SsrView calc={calc} />}

          {activeTab === "checklist" && (
            <div className="p-4 max-w-3xl mx-auto space-y-4">
              {submitted && (
                <div className={`rounded-xl p-4 text-center border-2 ${found.size >= PASS_THRESHOLD ? "bg-emerald-50 border-emerald-400" : "bg-red-50 border-red-300"}`}>
                  <div className="text-xl font-bold">{found.size}/{EXPERT_ERRORS.length} ошибок найдено</div>
                  <div className={`mt-1 font-semibold ${found.size >= PASS_THRESHOLD ? "text-emerald-700" : "text-red-700"}`}>
                    {found.size >= PASS_THRESHOLD ? "✓ Зачёт получен!" : `Не хватает ${PASS_THRESHOLD - found.size} ошибок`}
                  </div>
                </div>
              )}

              {EXPERT_ERRORS.map((err) => {
                const isFound = found.has(err.id);
                const hintOpen = showHints.has(err.id);
                const style = impactColor[err.impact];

                return (
                  <div key={err.id} className={`border rounded-lg p-4 ${isFound ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                    <div className="flex gap-3 items-start">
                      <input
                        type="checkbox"
                        checked={isFound}
                        onChange={() => toggleFound(err.id)}
                        disabled={submitted}
                        className="mt-1 accent-emerald-600 shrink-0 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style}`}>
                            {impactLabel[err.impact]}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">{err.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">📍 {err.where}</div>

                        {isFound && (
                          <>
                            <div className="text-xs text-slate-700 mt-2 leading-relaxed">{err.description}</div>
                            <div className="text-[11px] text-slate-500 mt-1 italic">{err.normRef}</div>
                            <textarea
                              rows={2}
                              placeholder="Ваше обоснование нарушения..."
                              className="mt-2 w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                              value={notes[err.id] ?? ""}
                              onChange={(e) => setNotes((prev) => ({ ...prev, [err.id]: e.target.value }))}
                              disabled={submitted}
                            />
                          </>
                        )}

                        {!isFound && (
                          <div className="mt-1">
                            <button
                              onClick={() => toggleHint(err.id)}
                              className="text-[11px] text-slate-400 hover:text-emerald-600 underline"
                            >
                              {hintOpen ? "скрыть подсказку" : "показать подсказку"}
                            </button>
                            {hintOpen && (
                              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                                💡 {err.hint}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!submitted && (
                <button
                  onClick={handleSubmit}
                  disabled={found.size === 0}
                  className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-40"
                >
                  Подать экспертное заключение
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI подсказки справа */}
      <aside className="w-64 shrink-0 bg-slate-50 border-l border-slate-200 p-3 overflow-auto">
        <div className="text-xs font-bold text-slate-600 mb-3">AI — подсказки эксперту</div>
        {aiNotices.length === 0 ? (
          <div className="text-xs text-slate-400 italic">AI не обнаружил явных нарушений. Ищите скрытые ошибки самостоятельно.</div>
        ) : (
          <div className="space-y-2">
            {aiNotices.map((n) => (
              <div key={n.id} className={`text-xs rounded p-2 border ${n.severity === "error" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="font-semibold">{n.title}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{n.message}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-[10px] text-slate-400 italic">
          AI находит не все ошибки — часть нужно обнаружить профессиональным взглядом.
        </div>
      </aside>
    </div>
  );
}
