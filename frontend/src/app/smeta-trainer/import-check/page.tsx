"use client";

import Link from "next/link";
import { useState } from "react";
import { findRate, learningObjects } from "../lib/corpus";
import { calcLsr } from "../lib/calc";
import { runAiAdvisor } from "../lib/ai";
import type { Lsr, SmetaPosition, SmetaSection, WorkCategory } from "../lib/types";
import { LsrFormTable } from "../components/LsrFormTable";

const SAMPLE_CSV = `code,volume,coefficient,formula
ОТД-13-01-001,52.0,,Площадь стен класса (бруто)
ОТД-15-04-001,52.0,,Окраска стен (бруто, без вычета проёмов)
ОТД-15-02-003,52.0,,Шпатлёвка
ОТД-11-02-001,18.0,,Демонтаж стяжки
ОТД-11-04-002,18.0,,Стяжка цементная 40 мм
ОТД-11-04-003,18.0,,Демонтаж стяжки повторно (двойной счёт!)
КРВ-12-01-001,5.4,,Кровля 4-го этажа без К высоты
`;

interface ParsedRow {
  code: string;
  volume: number;
  formula?: string;
  raw: string;
}

function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { rows, errors: ["Пустой CSV"] };

  const header = lines[0].toLowerCase().split(/[,;\t]/).map((s) => s.trim());
  const codeIdx = header.findIndex((h) => h === "code" || h === "шифр");
  const volIdx = header.findIndex((h) => h === "volume" || h === "объём" || h === "объем");
  const formulaIdx = header.findIndex((h) => h === "formula" || h === "формула");
  if (codeIdx === -1 || volIdx === -1) {
    errors.push("В шапке CSV не найдены обязательные колонки 'code' и 'volume' (или 'шифр' и 'объём')");
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map((s) => s.trim());
    const code = cols[codeIdx];
    const volRaw = cols[volIdx];
    const vol = Number(volRaw.replace(",", "."));
    if (!code) continue;
    if (!Number.isFinite(vol)) {
      errors.push(`Строка ${i + 1}: объём «${volRaw}» не парсится как число`);
      continue;
    }
    rows.push({
      code,
      volume: vol,
      formula: formulaIdx >= 0 ? cols[formulaIdx] : undefined,
      raw: lines[i],
    });
  }
  return { rows, errors };
}

function rowsToLsr(rows: ParsedRow[], objectId: string): {
  lsr: Lsr;
  unknownCodes: string[];
} {
  const unknownCodes: string[] = [];
  const positions: SmetaPosition[] = [];
  rows.forEach((r, i) => {
    const rate = findRate(r.code);
    if (!rate) {
      unknownCodes.push(r.code);
      return;
    }
    positions.push({
      id: `imp-${i}`,
      rateCode: r.code,
      volume: r.volume,
      coefficients: [],
      formula: r.formula,
    });
  });
  // Группируем по категории расценок
  const sectionsByCategory = new Map<WorkCategory, SmetaPosition[]>();
  for (const pos of positions) {
    const rate = findRate(pos.rateCode);
    if (!rate) continue;
    if (!sectionsByCategory.has(rate.category)) sectionsByCategory.set(rate.category, []);
    sectionsByCategory.get(rate.category)!.push(pos);
  }
  const sections: SmetaSection[] = [...sectionsByCategory.entries()].map(([cat, ps], i) => ({
    id: `imp-s${i}`,
    title: `Раздел ${i + 1}. ${cat}`,
    category: cat,
    positions: ps,
  }));
  const lsr: Lsr = {
    id: "imported-lsr",
    title: "Импортированная ЛСР для проверки",
    objectId,
    method: "базисно-индексный",
    indexQuarter: "2026-Q2",
    indexRegion: "Алматы",
    meta: {
      lsrNumber: "IMP-01",
      objectTitle: "Импорт",
      strojkaCode: "—",
      priceDate: "проверяется",
      author: "(импорт)",
    },
    sections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { lsr, unknownCodes };
}

export default function ImportCheckPage() {
  const [csvText, setCsvText] = useState("");
  const [objectId, setObjectId] = useState(learningObjects[0]?.id ?? "");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [lsr, setLsr] = useState<Lsr | null>(null);
  const [unknownCodes, setUnknownCodes] = useState<string[]>([]);

  function handleAnalyze() {
    const p = parseCsv(csvText);
    setParsed(p);
    if (p.rows.length > 0) {
      const { lsr, unknownCodes } = rowsToLsr(p.rows, objectId);
      setLsr(lsr);
      setUnknownCodes(unknownCodes);
    } else {
      setLsr(null);
      setUnknownCodes([]);
    }
  }

  function handleSample() {
    setCsvText(SAMPLE_CSV);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  const calc = lsr ? calcLsr(lsr) : null;
  const learningObject = lsr ? learningObjects.find((o) => o.id === lsr.objectId) : undefined;
  const notices = lsr && learningObject ? runAiAdvisor(lsr, learningObject) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">CSV-импорт ЛСР для AI-проверки</h1>
            <p className="text-[11px] text-slate-500">
              Загрузи свою ЛСР в виде CSV → AI-советник прогонит 7 сценариев и покажет
              ошибки. Учебный режим: расценки из корпуса тренажёра (~200 шт).
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-4 space-y-4">
        {/* Форма импорта */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-semibold text-slate-900">CSV-данные</div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSample}
                className="text-[11px] text-emerald-600 hover:text-emerald-800 underline"
              >
                Загрузить пример (с ошибками)
              </button>
              <label className="text-[11px] text-sky-600 hover:text-sky-800 underline cursor-pointer">
                Открыть .csv файл
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
            </div>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            placeholder={`Формат CSV (разделитель — запятая, точка с запятой или таб):\n\ncode,volume,formula\nОТД-13-01-001,52.0,Площадь стен по чертежу А-12\nДЕМ-11-02-001,18.0,Демонтаж стяжки`}
            className="w-full border border-slate-300 rounded p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <select
              value={objectId}
              onChange={(e) => setObjectId(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-xs"
            >
              {learningObjects.map((o) => (
                <option key={o.id} value={o.id}>
                  Объект: {o.id}
                </option>
              ))}
            </select>
            <button
              onClick={handleAnalyze}
              disabled={!csvText.trim()}
              className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-40"
            >
              🔍 Проверить с AI-советником
            </button>
          </div>
        </div>

        {/* Парсинг ошибки */}
        {parsed && parsed.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
            <div className="font-bold mb-1">Ошибки парсинга:</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {parsed.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Неизвестные шифры */}
        {unknownCodes.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            <div className="font-bold mb-1">Не найдены в учебном корпусе ({unknownCodes.length}):</div>
            <div className="font-mono">{unknownCodes.join(", ")}</div>
            <div className="text-[10px] mt-1 italic">
              Эти позиции пропущены в анализе. В учебном корпусе ~200 расценок —
              для полной проверки нужна интеграция с реальным сборником ЭСН.
            </div>
          </div>
        )}

        {/* AI-советник результат */}
        {calc && lsr && (
          <>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-900">
                  AI-советник: {notices.length} замечаний
                </div>
                <div className="text-xs text-slate-500">
                  Позиций обработано: {calc.sections.reduce((s, sc) => s + sc.positions.length, 0)} ·
                  Итог без НДС: <strong className="text-slate-800">{Math.round(calc.totalBeforeVat).toLocaleString("ru-RU")} ₸</strong>
                </div>
              </div>
              {notices.length === 0 ? (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
                  ✓ AI-советник не нашёл явных ошибок. Это не значит, что смета идеальна
                  — могут быть незаметные алгоритму проблемы. Особенно по объёмам ВОР.
                </div>
              ) : (
                <div className="space-y-2">
                  {notices.map((n) => (
                    <div
                      key={n.id}
                      className={`text-xs rounded p-2 border ${
                        n.severity === "error"
                          ? "bg-red-50 border-red-200 text-red-800"
                          : n.severity === "warning"
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-sky-50 border-sky-200 text-sky-800"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        {n.severity === "error" ? "🛑" : n.severity === "warning" ? "⚠" : "💡"}
                        {n.title}
                      </div>
                      <div className="mt-0.5 leading-snug">{n.message}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 italic">
                        Сценарий: {n.scenario}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-slate-900 mb-3">
                Импортированная ЛСР (read-only)
              </div>
              <LsrFormTable
                calc={calc}
                notices={notices}
                onChangeVolume={() => {}}
                onRemove={() => {}}
              />
            </div>
          </>
        )}

        <div className="text-[10px] text-slate-400 italic text-center pt-2">
          Импорт работает с учебным корпусом расценок (~200 шифров). Для реальных
          смет требуется интеграция с полным сборником ЭСН РК.
        </div>
      </div>
    </div>
  );
}
