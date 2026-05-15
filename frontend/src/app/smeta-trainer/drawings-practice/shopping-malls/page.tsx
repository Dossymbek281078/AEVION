"use client";
import Link from "next/link";
import { useState } from "react";

export default function ShoppingMallsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 165) <= 15;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 42_000_000_000) <= 4_000_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "d",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Торгово-развлекательные центры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🛍️ Торгово-развлекательные центры (ТРЦ)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #210. Проектирование и расчёт смет ТРЦ РК: Mega Almaty (110 000 м² GLA),
            Esentai Mall (40 000 м²), Mega Park, Aport Mall, Khan Shatyr Astana.
            Многоэтажные торговые галереи, эскалаторы Schindler/KONE, фудкорты, кинотеатры IMAX,
            фасады из навесных систем, СН РК 2.02-15 категория Ф3.1, ТЭП.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ТРЦ</h2>
          <p className="text-slate-300 leading-relaxed">
            СП РК 3.02-115 «Здания общественные» и пособие по проектированию ТРЦ:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Якорные арендаторы (гипермаркет 8-12 тыс. м², электроника 3-5 тыс. м²).</li>
            <li>Торговая галерея (200-400 бутиков, средний размер 80-150 м²).</li>
            <li>Фудкорт (15-25 операторов, 600-1000 посадочных мест).</li>
            <li>Кинотеатр (8-12 залов мульти-плекс, IMAX зал 280 мест).</li>
            <li>Развлечения (детский парк, ледовая арена, боулинг).</li>
            <li>Подземный паркинг (2 500-4 000 м/мест, 1 м/м на 30-35 м² GLA).</li>
            <li>Атриум-двусветный (визитная карточка, лифты панорамные).</li>
            <li>Технические этажи (АХУ/чиллеры/ИТП/ГРЩ/насосные).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Эвакуация при пожаре</h2>
          <p className="text-slate-300">
            ТРЦ Ф3.1 (категория зданий торговли по СН РК 2.02-15) с одновременным
            пребыванием 15 000 чел. Какие требования по эвакуации ключевые?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно одного главного входа и эвакуация через парадную лестницу" },
              { v: "b", t: "2 эвакуационных выхода на этаж — типовое решение для общественных зданий" },
              { v: "c", t: "Незадымляемые лестничные клетки Н2 (с подпором воздуха), расчётное время эвак. ≤6 мин, ширина прохода 1.0 м на 100 чел, выходы через каждые 75 м, разделение пож. отсеками 4000 м² пер. блок, СОУЭ 5-го типа, СН РК 2.02-15 разд. 8" },
              { v: "d", t: "Только система оповещения и пожарных дверей — без подпора воздуха" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Эскалаторы и лифты</h2>
          <p className="text-slate-300">
            ТРЦ 50 000 м² GLA, 4 уровня (1−4 этажи), якорные арендаторы на каждом этаже,
            прогнозируемый трафик 50 000 посетителей/день, пиковый час 7000 чел.
            Сколько эскалаторов (Schindler/KONE 9300, пропускная 6800 чел/ч в одну сторону) нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            На каждый межэтажный переход — пара эскалаторов (вверх/вниз)<br />
            +2 траволатора для паркинга, +лифты пассажирские/грузовые
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во эскалаторов/траволаторов (всего ед. вертик. транспорта)"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 3 межэтажных перехода × 2 (вверх+вниз) × 4 узла (атриум, юг, север, фудкорт) = 24 эскалатора + 6 траволаторов + 6 панорамных лифтов + 8 грузовых + 12 пассажирских = ~165 единиц вертикального транспорта (зависит от точной планировки).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ТРЦ 50 000 м² GLA</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: монолитный каркас + перекрытия 100 000 м² общ. — 12.5 млрд тг,
            фасадная система НВФ керамогранит/композит — 4.8 млрд тг,
            кровля + светопрозрачный атриум — 1.8 млрд тг, внутренняя отделка mall зон — 6.4 млрд тг,
            эскалаторы + лифты + траволаторы (165 ед.) — 5.4 млрд тг,
            HVAC чиллеры + АХУ + вентиляция — 4.2 млрд тг, электрика + слаботочка + СКУД — 3.2 млрд тг,
            АУПТ спринклер + СОУЭ — 1.6 млрд тг, благоустройство + паркинг 3000 м/мест — 1.8 млрд тг.
            Сметная стоимость (без отделки магазинов арендаторами)?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~42 млрд тг (допуск ±10%). 12500+4800+1800+6400+5400+4200+3200+1600+1800 = 41 700 млн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Технологическая зона</h2>
          <p className="text-slate-300">
            Фудкорт ТРЦ: 20 ресторанов с собственными кухнями. Какое инженерное решение обязательно?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Общая вентиляция от АХУ зала — отдельных систем не требуется" },
              { v: "b", t: "Только местные вытяжки над плитами без общей системы" },
              { v: "c", t: "Жироуловители у каждой раковины + общая канализация" },
              { v: "d", t: "Отдельная система кухонной вытяжки L=2000-3000 м³/ч на ресторан с жироулавливающими фильтрами «Air Box», воздуховоды класс «Н» (пожаробезопасные), отдельный вентканал на крышу, противопожарные клапаны, локальные жироуловители 50-100 л и общий жироотделитель «ACO» 2000 л перед канализацией" },
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
                {score === 4 ? "Отлично — готовы к проектированию ТРЦ" : score >= 2 ? "Перечитайте СН РК 2.02-15 и СП РК 3.02-115" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 2.02-15 (Пожбез), СП РК 3.02-115 (Общественные), ЕН 81-20 (Лифты), ГОСТ 33652 (Эскалаторы), СН РК 4.02-08.</p>
          <p><strong>Реальные объекты РК:</strong> Mega Almaty/Park, Esentai Mall, Khan Shatyr (Астана), Aport Mall, Forum Almaty, Dostyk Plaza, MyMall.</p>
        </section>
      </main>
    </div>
  );
}
