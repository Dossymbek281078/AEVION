"use client";

/**
 * Реальные расценки РК из настоящей локальной сметы (Форма 4 по НДЦС РК 8.01-08-2022).
 * Источник: real-rates.json (raw-corpus/parse-real-smeta.py, арифметически проверенные позиции —
 * 3237 расценок + 11634 ресурса из 34 локальных смет реального объекта «коллектор + КНС»).
 *
 * Учебная ценность — рядом с реальной позицией показываем:
 *  • раскрытие состава ресурсов (труд / машины / материалы / перевозки с реальными кодами);
 *  • учебный аналог из seed.json (по типу работ) и чем он отличается:
 *    реальный код ЭСН РК vs учебный шифр, ресурсная разбивка vs плоская цена.
 *
 * Стиль — Tailwind, как остальной тренажёр. Подключено роутом real-rates/page.tsx.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import realRates from "../data/real-rates.json";
import { rates as SEED_RATES } from "../lib/corpus";
import { formatKzt } from "../lib/calc";

// Контракт передачи в открытую вкладку с экзаменом — тот же ключ, что у /rates.
// Реальные коды ЭСН РК (1101-0705-0107) в seed-корпусе отсутствуют, поэтому
// в смету уходит код УЧЕБНОГО АНАЛОГА, который редактор экзамена умеет разрешить.
const PENDING_RATE_KEY = "smeta-trainer:pending-rate-code";

function sendAnalogToExam(analog: typeof SEED_RATES[number]) {
  if (typeof window === "undefined") return;
  const payload = {
    kind: "rate",
    rateCode: analog.code,
    title: analog.title,
    unit: analog.unit,
    at: Date.now(),
  };
  try {
    window.localStorage.setItem(PENDING_RATE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

interface Resource {
  code: string;
  kind: string;
  name: string;
  qtyPerUnit: number;
  unit: string;
  basePrice: number;
  total: number;
}
interface Position {
  n: number;
  code: string;
  basisDoc: string | null;
  basisClass: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
  resources?: Resource[];
}
interface Smeta {
  sheet: string;
  smetaNo: string | null;
  object: string | null;
  priceLevel?: string | null;
  totals: Record<string, number | null>;
  positions: Position[];
}
interface RealRates {
  version: string;
  source: string;
  norm: string;
  smetyCount: number;
  positionsCount: number;
  resourcesCount?: number;
  smety: Smeta[];
}

const DATA = realRates as unknown as RealRates;

// --- маппинг реальной позиции в учебную категорию seed по ключевым словам ---
// Категории совпадают с category в seed.json.
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/демонтаж|разборк|снятие|валк|корчевк|срезк/i, "демонтажные"],
  [/земл|грунт|котлован|траншея|разрабо|насыпь|планировк/i, "земляные"],
  [/труб|водопровод|канализ|колодец|задвижк|фасонн|сантех/i, "сантехнические"],
  [/штукатур|окрас|краск|малярн|шпатлевк|шпаклевк|плит|облицовк|потолок/i, "отделочные"],
  [/кровл|рулонн|стропил/i, "кровельные"],
  [/кабел|электр|провод|светильник|освещен|щит/i, "электромонтажные"],
  [/оборудовани|насос|агрегат/i, "монтаж-оборудования"],
  [/бетон|фундамент|стяжк|кладк|монтаж|установк|укладк|устройство/i, "общестроительные"],
];

function categoryOf(name: string): string | null {
  for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(name)) return cat;
  return null;
}

function seedAnalog(pos: Position) {
  const cat = categoryOf(pos.name);
  if (!cat) return null;
  const inCat = SEED_RATES.filter((r) => r.category === cat);
  if (!inCat.length) return null;
  // стабильный выбор: по хешу кода позиции
  let h = 0;
  for (const ch of pos.code) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return inCat[Math.abs(h) % inCat.length];
}

const KIND_BADGE: Record<string, string> = {
  "труд": "bg-amber-100 text-amber-800",
  "машины": "bg-purple-100 text-purple-800",
  "материал": "bg-emerald-100 text-emerald-800",
  "перевозка": "bg-sky-100 text-sky-800",
};
const BASIS_BADGE: Record<string, string> = {
  "ЭСН РК": "bg-blue-100 text-blue-800",
  "ССЦ РК": "bg-emerald-100 text-emerald-800",
  "Перевозка": "bg-sky-100 text-sky-800",
  "прочее": "bg-slate-100 text-slate-700",
};

export function RealRatesView({
  fromExam = false,
  examId = null,
}: {
  fromExam?: boolean;
  examId?: string | null;
} = {}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const smeta = DATA.smety[active];

  const positions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return smeta.positions;
    return smeta.positions.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [smeta, query]);

  return (
    <div>
      {fromExam && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-3 mb-4 flex items-center gap-3 text-xs text-emerald-900">
          <span className="text-lg">🎯</span>
          <div className="flex-1">
            <strong>Режим из экзамена.</strong> Разверните позицию (▶) и нажмите
            «📤 Учебный аналог → в смету» — расценка появится во вкладке с экзаменом
            как новая позиция (реальный код ЭСН в корпусе синтетический, поэтому
            передаётся сопоставимый учебный аналог).
          </div>
          {examId && (
            <Link
              href={`/smeta-trainer/exam/${examId}`}
              className="shrink-0 text-emerald-700 underline hover:text-emerald-900"
            >
              ← вернуться
            </Link>
          )}
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-7">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
              Локальная смета
            </label>
            <select
              value={active}
              onChange={(e) => {
                setActive(Number(e.target.value));
                setOpen(null);
              }}
              className="w-full border border-slate-300 rounded px-2 py-2 text-sm"
            >
              {DATA.smety.map((s, i) => (
                <option key={s.sheet} value={i}>
                  ЛС {s.smetaNo ?? s.sheet} — {(s.object ?? "").slice(0, 50)} ({s.positions.length} поз.)
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
              Поиск в смете
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Поиск расценки по коду или наименованию"
              placeholder="Код или наименование работы"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        {smeta.priceLevel && (
          <p className="text-[11px] text-slate-500 mt-2 italic">{smeta.priceLevel}</p>
        )}
        {smeta.totals?.["всего"] != null && (
          <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-600">
            <span>Всего по смете: <b className="font-mono">{formatKzt(smeta.totals["всего"]!)}</b></span>
            {smeta.totals["труд"] != null && <span>труд: <span className="font-mono">{formatKzt(smeta.totals["труд"]!)}</span></span>}
            {smeta.totals["машины"] != null && <span>машины: <span className="font-mono">{formatKzt(smeta.totals["машины"]!)}</span></span>}
            {smeta.totals["перевозки"] != null && <span>перевозки: <span className="font-mono">{formatKzt(smeta.totals["перевозки"]!)}</span></span>}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-2 text-left w-10">№</th>
              <th className="px-2 py-2 text-left w-40">Код / обоснование</th>
              <th className="px-2 py-2 text-left">Наименование</th>
              <th className="px-2 py-2 text-center w-16">Ед.</th>
              <th className="px-2 py-2 text-right w-20">Кол-во</th>
              <th className="px-2 py-2 text-right w-28">Цена ед., ₸</th>
              <th className="px-2 py-2 text-right w-28">Всего, ₸</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400 italic">Ничего не найдено</td></tr>
            ) : (
              positions.map((p) => (
                <RealRow
                  key={p.n}
                  pos={p}
                  isOpen={open === p.n}
                  onToggle={() => setOpen(open === p.n ? null : p.n)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RealRow({ pos, isOpen, onToggle }: { pos: Position; isOpen: boolean; onToggle: () => void }) {
  const analog = useMemo(() => seedAnalog(pos), [pos]);
  const hasRes = !!pos.resources?.length;

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-2 text-slate-500">{pos.n}</td>
        <td className="px-2 py-2">
          <code className="text-[10px] text-slate-900">{pos.code}</code>
          <br />
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${BASIS_BADGE[pos.basisClass] ?? "bg-slate-100"}`}>
            {pos.basisDoc ?? pos.basisClass}
          </span>
        </td>
        <td className="px-2 py-2 text-slate-800">{pos.name}</td>
        <td className="px-2 py-2 text-center text-slate-600">{pos.unit}</td>
        <td className="px-2 py-2 text-right font-mono text-slate-600">{formatKzt(pos.qty)}</td>
        <td className="px-2 py-2 text-right font-mono text-slate-700">{formatKzt(pos.unitPrice)}</td>
        <td className="px-2 py-2 text-right font-mono font-semibold text-emerald-700">{formatKzt(pos.total)}</td>
        <td className="px-2 py-2 text-center text-slate-400">{isOpen ? "▼" : "▶"}</td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="p-4">
            {hasRes && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                  🧱 Состав ресурсов (ресурсный метод) — {pos.resources!.length} ед.
                </div>
                <table className="w-full text-[11px] bg-white border border-slate-200 rounded">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left w-24">Вид</th>
                      <th className="px-2 py-1 text-left w-28">Код</th>
                      <th className="px-2 py-1 text-left">Ресурс</th>
                      <th className="px-2 py-1 text-right w-28">Расход / ед.</th>
                      <th className="px-2 py-1 text-right w-24">Цена, ₸</th>
                      <th className="px-2 py-1 text-right w-24">Сумма, ₸</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.resources!.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${KIND_BADGE[r.kind] ?? "bg-slate-100"}`}>
                            {r.kind}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono text-[10px] text-slate-700">{r.code}</td>
                        <td className="px-2 py-1 text-slate-700">{r.name}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-600">{formatKzt(r.qtyPerUnit)} {r.unit}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-600">{formatKzt(r.basePrice)}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-700">{formatKzt(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {analog ? <AnalogCompare pos={pos} analog={analog} /> : (
              <p className="text-[11px] text-slate-400 italic">Учебного аналога по типу работ в корпусе не найдено.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function AnalogCompare({ pos, analog }: { pos: Position; analog: typeof SEED_RATES[number] }) {
  const [sent, setSent] = useState(false);
  const Row = ({ label, real, edu }: { label: string; real: React.ReactNode; edu: React.ReactNode }) => (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-2 py-1.5 text-slate-500 w-28">{label}</td>
      <td className="px-2 py-1.5 text-slate-800">{real}</td>
      <td className="px-2 py-1.5 text-slate-800">{edu}</td>
    </tr>
  );
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
        🎓 Учебный аналог из корпуса — чем отличается от реальной сметы
      </div>
      <table className="w-full text-[11px] bg-white border border-slate-200 rounded">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-2 py-1 text-left w-28"></th>
            <th className="px-2 py-1 text-left">Реальная смета РК</th>
            <th className="px-2 py-1 text-left">Учебный корпус</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Шифр" real={<code>{pos.code}</code>} edu={<code>{analog.code}</code>} />
          <Row
            label="Обоснование"
            real={<span>{pos.basisDoc ?? pos.basisClass} <span className="text-emerald-600">(реальный норматив)</span></span>}
            edu={<span className="text-amber-700">учебный шифр (синтетический)</span>}
          />
          <Row label="Наименование" real={pos.name} edu={analog.title} />
          <Row
            label="Цена единицы"
            real={<span className="font-mono">{formatKzt(pos.unitPrice)} ₸/{pos.unit}</span>}
            edu={<span className="font-mono">{formatKzt(analog.baseCostPerUnit)} ₸/{analog.unit}</span>}
          />
          <Row
            label="Структура"
            real={<span>ресурсная разбивка: {pos.resources?.length ?? 0} ресурса (труд / машины / материалы / перевозки с кодами)</span>}
            edu={<span>{analog.resources.length} ресурса, цена задана плоско (baseCostPerUnit)</span>}
          />
        </tbody>
      </table>
      {analog.technicalNotes && (
        <p className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          💡 {analog.technicalNotes}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            sendAnalogToExam(analog);
            setSent(true);
            setTimeout(() => setSent(false), 2000);
          }}
          className={`px-3 py-1.5 text-[11px] font-bold rounded ${
            sent
              ? "bg-emerald-700 text-white"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
          title="Передать учебный аналог этой позиции в открытую вкладку с экзаменом"
        >
          {sent ? "✓ Передано" : "📤 Учебный аналог → в смету"}
        </button>
        <span className="text-[10px] text-slate-400">
          Появится во вкладке с экзаменом как новая позиция (объём по умолчанию 1).
        </span>
      </div>
    </div>
  );
}
