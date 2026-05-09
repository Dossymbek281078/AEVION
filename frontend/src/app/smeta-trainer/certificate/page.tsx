"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LEVELS } from "../lib/levels";
import { useProgress } from "../lib/useProgress";
import { useStudent } from "../lib/useStudent";
import { getLessonsForLevel, loadLessonProgress } from "../lib/lessons";

const COURSE_TITLE = "Сметное дело в Республике Казахстан";
const COURSE_HOURS = 88;
const COURSE_ORG = "AEVION · Учебная платформа";

function formatRuDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const months = [
    "января","февраля","марта","апреля","мая","июня",
    "июля","августа","сентября","октября","ноября","декабря",
  ];
  return `«${d.getDate()}» ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}

function genCertificateNumber(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const num = (Math.abs(h) % 9000) + 1000;
  const year = new Date().getFullYear();
  return `AEV-СМТ-${year}-${num}`;
}

export default function CertificatePage() {
  const { progress } = useProgress();
  const { student, setStudent, hydrated } = useStudent();
  const [lessonsDone, setLessonsDone] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  useEffect(() => {
    const lp = loadLessonProgress();
    let total = 0;
    let done = 0;
    LEVELS.forEach((lv) => {
      const lessons = getLessonsForLevel(lv.num);
      total += lessons.length;
      done += lessons.filter((l) => lp[l.id]?.completed).length;
    });
    setLessonsDone({ done, total });
  }, [progress]);

  const doneLevels = LEVELS.filter((lv) => progress.levels[lv.num]?.status === "done");
  const allDone = doneLevels.length === LEVELS.length;
  const totalScore = LEVELS.reduce(
    (s, lv) => s + (progress.levels[lv.num]?.score ?? 0),
    0,
  );
  const issueDate = useMemo(() => {
    const dates = LEVELS
      .map((lv) => progress.levels[lv.num]?.completedAt)
      .filter(Boolean) as string[];
    if (dates.length === 0) return undefined;
    return dates.sort().at(-1);
  }, [progress]);

  const certNumber = useMemo(
    () => genCertificateNumber(`${student.name}|${student.group}|${issueDate ?? ""}`),
    [student, issueDate],
  );

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Загрузка…</div>;
  }

  if (!allDone) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Сертификат пока недоступен</h1>
          <p className="text-sm text-slate-600 mb-4">
            Чтобы получить сертификат курса «{COURSE_TITLE}», нужно зачесть все 5 уровней.
          </p>
          <div className="text-sm text-slate-700 mb-6">
            Прогресс: <span className="font-bold text-emerald-600">{doneLevels.length}/{LEVELS.length}</span> уровней зачтено
            {lessonsDone.total > 0 && (
              <>, <span className="font-bold text-sky-600">{lessonsDone.done}/{lessonsDone.total}</span> уроков пройдено</>
            )}
          </div>
          <div className="space-y-1.5 text-left text-xs text-slate-600 mb-6">
            {LEVELS.map((lv) => {
              const status = progress.levels[lv.num]?.status ?? "open";
              return (
                <div key={lv.num} className="flex items-center justify-between border-b border-slate-100 py-1">
                  <span>
                    <span className="mr-2">{lv.icon}</span>
                    Уровень {lv.num} — {lv.title}
                  </span>
                  <span className={status === "done" ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                    {status === "done" ? "✓ зачтён" : "не зачтён"}
                  </span>
                </div>
              );
            })}
          </div>
          <Link
            href="/smeta-trainer"
            className="inline-block px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
          >
            ← К курсу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0 relative">
      {/* Confetti — только при первом открытии (CSS-only) */}
      <Confetti />

      {/* Toolbar (скрыт при печати) */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
          ← К курсу
        </Link>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={student.name}
            onChange={(e) => setStudent({ ...student, name: e.target.value })}
            placeholder="ФИО на сертификате"
            maxLength={120}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-72"
          />
          <input
            type="text"
            value={student.group}
            onChange={(e) => setStudent({ ...student, group: e.target.value })}
            placeholder="Группа (опционально)"
            maxLength={60}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-44"
          />
          <button
            onClick={() => window.print()}
            disabled={!student.name.trim()}
            className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700 disabled:opacity-40"
          >
            🖨 Печать / PDF
          </button>
        </div>
      </div>

      {!student.name.trim() && (
        <div className="max-w-4xl mx-auto mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 print:hidden">
          Введите ФИО в поле выше — оно будет напечатано на сертификате (сохраняется на этом устройстве).
        </div>
      )}

      {/* Сам сертификат */}
      <div
        className="max-w-4xl mx-auto bg-white border-[6px] border-double border-emerald-700 rounded-lg p-12 shadow-xl print:shadow-none print:border-emerald-700 print:max-w-none"
        style={{ aspectRatio: "1.414 / 1", minHeight: "560px" }}
      >
        <div className="flex flex-col h-full justify-between">
          {/* Header */}
          <div className="text-center">
            <div className="text-[10px] tracking-[0.3em] text-emerald-700 font-bold uppercase">
              {COURSE_ORG}
            </div>
            <div className="mt-1 text-[10px] font-mono text-slate-400">
              № {certNumber}
              <span className="ml-2 text-emerald-600 print:text-slate-400">
                · проверка: /smeta-trainer/verify/{certNumber}
              </span>
            </div>
          </div>

          {/* Title block */}
          <div className="text-center">
            <div className="text-2xl font-light text-slate-500 tracking-wide">СЕРТИФИКАТ</div>
            <div className="text-base text-slate-500 italic mt-0.5">об успешном окончании курса</div>

            <div className="mt-8 text-sm text-slate-600">настоящим удостоверяется, что</div>
            <div className="mt-3 text-3xl font-bold text-slate-900 border-b-2 border-emerald-200 pb-2 mx-auto inline-block min-w-[400px]">
              {student.name.trim() || "_____________________"}
            </div>
            {student.group && (
              <div className="mt-2 text-xs text-slate-500">группа {student.group}</div>
            )}

            <div className="mt-6 text-sm text-slate-600">
              успешно прошёл(-ла) учебный курс
            </div>
            <div className="mt-2 text-xl font-semibold text-emerald-800">
              «{COURSE_TITLE}»
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {COURSE_HOURS} учебных часов · {LEVELS.length} уровней · {lessonsDone.total} уроков
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Сквозной кейс: Капитальный ремонт СОШ №47, г. Алматы
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-2 mt-6">
            {LEVELS.map((lv) => {
              const score = progress.levels[lv.num]?.score;
              return (
                <div key={lv.num} className="text-center border border-emerald-100 rounded px-1 py-2 bg-emerald-50/40">
                  <div className="text-[10px] text-slate-400 uppercase">Ур. {lv.num}</div>
                  <div className="text-base">{lv.icon}</div>
                  <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                    {score !== undefined ? `${score}/100` : "✓"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="grid grid-cols-3 items-end gap-4 mt-6 pt-4 border-t border-slate-200">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Дата выдачи</div>
              <div className="text-sm font-semibold text-slate-700">{formatRuDate(issueDate)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 uppercase">Итоговый балл</div>
              <div className="text-lg font-bold text-emerald-700">{totalScore}/500</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase">Выдан</div>
              <div className="text-sm font-semibold text-slate-700">AEVION</div>
              <div className="text-[10px] text-slate-400">aevion.kz · сметный тренажёр</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-3 text-[10px] text-slate-400 text-center print:hidden">
        Сертификат генерируется на основе локального прогресса. Для подтверждения куратору
        синхронизируйте прогресс на странице Dashboard.
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

// ── Confetti (CSS-only, без библиотек) ──────────────────────────────
function Confetti() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;

  // 60 цветных «конфетти» с разными задержками и углами
  const pieces = Array.from({ length: 60 }, (_, i) => i);
  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-20 print:hidden">
      {pieces.map((i) => {
        const left = (i * 16) % 100;
        const delay = (i % 8) * 0.15;
        const dur = 2.5 + (i % 5) * 0.4;
        const color = colors[i % colors.length];
        const rot = (i * 47) % 360;
        return (
          <span
            key={i}
            className="absolute top-[-20px] confetti-piece"
            style={{
              left: `${left}%`,
              backgroundColor: color,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
              transform: `rotate(${rot}deg)`,
            }}
          />
        );
      })}
      <style jsx>{`
        .confetti-piece {
          width: 8px;
          height: 14px;
          opacity: 0.9;
          border-radius: 1px;
          animation-name: fall;
          animation-iteration-count: 1;
          animation-timing-function: cubic-bezier(0.4, 0.6, 0.6, 1);
          animation-fill-mode: forwards;
        }
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
