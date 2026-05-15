"use client";
import Link from "next/link";
import { useState } from "react";

export default function DairyPlantsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 2400) <= 200;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 9_800_000_000) <= 900_000_000;

  const correct = {
    ex1: ex1 === "d",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "c",
  };
  const score = Object.values(correct).filter(Boolean).length;

  const optClass = (state: string, value: string, ok: boolean) => {
    if (!showResults || state !== value) return state === value ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500";
    return ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Молочные заводы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🥛 Молочные заводы и переработка молока</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #197. Проектирование и расчёт смет на молокозаводы РК: приёмка сырого молока,
            пастеризация (HTST 72-75°C / UHT 135-138°C), сепарация, гомогенизация, нормализация,
            асептическая упаковка Tetra Pak / ELOPAK. Камеры хранения +4°C, СанПиН РК 4.01-001-2024,
            ГОСТ 31450-2013, ТР ТС 033/2013. Учебный кейс — молокозавод 200 т/сутки, Алматинская обл.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая цепочка</h2>
          <p className="text-slate-300 leading-relaxed">
            Согласно ВНТП-645 «Нормы технологического проектирования молочной промышленности»:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Приёмка сырого молока (молоковозы → счётчик-расходомер → охладитель ОМ-1000).</li>
            <li>Резервирование в танках Г2-ОТ2-А10 (нерж. AISI 304, V=10-50 м³, +4°C).</li>
            <li>Сепарация (отделение сливок) и нормализация по жирности.</li>
            <li>Гомогенизация Tetra Alex 350 (180 бар) — стабилизация жировой эмульсии.</li>
            <li>Пастеризация HTST 72-75°C × 15-20 с (или UHT 135-138°C × 2-4 с).</li>
            <li>Охлаждение до +4°C в пластинчатом теплообменнике (рекуперация 85%).</li>
            <li>Асептический розлив в Tetra Brik / Pure-Pak, маркировка, паллетирование.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — CIP-мойка</h2>
          <p className="text-slate-300">
            Молочное производство требует автоматическую безразборную мойку оборудования.
            Какой режим CIP (Cleaning-In-Place) типовой по ГОСТ 31450 для танка-резервуара после молока?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только промывка холодной водой 15 минут, безразборка не требуется" },
              { v: "b", t: "Промывка водой + щелочь NaOH 2% при 40°C × 10 минут, ополаскивание" },
              { v: "c", t: "Кислота HNO₃ 1% при 80°C × 30 минут, затем горячая вода" },
              { v: "d", t: "Полный цикл: тёпл. вода (40°C) → щёлочь NaOH 1.5-2% (75°C × 15-20 мин) → промежут. ополаск. → кислота HNO₃ 0.8-1.2% (65°C × 10-15 мин) → финальное ополаскивание питьевой водой → дезинфекция" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём ёмкостей хранения</h2>
          <p className="text-slate-300">
            Завод приёмки 200 т/сутки молока, плотность 1030 кг/м³.
            Резерв на 2 смены работы (16 ч) + 25% страховой запас.
            Сколько суммарной кубатуры танков нужно (≈ м³)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_суточн = M / ρ; V_резерв = V × (16/24) × 1.25<br />
            +V_суточный (днев. оборот) ≈ полный объём
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Объём, м³"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 200000÷1030 ≈ 194 м³ суточн. + 194×0.67×1.25 ≈ 162 м³ резерв ≈ 356 м³ ≈ 8 танков по 30 м³ + 2 по 50 м³. Включая UHT/пастер. танки + сливок ≈ 600 м³ → запас 4×. Для всех видов продукции (молоко+кефир+йогурт+сыр) с резервированием итого ≈ 2 400 м³.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет молокозавода</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: главный производственный корпус 8 000 м² — 4.8 млрд тг,
            линия приёмки + резервуары 2 400 м³ — 850 млн тг,
            пастеризатор HTST 20 000 л/ч + сепараторы Tetra Centri — 720 млн тг,
            UHT-установка Tetra Therm AsepticVTIS + асептический танк — 980 млн тг,
            упаковочный автомат Tetra Pak A3/Speed × 4 — 1.2 млрд тг,
            холодильник готовой продукции 2000 м² +4°C — 580 млн тг,
            котельная + холодильная + очистные — 720 млн тг.
            Сметная стоимость молокозавода 200 т/сутки?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~9.8 млрд тг (допуск ±10%). 4800+850+720+980+1200+580+720 = 9 850 млн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Очистные сооружения</h2>
          <p className="text-slate-300">
            Молочные стоки — высоконагруженные органикой (БПК₅ до 3000 мг/л), требуют сложной очистки.
            Что предусмотреть по СН РК 4.01-02 для молокозавода 200 т/сутки?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Прямой сброс в горканализацию без предочистки — ГорВодоканал доочистит" },
              { v: "b", t: "Только механический отстойник + жироловка, биологию не нужно" },
              { v: "c", t: "Локальная биологическая очистка: усреднитель → жироловка → анаэробный реактор UASB → аэротенк-нитриденитрификатор → вторичный отстойник → УФ-обеззараживание. БПК на выходе ≤ 6 мг/л (норматив для сброса в водоём)" },
              { v: "d", t: "Достаточно реагентной очистки коагулянтами (FeCl₃) без биологии" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-xl p-6">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
          >
            Проверить ответы
          </button>
          {showResults && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${score === 4 ? "text-emerald-400" : score >= 2 ? "text-amber-400" : "text-rose-400"}`}>
                {score} / 4
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {score === 4 ? "Отлично — готовы к проектированию молокозавода" : score >= 2 ? "Перечитайте ВНТП-645 и ГОСТ 31450" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СанПиН РК 4.01-001-2024, ВНТП-645, ГОСТ 31450-2013 (Молоко), ТР ТС 033/2013, СН РК 4.01-02 (Очистные), СН РК 4.02-08 (Холод).</p>
          <p><strong>Реальные объекты РК:</strong> Foodmaster (Алматы, Шымкент), «Айналайын» (Костанай), «Раимбек» (Талгар), «Адал», «Натуральный продукт».</p>
        </section>
      </main>
    </div>
  );
}
