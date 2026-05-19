"use client";

/**
 * Страница конкретного экзамена. URL: /smeta-trainer/exam/[id].
 * Загружает задание из EXAM_TASKS по id и предоставляет редактор + грейдер.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { useMemo, useState } from "react";
import type { Lsr } from "../../lib/types";
import { findRate } from "../../lib/corpus";
import { calcLsr, formatKzt } from "../../lib/calc";
import { gradeExam, type ExamReport } from "../../lib/examGrader";
import { findExamTask } from "../../lib/examTasks";

export default function ExamTaskPage({ params }: { params: { id: string } }) {
  const task = findExamTask(params.id);
  if (!task) {
    notFound();
  }
  const [lsr, setLsr] = useState<Lsr>(task!.starter);
  const [report, setReport] = useState<ExamReport | null>(null);
  const [showHints, setShowHints] = useState(false);

  const calc = useMemo(() => calcLsr(lsr), [lsr]);

  function updateVolume(sectionId: string, posId: string, volume: number) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              positions: s.positions.map((p) =>
                p.id === posId ? { ...p, volume: Math.max(0, volume) } : p,
              ),
            }
          : s,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function toggleCoef(sectionId: string, posId: string) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              positions: s.positions.map((p) => {
                if (p.id !== posId) return p;
                const has = (p.coefficients ?? []).some((c) => c.kind === "действующий-объект");
                return {
                  ...p,
                  coefficients: has
                    ? p.coefficients.filter((c) => c.kind !== "действующий-объект")
                    : [
                        ...(p.coefficients ?? []),
                        {
                          kind: "действующий-объект",
                          value: 1.15,
                          justification: "Действующий объект, СН РК 8.02-10",
                        },
                      ],
                };
              }),
            }
          : s,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function removePosition(sectionId: string, posId: string) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, positions: s.positions.filter((p) => p.id !== posId) }
          : s,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function changeRateCode(sectionId: string, posId: string, newCode: string) {
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              positions: s.positions.map((p) =>
                p.id === posId ? { ...p, rateCode: newCode } : p,
              ),
            }
          : s,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function addPosition(sectionId: string) {
    const code = prompt("Шифр расценки (например ФУН-05-02-001):");
    if (!code) return;
    const trimmed = code.trim();
    if (!findRate(trimmed)) {
      alert(`Расценка ${trimmed} не найдена в корпусе`);
      return;
    }
    setLsr((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              positions: [
                ...s.positions,
                {
                  id: `add-${Date.now()}`,
                  rateCode: trimmed,
                  volume: 1,
                  coefficients: [],
                  formula: "добавлено вручную",
                },
              ],
            }
          : s,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function submit() {
    const r = gradeExam(lsr, task!.reference, task!.object);
    setReport(r);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setLsr(task!.starter);
    setReport(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link href="/smeta-trainer/exam" className="text-xs text-blue-600 hover:underline">
            ← К списку экзаменов
          </Link>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl">{task!.icon}</span>
            <h1 className="text-2xl font-bold text-slate-900">{task!.title}</h1>
            <span className="text-[10px] uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {task!.category} · {task!.difficulty}
            </span>
          </div>
        </div>

        {/* Задание */}
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-amber-700 font-bold mb-1">
            Задание (~ {task!.durationMin} мин)
          </div>
          <div className="text-sm text-amber-900 leading-relaxed">{task!.object.description}</div>
          <button
            onClick={() => setShowHints((v) => !v)}
            className="mt-3 text-[11px] text-amber-700 underline hover:text-amber-900"
          >
            {showHints ? "Скрыть подсказки" : `Показать подсказки (${task!.hints.length})`}
          </button>
          {showHints && (
            <ul className="mt-2 list-disc list-inside text-xs text-amber-900 space-y-1">
              {task!.hints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Отчёт */}
        {report && (
          <div className="bg-white border-2 border-emerald-300 rounded-lg p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Результат</div>
                <div className="text-4xl font-bold text-emerald-700 mt-1">
                  {report.score}
                  <span className="text-lg text-slate-500 font-normal"> / 100</span>
                </div>
                <div
                  className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    report.grade === "отлично"
                      ? "bg-emerald-100 text-emerald-800"
                      : report.grade === "хорошо"
                      ? "bg-blue-100 text-blue-800"
                      : report.grade === "удовл."
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {report.grade}
                </div>
              </div>
              <button
                onClick={reset}
                className="text-xs px-3 py-2 border border-slate-300 rounded hover:bg-slate-100"
              >
                Начать заново
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              <Score label="AI-проверки" score={report.breakdown.ai.score} weight={report.breakdown.ai.weight} hint={`${report.breakdown.ai.notices.length} замечаний`} />
              <Score label="Покрытие позиций" score={report.breakdown.coverage.score} weight={report.breakdown.coverage.weight} hint={`${report.breakdown.coverage.matched} / ${report.breakdown.coverage.total} расценок`} />
              <Score label="Точность объёмов" score={report.breakdown.volumes.score} weight={report.breakdown.volumes.weight} hint={`Δ ${report.breakdown.volumes.avgDeltaPct.toFixed(1)}% в среднем`} />
              <Score label="Итоговая сумма" score={report.breakdown.total.score} weight={report.breakdown.total.weight} hint={`Δ ${report.breakdown.total.deltaPct.toFixed(1)}% от эталона`} />
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Сравнение с эталоном</h3>
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-32">Шифр</th>
                    <th className="px-2 py-1.5 text-left">Наименование</th>
                    <th className="px-2 py-1.5 text-right w-24">Эталон</th>
                    <th className="px-2 py-1.5 text-right w-24">Студент</th>
                    <th className="px-2 py-1.5 text-right w-20">Δ%</th>
                    <th className="px-2 py-1.5 text-center w-24">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {report.positions.map((p, i) => (
                    <tr key={`${p.rateCode}-${p.status}-${i}`} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-mono text-[10px]">{p.rateCode}</td>
                      <td className="px-2 py-1.5 text-slate-700">{p.rateTitle}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {p.status === "extra" ? "—" : `${p.refVolume.toFixed(2)} ${p.unit}`}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {p.studentVolume == null ? "—" : `${p.studentVolume.toFixed(2)} ${p.unit}`}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-600">
                        {p.deltaPct == null ? "—" : `${p.deltaPct > 0 ? "+" : ""}${p.deltaPct.toFixed(1)}%`}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {report.breakdown.ai.notices.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">
                  Замечания AI ({report.breakdown.ai.notices.length})
                </h3>
                <div className="space-y-2">
                  {report.breakdown.ai.notices.map((n) => (
                    <div
                      key={n.id}
                      className={`border rounded p-3 text-xs ${
                        n.severity === "error"
                          ? "bg-red-50 border-red-300"
                          : n.severity === "warning"
                          ? "bg-amber-50 border-amber-300"
                          : "bg-slate-50 border-slate-300"
                      }`}
                    >
                      <div className="font-bold">{n.title}</div>
                      <div className="text-slate-700 mt-1">{n.message}</div>
                      {n.suggestion && (
                        <div className="text-slate-600 italic mt-1">→ {n.suggestion}</div>
                      )}
                      {n.reference && (
                        <div className="text-[10px] text-slate-500 mt-1">📎 {n.reference}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Редактор позиций */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">Моё решение</h2>
            <div className="text-sm font-mono text-emerald-700">
              Итог: {formatKzt(calc.totalWithVat)}
            </div>
          </div>

          {lsr.sections.map((section) => (
            <div key={section.id} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase text-slate-600">{section.title}</h3>
                <button
                  onClick={() => addPosition(section.id)}
                  className="text-[10px] px-2 py-1 border border-slate-300 rounded hover:bg-slate-100"
                >
                  + Добавить позицию
                </button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-36">Шифр</th>
                    <th className="px-2 py-1.5 text-left">Наименование</th>
                    <th className="px-2 py-1.5 text-right w-36">Объём</th>
                    <th className="px-2 py-1.5 text-center w-24">К=1.15</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {section.positions.map((p) => {
                    const rate = findRate(p.rateCode);
                    const hasCoef = (p.coefficients ?? []).some(
                      (c) => c.kind === "действующий-объект",
                    );
                    return (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-2 py-1.5">
                          <input
                            value={p.rateCode}
                            onChange={(e) => changeRateCode(section.id, p.id, e.target.value)}
                            className="w-32 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[10px]"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {rate?.title ?? <span className="text-red-500">расценка не найдена</span>}
                          {p.formula && (
                            <div className="text-[10px] text-slate-400 italic">{p.formula}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={p.volume}
                            onChange={(e) => updateVolume(section.id, p.id, parseFloat(e.target.value) || 0)}
                            className="w-24 border border-slate-300 rounded px-2 py-1 text-right font-mono text-xs"
                          />{" "}
                          <span className="text-slate-500">{rate?.unit}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={hasCoef}
                            onChange={() => toggleCoef(section.id, p.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => removePosition(section.id, p.id)}
                            className="text-[10px] text-red-500 hover:text-red-700"
                            title="Удалить позицию"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <div className="flex gap-2 pt-3 border-t border-slate-200">
            <button
              onClick={submit}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700"
            >
              🎯 Сдать на проверку
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-white border border-slate-300 rounded text-sm hover:bg-slate-100"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Score({
  label,
  score,
  weight,
  hint,
}: {
  label: string;
  score: number;
  weight: number;
  hint: string;
}) {
  const color = score >= 85 ? "emerald" : score >= 60 ? "blue" : score >= 30 ? "amber" : "red";
  const colorMap = {
    emerald: "text-emerald-700 border-emerald-200",
    blue: "text-blue-700 border-blue-200",
    amber: "text-amber-700 border-amber-200",
    red: "text-red-700 border-red-200",
  } as const;
  return (
    <div className={`border rounded p-2 ${colorMap[color]}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold font-mono">
        {score}
        <span className="text-xs text-slate-500 font-normal"> /100</span>
      </div>
      <div className="text-[10px] text-slate-500">вес × {weight}% · {hint}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "match" | "off-volume" | "missing" | "extra" }) {
  const map = {
    match: { label: "✓ совпало", cls: "bg-emerald-100 text-emerald-800" },
    "off-volume": { label: "≠ объём", cls: "bg-amber-100 text-amber-800" },
    missing: { label: "− пропущено", cls: "bg-red-100 text-red-800" },
    extra: { label: "+ лишняя", cls: "bg-blue-100 text-blue-800" },
  } as const;
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{label}</span>;
}
