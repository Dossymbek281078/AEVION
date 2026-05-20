"use client";

/**
 * Калькулятор объёмов — интерактивная утилита для рутинных расчётов сметчика.
 * Каждый расчёт: ввод параметров → формула → результат + кнопка «скопировать».
 *
 * Все формулы соответствуют тем, что разобраны в /exam/[id]/lesson.
 */

import Link from "next/link";
import { useState } from "react";

type CalcKey =
  | "wall-net"
  | "flat-roof"
  | "sloped-roof"
  | "floor"
  | "excavation"
  | "slab"
  | "strip"
  | "formwork"
  | "cable-routing"
  | "pile-grid"
  | "rebar-mass"
  | "perimeter";

const TABS: Array<{ key: CalcKey; label: string; group: string; icon: string }> = [
  { key: "wall-net", group: "Площади", label: "Стены нетто (минус проёмы)", icon: "🧱" },
  { key: "flat-roof", group: "Площади", label: "Плоская кровля", icon: "🏠" },
  { key: "sloped-roof", group: "Площади", label: "Скатная кровля cos(α)", icon: "🏘" },
  { key: "floor", group: "Площади", label: "Пол по габариту", icon: "🟫" },
  { key: "excavation", group: "Объёмы", label: "Котлован", icon: "⛏" },
  { key: "slab", group: "Объёмы", label: "Бетон плиты", icon: "🧱" },
  { key: "strip", group: "Объёмы", label: "Бетон ленты фундамента", icon: "🏗" },
  { key: "formwork", group: "Объёмы", label: "Опалубка плиты", icon: "📐" },
  { key: "cable-routing", group: "Длины", label: "Кабель × коэф штроб", icon: "⚡" },
  { key: "perimeter", group: "Длины", label: "Периметр", icon: "📏" },
  { key: "pile-grid", group: "Счёт", label: "Свайное поле", icon: "🏗" },
  { key: "rebar-mass", group: "Счёт", label: "Масса арматуры", icon: "⚙️" },
];

function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

export default function CalcPage() {
  const [tab, setTab] = useState<CalcKey>("wall-net");
  const groups = Array.from(new Set(TABS.map((t) => t.group)));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
            ← Главная
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">🧮 Калькулятор объёмов</h1>
          <p className="text-sm text-slate-600 mt-1">
            Типовые расчёты с готовыми формулами. Результат можно сразу скопировать в смету.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          {/* Меню */}
          <nav className="bg-white border border-slate-200 rounded-lg p-2 h-fit sticky top-4">
            {groups.map((g) => (
              <div key={g} className="mb-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 py-1">
                  {g}
                </div>
                {TABS.filter((t) => t.group === g).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded mb-0.5 flex items-center gap-2 ${
                      tab === t.key
                        ? "bg-emerald-100 text-emerald-800 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Активный калькулятор */}
          <div>
            {tab === "wall-net" && <WallNetCalc />}
            {tab === "flat-roof" && <FlatRoofCalc />}
            {tab === "sloped-roof" && <SlopedRoofCalc />}
            {tab === "floor" && <FloorCalc />}
            {tab === "excavation" && <ExcavationCalc />}
            {tab === "slab" && <SlabCalc />}
            {tab === "strip" && <StripCalc />}
            {tab === "formwork" && <FormworkCalc />}
            {tab === "cable-routing" && <CableCalc />}
            {tab === "pile-grid" && <PileGridCalc />}
            {tab === "rebar-mass" && <RebarMassCalc />}
            {tab === "perimeter" && <PerimeterCalc />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── общие компоненты ───────────────────────────

function CalcCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 italic mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, unit, step = "0.01" }: { label: string; value: number; onChange: (n: number) => void; unit: string; step?: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-600 flex-1">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 border border-slate-300 rounded px-2 py-1 text-right font-mono text-xs"
      />
      <span className="text-xs text-slate-500 w-12">{unit}</span>
    </div>
  );
}

function Result({ label, value, unit, hint }: { label: string; value: number | string; unit: string; hint?: string }) {
  const display = typeof value === "number" ? value.toFixed(2) : value;
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded p-3 mt-3 flex items-center gap-3">
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-emerald-700">{label}</div>
        <div className="text-2xl font-bold font-mono text-emerald-800">
          {display} <span className="text-sm text-emerald-600 font-normal">{unit}</span>
        </div>
        {hint && <div className="text-[10px] text-emerald-600 italic mt-1">{hint}</div>}
      </div>
      <button
        onClick={() => copyText(String(display))}
        className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
        title="Скопировать значение"
      >
        📋 Копировать
      </button>
    </div>
  );
}

function FormulaHint({ formula }: { formula: string }) {
  return (
    <div className="mt-3 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 font-mono">
      ƒ: {formula}
    </div>
  );
}

// ─────────────────────────── расчёты ───────────────────────────

function WallNetCalc() {
  const [a, setA] = useState(6);
  const [b, setB] = useState(5);
  const [h, setH] = useState(3.0);
  const [winW, setWinW] = useState(1.4);
  const [winH, setWinH] = useState(1.6);
  const [winN, setWinN] = useState(2);
  const [doorW, setDoorW] = useState(0.9);
  const [doorH, setDoorH] = useState(2.1);
  const [doorN, setDoorN] = useState(1);

  const brutto = 2 * (a + b) * h;
  const openings = winW * winH * winN + doorW * doorH * doorN;
  const netto = Math.max(0, brutto - openings);

  return (
    <CalcCard
      title="Стены нетто (брутто минус проёмы)"
      subtitle="Для штукатурки, окраски, обоев — площадь стен за вычетом окон и дверей."
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Помещение</div>
          <Field label="Длина a" value={a} onChange={setA} unit="м" />
          <Field label="Ширина b" value={b} onChange={setB} unit="м" />
          <Field label="Высота h" value={h} onChange={setH} unit="м" />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Проёмы</div>
          <Field label="Окно: ширина" value={winW} onChange={setWinW} unit="м" />
          <Field label="Окно: высота" value={winH} onChange={setWinH} unit="м" />
          <Field label="Окон, штук" value={winN} onChange={setWinN} unit="шт" step="1" />
          <Field label="Дверь: ширина" value={doorW} onChange={setDoorW} unit="м" />
          <Field label="Дверь: высота" value={doorH} onChange={setDoorH} unit="м" />
          <Field label="Дверей, штук" value={doorN} onChange={setDoorN} unit="шт" step="1" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Брутто:</span> <span className="font-mono font-bold">{brutto.toFixed(2)} м²</span></div>
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Проёмы:</span> <span className="font-mono font-bold">{openings.toFixed(2)} м²</span></div>
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Нетто:</span> <span className="font-mono font-bold">{netto.toFixed(2)} м²</span></div>
      </div>
      <Result label="Объём для позиции «100 м²»" value={netto / 100} unit="(100 м²)" hint={`Это значение для поля volume в позиции ЛСР`} />
      <FormulaHint formula="S = 2 × (a + b) × h − Σ(w × h × n)" />
    </CalcCard>
  );
}

function FlatRoofCalc() {
  const [a, setA] = useState(15);
  const [b, setB] = useState(25);
  const area = a * b;
  return (
    <CalcCard title="Плоская кровля" subtitle="Для пирога: пароизоляция → утеплитель → ковёр (все слои одной площади).">
      <div className="space-y-2">
        <Field label="Длина a" value={a} onChange={setA} unit="м" />
        <Field label="Ширина b" value={b} onChange={setB} unit="м" />
      </div>
      <Result label="Площадь" value={area} unit="м²" />
      <Result label="Объём для каждого слоя (ед. «100 м²»)" value={area / 100} unit="(100 м²)" hint="Введите одинаковое значение в все три позиции пирога" />
      <FormulaHint formula="S = a × b" />
    </CalcCard>
  );
}

function SlopedRoofCalc() {
  const [planA, setPlanA] = useState(8);
  const [planB, setPlanB] = useState(12);
  const [angle, setAngle] = useState(30);
  const planArea = planA * planB;
  const cosA = Math.cos((angle * Math.PI) / 180);
  const slopedArea = planArea / cosA;
  const extra = ((slopedArea - planArea) / planArea) * 100;
  return (
    <CalcCard title="Скатная кровля по cos(α)" subtitle="Фактическая площадь больше площади в плане на 1/cos(α).">
      <div className="space-y-2">
        <Field label="План: длина" value={planA} onChange={setPlanA} unit="м" />
        <Field label="План: ширина" value={planB} onChange={setPlanB} unit="м" />
        <Field label="Угол ската α" value={angle} onChange={setAngle} unit="°" step="1" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">В плане:</span> <span className="font-mono font-bold">{planArea.toFixed(1)} м²</span></div>
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">cos(α):</span> <span className="font-mono font-bold">{cosA.toFixed(3)}</span></div>
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">+%:</span> <span className="font-mono font-bold">{extra.toFixed(1)}%</span></div>
      </div>
      <Result label="Площадь по скату" value={slopedArea} unit="м²" hint={`Для металлочерепицы — vol = ${slopedArea.toFixed(1)} м²; для пирога (ед. 100 м²) — vol = ${(slopedArea / 100).toFixed(3)}`} />
      <FormulaHint formula="S = (a × b) / cos(α)" />
    </CalcCard>
  );
}

function FloorCalc() {
  const [a, setA] = useState(4);
  const [b, setB] = useState(5);
  const area = a * b;
  return (
    <CalcCard title="Площадь пола" subtitle="Для стяжки, плитки, ламината, линолеума (учитываем габарит помещения).">
      <div className="space-y-2">
        <Field label="Длина a" value={a} onChange={setA} unit="м" />
        <Field label="Ширина b" value={b} onChange={setB} unit="м" />
      </div>
      <Result label="Площадь" value={area} unit="м²" />
      <Result label="Объём для позиции «100 м²»" value={area / 100} unit="(100 м²)" />
      <FormulaHint formula="S = a × b" />
    </CalcCard>
  );
}

function ExcavationCalc() {
  const [a, setA] = useState(10);
  const [b, setB] = useState(8);
  const [depth, setDepth] = useState(1.5);
  const volume = a * b * depth;
  return (
    <CalcCard title="Объём котлована" subtitle="Прямоугольный котлован для фундамента (упрощённо без откосов).">
      <div className="space-y-2">
        <Field label="Длина" value={a} onChange={setA} unit="м" />
        <Field label="Ширина" value={b} onChange={setB} unit="м" />
        <Field label="Глубина" value={depth} onChange={setDepth} unit="м" />
      </div>
      <Result label="Объём" value={volume} unit="м³" />
      <Result label="Объём для позиции «100 м³»" value={volume / 100} unit="(100 м³)" hint="Используется в расценках разработки грунта (ЗЕМ-01-01-XXX)" />
      <FormulaHint formula="V = a × b × h" />
    </CalcCard>
  );
}

function SlabCalc() {
  const [a, setA] = useState(10);
  const [b, setB] = useState(8);
  const [thick, setThick] = useState(0.4);
  const volume = a * b * thick;
  return (
    <CalcCard title="Бетон фундаментной плиты" subtitle="Монолитная плита прямоугольной формы.">
      <div className="space-y-2">
        <Field label="Длина" value={a} onChange={setA} unit="м" />
        <Field label="Ширина" value={b} onChange={setB} unit="м" />
        <Field label="Толщина" value={thick} onChange={setThick} unit="м" />
      </div>
      <Result label="Объём бетона" value={volume} unit="м³" hint="ФУН-05-01-001 (м³). При толщине 400 мм используйте именно эту расценку." />
      <FormulaHint formula="V = a × b × t" />
    </CalcCard>
  );
}

function StripCalc() {
  const [a, setA] = useState(10);
  const [b, setB] = useState(8);
  const [width, setWidth] = useState(0.4);
  const [height, setHeight] = useState(1.5);
  const perimeter = 2 * (a + b);
  const volume = perimeter * width * height;
  return (
    <CalcCard title="Бетон ленточного фундамента" subtitle="Лента по периметру здания.">
      <div className="space-y-2">
        <Field label="Длина дома" value={a} onChange={setA} unit="м" />
        <Field label="Ширина дома" value={b} onChange={setB} unit="м" />
        <Field label="Ширина ленты" value={width} onChange={setWidth} unit="м" />
        <Field label="Высота ленты" value={height} onChange={setHeight} unit="м" />
      </div>
      <div className="bg-slate-50 rounded p-2 mt-3 text-xs">
        <span className="text-slate-500">Периметр:</span> <span className="font-mono font-bold">{perimeter.toFixed(2)} м</span>
      </div>
      <Result label="Объём бетона ленты" value={volume} unit="м³" />
      <FormulaHint formula="V = 2(a+b) × w × h" />
    </CalcCard>
  );
}

function FormworkCalc() {
  const [a, setA] = useState(10);
  const [b, setB] = useState(8);
  const [thick, setThick] = useState(0.4);
  const perimeter = 2 * (a + b);
  const area = perimeter * thick;
  return (
    <CalcCard title="Опалубка плиты по периметру" subtitle="Деревянная/инвентарная опалубка по контуру плиты.">
      <div className="space-y-2">
        <Field label="Длина плиты" value={a} onChange={setA} unit="м" />
        <Field label="Ширина плиты" value={b} onChange={setB} unit="м" />
        <Field label="Толщина плиты" value={thick} onChange={setThick} unit="м" />
      </div>
      <Result label="Площадь опалубки" value={area} unit="м²" hint="ФУН-05-02-001 (м²)" />
      <FormulaHint formula="S = 2(a+b) × t" />
    </CalcCard>
  );
}

function CableCalc() {
  const [planLen, setPlanLen] = useState(20);
  const [coef, setCoef] = useState(2.2);
  const total = planLen * coef;
  return (
    <CalcCard title="Длина кабеля с учётом штроб" subtitle="Реальная длина кабеля больше прямой по плану в 2–2.5 раза за счёт штроб, петель, обходов.">
      <div className="space-y-2">
        <Field label="Прямая по плану" value={planLen} onChange={setPlanLen} unit="м" />
        <Field label="Коэф штроб" value={coef} onChange={setCoef} unit="" step="0.1" />
      </div>
      <Result label="Длина кабеля" value={total} unit="м" hint="ЭЛ-21-04-007 (100 м). Vol = total/100" />
      <FormulaHint formula="L = L_прямая × k_штроб" />
    </CalcCard>
  );
}

function PerimeterCalc() {
  const [a, setA] = useState(10);
  const [b, setB] = useState(8);
  const p = 2 * (a + b);
  return (
    <CalcCard title="Периметр прямоугольного объекта" subtitle="Для ограждений, бордюров, отмостки, водоотводных лотков.">
      <div className="space-y-2">
        <Field label="Длина a" value={a} onChange={setA} unit="м" />
        <Field label="Ширина b" value={b} onChange={setB} unit="м" />
      </div>
      <Result label="Периметр" value={p} unit="м" />
      <FormulaHint formula="P = 2(a + b)" />
    </CalcCard>
  );
}

function PileGridCalc() {
  const [a, setA] = useState(24);
  const [b, setB] = useState(36);
  const [step, setStep] = useState(4);
  const rowsA = Math.ceil(a / step) + 1;
  const rowsB = Math.ceil(b / step) + 1;
  const total = rowsA * rowsB;
  return (
    <CalcCard title="Свайное поле — расчёт количества свай" subtitle="Регулярная сетка свай с заданным шагом по обеим осям.">
      <div className="space-y-2">
        <Field label="Длина здания" value={a} onChange={setA} unit="м" />
        <Field label="Ширина здания" value={b} onChange={setB} unit="м" />
        <Field label="Шаг свай" value={step} onChange={setStep} unit="м" step="0.5" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Свай вдоль a:</span> <span className="font-mono font-bold">{rowsA}</span></div>
        <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Свай вдоль b:</span> <span className="font-mono font-bold">{rowsB}</span></div>
      </div>
      <Result label="Всего свай" value={total} unit="шт" hint="ФУН-07-01-001 (шт)" />
      <FormulaHint formula="n = (⌈a/шаг⌉ + 1) × (⌈b/шаг⌉ + 1)" />
    </CalcCard>
  );
}

function RebarMassCalc() {
  const [volume, setVolume] = useState(20);
  const [ratio, setRatio] = useState(75);
  const mass = (volume * ratio) / 1000;
  return (
    <CalcCard title="Масса арматуры по объёму бетона" subtitle="Расход арматуры зависит от типа конструкции: плита 60-80, балка 100-150, колонна 120-180 кг/м³.">
      <div className="space-y-2">
        <Field label="Объём бетона" value={volume} onChange={setVolume} unit="м³" />
        <Field label="Удельный расход" value={ratio} onChange={setRatio} unit="кг/м³" step="5" />
      </div>
      <Result label="Масса арматуры" value={mass} unit="т" hint="ФУН-06-01-001 (т). Округлите до 0.01 т." />
      <FormulaHint formula="m = V_бетон × ρ_арм / 1000" />
    </CalcCard>
  );
}
