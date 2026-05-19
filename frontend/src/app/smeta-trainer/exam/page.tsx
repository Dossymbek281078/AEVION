"use client";

/**
 * Экзамен — студент сам составляет ЛСР и сдаёт на автопроверку.
 *
 * Задание: восстановление двух классов начальной школы после протечки
 * кровли. Объём чёткий, в задании прямо указан, но эталонные коэффициенты
 * (вычет проёмов, коэф. действующего объекта) студенту нужно применить
 * самостоятельно.
 *
 * Оценивание: см. lib/examGrader.ts.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lsr, LearningObject, SmetaPosition } from "../lib/types";
import { findRate } from "../lib/corpus";
import { calcLsr, formatKzt } from "../lib/calc";
import { gradeExam, type ExamReport } from "../lib/examGrader";

const OBJECT: LearningObject = {
  id: "exam-school-47-roof-leak",
  title: "СОШ №47, восстановление двух классов после протечки кровли",
  type: "капремонт",
  region: "Алматы",
  description:
    "Класс 305 + класс 306 на 3-м этаже. Размер каждого: 9.0 × 6.0 × 3.3 м. " +
    "В каждом 2 окна 1.4 × 1.6 м и 1 дверь 0.9 × 2.1 м. " +
    "Школа работает (ремонт — действующий объект, K=1.15 по СН РК 8.02-10).",
  geometry: {
    kind: "room",
    length: 9.0,
    width: 6.0,
    height: 3.3,
    openings: [
      { kind: "window", width: 1.4, height: 1.6, count: 4 }, // 2 окна × 2 класса
      { kind: "door", width: 0.9, height: 2.1, count: 2 },
    ],
  },
  attachments: [],
};

// Эталонное решение (бенчмарк)
const REFERENCE_LSR: Lsr = {
  id: "exam-ref",
  title: "Эталонная ЛСР — восстановление двух классов",
  objectId: OBJECT.id,
  method: "базисно-индексный",
  indexQuarter: "2026-Q2",
  indexRegion: "Алматы",
  meta: {
    objectTitle: OBJECT.title,
    lsrNumber: "exam-001",
    priceDate: "декабрь 2025 г.",
    osnovanje: "Задание экзамена",
  },
  sections: [
    {
      id: "ref-s1",
      title: "Раздел 1. Демонтаж",
      category: "демонтажные",
      positions: [
        // Площадь потолков 2×(9×6) = 108 м² (без проёмов) → 108/100
        { id: "rp1", rateCode: "ДЕМ-15-01-001", volume: 1.08, coefficients: [], formula: "(9×6)×2 = 108 м² / 100" },
        // Полы 108 м² / 100
        { id: "rp2", rateCode: "ДЕМ-11-02-001", volume: 1.08, coefficients: [], formula: "(9×6)×2 / 100" },
      ],
    },
    {
      id: "ref-s2",
      title: "Раздел 2. Штукатурка/шпатлёвка/окраска стен",
      category: "отделочные",
      positions: [
        // Стены брутто 2 × 2×(9+6) × 3.3 = 198 м². Проёмы: 4 окна × 2.24 = 8.96 + 2 двери × 1.89 = 3.78 → 12.74 м²
        // Нетто 198 − 12.74 = 185.26 м² → /100 = 1.85
        { id: "rp3", rateCode: "ОТД-13-01-001", volume: 1.85, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует, ремонт в каникулы" }], formula: "(2×(9+6)×3.3)×2 − 12.74 = 185.26 / 100" },
        { id: "rp4", rateCode: "ОТД-15-04-001", volume: 1.85, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "Школа функционирует" }], formula: "185.26 / 100" },
      ],
    },
    {
      id: "ref-s3",
      title: "Раздел 3. Полы",
      category: "отделочные",
      positions: [
        { id: "rp5", rateCode: "ОТД-11-04-002", volume: 1.08, coefficients: [], formula: "108 / 100 (линолеум)" },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Стартовый шаблон студента (с типичными ошибками — для удобства правки)
const STARTER_LSR: Lsr = {
  id: "exam-student",
  title: "Моё решение",
  objectId: OBJECT.id,
  method: "базисно-индексный",
  indexQuarter: "2026-Q2",
  indexRegion: "Алматы",
  meta: { lsrNumber: "exam-001", priceDate: "декабрь 2025 г." },
  sections: [
    {
      id: "stu-s1",
      title: "Раздел 1. Демонтаж",
      category: "демонтажные",
      positions: [
        { id: "sp1", rateCode: "ДЕМ-15-01-001", volume: 1.08, coefficients: [], formula: "108 / 100" },
        { id: "sp2", rateCode: "ДЕМ-11-02-001", volume: 1.08, coefficients: [], formula: "108 / 100" },
      ],
    },
    {
      id: "stu-s2",
      title: "Раздел 2. Отделка стен",
      category: "отделочные",
      positions: [
        // Намеренный «классический промах»: брутто без вычета проёмов → 198/100 = 1.98 (вместо 1.85)
        { id: "sp3", rateCode: "ОТД-13-01-001", volume: 1.98, coefficients: [], formula: "(2×(9+6)×3.3)×2 / 100 — без вычета проёмов" },
        { id: "sp4", rateCode: "ОТД-15-04-001", volume: 1.98, coefficients: [], formula: "1.98 (брутто)" },
      ],
    },
    {
      id: "stu-s3",
      title: "Раздел 3. Полы",
      category: "отделочные",
      positions: [
        { id: "sp5", rateCode: "ОТД-11-04-002", volume: 1.08, coefficients: [], formula: "108 / 100" },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function ExamPage() {
  const [lsr, setLsr] = useState<Lsr>(STARTER_LSR);
  const [report, setReport] = useState<ExamReport | null>(null);

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
                          justification: "Школа функционирует, ремонт в каникулы",
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

  function submit() {
    const r = gradeExam(lsr, REFERENCE_LSR, OBJECT);
    setReport(r);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setLsr(STARTER_LSR);
    setReport(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
            ← Главная
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            🎓 Экзамен: автоматическая проверка ЛСР
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Составьте смету по заданию ниже. Система проверит AI-сценариями (15 шт.), сравнит с
            эталоном по покрытию позиций, объёмам и итоговой сумме. Балл — от 0 до 100.
          </p>
        </div>

        {/* Задание */}
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-amber-700 font-bold mb-1">
            Задание
          </div>
          <div className="text-sm text-amber-900 leading-relaxed">{OBJECT.description}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
            <Bit label="Габарит класса" value="9 × 6 × 3.3 м" />
            <Bit label="Кол-во классов" value="2 (305, 306)" />
            <Bit label="Окон в классе" value="2 шт (1.4 × 1.6)" />
            <Bit label="Дверей в классе" value="1 шт (0.9 × 2.1)" />
          </div>
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
              <Score
                label="AI-проверки"
                score={report.breakdown.ai.score}
                weight={report.breakdown.ai.weight}
                hint={`${report.breakdown.ai.notices.length} замечаний`}
              />
              <Score
                label="Покрытие позиций"
                score={report.breakdown.coverage.score}
                weight={report.breakdown.coverage.weight}
                hint={`${report.breakdown.coverage.matched} / ${report.breakdown.coverage.total} расценок`}
              />
              <Score
                label="Точность объёмов"
                score={report.breakdown.volumes.score}
                weight={report.breakdown.volumes.weight}
                hint={`Δ ${report.breakdown.volumes.avgDeltaPct.toFixed(1)}% в среднем`}
              />
              <Score
                label="Итоговая сумма"
                score={report.breakdown.total.score}
                weight={report.breakdown.total.weight}
                hint={`Δ ${report.breakdown.total.deltaPct.toFixed(1)}% от эталона`}
              />
            </div>

            {/* Сравнение позиций */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">
                Сравнение с эталоном
              </h3>
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-28">Шифр</th>
                    <th className="px-2 py-1.5 text-left">Наименование</th>
                    <th className="px-2 py-1.5 text-right w-20">Эталон</th>
                    <th className="px-2 py-1.5 text-right w-20">Студент</th>
                    <th className="px-2 py-1.5 text-right w-20">Δ%</th>
                    <th className="px-2 py-1.5 text-center w-24">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {report.positions.map((p) => (
                    <tr key={`${p.rateCode}-${p.status}`} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-mono">{p.rateCode}</td>
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

            {/* AI замечания */}
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
              <h3 className="text-xs font-bold uppercase text-slate-600 mb-2">{section.title}</h3>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-28">Шифр</th>
                    <th className="px-2 py-1.5 text-left">Наименование</th>
                    <th className="px-2 py-1.5 text-right w-32">Объём</th>
                    <th className="px-2 py-1.5 text-center w-32">К=1.15</th>
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
                        <td className="px-2 py-1.5 font-mono">{p.rateCode}</td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {rate?.title ?? p.rateCode}
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

        <div className="text-[11px] text-slate-500 italic">
          Подсказка: на отделке стен в действующей школе типично применяют К=1.15 (СН РК 8.02-10).
          Проёмы вычитайте из брутто площадей стен — иначе закроете больше штукатурки, чем выполнено.
        </div>
      </div>
    </div>
  );
}

function Bit({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-amber-700 text-[10px] uppercase">{label}</div>
      <div className="font-semibold text-amber-900">{value}</div>
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
