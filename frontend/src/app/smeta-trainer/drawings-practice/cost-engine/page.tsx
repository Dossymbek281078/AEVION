"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Калькулятор стоимости работ — финальный шаг учебного цикла.
 * Принимает объёмы из любого модуля → возвращает стоимость в тенге.
 *
 * Источники:
 *   ЭСН РК (базовые цены 2001 г.) — Сб.1, 6, 8, 12, 15, 26
 *   ССЦ РК 8.04-08-2025 — индексы перехода в текущие цены
 *   МДС 81-33.2004 — нормативы накладных расходов (НР)
 *   МДС 81-25.2004 п. 4.10 — нормативы сметной прибыли (СП)
 */

type WorkKey =
  | "earth-excavator"
  | "concrete-m300"
  | "brick-walling"
  | "gasconcrete"
  | "slab-mono"
  | "wateripr"
  | "minwool"
  | "roof-naplava"
  | "plaster"
  | "vd-paint"
  | "tile-floor"
  | "pe-pipe-160";

interface PriceItem {
  name: string;
  unit: string;
  base: number;       // тг за единицу в ценах 2001 г. (учебные)
  kr?: boolean;       // применим ли Кр (только для земли по умолчанию)
  collection: string; // ссылка на сборник ЭСН
  norm: string;       // норма расхода материала (учебная)
  fotShare: number;   // доля ФОТ от прямых затрат (учебно, 0..1)
}

const PRICES_2001: Record<WorkKey, PriceItem> = {
  "earth-excavator": {
    name: "Разработка грунта в котловане экскаватором",
    unit: "м³",
    base: 154.30,
    kr: true,
    collection: "ЭСН РК Сб.1 §1-1-23",
    norm: "ДТ 0.45 кг/м³ (для механизмов)",
    fotShare: 0.18,
  },
  "concrete-m300": {
    name: "Бетонирование монолита М300",
    unit: "м³",
    base: 1280.50,
    collection: "ЭСН РК Сб.6 §6-1-1",
    norm: "Бетон М300 — 1.015 м³/м³",
    fotShare: 0.32,
  },
  "brick-walling": {
    name: "Кладка кирпича рядового",
    unit: "м³",
    base: 1845.20,
    collection: "ЭСН РК Сб.8 §8-1-1",
    norm: "Кирпич — 400 шт/м³, раствор — 0.23 м³/м³",
    fotShare: 0.45,
  },
  "gasconcrete": {
    name: "Кладка газобетон D500",
    unit: "м³",
    base: 1654.80,
    collection: "ЭСН РК Сб.8 §8-2-3",
    norm: "Блок D500 — 0.99 м³/м³, клей — 25 кг/м³",
    fotShare: 0.40,
  },
  "slab-mono": {
    name: "Перекрытие монолитное ж/б",
    unit: "м³",
    base: 1420.30,
    collection: "ЭСН РК Сб.6 §6-2-1",
    norm: "Бетон М300 — 1.015 м³/м³, арматура — 95 кг/м³",
    fotShare: 0.35,
  },
  "wateripr": {
    name: "Гидроизоляция оклеечная",
    unit: "м²",
    base: 245.60,
    collection: "ЭСН РК Сб.12 §12-3-1",
    norm: "Рубероид — 1.15 м²/м², мастика — 1.8 кг/м²",
    fotShare: 0.38,
  },
  "minwool": {
    name: "Утепление минвата 100 мм",
    unit: "м²",
    base: 184.20,
    collection: "ЭСН РК Сб.12 §12-4-2",
    norm: "Минвата 100 мм — 0.105 м³/м², дюбели — 6 шт/м²",
    fotShare: 0.30,
  },
  "roof-naplava": {
    name: "Кровля наплавляемая 2 слоя",
    unit: "м²",
    base: 358.40,
    collection: "ЭСН РК Сб.12 §12-1-3",
    norm: "Наплав. материал — 2.3 м²/м², газ — 0.18 кг/м²",
    fotShare: 0.42,
  },
  "plaster": {
    name: "Штукатурка стен (цем.-известк. 20 мм)",
    unit: "100 м²",
    base: 9540.00,
    collection: "ЭСН РК Сб.15 §15-2-1",
    norm: "Раствор — 2.05 м³/100 м², сетка — 105 м²/100 м²",
    fotShare: 0.55,
  },
  "vd-paint": {
    name: "Окраска ВД 2 слоя",
    unit: "100 м²",
    base: 5230.00,
    collection: "ЭСН РК Сб.15 §15-4-2",
    norm: "Краска ВД — 32 кг/100 м², грунт — 12 кг/100 м²",
    fotShare: 0.48,
  },
  "tile-floor": {
    name: "Плитка керамическая пол 300×300",
    unit: "100 м²",
    base: 12640.00,
    collection: "ЭСН РК Сб.15 §15-5-1",
    norm: "Плитка — 102 м²/100 м², клей — 580 кг/100 м²",
    fotShare: 0.52,
  },
  "pe-pipe-160": {
    name: "Прокладка трубы ПЭ Ø160 (водопровод)",
    unit: "м.п.",
    base: 312.50,
    collection: "ЭСН РК Сб.26 §26-1-12",
    norm: "Труба ПЭ100 SDR17 Ø160 — 1.005 м/м.п.",
    fotShare: 0.28,
  },
};

const KR_OPTIONS = [1.10, 1.15, 1.20, 1.25, 1.30];
const KZ_OPTIONS = [1.05, 1.15, 1.30, 1.45];

const NR_OPTIONS = [
  { v: 80,  label: "80% — простые работы (земля, монолит без сложных узлов)" },
  { v: 85,  label: "85% — стандартные общестроительные" },
  { v: 95,  label: "95% — типовое здание (среднее)" },
  { v: 105, label: "105% — особо сложное (высотка, инд. проект)" },
  { v: 120, label: "120% — реконструкция действ. объекта" },
];

const SP_OPTIONS = [
  { v: 50, label: "50% — бюджетные объекты (мин.)" },
  { v: 65, label: "65% — типовая сметная прибыль" },
  { v: 75, label: "75% — коммерческие объекты" },
  { v: 85, label: "85% — сложные технологии, риски" },
];

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (n: number) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

// ── UI ───────────────────────────────────────────────────────────────────────

export default function CostEnginePage() {
  const [workKey, setWorkKey] = useState<WorkKey>("earth-excavator");
  const [volume, setVolume] = useState<number>(1380);

  const [useKr, setUseKr] = useState<boolean>(true);
  const [krValue, setKrValue] = useState<number>(1.20);

  const [useKz, setUseKz] = useState<boolean>(false);
  const [kzValue, setKzValue] = useState<number>(1.15);

  const [useActiveObject, setUseActiveObject] = useState<boolean>(false);
  const [useDemolition, setUseDemolition] = useState<boolean>(false);

  const [nr, setNr] = useState<number>(95);
  const [sp, setSp] = useState<number>(65);
  const [indexValue, setIndexValue] = useState<number>(11.42);

  const [copied, setCopied] = useState<boolean>(false);

  const item = PRICES_2001[workKey];

  const calc = useMemo(() => {
    const baseUnit = item.base;
    const baseTotal = baseUnit * volume;

    const kKr = useKr && item.kr ? krValue : 1;
    const kKz = useKz ? kzValue : 1;
    const kAct = useActiveObject ? 1.15 : 1;
    const kDem = useDemolition ? 0.5 : 1;

    const afterKr = baseTotal * kKr;
    const afterKz = afterKr * kKz;
    const afterAct = afterKz * kAct;
    const afterDem = afterAct * kDem;

    const directBefore = afterDem;                     // ЭСН × коэф. (в ценах 2001)
    const directAfter = directBefore * indexValue;     // в текущих ценах

    // Учебная упрощёнка: НР и СП считаем от ФОТ × 0.5 (а не от полного ФОТ),
    // чтобы наглядно показать структуру, не уходя в реальный расчёт по МДС
    const fotEstimated = directAfter * item.fotShare;
    const nrTotal = fotEstimated * (nr / 100) * 0.5;
    const spTotal = fotEstimated * (sp / 100) * 0.5;

    const grandTotal = directAfter + nrTotal + spTotal;
    const perUnit = volume > 0 ? grandTotal / volume : 0;

    return {
      baseUnit,
      baseTotal,
      kKr, kKz, kAct, kDem,
      afterKr, afterKz, afterAct, afterDem,
      directBefore,
      directAfter,
      fotEstimated,
      nrTotal,
      spTotal,
      grandTotal,
      perUnit,
    };
  }, [item, volume, useKr, krValue, useKz, kzValue, useActiveObject, useDemolition, nr, sp, indexValue]);

  const handleReset = () => {
    setWorkKey("earth-excavator");
    setVolume(1380);
    setUseKr(true);
    setKrValue(1.20);
    setUseKz(false);
    setKzValue(1.15);
    setUseActiveObject(false);
    setUseDemolition(false);
    setNr(95);
    setSp(65);
    setIndexValue(11.42);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Итого: ${fmt(calc.grandTotal)} тг (за ${volume} ${item.unit}, ${item.name})`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-emerald-200 dark:border-emerald-800/60 bg-white/85 dark:bg-slate-900/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Калькулятор · ЭСН × Кр × Кз × индекс + НР + СП
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-emerald-800 dark:text-emerald-300">
            💰 Калькулятор стоимости работ — ЭСН × Кр × Кз × индекс + НР + СП
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Финальный шаг учебного цикла: объём → стоимость в тенге.
          </p>
        </div>

        {/* Описание */}
        <section className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700 p-5">
          <p className="text-sm md:text-base text-emerald-900 dark:text-emerald-200 leading-relaxed">
            Эта утилита превращает технический объём работ (м³, м², т, шт)
            в финальную стоимость в тенге по формуле учебного курса РК.
          </p>
          <p className="text-sm text-emerald-900 dark:text-emerald-200 mt-2 leading-relaxed">
            Используй после подсчёта объёмов в любом модуле:
            например, посчитал котлован <b>1380 м³</b> — введи цифры здесь и
            получи стоимость с НР, СП и индексом перехода.
          </p>
          <div className="mt-3 grid md:grid-cols-2 gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white/70 dark:bg-emerald-950/40 px-3 py-2">
              <b>Источники цен:</b> ЭСН РК (базовые цены 2001 г.)
            </div>
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white/70 dark:bg-emerald-950/40 px-3 py-2">
              <b>Индексы перехода:</b> ССЦ РК 8.04-08-2025 → текущие цены
            </div>
          </div>
        </section>

        {/* Form + Results */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* ── Левая колонка: ФОРМА ────────────────────────────────────── */}
          <section className="rounded-xl border-2 border-emerald-500 dark:border-emerald-700 bg-white dark:bg-slate-900 p-5 space-y-5">
            {/* ШАГ 1 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold">1</span>
                <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">Выбери вид работы</h2>
              </div>
              <select
                value={workKey}
                onChange={(e) => setWorkKey(e.target.value as WorkKey)}
                className="w-full rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-slate-800 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 outline-none"
              >
                {(Object.keys(PRICES_2001) as WorkKey[]).map((k) => (
                  <option key={k} value={k}>
                    {PRICES_2001[k].name} ({PRICES_2001[k].unit})
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                <b>Расценка:</b> {item.collection} · <b>Базовая цена 2001:</b> {fmt(item.base)} тг / {item.unit}
              </div>
            </div>

            {/* ШАГ 2 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold">2</span>
                <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">Введи объём работ</h2>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
                  className="w-48 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 py-2 text-base font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 outline-none"
                />
                <span className="text-base font-semibold text-emerald-700 dark:text-emerald-400">{item.unit}</span>
              </div>
            </div>

            {/* ШАГ 3 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold">3</span>
                <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">Параметры расчёта</h2>
              </div>

              <div className="space-y-3 text-sm">
                {/* Кр */}
                <label className={`flex items-start gap-3 rounded-lg border ${useKr && item.kr ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700" : "border-slate-200 dark:border-slate-700"} px-3 py-2 ${!item.kr ? "opacity-50" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={useKr && !!item.kr}
                    disabled={!item.kr}
                    onChange={(e) => setUseKr(e.target.checked)}
                    className="mt-1 accent-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Применить Кр (разрыхление, для земли)</div>
                    {!item.kr && <div className="text-xs text-slate-500">Не применимо для этого вида работ</div>}
                    {useKr && item.kr && (
                      <select
                        value={krValue}
                        onChange={(e) => setKrValue(parseFloat(e.target.value))}
                        className="mt-1 rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      >
                        {KR_OPTIONS.map((v) => (
                          <option key={v} value={v}>Кр = {v.toFixed(2)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>

                {/* Кз */}
                <label className={`flex items-start gap-3 rounded-lg border ${useKz ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700" : "border-slate-200 dark:border-slate-700"} px-3 py-2 cursor-pointer`}>
                  <input
                    type="checkbox"
                    checked={useKz}
                    onChange={(e) => setUseKz(e.target.checked)}
                    className="mt-1 accent-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Применить Кз (зимние работы)</div>
                    {useKz && (
                      <select
                        value={kzValue}
                        onChange={(e) => setKzValue(parseFloat(e.target.value))}
                        className="mt-1 rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      >
                        {KZ_OPTIONS.map((v) => (
                          <option key={v} value={v}>Кз = {v.toFixed(2)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>

                {/* К действ. */}
                <label className={`flex items-start gap-3 rounded-lg border ${useActiveObject ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700" : "border-slate-200 dark:border-slate-700"} px-3 py-2 cursor-pointer`}>
                  <input
                    type="checkbox"
                    checked={useActiveObject}
                    onChange={(e) => setUseActiveObject(e.target.checked)}
                    className="mt-1 accent-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">К на действ. объекте (1.15)</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Реконструкция, работы при действующем производстве</div>
                  </div>
                </label>

                {/* К демонтаж */}
                <label className={`flex items-start gap-3 rounded-lg border ${useDemolition ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700" : "border-slate-200 dark:border-slate-700"} px-3 py-2 cursor-pointer`}>
                  <input
                    type="checkbox"
                    checked={useDemolition}
                    onChange={(e) => setUseDemolition(e.target.checked)}
                    className="mt-1 accent-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium">К на демонтаж (0.5 + Сб.46)</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Расценка × 0.5; материал не учитывается</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Норма расхода материала */}
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
              <div className="font-semibold text-amber-800 dark:text-amber-300">Норма расхода материала:</div>
              <div className="text-amber-900 dark:text-amber-200 mt-1">{item.norm}</div>
            </div>

            {/* НР */}
            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                Тариф НР (накладные расходы):
              </label>
              <select
                value={nr}
                onChange={(e) => setNr(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {NR_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>{o.v}% — {o.label.split(" — ")[1]}</option>
                ))}
              </select>
            </div>

            {/* СП */}
            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                Тариф СП (сметная прибыль):
              </label>
              <select
                value={sp}
                onChange={(e) => setSp(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {SP_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>{o.v}% — {o.label.split(" — ")[1]}</option>
                ))}
              </select>
            </div>

            {/* Индекс */}
            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                Индекс перехода (2001 → текущий):
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={indexValue}
                onChange={(e) => setIndexValue(parseFloat(e.target.value) || 0)}
                className="w-48 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 py-2 text-base font-mono"
              />
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ССЦ РК 8.04-08-2025: для III кв. 2025 г. для г. Алматы среднее <b>11.42</b>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleReset}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Сбросить
              </button>
              <button
                onClick={handleCopy}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition"
              >
                {copied ? "✓ Скопировано" : "Скопировать итог"}
              </button>
            </div>
          </section>

          {/* ── Правая колонка: РЕЗУЛЬТАТЫ ──────────────────────────────── */}
          <section className="rounded-xl border-2 border-yellow-500 dark:border-yellow-600 bg-gradient-to-br from-yellow-50 to-emerald-50 dark:from-yellow-950/30 dark:to-emerald-950/30 p-5 space-y-3 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-center gap-2 border-b-2 border-yellow-400 dark:border-yellow-700 pb-2">
              <span className="text-2xl">🧮</span>
              <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">РАСЧЁТ СТОИМОСТИ</h2>
            </div>

            <div className="text-sm space-y-2 font-mono">
              {/* Базовая цена */}
              <div className="flex justify-between">
                <span className="text-slate-700 dark:text-slate-300">Базовая ЭСН (2001) за {item.unit}:</span>
                <span className="font-semibold">{fmt(calc.baseUnit)} тг</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700 dark:text-slate-300">× объём {fmtInt(volume)} {item.unit}</span>
                <span className="font-semibold">=</span>
              </div>
              <div className="flex justify-between bg-white/60 dark:bg-slate-800/40 rounded px-2 py-1">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">Базовая стоимость работ:</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-200">{fmt(calc.baseTotal)} тг</span>
              </div>

              {/* Коэффициенты */}
              {calc.kKr !== 1 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-300">
                  <span>× Кр (разрыхление) = {calc.kKr.toFixed(2)}:</span>
                  <span>{fmt(calc.afterKr)} тг</span>
                </div>
              )}
              {calc.kKz !== 1 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-300">
                  <span>× Кз (зимние) = {calc.kKz.toFixed(2)}:</span>
                  <span>{fmt(calc.afterKz)} тг</span>
                </div>
              )}
              {calc.kAct !== 1 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-300">
                  <span>× К действ. = {calc.kAct.toFixed(2)}:</span>
                  <span>{fmt(calc.afterAct)} тг</span>
                </div>
              )}
              {calc.kDem !== 1 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-300">
                  <span>× К демонтаж = {calc.kDem.toFixed(2)}:</span>
                  <span>{fmt(calc.afterDem)} тг</span>
                </div>
              )}

              <div className="border-t border-dashed border-emerald-400 dark:border-emerald-700 pt-2 flex justify-between bg-white/60 dark:bg-slate-800/40 rounded px-2 py-1">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">Прямые ЭСН × коэф. (2001):</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-200">{fmt(calc.directBefore)} тг</span>
              </div>

              {/* Индекс */}
              <div className="flex justify-between text-blue-800 dark:text-blue-300">
                <span>× Индекс {indexValue.toFixed(2)} (переход в текущие):</span>
                <span>=</span>
              </div>
              <div className="flex justify-between bg-white/80 dark:bg-slate-800/60 rounded px-2 py-1.5 border border-blue-300 dark:border-blue-700">
                <span className="text-blue-900 dark:text-blue-200 font-semibold">Прямые в текущих ценах:</span>
                <span className="font-bold text-blue-900 dark:text-blue-200">{fmt(calc.directAfter)} тг</span>
              </div>

              {/* НР + СП */}
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                ФОТ оценочно ({Math.round(item.fotShare * 100)}% от прямых) = {fmt(calc.fotEstimated)} тг
              </div>
              <div className="flex justify-between text-purple-800 dark:text-purple-300">
                <span>+ НР {nr}% от ФОТ × 0.5:</span>
                <span>{fmt(calc.nrTotal)} тг</span>
              </div>
              <div className="flex justify-between text-purple-800 dark:text-purple-300">
                <span>+ СП {sp}% от ФОТ × 0.5:</span>
                <span>{fmt(calc.spTotal)} тг</span>
              </div>

              {/* ИТОГО */}
              <div className="border-t-2 border-double border-yellow-500 dark:border-yellow-600 pt-2 mt-2">
                <div className="flex justify-between items-baseline bg-yellow-100 dark:bg-yellow-900/40 rounded-lg px-3 py-3 border-2 border-yellow-500 dark:border-yellow-600">
                  <span className="text-base font-bold text-emerald-900 dark:text-emerald-200">ИТОГО:</span>
                  <span className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200">
                    {fmt(calc.grandTotal)} тг
                  </span>
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>В среднем на единицу:</span>
                  <span className="font-semibold">{fmt(calc.perUnit)} тг / {item.unit}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Фактоид — упрощения */}
        <section className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <h3 className="font-bold text-emerald-900 dark:text-emerald-200 mb-2">
                ЭТО УПРОЩЁННЫЙ КАЛЬКУЛЯТОР для учебных целей
              </h3>
              <p className="text-sm text-emerald-900 dark:text-emerald-200 mb-2">
                Реальная смета по форме ОС-1 содержит ещё:
              </p>
              <ul className="text-sm text-emerald-900 dark:text-emerald-200 space-y-1 list-disc list-inside">
                <li>Зимний коэффициент НР+СП (дополнительно к Кз)</li>
                <li>Транспортные расходы (отдельной строкой по сборнику ССЦ)</li>
                <li>Затраты на ОТ (охрана труда) — 0.4–1% от ФОТ</li>
                <li>Стоимость материалов (отдельно из ССЦ, не из ЭСН)</li>
                <li>НДС 12% (после всех расчётов)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Нормативный блок */}
        <section className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3">
            📚 Нормативная база калькулятора
          </h3>
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">Базовые цены</div>
              <div className="text-slate-700 dark:text-slate-300 mt-1">
                ЭСН РК (Сборники 1, 6, 8, 12, 15, 26 — в зависимости от вида работ)
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">Индексы перехода</div>
              <div className="text-slate-700 dark:text-slate-300 mt-1">
                ССЦ РК 8.04-08-2025 — квартальные индексы перевода базы 2001 г. в текущие цены
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">Накладные расходы (НР)</div>
              <div className="text-slate-700 dark:text-slate-300 mt-1">
                МДС 81-33.2004, тарифы по группам работ (земля, бетон, кладка, отделка)
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">Сметная прибыль (СП)</div>
              <div className="text-slate-700 dark:text-slate-300 mt-1">
                МДС 81-25.2004 п. 4.10 — методические указания по определению СП
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-amber-700 dark:text-amber-400 italic">
            Учебные коэффициенты упрощены для понимания структуры. Полный расчёт — по форме ОС-1 с учётом всех индексов и поправочных коэффициентов СНБ РК.
          </div>
        </section>
      </main>
    </div>
  );
}
