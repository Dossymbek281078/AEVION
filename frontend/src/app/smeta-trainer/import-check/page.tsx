"use client";

import Link from "next/link";
import { useState } from "react";
import { findRate, learningObjects, registerRuntimeRate, clearRuntimeRates } from "../lib/corpus";
import { calcLsr } from "../lib/calc";
import { runAiAdvisor } from "../lib/ai";
import type { Lsr, Rate, SmetaPosition, SmetaSection, Unit, WorkCategory, Resource } from "../lib/types";
import { LsrFormTable } from "../components/LsrFormTable";

const SAMPLE_CSV = `code,volume,formula,name,unit,category,fot_per_unit,em_per_unit,mat_per_unit
ОТД-13-01-001,52.0,Площадь стен класса (бруто),,,,,,
ОТД-15-04-001,52.0,Окраска стен (бруто без вычета проёмов),,,,,,
ОТД-15-02-003,52.0,Шпатлёвка,,,,,,
ОТД-11-02-001,18.0,Демонтаж стяжки,,,,,,
ОТД-11-04-002,18.0,Стяжка цементная 40 мм,,,,,,
ОТД-11-04-003,18.0,Демонтаж стяжки повторно (двойной счёт!),,,,,,
КРВ-12-01-001,5.4,Кровля 4-го этажа без К высоты,,,,,,
CUSTOM-01,12,Шахта лифта по проекту,Демонтаж кирпичной кладки 250мм,м³,демонтажные,3500,2200,0
CUSTOM-02,8,Усиление перекрытия,Армирование Æ12 мм по проекту,т,общестроительные,18000,4500,82000
`;

interface ParsedRow {
  code: string;
  volume: number;
  formula?: string;
  /** Опциональные поля для синтетической расценки (если code не в корпусе). */
  name?: string;
  unit?: string;
  category?: string;
  fotPerUnit?: number;
  emPerUnit?: number;
  matPerUnit?: number;
  raw: string;
}

const VALID_CATEGORIES: WorkCategory[] = [
  "общестроительные",
  "ремонтно-строительные",
  "монтаж-оборудования",
  "электромонтажные",
  "сантехнические",
  "отделочные",
  "земляные",
  "кровельные",
  "демонтажные",
];

function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { rows, errors: ["Пустой CSV"] };

  const header = lines[0].toLowerCase().split(/[,;\t]/).map((s) => s.trim());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const codeIdx = idx(["code", "шифр"]);
  const volIdx = idx(["volume", "объём", "объем"]);
  const formulaIdx = idx(["formula", "формула"]);
  const nameIdx = idx(["name", "наименование", "название"]);
  const unitIdx = idx(["unit", "ед.изм.", "ед", "единица"]);
  const catIdx = idx(["category", "категория"]);
  const fotIdx = idx(["fot_per_unit", "фот"]);
  const emIdx = idx(["em_per_unit", "эм"]);
  const matIdx = idx(["mat_per_unit", "материалы", "мат"]);

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
    const numOrUndef = (s: string | undefined): number | undefined => {
      if (!s || !s.trim()) return undefined;
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };
    rows.push({
      code,
      volume: vol,
      formula: formulaIdx >= 0 ? cols[formulaIdx] || undefined : undefined,
      name: nameIdx >= 0 ? cols[nameIdx] || undefined : undefined,
      unit: unitIdx >= 0 ? cols[unitIdx] || undefined : undefined,
      category: catIdx >= 0 ? cols[catIdx] || undefined : undefined,
      fotPerUnit: fotIdx >= 0 ? numOrUndef(cols[fotIdx]) : undefined,
      emPerUnit: emIdx >= 0 ? numOrUndef(cols[emIdx]) : undefined,
      matPerUnit: matIdx >= 0 ? numOrUndef(cols[matIdx]) : undefined,
      raw: lines[i],
    });
  }
  return { rows, errors };
}

/** Создать synthetic Rate из user-input (для CSV-импорта пользовательских расценок). */
function buildSyntheticRate(row: ParsedRow): Rate | null {
  if (!row.name || !row.unit || !row.category) return null;
  if (row.fotPerUnit == null && row.emPerUnit == null && row.matPerUnit == null) return null;
  const cat = row.category.toLowerCase();
  if (!VALID_CATEGORIES.includes(cat as WorkCategory)) return null;

  const resources: Resource[] = [];
  if (row.fotPerUnit != null && row.fotPerUnit > 0) {
    resources.push({
      kind: "труд",
      name: "Труд (агрегированный)",
      qtyPerUnit: 1,
      unit: "руб",
      basePrice: row.fotPerUnit,
    });
  }
  if (row.emPerUnit != null && row.emPerUnit > 0) {
    resources.push({
      kind: "машины",
      name: "Машины (агрегированные)",
      qtyPerUnit: 1,
      unit: "руб",
      basePrice: row.emPerUnit,
    });
  }
  if (row.matPerUnit != null && row.matPerUnit > 0) {
    resources.push({
      kind: "материал",
      name: "Материалы (агрегированные)",
      qtyPerUnit: 1,
      unit: "руб",
      basePrice: row.matPerUnit,
    });
  }
  if (resources.length === 0) return null;

  const baseCost =
    (row.fotPerUnit ?? 0) + (row.emPerUnit ?? 0) + (row.matPerUnit ?? 0);

  return {
    code: row.code,
    title: row.name,
    category: cat as WorkCategory,
    unit: row.unit as Unit,
    composition: ["Пользовательская расценка из CSV-импорта"],
    resources,
    baseCostPerUnit: baseCost,
  };
}

function rowsToLsr(rows: ParsedRow[], objectId: string): {
  lsr: Lsr;
  unknownCodes: string[];
  syntheticCount: number;
} {
  // Сбрасываем runtime-расценки от прошлых импортов и регистрируем новые
  clearRuntimeRates();
  let syntheticCount = 0;
  for (const row of rows) {
    if (findRate(row.code)) continue; // уже есть в корпусе
    const synth = buildSyntheticRate(row);
    if (synth) {
      registerRuntimeRate(synth);
      syntheticCount++;
    }
  }

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
  return { lsr, unknownCodes, syntheticCount };
}

export default function ImportCheckPage() {
  const [csvText, setCsvText] = useState("");
  const [objectId, setObjectId] = useState(learningObjects[0]?.id ?? "");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [lsr, setLsr] = useState<Lsr | null>(null);
  const [unknownCodes, setUnknownCodes] = useState<string[]>([]);
  const [syntheticCount, setSyntheticCount] = useState(0);

  function handleAnalyze() {
    const p = parseCsv(csvText);
    setParsed(p);
    if (p.rows.length > 0) {
      const r = rowsToLsr(p.rows, objectId);
      setLsr(r.lsr);
      setUnknownCodes(r.unknownCodes);
      setSyntheticCount(r.syntheticCount);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">CSV-импорт ЛСР для AI-проверки</h1>
            <p className="text-[11px] text-slate-500">
              Загрузи любую ЛСР в CSV → AI-советник прогонит 7 сценариев. Расценки
              из учебного корпуса распознаются по шифру; пользовательские —
              через колонки name/unit/category/fot/em/mat.
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
            placeholder={`Формат CSV (разделитель — , ; или таб):\n\ncode,volume,formula,name,unit,category,fot_per_unit,em_per_unit,mat_per_unit\n\nЕсли code в учебном корпусе — остальные колонки игнорируются.\nИначе нужны: name, unit, category (одна из 9), и хотя бы одна из fot/em/mat.\nПример пользовательской: CUSTOM-01,12,Шахта лифта,Демонтаж кладки,м³,демонтажные,3500,2200,0`}
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

        {/* Synthetic rates info */}
        {syntheticCount > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs text-emerald-800">
            <div className="font-bold mb-1">✓ Загружено пользовательских расценок: {syntheticCount}</div>
            <div className="text-[10px] italic">
              Расценки вне учебного корпуса использованы из CSV-полей name/unit/category/fot_per_unit/em_per_unit/mat_per_unit.
              Это позволяет проверять реальные сметы AI-советником.
            </div>
          </div>
        )}

        {/* Неизвестные шифры */}
        {unknownCodes.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            <div className="font-bold mb-1">Не найдены в корпусе и не имеют пользовательских данных ({unknownCodes.length}):</div>
            <div className="font-mono">{unknownCodes.join(", ")}</div>
            <div className="text-[10px] mt-1 italic">
              Эти позиции пропущены. Чтобы их добавить — заполните в CSV колонки
              <code className="mx-1 bg-amber-100 px-1 rounded">name, unit, category, fot_per_unit, em_per_unit, mat_per_unit</code>
              рядом с code.
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
          Импорт принимает любые расценки: учебный корпус (~200 шифров) +
          пользовательские (через колонки name/unit/category/fot/em/mat). AI-советник
          прогоняет 7 сценариев по любой смете — учебной или реальной.
        </div>
      </div>
    </div>
  );
}
