"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TabId = "ks2" | "ks3" | "f3";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "ks2", label: "Акт КС-2", icon: "📑" },
  { id: "ks3", label: "Справка КС-3", icon: "📊" },
  { id: "f3", label: "Форма Ф-3", icon: "📘" },
];

// ───────── helpers ─────────

function fmt(n: number): string {
  if (!isFinite(n)) return "0";
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmt2(n: number): string {
  if (!isFinite(n)) return "0,00";
  return n
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ───────── KS-2 types ─────────

interface Ks2Position {
  id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
}

const newKs2Pos = (): Ks2Position => ({
  id: Math.random().toString(36).slice(2, 9),
  code: "",
  name: "",
  unit: "",
  qty: 0,
  price: 0,
});

interface Ks2State {
  number: string;
  object: string;
  contractor: string;
  customer: string;
  contractNo: string;
  contractDate: string;
  periodFrom: string;
  periodTo: string;
  index: number;
  positions: Ks2Position[];
}

const initialKs2: Ks2State = {
  number: "1",
  object: "Школа №47, г. Алматы",
  contractor: "ТОО «СтройМонтажАлматы»",
  customer: "ГУ «Управление образования г. Алматы»",
  contractNo: "СМР-12/2026",
  contractDate: "2026-03-15",
  periodFrom: "2026-04-01",
  periodTo: "2026-04-30",
  index: 11.42,
  positions: [
    {
      id: "p1",
      code: "ЭСН 6-01-001-1",
      name: "Бетонирование монолитного фундамента",
      unit: "м³",
      qty: 100,
      price: 1280,
    },
    {
      id: "p2",
      code: "ЭСН 8-02-001-1",
      name: "Кладка стен из газобетонных блоков",
      unit: "м³",
      qty: 45,
      price: 2150,
    },
  ],
};

// ───────── KS-3 types ─────────

interface Ks3State {
  number: string;
  object: string;
  contractor: string;
  customer: string;
  contractNo: string;
  contractDate: string;
  periodFrom: string;
  periodTo: string;
  totalSinceStart: number;
  totalPeriod: number;
  costSinceYear: number;
  costSmr: number;
  costEquipment: number;
}

const initialKs3: Ks3State = {
  number: "1",
  object: "Школа №47, г. Алматы",
  contractor: "ТОО «СтройМонтажАлматы»",
  customer: "ГУ «Управление образования г. Алматы»",
  contractNo: "СМР-12/2026",
  contractDate: "2026-03-15",
  periodFrom: "2026-04-01",
  periodTo: "2026-04-30",
  totalSinceStart: 12500000,
  totalPeriod: 4200000,
  costSinceYear: 12500000,
  costSmr: 3800000,
  costEquipment: 400000,
};

// ───────── F-3 types ─────────

const F3_CHAPTERS = [
  "Подготовка территории строительства",
  "Основные объекты строительства",
  "Объекты подсобного и обслуживающего назначения",
  "Объекты энергетического хозяйства",
  "Объекты транспортного хозяйства и связи",
  "Наружные сети и сооружения водоснабжения, канализации, теплоснабжения и газоснабжения",
  "Благоустройство и озеленение территории",
  "Временные здания и сооружения",
  "Прочие работы и затраты",
  "Содержание дирекции (технический надзор)",
  "ПИР (проектные и изыскательские работы)",
  "Подготовка эксплуатационных кадров",
];

interface F3State {
  object: string;
  customer: string;
  stage: "П" | "РД";
  chapters: number[]; // 12 numbers
  reservePct: number;
}

const initialF3: F3State = {
  object: "Школа №47, г. Алматы — пристройка 600 м²",
  customer: "ГУ «Управление образования г. Алматы»",
  stage: "РД",
  chapters: [
    1500000, // 1
    65000000, // 2
    3500000, // 3
    1200000, // 4
    800000, // 5
    7500000, // 6
    2800000, // 7
    1400000, // 8
    2100000, // 9
    900000, // 10
    4500000, // 11
    300000, // 12
  ],
  reservePct: 2,
};

// ───────── PRINT STYLES ─────────

const PRINT_STYLES = `
  @media print {
    body { background: white !important; }
    .no-print { display: none !important; }
    .print-area { display: block !important; }
    .print-area * { color: #000 !important; background: #fff !important; }
    .print-area table { border-collapse: collapse; width: 100%; }
    .print-area table th, .print-area table td {
      border: 1px solid #000 !important;
      padding: 4px 6px !important;
      font-size: 11px !important;
    }
    @page { margin: 12mm; size: A4; }
  }
`;

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function FormsActsPage() {
  const [tab, setTab] = useState<TabId>("ks2");
  const [ks2, setKs2] = useState<Ks2State>(initialKs2);
  const [ks3, setKs3] = useState<Ks3State>(initialKs3);
  const [f3, setF3] = useState<F3State>(initialF3);
  const [showPrint, setShowPrint] = useState(false);

  // KS-2 calculations
  const ks2Calc = useMemo(() => {
    const subtotal = ks2.positions.reduce((s, p) => s + p.qty * p.price, 0);
    const withIndex = subtotal * ks2.index;
    const vat = withIndex * 0.12;
    const total = withIndex + vat;
    return { subtotal, withIndex, vat, total };
  }, [ks2.positions, ks2.index]);

  // KS-3 calculations
  const ks3Calc = useMemo(() => {
    const sumNoVat = ks3.totalPeriod;
    const vat = sumNoVat * 0.12;
    const totalWithVat = sumNoVat + vat;
    return { sumNoVat, vat, totalWithVat };
  }, [ks3.totalPeriod]);

  // F-3 calculations
  const f3Calc = useMemo(() => {
    const ch = f3.chapters;
    const smr1to7 = ch.slice(0, 7).reduce((s, v) => s + v, 0);
    const smrWithTemp = smr1to7 + ch[7]; // 1-8
    const totalSummary = ch.reduce((s, v) => s + v, 0); // 1-12
    const reserve = (totalSummary * f3.reservePct) / 100;
    const withReserve = totalSummary + reserve;
    const vat = withReserve * 0.12;
    const grandTotal = withReserve + vat;
    return { smr1to7, smrWithTemp, totalSummary, reserve, withReserve, vat, grandTotal };
  }, [f3.chapters, f3.reservePct]);

  function handlePrint() {
    setShowPrint(true);
    setTimeout(() => {
      window.print();
    }, 100);
  }

  function clearKs2() {
    if (!confirm("Очистить форму КС-2?")) return;
    setKs2({
      ...initialKs2,
      number: "",
      object: "",
      contractor: "",
      customer: "",
      contractNo: "",
      contractDate: "",
      periodFrom: "",
      periodTo: "",
      index: 11.42,
      positions: [newKs2Pos()],
    });
    setShowPrint(false);
  }

  function clearKs3() {
    if (!confirm("Очистить форму КС-3?")) return;
    setKs3({
      ...initialKs3,
      number: "",
      object: "",
      contractor: "",
      customer: "",
      contractNo: "",
      contractDate: "",
      periodFrom: "",
      periodTo: "",
      totalSinceStart: 0,
      totalPeriod: 0,
      costSinceYear: 0,
      costSmr: 0,
      costEquipment: 0,
    });
    setShowPrint(false);
  }

  function clearF3() {
    if (!confirm("Очистить форму Ф-3?")) return;
    setF3({
      ...initialF3,
      object: "",
      customer: "",
      stage: "РД",
      chapters: new Array(12).fill(0),
      reservePct: 2,
    });
    setShowPrint(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style jsx global>{PRINT_STYLES}</style>

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📑 Формы КС-2, КС-3, Ф-3 — генератор для печати
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Заполни данные → нажми «Просмотр для печати» → сохрани через браузер как PDF (Ctrl+P → «Сохранить как PDF»)
            </p>
          </div>
        </div>
      </header>

      <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-2 text-xs text-blue-800 dark:text-blue-300 no-print">
        💡 Это <b>учебный</b> генератор. Для боевых форм используют АВС-4 / Сметa РК / Сана. Цель тренажёра — понять структуру документов и научиться их заполнять.
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 no-print">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setShowPrint(false);
                }}
                className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ═══════ TAB 1: КС-2 ═══════ */}
        {tab === "ks2" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-4">
                Общие данные акта КС-2
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="№ акта">
                  <input
                    value={ks2.number}
                    onChange={(e) => setKs2({ ...ks2, number: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Объект">
                  <input
                    value={ks2.object}
                    onChange={(e) => setKs2({ ...ks2, object: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Подрядчик">
                  <input
                    value={ks2.contractor}
                    onChange={(e) => setKs2({ ...ks2, contractor: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Заказчик">
                  <input
                    value={ks2.customer}
                    onChange={(e) => setKs2({ ...ks2, customer: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Договор №">
                  <input
                    value={ks2.contractNo}
                    onChange={(e) => setKs2({ ...ks2, contractNo: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Дата договора">
                  <input
                    type="date"
                    value={ks2.contractDate}
                    onChange={(e) => setKs2({ ...ks2, contractDate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Период с">
                  <input
                    type="date"
                    value={ks2.periodFrom}
                    onChange={(e) => setKs2({ ...ks2, periodFrom: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Период по">
                  <input
                    type="date"
                    value={ks2.periodTo}
                    onChange={(e) => setKs2({ ...ks2, periodTo: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            {/* Positions */}
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
                Позиции работ
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold w-8">№</th>
                      <th className="px-2 py-2 text-left font-semibold w-32">Шифр</th>
                      <th className="px-2 py-2 text-left font-semibold">Наименование</th>
                      <th className="px-2 py-2 text-left font-semibold w-16">Ед.</th>
                      <th className="px-2 py-2 text-right font-semibold w-20">Кол-во</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">Цена 2001 г.</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">Сумма</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ks2.positions.map((p, idx) => (
                      <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="px-2 py-1 text-slate-500">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <input
                            value={p.code}
                            onChange={(e) =>
                              setKs2({
                                ...ks2,
                                positions: ks2.positions.map((x) =>
                                  x.id === p.id ? { ...x, code: e.target.value } : x,
                                ),
                              })
                            }
                            className={inputXs}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            value={p.name}
                            onChange={(e) =>
                              setKs2({
                                ...ks2,
                                positions: ks2.positions.map((x) =>
                                  x.id === p.id ? { ...x, name: e.target.value } : x,
                                ),
                              })
                            }
                            className={inputXs}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            value={p.unit}
                            onChange={(e) =>
                              setKs2({
                                ...ks2,
                                positions: ks2.positions.map((x) =>
                                  x.id === p.id ? { ...x, unit: e.target.value } : x,
                                ),
                              })
                            }
                            className={inputXs}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={p.qty}
                            onChange={(e) =>
                              setKs2({
                                ...ks2,
                                positions: ks2.positions.map((x) =>
                                  x.id === p.id ? { ...x, qty: parseFloat(e.target.value) || 0 } : x,
                                ),
                              })
                            }
                            className={`${inputXs} text-right`}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={p.price}
                            onChange={(e) =>
                              setKs2({
                                ...ks2,
                                positions: ks2.positions.map((x) =>
                                  x.id === p.id ? { ...x, price: parseFloat(e.target.value) || 0 } : x,
                                ),
                              })
                            }
                            className={`${inputXs} text-right`}
                          />
                        </td>
                        <td className="px-2 py-1 text-right text-slate-700 dark:text-slate-300 font-mono">
                          {fmt(p.qty * p.price)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setKs2({
                                ...ks2,
                                positions: ks2.positions.filter((x) => x.id !== p.id),
                              })
                            }
                            className="text-red-500 hover:text-red-700 text-base"
                            title="Удалить позицию"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() =>
                  setKs2({ ...ks2, positions: [...ks2.positions, newKs2Pos()] })
                }
                className="mt-3 text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 font-semibold"
              >
                + Добавить позицию
              </button>
            </div>

            {/* Totals */}
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
                Итоги по акту
              </h2>
              <div className="space-y-2 text-xs">
                <Row label="Итого по позициям (в ценах 2001 г.):" value={`${fmt(ks2Calc.subtotal)} тг`} />
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400 flex-1">
                    × Индекс перевода в текущие цены:
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={ks2.index}
                    onChange={(e) =>
                      setKs2({ ...ks2, index: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} w-24 text-right`}
                  />
                </div>
                <Row label="= Стоимость в текущих ценах:" value={`${fmt(ks2Calc.withIndex)} тг`} />
                <Row label="+ НДС 12%:" value={`${fmt(ks2Calc.vat)} тг`} />
                <div className="border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                  <Row
                    label="К оплате (с НДС):"
                    value={`${fmt(ks2Calc.total)} тг`}
                    bold
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  🖨 Просмотр для печати
                </button>
                <button
                  type="button"
                  onClick={clearKs2}
                  className="text-xs px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold"
                >
                  Очистить форму
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB 2: КС-3 ═══════ */}
        {tab === "ks3" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-4">
                Справка о стоимости (КС-3)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="№ справки">
                  <input
                    value={ks3.number}
                    onChange={(e) => setKs3({ ...ks3, number: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Объект">
                  <input
                    value={ks3.object}
                    onChange={(e) => setKs3({ ...ks3, object: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Подрядчик">
                  <input
                    value={ks3.contractor}
                    onChange={(e) => setKs3({ ...ks3, contractor: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Заказчик">
                  <input
                    value={ks3.customer}
                    onChange={(e) => setKs3({ ...ks3, customer: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Договор №">
                  <input
                    value={ks3.contractNo}
                    onChange={(e) => setKs3({ ...ks3, contractNo: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Дата договора">
                  <input
                    type="date"
                    value={ks3.contractDate}
                    onChange={(e) => setKs3({ ...ks3, contractDate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Период с">
                  <input
                    type="date"
                    value={ks3.periodFrom}
                    onChange={(e) => setKs3({ ...ks3, periodFrom: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Период по">
                  <input
                    type="date"
                    value={ks3.periodTo}
                    onChange={(e) => setKs3({ ...ks3, periodTo: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="С начала строительства, всего (тг)">
                  <input
                    type="number"
                    value={ks3.totalSinceStart}
                    onChange={(e) =>
                      setKs3({ ...ks3, totalSinceStart: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} text-right`}
                  />
                </Field>
                <Field label="В т.ч. за отчётный период (тг)">
                  <input
                    type="number"
                    value={ks3.totalPeriod}
                    onChange={(e) =>
                      setKs3({ ...ks3, totalPeriod: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} text-right`}
                  />
                </Field>
                <Field label="С начала года (тг)">
                  <input
                    type="number"
                    value={ks3.costSinceYear}
                    onChange={(e) =>
                      setKs3({ ...ks3, costSinceYear: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} text-right`}
                  />
                </Field>
                <Field label="В т.ч. СМР (тг)">
                  <input
                    type="number"
                    value={ks3.costSmr}
                    onChange={(e) => setKs3({ ...ks3, costSmr: parseFloat(e.target.value) || 0 })}
                    className={`${inputCls} text-right`}
                  />
                </Field>
                <Field label="В т.ч. оборудование (тг)">
                  <input
                    type="number"
                    value={ks3.costEquipment}
                    onChange={(e) =>
                      setKs3({ ...ks3, costEquipment: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} text-right`}
                  />
                </Field>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
                Расчёт итогов
              </h2>
              <div className="space-y-2 text-xs">
                <Row label="Сумма за период без НДС:" value={`${fmt(ks3Calc.sumNoVat)} тг`} />
                <Row label="+ НДС 12%:" value={`${fmt(ks3Calc.vat)} тг`} />
                <div className="border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                  <Row label="Итого с НДС:" value={`${fmt(ks3Calc.totalWithVat)} тг`} bold />
                </div>
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  🖨 Просмотр для печати
                </button>
                <button
                  type="button"
                  onClick={clearKs3}
                  className="text-xs px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold"
                >
                  Очистить форму
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB 3: Ф-3 ═══════ */}
        {tab === "f3" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-4">
                Сводный сметный расчёт (Форма Ф-3)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Объект">
                  <input
                    value={f3.object}
                    onChange={(e) => setF3({ ...f3, object: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Заказчик">
                  <input
                    value={f3.customer}
                    onChange={(e) => setF3({ ...f3, customer: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Стадия проектирования">
                  <select
                    value={f3.stage}
                    onChange={(e) => setF3({ ...f3, stage: e.target.value as "П" | "РД" })}
                    className={inputCls}
                  >
                    <option value="П">П — Проект</option>
                    <option value="РД">РД — Рабочая документация</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
                12 глав сводного расчёта (тг)
              </h2>
              <div className="space-y-1.5">
                {F3_CHAPTERS.map((title, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400 w-6 shrink-0 text-right font-mono">
                      гл. {i + 1}
                    </span>
                    <span className="flex-1 text-slate-700 dark:text-slate-300">{title}</span>
                    <input
                      type="number"
                      value={f3.chapters[i]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        const c = [...f3.chapters];
                        c[i] = v;
                        setF3({ ...f3, chapters: c });
                      }}
                      className={`${inputCls} w-32 text-right shrink-0`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
                Итоги по сводному расчёту
              </h2>
              <div className="space-y-2 text-xs">
                <Row label="Итого СМР (главы 1-7):" value={`${fmt(f3Calc.smr1to7)} тг`} />
                <Row
                  label="Итого СМР с временными зданиями (главы 1-8):"
                  value={`${fmt(f3Calc.smrWithTemp)} тг`}
                />
                <Row label="Всего по сводному (главы 1-12):" value={`${fmt(f3Calc.totalSummary)} тг`} />
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400 flex-1">
                    + Резерв на непредвиденные работы и затраты, %:
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={f3.reservePct}
                    onChange={(e) =>
                      setF3({ ...f3, reservePct: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} w-20 text-right`}
                  />
                </div>
                <Row label="Сумма резерва:" value={`${fmt(f3Calc.reserve)} тг`} />
                <Row label="Итого с резервом:" value={`${fmt(f3Calc.withReserve)} тг`} />
                <Row label="+ НДС 12%:" value={`${fmt(f3Calc.vat)} тг`} />
                <div className="border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                  <Row
                    label="СТОИМОСТЬ ОБЪЕКТА В ТЕКУЩИХ ЦЕНАХ:"
                    value={`${fmt(f3Calc.grandTotal)} тг`}
                    bold
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  🖨 Просмотр для печати
                </button>
                <button
                  type="button"
                  onClick={clearF3}
                  className="text-xs px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold"
                >
                  Очистить форму
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reference card */}
        <div className="mt-8 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-5">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
            📚 Справочник по формам
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">КС-2</div>
              <div className="text-slate-600 dark:text-slate-400">
                Акт о приёмке выполненных работ. Унифицированная форма, утверждена
                Постановлением Госкомстата РФ № 100; применяется в РК как унифицированная
                форма. Подписывают подрядчик, заказчик, тех. надзор.
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">КС-3</div>
              <div className="text-slate-600 dark:text-slate-400">
                Справка о стоимости выполненных работ и затрат. Составляется на основании
                КС-2 нарастающим итогом. Основание для перевода средств подрядчику.
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">Ф-3</div>
              <div className="text-slate-600 dark:text-slate-400">
                Сводный сметный расчёт стоимости строительства по МДС 81-25.2004 (12 глав).
                Главный финансовый документ объекта в стадии «П» / «РД».
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
           PRINT AREA
         ═══════════════════════════════════════════════════════ */}
      {showPrint && (
        <div className="print-area max-w-5xl mx-auto px-6 py-6 bg-white text-black">
          {/* Print toolbar (visible on screen, hidden on print) */}
          <div className="no-print mb-4 flex gap-2 items-center bg-yellow-50 border border-yellow-300 rounded-lg p-3">
            <span className="text-xs text-yellow-900 font-semibold flex-1">
              👁 Предпросмотр документа. Используй Ctrl+P чтобы напечатать или сохранить как PDF.
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700"
            >
              🖨 Печать / PDF
            </button>
            <button
              type="button"
              onClick={() => setShowPrint(false)}
              className="text-xs px-3 py-1.5 bg-slate-200 text-slate-700 rounded font-semibold hover:bg-slate-300"
            >
              Закрыть
            </button>
          </div>

          {/* ───── KS-2 PRINT ───── */}
          {tab === "ks2" && (
            <div className="font-mono text-[12px] text-black">
              <div className="text-right text-[10px] mb-2">
                Унифицированная форма № КС-2
                <br />
                Утверждена Постановлением Госкомстата РФ от 11.11.1999 № 100
              </div>
              <div className="text-center mb-4">
                <div className="text-base font-bold">АКТ № {ks2.number || "___"}</div>
                <div className="text-sm font-bold">О ПРИЁМКЕ ВЫПОЛНЕННЫХ РАБОТ</div>
              </div>
              <div className="space-y-1 mb-4">
                <div>
                  <b>Объект:</b> {ks2.object || "_______________________"}
                </div>
                <div>
                  <b>Подрядчик:</b> {ks2.contractor || "_______________________"}
                </div>
                <div>
                  <b>Заказчик:</b> {ks2.customer || "_______________________"}
                </div>
                <div>
                  <b>Договор №</b> {ks2.contractNo || "____"} <b>от</b>{" "}
                  {ks2.contractDate || "____________"}
                </div>
                <div>
                  <b>Отчётный период:</b> с {ks2.periodFrom || "________"} по{" "}
                  {ks2.periodTo || "________"}
                </div>
              </div>
              <table className="w-full mb-3" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cellHead}>№</th>
                    <th style={cellHead}>Шифр расценки</th>
                    <th style={cellHead}>Наименование работ</th>
                    <th style={cellHead}>Ед.</th>
                    <th style={cellHead}>Кол-во</th>
                    <th style={cellHead}>Цена 2001 г.</th>
                    <th style={cellHead}>Сумма 2001 г.</th>
                  </tr>
                </thead>
                <tbody>
                  {ks2.positions.map((p, i) => (
                    <tr key={p.id}>
                      <td style={cell}>{i + 1}</td>
                      <td style={cell}>{p.code}</td>
                      <td style={cell}>{p.name}</td>
                      <td style={cell}>{p.unit}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmt2(p.qty)}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmt2(p.price)}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmt(p.qty * p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1 text-right mb-6">
                <div>
                  Итого по позициям (2001 г.): <b>{fmt(ks2Calc.subtotal)} тг</b>
                </div>
                <div>
                  × Индекс {ks2.index}: <b>{fmt(ks2Calc.withIndex)} тг</b>
                </div>
                <div>
                  + НДС 12%: <b>{fmt(ks2Calc.vat)} тг</b>
                </div>
                <div className="text-base mt-2">
                  К ОПЛАТЕ: <b>{fmt(ks2Calc.total)} тг</b>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 mt-12 text-[11px]">
                <div>
                  <div>Сдал — Подрядчик:</div>
                  <div className="mt-8 border-t border-black pt-1">
                    ____________________ / __________________ /
                  </div>
                  <div className="mt-1 text-center">М.П.</div>
                </div>
                <div>
                  <div>Принял — Заказчик:</div>
                  <div className="mt-8 border-t border-black pt-1">
                    ____________________ / __________________ /
                  </div>
                  <div className="mt-1 text-center">М.П.</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 mt-6 text-[11px]">
                <div>
                  <div>Технический надзор:</div>
                  <div className="mt-8 border-t border-black pt-1">
                    ____________________ / __________________ /
                  </div>
                </div>
                <div>
                  <div>Дата подписания:</div>
                  <div className="mt-8 border-t border-black pt-1">
                    «____» _________________ 20__ г.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ───── KS-3 PRINT ───── */}
          {tab === "ks3" && (
            <div className="font-mono text-[12px] text-black">
              <div className="text-right text-[10px] mb-2">
                Унифицированная форма № КС-3
                <br />
                Утверждена Постановлением Госкомстата РФ от 11.11.1999 № 100
              </div>
              <div className="text-center mb-4">
                <div className="text-base font-bold">СПРАВКА № {ks3.number || "___"}</div>
                <div className="text-sm font-bold">
                  О СТОИМОСТИ ВЫПОЛНЕННЫХ РАБОТ И ЗАТРАТ
                </div>
              </div>
              <div className="space-y-1 mb-4">
                <div>
                  <b>Объект:</b> {ks3.object || "_______________________"}
                </div>
                <div>
                  <b>Подрядчик:</b> {ks3.contractor || "_______________________"}
                </div>
                <div>
                  <b>Заказчик:</b> {ks3.customer || "_______________________"}
                </div>
                <div>
                  <b>Договор №</b> {ks3.contractNo || "____"} <b>от</b>{" "}
                  {ks3.contractDate || "____________"}
                </div>
                <div>
                  <b>Отчётный период:</b> с {ks3.periodFrom || "________"} по{" "}
                  {ks3.periodTo || "________"}
                </div>
              </div>
              <table className="w-full mb-3" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cellHead}>Наименование показателя</th>
                    <th style={cellHead}>Стоимость, тг</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={cell}>Стоимость работ с начала строительства, всего</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(ks3.totalSinceStart)}</td>
                  </tr>
                  <tr>
                    <td style={cell}>В т.ч. за отчётный период</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(ks3.totalPeriod)}</td>
                  </tr>
                  <tr>
                    <td style={cell}>Стоимость с начала года</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(ks3.costSinceYear)}</td>
                  </tr>
                  <tr>
                    <td style={cell}>В т.ч. строительно-монтажные работы (СМР)</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(ks3.costSmr)}</td>
                  </tr>
                  <tr>
                    <td style={cell}>В т.ч. оборудование</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(ks3.costEquipment)}</td>
                  </tr>
                  <tr>
                    <td style={cell}>Сумма за период без НДС</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(ks3Calc.sumNoVat)}</td>
                  </tr>
                  <tr>
                    <td style={cell}>НДС 12%</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(ks3Calc.vat)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cell, fontWeight: "bold" }}>ИТОГО С НДС</td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: "bold" }}>
                      {fmt(ks3Calc.totalWithVat)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="grid grid-cols-2 gap-8 mt-12 text-[11px]">
                <div>
                  <div>Подрядчик:</div>
                  <div className="mt-8 border-t border-black pt-1">
                    ____________________ / __________________ /
                  </div>
                  <div className="mt-1 text-center">М.П.</div>
                </div>
                <div>
                  <div>Заказчик:</div>
                  <div className="mt-8 border-t border-black pt-1">
                    ____________________ / __________________ /
                  </div>
                  <div className="mt-1 text-center">М.П.</div>
                </div>
              </div>
            </div>
          )}

          {/* ───── F-3 PRINT ───── */}
          {tab === "f3" && (
            <div className="font-mono text-[12px] text-black">
              <div className="text-right text-[10px] mb-2">
                Форма № Ф-3
                <br />
                МДС 81-25.2004
              </div>
              <div className="text-center mb-4">
                <div className="text-base font-bold">СВОДНЫЙ СМЕТНЫЙ РАСЧЁТ</div>
                <div className="text-sm">СТОИМОСТИ СТРОИТЕЛЬСТВА</div>
              </div>
              <div className="space-y-1 mb-4">
                <div>
                  <b>Объект:</b> {f3.object || "_______________________"}
                </div>
                <div>
                  <b>Заказчик:</b> {f3.customer || "_______________________"}
                </div>
                <div>
                  <b>Стадия:</b>{" "}
                  {f3.stage === "П" ? "П — Проект" : "РД — Рабочая документация"}
                </div>
              </div>
              <table className="w-full mb-3" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...cellHead, width: "8%" }}>№ гл.</th>
                    <th style={cellHead}>Наименование глав и работ</th>
                    <th style={{ ...cellHead, width: "20%" }}>Стоимость, тг</th>
                  </tr>
                </thead>
                <tbody>
                  {F3_CHAPTERS.map((title, i) => (
                    <tr key={i}>
                      <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
                      <td style={cell}>{title}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmt(f3.chapters[i])}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ ...cell, fontWeight: "bold" }}>
                      Итого СМР (главы 1-7)
                    </td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: "bold" }}>
                      {fmt(f3Calc.smr1to7)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ ...cell, fontWeight: "bold" }}>
                      Итого СМР с временными (главы 1-8)
                    </td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: "bold" }}>
                      {fmt(f3Calc.smrWithTemp)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ ...cell, fontWeight: "bold" }}>
                      Всего по сводному (главы 1-12)
                    </td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: "bold" }}>
                      {fmt(f3Calc.totalSummary)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={cell}>
                      Резерв на непредвиденные работы и затраты ({f3.reservePct}%)
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(f3Calc.reserve)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ ...cell, fontWeight: "bold" }}>
                      Итого с резервом
                    </td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: "bold" }}>
                      {fmt(f3Calc.withReserve)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={cell}>
                      НДС 12%
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmt(f3Calc.vat)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ ...cell, fontWeight: "bold" }}>
                      СТОИМОСТЬ ОБЪЕКТА В ТЕКУЩИХ ЦЕНАХ
                    </td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: "bold" }}>
                      {fmt(f3Calc.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="grid grid-cols-2 gap-8 mt-12 text-[11px]">
                <div>
                  <div>Составил (ГИП):</div>
                  <div className="mt-8 border-t border-black pt-1">
                    ____________________ / __________________ /
                  </div>
                </div>
                <div>
                  <div>Согласовано (Заказчик):</div>
                  <div className="mt-8 border-t border-black pt-1">
                    ____________________ / __________________ /
                  </div>
                  <div className="mt-1 text-center">М.П.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────── small UI helpers ─────────

const inputCls =
  "w-full text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

const inputXs =
  "w-full text-xs px-1.5 py-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded focus:outline-none focus:border-blue-500";

const cell: React.CSSProperties = {
  border: "1px solid #000",
  padding: "4px 6px",
  fontSize: "11px",
  verticalAlign: "top",
};

const cellHead: React.CSSProperties = {
  border: "1px solid #000",
  padding: "4px 6px",
  fontSize: "11px",
  fontWeight: "bold",
  background: "#f0f0f0",
  textAlign: "left",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span
        className={`flex-1 ${
          bold
            ? "text-sm font-bold text-slate-900 dark:text-slate-100"
            : "text-slate-600 dark:text-slate-400"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono ${
          bold
            ? "text-base font-bold text-blue-700 dark:text-blue-300"
            : "text-slate-800 dark:text-slate-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
