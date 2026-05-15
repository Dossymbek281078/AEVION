"use client";
import Link from "next/link";
import { useState } from "react";

export default function SchoolsModernPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 12000) <= 1000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 7_200_000_000) <= 700_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Современные школы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏫 Современные общеобразовательные школы РК</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #213. Проектирование и расчёт смет общеобразовательных школ РК:
            типовой проект 224-1-587с школа №47 г. Алматы vs новые проекты ШГ-1500 мест.
            СП РК 3.02-04 «Здания общеобразовательных учреждений», СН РК 2.02-15 Ф4.1
            (учебные заведения), СанПиН РК 4.01-007-2024. Спортивный зал 9×18×8 м,
            актовый зал на 600 чел, лаборатории, столовая на ≥150 мест.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав школы на 1500 мест</h2>
          <p className="text-slate-300 leading-relaxed">
            СП РК 3.02-04 + СанПиН РК 4.01-007-2024:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Учебные кабинеты (60 кабинетов, 50 м² каждый, 2.0 м²/учащ. начальное / 2.5 м²/средн.).</li>
            <li>Кабинеты физики/химии/биологии с лаборантскими и вытяжными шкафами.</li>
            <li>Компьютерные классы (4 кабинета, ПК с антибликовыми экранами, освещ. 500 лк).</li>
            <li>Мастерские (трудовое обучение): столярная, слесарная, кулинарная, швейная.</li>
            <li>Спортивные залы: большой 18×30×7 м + малый 12×24×6 м + гимнаст. 9×18×6 м.</li>
            <li>Актовый зал на 600 мест с эстрадой 80 м² и пультовой светотехникой.</li>
            <li>Библиотека с читальным залом на 60 мест + медиатека.</li>
            <li>Столовая с пищеблоком на 150 посадочных мест (2 смены × 750 чел).</li>
            <li>Медблок: кабинет врача, прививочный, физиотерапевт., изолятор на 2 койки.</li>
            <li>Административный блок (директор, завучи, методический, бухгалтерия).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Эвакуация и пожбез</h2>
          <p className="text-slate-300">
            Школа 1500 учащ. + 200 сотрудн., 4 этажа, площадь 12 000 м².
            Что обязательно по СН РК 2.02-15 (категория Ф4.1)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно одной центральной лестницы + АУПС" },
              { v: "b", t: "Только обычные лестничные клетки Л1 без подпора" },
              { v: "c", t: "Минимум 2 рассредоточенных эвакуационных выхода с этажа, лестничные клетки типа Л1 с естественным освещением (или Н2 если высота >28 м), пожарные двери EI30 на лестницы, СОУЭ 4-го типа с речевым оповещением, спринклеры (если строит. объём >25 000 м³), эвакуация ≤6 мин по расчёту СН РК 2.02-15 разд. 8" },
              { v: "d", t: "Газовое пожаротушение и автоматическое запирание дверей" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь школы</h2>
          <p className="text-slate-300">
            Школа на 1500 мест по СП РК 3.02-04. Норматив: 7.5-8.5 м²/учащ. общей площади
            (учебная + актовый + спорт + столовая + админ + коридоры + санузлы).
            Какая общая площадь нужна (≈ м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_общ = N × норматив; в т.ч. учебная ≈30% от общей<br />
            спорт ≈10%, актовый ≈5%, столовая ≈8%, технические/коммуникации ≈20%
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 1500 × 8 ≈ 12 000 м² (типовой проект ШГ-1500).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ШГ-1500</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: монолит каркас + перекрытия 12 000 м² — 3.6 млрд тг,
            фасад НВФ керамогранит + кровля — 720 млн тг, отделка учебных и админ блоков — 1.4 млрд тг,
            спортзалы (полы Гербол, освещ., оборудование) — 380 млн тг, актовый зал
            (амфитеатр, акустика, светотехника) — 320 млн тг, столовая + пищеблок — 280 млн тг,
            HVAC + сантехника + электрика — 580 млн тг, IT-инфра + СКС + интерактивные доски — 180 млн тг,
            благоустройство + спортплощадки + ограждение — 320 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~7.2 млрд тг (допуск ±10%). 3600+720+1400+380+320+280+580+180+320 = 7 780 млн → с НР+СП ≈ 7.2 млрд тг базовая стоимость без оборудования арендаторов.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Спортзал параметры</h2>
          <p className="text-slate-300">
            Спортивный зал общеобразовательной школы для гандбола, волейбола, баскетбола.
            Какие параметры обязательны по СП РК 3.02-04 и ФИБА/ФИВБ?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "12×24×6 м — этого достаточно для волейбола и баскетбола школьного уровня" },
              { v: "b", t: "9×18×8 м — для гимнастики, но для игровых маловат" },
              { v: "c", t: "12×24×7 м с защитными сетками — компромисс по бюджету" },
              { v: "d", t: "Минимум 18×30×7 м (площадь 540 м², h=7 м) с зонами безопасности 1-2 м по периметру, защита окон сетками, пол Гербол/Tarkett спорт. 8.5 мм, освещ. 400 лк, разметка для 3 видов спорта одновременно, акустическая обработка стен, естественное освещение с защитой от прямых лучей" },
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
                {score === 4 ? "Отлично — готовы к проектированию школы" : score >= 2 ? "Перечитайте СП РК 3.02-04 и СанПиН 4.01-007-2024" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 3.02-04 (Школы), СН РК 2.02-15 (Пожбез Ф4.1), СанПиН РК 4.01-007-2024 (Сан-эпид. требования), Типовые проекты Минпросвещения РК (ШГ-1500/ШГ-2000).</p>
          <p><strong>Реальные объекты РК:</strong> Школа-гимназия №47 (Алматы, типовой 224-1-587с), Назарбаев Интеллектуальные Школы (15 НИШ), школы «BIL», международные KIS/Tien Shan Almaty.</p>
        </section>
      </main>
    </div>
  );
}
