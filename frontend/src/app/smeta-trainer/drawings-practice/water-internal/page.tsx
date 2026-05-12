"use client";

import { useState } from "react";
import Link from "next/link";

type Pipe = {
  type: string;
  use: string;
  price: string;
};

type Device = {
  name: string;
  price: string;
};

const PIPES: Pipe[] = [
  { type: "Металлопластик Ø16 (TECE)", use: "Подводки к смесителям", price: "380 тг/м" },
  { type: "Металлопластик Ø20", use: "Магистрали в квартире", price: "520 тг/м" },
  { type: "Полипропилен PPR Ø25 (армир.)", use: "Стояки общие", price: "650 тг/м" },
  { type: "Полипропилен PPR Ø32 (армир. ГВС)", use: "Стояки ГВС", price: "950 тг/м" },
  { type: "Сшитый полиэтилен PEX-A Ø16", use: "Универсальный", price: "420 тг/м" },
  { type: "Медь Ø15", use: "Премиум, долговечный", price: "4 800 тг/м" },
  { type: "Нержавеющая сталь Ø15", use: "Особый класс", price: "12 000 тг/м" },
  { type: "Стальной оцинк. Ø15 (старый стандарт)", use: "Реставрация", price: "1 850 тг/м" },
];

const DEVICES: Device[] = [
  { name: "Водомер для квартиры универс. ХВС", price: "18 500 тг" },
  { name: "Водомер ГВС с термокомпенсацией", price: "22 000 тг" },
  { name: "Магнитный умягчитель воды", price: "8 500 тг" },
  { name: "Фильтр механической очистки", price: "5 500 тг" },
  { name: "Гидроаккумулятор 50 л", price: "35 000 тг" },
  { name: "Запорная арматура (краны) — комплект квартирный", price: "18 000 тг" },
];

type Exercise = {
  id: string;
  title: string;
  prompt: string;
  hint: string;
  answer: number;
  tolerancePct: number;
  unit: string;
  solution: string[];
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Упр. 1 — Длина труб для квартиры 80 м² (1 санузел + кухня)",
    prompt: "Рассчитайте стоимость металлопластиковых труб Ø20 для разводки ХВС и ГВС в квартире 80 м² (1 санузел + кухня). Введите сумму в тенге.",
    hint: "Подсказка: магистрали по 12 м для ХВС и ГВС, плюс подводки по 2 м к 3 точкам с каждой стороны. Цена Ø20 = 520 тг/м.",
    answer: 18720,
    tolerancePct: 10,
    unit: "тг",
    solution: [
      "ХВС магистраль 12 м + подводки к 3 точкам по 2 м = 18 м",
      "ГВС магистраль 12 м + подводки = 18 м",
      "Итого: 36 м труб Ø20 металлопластик",
      "Стоимость: 36 · 520 = 18 720 тг",
      "Допуск ±10%",
    ],
  },
  {
    id: "ex2",
    title: "Упр. 2 — Стоимость узла учёта (комплект ХВС + ГВС)",
    prompt: "Рассчитайте стоимость комплекта узла учёта: водомер ХВС + водомер ГВС + запорная арматура + фильтр механической очистки. Введите сумму в тенге.",
    hint: "Подсказка: 18 500 + 22 000 + 18 000 + 5 500.",
    answer: 64000,
    tolerancePct: 5,
    unit: "тг",
    solution: [
      "Водомер ХВС + ГВС: 18 500 + 22 000 = 40 500 тг",
      "+ Запорная арматура: 18 000 тг",
      "+ Фильтр: 5 500 тг",
      "Итого: 64 000 тг",
      "Допуск ±5%",
    ],
  },
  {
    id: "ex3",
    title: "Упр. 3 — Длина стояков водопровода для 9-эт. жилого дома (1 секция)",
    prompt: "Сколько м.п. стояков водопровода (ХВС + ГВС + циркуляция ГВС) для 9-эт. дома, высота этажа 3 м, 1 секция? Введите м.п.",
    hint: "Подсказка: 9 этажей × 3 м = 27 м. Стояков всего три (ХВС, ГВС, циркуляция ГВС).",
    answer: 81,
    tolerancePct: 5,
    unit: "м.п.",
    solution: [
      "2 стояка (ХВС + ГВС) × 27 м (9 эт. × 3 м) = 54 м.п.",
      "+ Циркуляционный стояк ГВС: 27 м",
      "Итого: 81 м.п.",
      "Допуск ±5%",
    ],
  },
  {
    id: "ex4",
    title: "Упр. 4 — Стоимость сан. техники для типовой квартиры",
    prompt: "Рассчитайте итоговую стоимость сан. техники с установкой: унитаз + ванна стальная + раковина + 2 смесителя + подводка + запорная арматура. Установка +30%. Введите сумму в тенге.",
    hint: "Подсказка: материалы 196 000 тг, установка ≈ 30%, итого около 255 000 тг.",
    answer: 254800,
    tolerancePct: 15,
    unit: "тг",
    solution: [
      "Унитаз 65 000",
      "Ванна стальная: 45 000",
      "Раковина в ванной: 15 000",
      "2 смесителя (ванна + кухня): 35 000",
      "Подводка металлопластик: 18 000",
      "Запорная арматура: 18 000",
      "Итого материалы: 196 000 тг",
      "+ Установка ~30%: 58 800 тг",
      "ИТОГО: ~254 800 тг",
      "Допуск ±15%",
    ],
  },
];

function ExerciseCard({ ex }: { ex: Exercise }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const parsed = parseFloat(value.replace(/\s+/g, "").replace(",", "."));
  const isNum = !Number.isNaN(parsed);
  const diffPct = isNum ? Math.abs((parsed - ex.answer) / ex.answer) * 100 : Infinity;
  const ok = isNum && diffPct <= ex.tolerancePct;

  return (
    <div className="rounded-2xl border border-cyan-900/60 bg-slate-900/60 p-5 shadow-lg shadow-cyan-950/20">
      <h3 className="text-lg font-semibold text-cyan-200">{ex.title}</h3>
      <p className="mt-2 text-sm text-slate-300">{ex.prompt}</p>
      <p className="mt-1 text-xs text-cyan-400/80 italic">{ex.hint}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setChecked(false);
          }}
          placeholder={`Ответ в ${ex.unit}`}
          className="w-48 rounded-lg border border-cyan-800/60 bg-slate-950/70 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <span className="text-sm text-slate-400">{ex.unit}</span>
        <button
          onClick={() => setChecked(true)}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cyan-500 active:bg-cyan-700"
        >
          Проверить
        </button>
        <button
          onClick={() => setShowSolution((s) => !s)}
          className="rounded-lg border border-cyan-700/60 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-900/30"
        >
          {showSolution ? "Скрыть решение" : "Показать решение"}
        </button>
      </div>

      {checked && isNum && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            ok
              ? "border border-emerald-700/60 bg-emerald-900/30 text-emerald-200"
              : "border border-rose-700/60 bg-rose-900/30 text-rose-200"
          }`}
        >
          {ok
            ? `Верно. Эталон: ${ex.answer.toLocaleString("ru-RU")} ${ex.unit} (отклонение ${diffPct.toFixed(1)}% ≤ ${ex.tolerancePct}%).`
            : `Не попали в допуск ±${ex.tolerancePct}%. Эталон: ${ex.answer.toLocaleString("ru-RU")} ${ex.unit}. Ваше отклонение ${diffPct.toFixed(1)}%.`}
        </div>
      )}
      {checked && !isNum && (
        <div className="mt-3 rounded-lg border border-amber-700/60 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
          Введите числовое значение.
        </div>
      )}

      {showSolution && (
        <ol className="mt-3 list-decimal space-y-1 rounded-lg border border-cyan-900/50 bg-slate-950/60 p-4 pl-7 text-sm text-slate-300">
          {ex.solution.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function WaterInternalPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-cyan-300 hover:text-cyan-200 hover:underline"
          >
            ← К разделам
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-cyan-300 sm:text-4xl">
          💧 Внутренний водопровод — ХВС, ГВС, разводка
        </h1>

        {/* Intro */}
        <section className="mt-6 rounded-2xl border border-cyan-900/60 bg-slate-900/50 p-5">
          <p className="text-slate-200">
            <strong className="text-cyan-200">Внутренний водопровод</strong> — разводка ХВС и ГВС в
            здании от ввода до водоразборных точек. Не путать с{" "}
            <Link
              href="/smeta-trainer/drawings-practice/water"
              className="text-cyan-300 underline hover:text-cyan-200"
            >
              наружным водопроводом
            </Link>
            .
          </p>
          <p className="mt-2 text-slate-300">
            Стоимость для квартиры 70–100 м²:{" "}
            <span className="font-semibold text-cyan-200">280 000 – 580 000 тг</span>.
          </p>
        </section>

        {/* Norms */}
        <section className="mt-6 rounded-2xl border border-cyan-900/60 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold text-cyan-200">Нормативная база</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-slate-300">
            <li>ЭСН РК Сб.16 «Водопровод и канализация — внутренние»</li>
            <li>СНиП РК 4.01-02-2009 «Внутренний водопровод и канализация»</li>
            <li>ГОСТ 32415-2013 Трубы напорные ПЭ</li>
          </ul>
        </section>

        {/* Section 1: Pipes */}
        <section className="mt-6 rounded-2xl border border-cyan-900/60 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold text-cyan-200">1. Типы труб</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyan-900/60 text-left text-cyan-300">
                  <th className="px-3 py-2">Тип</th>
                  <th className="px-3 py-2">Применение</th>
                  <th className="px-3 py-2">Цена 2025</th>
                </tr>
              </thead>
              <tbody>
                {PIPES.map((p) => (
                  <tr key={p.type} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2 text-slate-100">{p.type}</td>
                    <td className="px-3 py-2 text-slate-300">{p.use}</td>
                    <td className="px-3 py-2 font-medium text-cyan-200">{p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Devices */}
        <section className="mt-6 rounded-2xl border border-cyan-900/60 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold text-cyan-200">2. Узлы учёта и сан. приборы</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyan-900/60 text-left text-cyan-300">
                  <th className="px-3 py-2">Прибор</th>
                  <th className="px-3 py-2">Цена 2025</th>
                </tr>
              </thead>
              <tbody>
                {DEVICES.map((d) => (
                  <tr key={d.name} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2 text-slate-100">{d.name}</td>
                    <td className="px-3 py-2 font-medium text-cyan-200">{d.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Exercises */}
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-cyan-200">3. Практика — 4 задачи</h2>
          <div className="mt-4 space-y-5">
            {EXERCISES.map((ex) => (
              <ExerciseCard key={ex.id} ex={ex} />
            ))}
          </div>
        </section>

        {/* ESN refs */}
        <section className="mt-6 rounded-2xl border border-cyan-900/60 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold text-cyan-200">Расценки ЭСН</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-slate-300">
            <li>Сб.16-1 — трубы</li>
            <li>Сб.16-2 — приборы</li>
            <li>Сб.16-5 — водомеры</li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="mt-6 rounded-2xl border-2 border-cyan-500/60 bg-cyan-950/40 p-5 shadow-lg shadow-cyan-900/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <p className="text-cyan-100">
              <strong className="text-cyan-300">Факт:</strong> Гидравлические испытания внутреннего
              водопровода — <span className="font-semibold">ОБЯЗАТЕЛЬНЫ</span> перед закрытием стен
              (двукратное рабочее давление, 30 мин). Без акта испытаний — стены не штукатурят.
            </p>
          </div>
        </section>

        <div className="mt-10 text-center text-xs text-slate-500">
          AEVION Smeta Trainer · Drawings Practice · Water Internal
        </div>
      </div>
    </div>
  );
}
