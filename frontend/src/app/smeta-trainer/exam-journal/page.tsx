"use client";

/**
 * Журнал попыток экзаменов — все сдачи студента + агрегированная статистика.
 * Данные хранятся локально (localStorage); экспорт в CSV для отправки преподавателю.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { EXAM_TASKS, findExamTask } from "../lib/examTasks";
import {
  loadAttempts,
  computeStats,
  clearJournal,
  exportCsv,
  type ExamAttempt,
  type JournalStats,
} from "../lib/examJournal";
import {
  checkEligibility,
  buildPayload,
  encodePayload,
  loadStudentName,
  saveStudentName,
  type CertificateEligibility,
} from "../lib/examCertificate";
import { useRouter } from "next/navigation";

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function gradeColor(grade: string): string {
  if (grade === "отлично") return "bg-emerald-100 text-emerald-800";
  if (grade === "хорошо") return "bg-blue-100 text-blue-800";
  if (grade === "удовл.") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function ExamJournalPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [filterTask, setFilterTask] = useState<string>("all");
  const [eligibility, setEligibility] = useState<CertificateEligibility | null>(null);
  const [studentName, setStudentName] = useState("");

  function refresh() {
    setAttempts(loadAttempts());
    setStats(computeStats());
    setEligibility(checkEligibility());
  }

  useEffect(() => {
    refresh();
    setStudentName(loadStudentName());
  }, []);

  function issueCertificate() {
    if (!eligibility) return;
    const name = studentName.trim();
    if (!name) {
      alert("Введите ваше ФИО для сертификата");
      return;
    }
    saveStudentName(name);
    const payload = buildPayload(eligibility, name);
    if (!payload) return;
    const hash = encodePayload(payload);
    router.push(`/smeta-trainer/certificate-exam/${hash}`);
  }

  function handleClear() {
    if (!confirm("Удалить весь журнал? Действие не отменяется.")) return;
    clearJournal();
    refresh();
  }

  function handleExport() {
    const csv = exportCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smeta-exam-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const filtered =
    filterTask === "all"
      ? attempts
      : attempts.filter((a) => a.taskId === filterTask);
  const sorted = [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const totalTasks = EXAM_TASKS.length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer/exam" className="text-xs text-blue-600 hover:underline">
              ← К списку экзаменов
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">📔 Журнал попыток</h1>
            <p className="text-sm text-slate-600 mt-1">
              История всех сдач + ваш лучший балл по каждому заданию. Хранится локально в браузере.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={attempts.length === 0}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40"
            >
              ⬇ Экспорт CSV
            </button>
            <button
              onClick={handleClear}
              disabled={attempts.length === 0}
              className="px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-40"
            >
              ✕ Очистить
            </button>
          </div>
        </div>

        {stats && stats.totalAttempts === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
            Журнал пуст. Сдайте хотя бы один экзамен из{" "}
            <Link href="/smeta-trainer/exam" className="underline">
              банка заданий
            </Link>
            .
          </div>
        )}

        {stats && stats.totalAttempts > 0 && (
          <>
            {/* Общая статистика */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Metric label="Всего попыток" value={String(stats.totalAttempts)} hint="по всем заданиям" />
              <Metric
                label="Средний балл"
                value={stats.avgScore.toFixed(1)}
                hint={`из 100`}
              />
              <Metric
                label="На «отлично»"
                value={`${stats.excellentCount}`}
                hint={`из ${stats.totalAttempts} сдач`}
              />
              <Metric
                label="Сдано задач"
                value={`${stats.passedTasks} / ${totalTasks}`}
                hint={`${Math.round((stats.passedTasks / totalTasks) * 100)}% покрытия`}
              />
            </div>

            {/* Прогресс-бар «X из 5 на отлично» */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between text-xs text-slate-600 mb-2">
                <span>Задач сдано на «отлично»</span>
                <span className="font-mono">
                  {EXAM_TASKS.filter((t) => {
                    const slot = stats.perTask.get(t.id);
                    return slot && slot.best.score >= 85;
                  }).length}{" "}
                  / {totalTasks}
                </span>
              </div>
              <div className="bg-slate-100 rounded h-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      (EXAM_TASKS.filter((t) => {
                        const slot = stats.perTask.get(t.id);
                        return slot && slot.best.score >= 85;
                      }).length /
                        totalTasks) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Сертификат */}
            {eligibility && (
              <div
                className={`border-2 rounded-lg p-5 mb-4 ${
                  eligibility.tier === "gold"
                    ? "bg-amber-50 border-amber-300"
                    : eligibility.tier === "silver"
                    ? "bg-emerald-50 border-emerald-300"
                    : eligibility.tier === "bronze"
                    ? "bg-orange-50 border-orange-300"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider font-bold mb-1">
                      🎖 Сертификат экзаменационного цикла
                    </div>
                    {eligibility.tier === "gold" && (
                      <p className="text-sm text-amber-900">
                        🥇 <strong>Право на сертификат «С ОТЛИЧИЕМ»</strong> — все {eligibility.total} заданий на «отлично» (≥85).
                      </p>
                    )}
                    {eligibility.tier === "silver" && (
                      <p className="text-sm text-emerald-900">
                        🥈 <strong>Право на стандартный сертификат</strong> — {eligibility.goodPlus} из {eligibility.total} на «хорошо+» (≥70).
                      </p>
                    )}
                    {eligibility.tier === "bronze" && (
                      <p className="text-sm text-orange-900">
                        🥉 <strong>Право на базовый сертификат</strong> — {eligibility.satisfactoryPlus} из {eligibility.total} на «удовл.+» (≥50).
                      </p>
                    )}
                    {!eligibility.tier && (
                      <p className="text-sm text-slate-700">
                        Сертификат пока не доступен. Минимум — <strong>{Math.ceil(eligibility.total * 0.5)} / {eligibility.total} на «удовл.+»</strong> (бронзовый).
                        Сейчас: {eligibility.excellent} на «отлично», {eligibility.goodPlus} на «хорошо+», {eligibility.satisfactoryPlus} на «удовл.+».
                      </p>
                    )}
                  </div>
                  {eligibility.tier && (
                    <div className="flex flex-col gap-2 min-w-[280px]">
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Ваше ФИО для сертификата"
                        className="text-sm border border-slate-300 rounded px-3 py-2"
                      />
                      <button
                        onClick={issueCertificate}
                        disabled={!studentName.trim()}
                        className={`px-4 py-2 rounded text-sm font-bold text-white disabled:opacity-50 ${
                          eligibility.tier === "gold"
                            ? "bg-amber-600 hover:bg-amber-700"
                            : eligibility.tier === "silver"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-orange-600 hover:bg-orange-700"
                        }`}
                      >
                        Получить сертификат
                      </button>
                    </div>
                  )}
                </div>
                {!eligibility.tier && eligibility.blockingTaskIds.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                    <strong>Задания, мешающие выдаче:</strong>{" "}
                    {eligibility.blockingTaskIds
                      .map((id) => EXAM_TASKS.find((t) => t.id === id)?.title ?? id)
                      .join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* Лучший результат по каждому заданию */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <h2 className="text-base font-semibold text-slate-800 mb-3">
                Лучший балл по каждому заданию
              </h2>
              <div className="space-y-2">
                {EXAM_TASKS.map((task) => {
                  const slot = stats.perTask.get(task.id);
                  const best = slot?.best;
                  return (
                    <div key={task.id} className="grid grid-cols-[24px_1fr_120px_80px_80px] gap-3 items-center text-xs">
                      <div className="text-lg">{task.icon}</div>
                      <div>
                        <Link
                          href={`/smeta-trainer/exam/${task.id}`}
                          className="text-slate-900 font-medium hover:underline"
                        >
                          {task.title}
                        </Link>
                        <div className="text-[10px] text-slate-500">
                          {task.category} · {task.difficulty}
                        </div>
                      </div>
                      <div>
                        {best ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${gradeColor(best.grade)}`}>
                              {best.grade}
                            </span>
                            <span className="font-mono font-bold">{best.score}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">— не сдано —</span>
                        )}
                      </div>
                      <div className="text-right font-mono text-slate-600">
                        {slot ? `${slot.attempts.length} попыт.` : "—"}
                      </div>
                      <div className="text-right text-[10px] text-slate-500">
                        {best ? formatTs(best.timestamp) : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* История сдач */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-800">История сдач</h2>
                <select
                  value={filterTask}
                  onChange={(e) => setFilterTask(e.target.value)}
                  className="text-xs border border-slate-300 rounded px-2 py-1"
                >
                  <option value="all">Все задания</option>
                  {EXAM_TASKS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <table className="w-full text-xs">
                <thead className="text-slate-500 text-left">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-2 w-32">Дата</th>
                    <th className="py-2 px-2">Задание</th>
                    <th className="py-2 px-2 text-right w-16">Балл</th>
                    <th className="py-2 px-2 w-20">Оценка</th>
                    <th className="py-2 px-2 text-right w-20">AI</th>
                    <th className="py-2 px-2 text-right w-20">Покр.</th>
                    <th className="py-2 px-2 text-right w-20">Объёмы</th>
                    <th className="py-2 px-2 text-right w-20">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => {
                    const task = findExamTask(a.taskId);
                    return (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-1.5 px-2 text-slate-500 font-mono text-[10px]">
                          {formatTs(a.timestamp)}
                        </td>
                        <td className="py-1.5 px-2">
                          <Link
                            href={`/smeta-trainer/exam/${a.taskId}`}
                            className="text-slate-800 hover:underline"
                          >
                            {task?.icon} {a.taskTitle}
                          </Link>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">{a.score}</td>
                        <td className="py-1.5 px-2">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${gradeColor(a.grade)}`}>
                            {a.grade}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{a.breakdown.ai}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{a.breakdown.coverage}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{a.breakdown.volumes}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{a.breakdown.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-sm text-slate-500 italic py-4 text-center">
                  По выбранному фильтру попыток нет.
                </div>
              )}
            </div>
          </>
        )}

        <div className="text-[11px] text-slate-500 italic mt-4">
          Журнал хранится в localStorage вашего браузера и не уходит на сервер.
          Очистка истории браузера или другой профиль = пустой журнал.
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
