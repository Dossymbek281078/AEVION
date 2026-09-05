"use client";

/**
 * Страница конкретного экзамена. URL: /smeta-trainer/exam/[id].
 * Загружает задание из EXAM_TASKS по id и предоставляет редактор + грейдер.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import type { Lsr } from "../../lib/types";
import { findRate } from "../../lib/corpus";
import { calcLsr, formatKzt } from "../../lib/calc";
import { gradeExam, type ExamReport } from "../../lib/examGrader";
import { findExamTask } from "../../lib/examTasks";
import { saveAttempt, bestAttempt, failedAttemptsCount } from "../../lib/examJournal";
import { syncExamAttempt } from "../../lib/examSync";
import { logTransfer } from "../../lib/transferLog";
import { isLessonVisited, findLesson } from "../../lib/examLessons";
import { buildRemediation, type RemSeverity } from "../../lib/examRemediation";
import { applyReferenceFixes, hasMechanicalFixes } from "../../lib/examFix";
import {
  analyzeOpenings,
  explainOpeningsDeterministic,
  buildOpeningsAIPrompt,
} from "../../lib/ai/scenarios/openingsAdvisor";
import { buildNoticeAIPrompt, hasDedicatedPanel } from "../../lib/ai/noticeAdvisor";
import { deterministicBreakdown } from "../../lib/ai/scenarios/scenarioBreakdowns";
import {
  buildLsrFormHtml,
  buildKs2FormHtml,
  buildSsrFormHtml,
  buildObjectEstimateHtml,
  buildKs3FormHtml,
  openPrintWindow,
} from "../../lib/printForms";
import { streamLLM } from "../../lib/aiBackend";
import type { LsrCalc, AiNotice } from "../../lib/types";
import type { RoomGeometry } from "../../lib/types";
import { ExamToolsPanel } from "../../components/ExamToolsPanel";
import { PendingCalcValue } from "../../components/PendingCalcValue";
import { LmsReturnBanner } from "../../components/LmsReturnBanner";

export default function ExamTaskPage({
  params,
}: {
  // params — всегда промис (Next 15+). Объединение `Promise<…> | {…}` осталось
  // со времён перехода и в Next 16 роняет СБОРКУ на проверке типов: сгенерённый
  // PageProps требует `Promise<any>`. В dev это не видно — падает только
  // полный build, уже после успешной компиляции.
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);
  const task = findExamTask(resolved.id);
  if (!task) {
    notFound();
  }
  const [lsr, setLsr] = useState<Lsr>(task!.starter);
  const [report, setReport] = useState<ExamReport | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [bestSoFar, setBestSoFar] = useState<number | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [lessonOpened, setLessonOpened] = useState(false);
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null);
  const lessonExists = !!findLesson(task!.id);

  function findSelectedPosition() {
    if (!selectedPosId) return null;
    for (const section of lsr.sections) {
      const pos = section.positions.find((p) => p.id === selectedPosId);
      if (pos) return { section, pos };
    }
    return null;
  }
  const selected = findSelectedPosition();
  const targetHint = selected ? selected.pos.rateCode : null;

  useEffect(() => {
    const b = bestAttempt(task!.id);
    setBestSoFar(b ? b.score : null);
    setFailedCount(failedAttemptsCount(task!.id));
    setLessonOpened(isLessonVisited(task!.id));
  }, [task]);

  // Адаптивные подсказки: hint[0] всегда виден, hint[1] после 1 неудачной попытки,
  // hint[2+] после 2 неудачных. Раскрытые подсказки — это первые N hints.
  const unlockedHints = Math.min(
    task!.hints.length,
    1 + (failedCount >= 1 ? 1 : 0) + (failedCount >= 2 ? task!.hints.length : 0),
  );

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
    saveAttempt(task!.id, task!.title, r, { trap: findLesson(task!.id)?.trap });
    // дублируем сдачу на backend для куратора (fire-and-forget, бэкенд опционален)
    void syncExamAttempt(task!.id, task!.title, r);
    const b = bestAttempt(task!.id);
    setBestSoFar(b ? b.score : null);
    setFailedCount(failedAttemptsCount(task!.id));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setLsr(task!.starter);
    setReport(null);
  }

  function printForm(html: string) {
    const ok = openPrintWindow(html);
    if (!ok && typeof window !== "undefined") {
      alert("Не удалось открыть окно печати — разрешите всплывающие окна для этого сайта.");
    }
  }

  /**
   * Применяет механические исправления из отчёта (объёмы / лишние / пропущенные)
   * к ЛСР, не трогая AI-замечания. Отчёт сбрасывается — студент пересдаёт сам.
   */
  function applyFixes() {
    if (!report) return;
    const { lsr: fixedLsr, counts } = applyReferenceFixes(lsr, report, task!.reference);
    setLsr(fixedLsr);
    setReport(null);
    if (typeof window !== "undefined") {
      const parts = [
        counts.volume > 0 ? `объёмов: ${counts.volume}` : null,
        counts.removed > 0 ? `удалено: ${counts.removed}` : null,
        counts.added > 0 ? `добавлено: ${counts.added}` : null,
      ].filter(Boolean);
      alert(
        `Исправлено механических расхождений — ${parts.join(", ") || "нет"}.\n` +
          "AI-замечания (коэффициенты, двойной счёт, индексы) оставлены вам — исправьте и пересдайте.",
      );
    }
  }

  function applyPendingValue(value: number) {
    logTransfer({ kind: "value", detail: value.toFixed(2), examId: task!.id, taskTitle: task!.title });
    setLsr((prev) => {
      if (selectedPosId) {
        return {
          ...prev,
          sections: prev.sections.map((s) => ({
            ...s,
            positions: s.positions.map((p) =>
              p.id === selectedPosId ? { ...p, volume: value } : p,
            ),
          })),
          updatedAt: new Date().toISOString(),
        };
      }
      const sections = prev.sections.map((s) => ({ ...s }));
      const target = sections[0];
      if (!target || target.positions.length === 0) return prev;
      const positions = [...target.positions];
      const lastIdx = positions.length - 1;
      positions[lastIdx] = { ...positions[lastIdx], volume: value };
      target.positions = positions;
      return { ...prev, sections, updatedAt: new Date().toISOString() };
    });
  }

  function applyPendingRate(rateCode: string) {
    const rate = findRate(rateCode);
    if (!rate) {
      alert(`Расценка ${rateCode} не найдена в корпусе`);
      return;
    }
    logTransfer({ kind: "rate", detail: rateCode, label: rate.title, examId: task!.id, taskTitle: task!.title });
    setLsr((prev) => {
      const sections = prev.sections.map((s) => ({ ...s, positions: [...s.positions] }));
      const targetSectionIdx = selectedPosId
        ? sections.findIndex((s) => s.positions.some((p) => p.id === selectedPosId))
        : 0;
      const target = sections[targetSectionIdx >= 0 ? targetSectionIdx : 0];
      if (!target) return prev;
      const newPos = {
        id: `from-rates-${Date.now()}`,
        rateCode,
        volume: 1,
        coefficients: [],
        formula: "добавлено из каталога расценок",
      };
      if (selectedPosId) {
        const insertAt = target.positions.findIndex((p) => p.id === selectedPosId);
        target.positions = [
          ...target.positions.slice(0, insertAt + 1),
          newPos,
          ...target.positions.slice(insertAt + 1),
        ];
      } else {
        target.positions = [...target.positions, newPos];
      }
      return { ...prev, sections, updatedAt: new Date().toISOString() };
    });
  }

  function applyPendingFormula(formula: string) {
    logTransfer({ kind: "formula", detail: formula, examId: task!.id, taskTitle: task!.title });
    setLsr((prev) => {
      if (selectedPosId) {
        return {
          ...prev,
          sections: prev.sections.map((s) => ({
            ...s,
            positions: s.positions.map((p) =>
              p.id === selectedPosId ? { ...p, formula } : p,
            ),
          })),
          updatedAt: new Date().toISOString(),
        };
      }
      const sections = prev.sections.map((s) => ({ ...s, positions: [...s.positions] }));
      const target = sections[0];
      if (!target || target.positions.length === 0) return prev;
      const lastIdx = target.positions.length - 1;
      target.positions[lastIdx] = { ...target.positions[lastIdx], formula };
      return { ...prev, sections, updatedAt: new Date().toISOString() };
    });
  }

  const remPlan = report ? buildRemediation(report, { trap: findLesson(task!.id)?.trap }) : null;

  // Контекст для живого AI-разбора проёмов: замечание + геометрия + введённый объём
  const openingsNotice = report?.breakdown.ai.notices.find(
    (n) => n.scenario === "missing-opening-subtraction",
  );
  const roomGeometry =
    task!.object.geometry && task!.object.geometry.kind === "room" ? task!.object.geometry : null;
  let openingsPosTitle: string | undefined;
  let openingsEnteredVolume: number | undefined;
  if (openingsNotice?.context.positionId) {
    for (const s of lsr.sections) {
      const p = s.positions.find((x) => x.id === openingsNotice.context.positionId);
      if (p) {
        openingsPosTitle = findRate(p.rateCode)?.title;
        openingsEnteredVolume = p.volume;
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <ExamToolsPanel examId={task!.id} hasLesson={lessonExists} />
      <PendingCalcValue
        onApplyValue={applyPendingValue}
        onApplyRate={applyPendingRate}
        onApplyFormula={applyPendingFormula}
        targetHint={targetHint}
      />
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <div className="flex justify-between items-baseline">
            <Link href="/smeta-trainer/exam" className="text-xs text-blue-600 hover:underline">
              ← К списку экзаменов
            </Link>
            <div className="flex gap-3">
              {lessonExists && (
                <Link
                  href={`/smeta-trainer/exam/${task!.id}/lesson`}
                  className="text-xs text-purple-600 hover:underline"
                >
                  📖 {lessonOpened ? "Урок изучен" : "Изучить теорию"} →
                </Link>
              )}
              <Link href="/smeta-trainer/exam-journal" className="text-xs text-blue-600 hover:underline">
                📔 Журнал попыток →
              </Link>
            </div>
          </div>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap">
            <span className="text-3xl">{task!.icon}</span>
            <h1 className="text-2xl font-bold text-slate-900">{task!.title}</h1>
            <span className="text-[10px] uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {task!.category} · {task!.difficulty}
            </span>
            {bestSoFar != null && (
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                  bestSoFar >= 85
                    ? "bg-emerald-100 text-emerald-800"
                    : bestSoFar >= 70
                    ? "bg-blue-100 text-blue-800"
                    : bestSoFar >= 50
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                Лучший балл: {bestSoFar} / 100
              </span>
            )}
          </div>
        </div>

        {/* Баннер «изучи теорию» — только если урок есть И не открыт */}
        {lessonExists && !lessonOpened && (
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-3 mb-4 flex items-center justify-between gap-3">
            <div className="text-xs text-purple-900">
              <strong>📖 Совет:</strong> перед сдачей посмотрите урок-разбор по этому заданию —
              формулы, нормативка РК, разобранный пример. ~5 минут.
            </div>
            <Link
              href={`/smeta-trainer/exam/${task!.id}/lesson`}
              className="shrink-0 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded hover:bg-purple-700"
            >
              Открыть урок
            </Link>
          </div>
        )}

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
            {showHints
              ? "Скрыть подсказки"
              : `Показать подсказки (${unlockedHints} из ${task!.hints.length} разблокировано)`}
          </button>
          {showHints && (
            <div className="mt-2 space-y-2">
              <ul className="list-disc list-inside text-xs text-amber-900 space-y-1">
                {task!.hints.slice(0, unlockedHints).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
              {unlockedHints < task!.hints.length && (
                <div className="text-[11px] text-amber-600 italic border-l-2 border-amber-300 pl-2">
                  🔒 Ещё {task!.hints.length - unlockedHints} подсказок откроется после{" "}
                  {failedCount === 0 ? "первой" : "второй"} неудачной попытки (балл &lt; 70).
                </div>
              )}
              {failedCount >= 2 && (
                <div className="bg-amber-100 border border-amber-300 rounded p-2 text-xs text-amber-900 mt-2">
                  <div className="font-bold mb-1">🔍 Эталонный разбор ({failedCount} неудач):</div>
                  <table className="w-full text-[11px]">
                    <thead className="text-amber-700">
                      <tr>
                        <th className="text-left py-0.5">Шифр</th>
                        <th className="text-right py-0.5">Эталон. объём</th>
                      </tr>
                    </thead>
                    <tbody>
                      {task!.reference.sections.flatMap((sec) =>
                        sec.positions.map((p) => (
                          <tr key={p.id} className="border-t border-amber-200">
                            <td className="py-0.5 font-mono">{p.rateCode}</td>
                            <td className="py-0.5 text-right font-mono">{p.volume.toFixed(2)}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Возврат зачёта в курс (если открыто из LMS) */}
        <LmsReturnBanner taskId={task!.id} score={report?.score ?? null} grade={report?.grade ?? null} />

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
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => printForm(buildLsrFormHtml(lsr, calc))}
                  className="text-xs px-3 py-2 border border-slate-300 rounded hover:bg-slate-100"
                  title="Открыть Форму 4* (ЛСР) для печати или сохранения в PDF"
                >
                  🖨 Форма 4*
                </button>
                <button
                  onClick={() => printForm(buildKs2FormHtml(lsr, calc))}
                  className="text-xs px-3 py-2 border border-slate-300 rounded hover:bg-slate-100"
                  title="Акт о приёмке выполненных работ (КС-2)"
                >
                  🖨 КС-2
                </button>
                <button
                  onClick={() => printForm(buildObjectEstimateHtml(lsr, calc))}
                  className="text-xs px-3 py-2 border border-slate-300 rounded hover:bg-slate-100"
                  title="Объектный сметный расчёт (Форма 3)"
                >
                  🖨 Форма 3
                </button>
                <button
                  onClick={() => printForm(buildSsrFormHtml(lsr, calc))}
                  className="text-xs px-3 py-2 border border-slate-300 rounded hover:bg-slate-100"
                  title="Сводный сметный расчёт (Форма 1)"
                >
                  🖨 ССР
                </button>
                <button
                  onClick={() => printForm(buildKs3FormHtml(lsr, calc))}
                  className="text-xs px-3 py-2 border border-slate-300 rounded hover:bg-slate-100"
                  title="Справка о стоимости (КС-3)"
                >
                  🖨 КС-3
                </button>
                <button
                  onClick={reset}
                  className="text-xs px-3 py-2 border border-slate-300 rounded hover:bg-slate-100"
                >
                  Начать заново
                </button>
              </div>
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
                      {(() => {
                        const bd = deterministicBreakdown(lsr, n);
                        return bd ? (
                          <div className="mt-2 text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap bg-white/60 rounded p-2 border border-slate-200">
                            {renderBold(bd)}
                          </div>
                        ) : null;
                      })()}
                      {!hasDedicatedPanel(n.scenario) && (
                        <NoticeAdvisor
                          notice={n}
                          lsr={lsr}
                          calc={calc}
                          notices={report.breakdown.ai.notices}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Живой AI-разбор проёмов (P3) */}
            {openingsNotice && roomGeometry && (
              <OpeningsAdvisorPanel
                geometry={roomGeometry}
                positionTitle={openingsPosTitle}
                enteredVolume={openingsEnteredVolume}
                lsr={lsr}
                calc={calc}
                notices={report.breakdown.ai.notices}
              />
            )}

            {/* Работа над ошибками */}
            {remPlan && remPlan.items.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1 gap-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase">
                    🛠 Работа над ошибками
                  </h3>
                  {hasMechanicalFixes(report) && (
                    <button
                      onClick={applyFixes}
                      className="text-[11px] px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-900 font-semibold whitespace-nowrap"
                      title="Привести объёмы к эталону, удалить лишние, добавить пропущенные. AI-замечания останутся вам."
                    >
                      ⚙ Применить исправления
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-2">{remPlan.summary}</p>
                {hasMechanicalFixes(report) && (
                  <p className="text-[10px] text-slate-400 italic mb-2">
                    Кнопка чинит только механику (объёмы / лишние / пропущенные). Коэффициенты, двойной
                    счёт и индексы из AI-замечаний исправьте сами — потом пересдайте.
                  </p>
                )}
                <ol className="space-y-1.5">
                  {remPlan.items.map((it, i) => (
                    <li
                      key={`${it.kind}-${it.rateCode ?? it.title}-${i}`}
                      className={`border rounded p-2.5 text-xs ${SEV_STYLE[it.severity].box}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${SEV_STYLE[it.severity].chip}`}>
                          {SEV_STYLE[it.severity].label}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800">{it.title}</div>
                          <div className="text-slate-700 mt-0.5">→ {it.action}</div>
                          {it.detail && <div className="text-slate-500 mt-0.5">{it.detail}</div>}
                          {it.reference && (
                            <div className="text-[10px] text-slate-500 mt-0.5">📎 {it.reference}</div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
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
                    <th className="px-2 py-1.5 w-6"></th>
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
                    const isSelected = selectedPosId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-slate-100 ${
                          isSelected ? "bg-emerald-50" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() =>
                              setSelectedPosId(isSelected ? null : p.id)
                            }
                            className={`w-4 h-4 rounded-full border-2 inline-flex items-center justify-center ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-600"
                                : "border-slate-300 bg-white hover:border-emerald-400"
                            }`}
                            title={
                              isSelected
                                ? "Получатель передач из /calc, /rates, /cheatsheet — снять"
                                : "Сделать этой строкой получателя передач из инструментов"
                            }
                            aria-label={
                              isSelected
                                ? `Активная позиция: ${p.rateCode}`
                                : `Выбрать как активную: ${p.rateCode}`
                            }
                          >
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </button>
                        </td>
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

/** Рендер «**жирного**» markdown в простой JSX (для разбора проёмов). */
function renderBold(text: string) {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, pi) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={pi}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={pi}>{part}</span>
        ),
      )}
      {"\n"}
    </span>
  ));
}

function OpeningsAdvisorPanel({
  geometry,
  positionTitle,
  enteredVolume,
  lsr,
  calc,
  notices,
}: {
  geometry: RoomGeometry;
  positionTitle?: string;
  enteredVolume?: number;
  lsr: Lsr;
  calc: LsrCalc;
  notices: AiNotice[];
}) {
  const analysis = useMemo(() => analyzeOpenings(geometry), [geometry]);
  const deterministic = useMemo(
    () => explainOpeningsDeterministic(analysis, enteredVolume),
    [analysis, enteredVolume],
  );
  const [aiText, setAiText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [asked, setAsked] = useState(false);

  async function askAI() {
    setAsked(true);
    setStreaming(true);
    setAiText("");
    const { question, extraSystem } = buildOpeningsAIPrompt(analysis, { positionTitle, enteredVolume });
    try {
      await streamLLM(question, [], lsr, calc, notices, {
        extraSystem,
        onChunk: (t) => setAiText((p) => p + t),
      });
    } catch {
      setAiText((p) => p || "Не удалось получить ответ ИИ — выше детерминированный разбор.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="mt-4 border border-sky-200 bg-sky-50 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-xs font-bold text-sky-900 uppercase">📐 Разбор проёмов</h3>
        <button
          onClick={askAI}
          disabled={streaming}
          className="text-[11px] px-3 py-1.5 rounded bg-sky-700 text-white hover:bg-sky-800 font-semibold disabled:opacity-50 whitespace-nowrap"
        >
          🤖 {streaming ? "ИИ разбирает…" : "Спросить ИИ подробнее"}
        </button>
      </div>
      <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
        {renderBold(deterministic)}
      </div>
      {asked && (
        <div className="mt-3 pt-3 border-t border-sky-200">
          <div className="text-[10px] uppercase tracking-wider text-sky-700 font-bold mb-1">
            🤖 Объяснение ИИ
          </div>
          <div className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
            {aiText || (streaming ? "…" : "")}
          </div>
        </div>
      )}
    </div>
  );
}

function NoticeAdvisor({
  notice,
  lsr,
  calc,
  notices,
}: {
  notice: AiNotice;
  lsr: Lsr;
  calc: LsrCalc;
  notices: AiNotice[];
}) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [asked, setAsked] = useState(false);

  async function ask() {
    setAsked(true);
    setStreaming(true);
    setText("");
    const { question, extraSystem } = buildNoticeAIPrompt(notice);
    try {
      await streamLLM(question, [], lsr, calc, notices, {
        extraSystem,
        onChunk: (t) => setText((p) => p + t),
      });
    } catch {
      setText((p) => p || "Не удалось получить ответ ИИ.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={ask}
        disabled={streaming}
        className="text-[10px] px-2 py-1 rounded border border-current opacity-80 hover:opacity-100 font-semibold disabled:opacity-50"
      >
        🤖 {streaming ? "ИИ разбирает…" : "Разобрать с ИИ"}
      </button>
      {asked && (
        <div className="mt-1.5 text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap bg-white/60 rounded p-2">
          {text || (streaming ? "…" : "")}
        </div>
      )}
    </div>
  );
}

const SEV_STYLE: Record<RemSeverity, { label: string; box: string; chip: string }> = {
  high:   { label: "критично", box: "bg-red-50 border-red-300",     chip: "bg-red-100 text-red-700" },
  medium: { label: "внимание", box: "bg-amber-50 border-amber-300", chip: "bg-amber-100 text-amber-800" },
  low:    { label: "мелочь",   box: "bg-slate-50 border-slate-300", chip: "bg-slate-200 text-slate-700" },
};

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
