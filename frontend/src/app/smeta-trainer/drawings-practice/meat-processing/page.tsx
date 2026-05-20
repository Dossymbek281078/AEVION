"use client";
import Link from "next/link";
import { useState } from "react";

export default function MeatProcessingPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1250) <= 100;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 12_500_000_000) <= 1_200_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Мясокомбинаты и пищепром</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🥩 Мясокомбинаты и пищевая промышленность</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #196. Проектирование и расчёт смет на мясоперерабатывающие комбинаты РК:
            цех убоя КРС/МРС/свиней, обвалочные и жиловочные цеха, колбасное производство,
            шоковая заморозка −35°C, холодильные камеры −20°C/−18°C, СанПиН РК 4.01-001-2024,
            ГОСТ Р 51074. Учебный кейс — мясокомбинат 50 т/смену, Караганда.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая цепочка</h2>
          <p className="text-slate-300 leading-relaxed">
            Согласно ВНТП-540 «Нормы технологического проектирования предприятий мясной промышленности»:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Скотобаза с предубойным содержанием (норма площади 3.5 м²/КРС, 1.0 м²/свинья).</li>
            <li>Цех убоя (оглушение, обескровливание, нутровка) — конвейер 60 голов/час.</li>
            <li>Холодильник остывания +4°C (24 ч для созревания).</li>
            <li>Цех обвалки и жиловки (t° воздуха ≤12°C, СанПиН).</li>
            <li>Колбасный цех (фаршеприготовление, шприцевание, термообработка).</li>
            <li>Шоковая заморозка −35°C (для готовой продукции).</li>
            <li>Камеры хранения −18°C (срок ≤ 6 мес), отгрузка в реф-фурах.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Зонирование цеха</h2>
          <p className="text-slate-300">
            СанПиН РК 4.01-001-2024 жёстко регламентирует разделение чистых и грязных потоков.
            Какое решение соответствует требованиям?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Все цеха в одном модуле без переборок — экономия на площадях" },
              { v: "b", t: "Разделение бытовое (вход/гардероб) — единое, технология общая" },
              { v: "c", t: "Раздельные потоки: «грязный» (приёмка-убой) и «чистый» (обвалка-колбаса) с отдельными входами, гардеробами, санпропускниками; шлюзы с дезматами; цвет полов разный" },
              { v: "d", t: "Только разделение по этажам без отдельных санпропускников" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Холодопотребность</h2>
          <p className="text-slate-300">
            Шоковая камера: загрузка 5 т/сутки мяса с +4°C до −18°C, удельная теплоёмкость
            замороженного мяса 1.7 кДж/(кг·К), теплота кристаллизации 230 кДж/кг.
            Сколько киловатт-часов холода требуется в сутки (≈)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Q = m × c × ΔT + m × L<br />
            ΔT = 22°C; перевод кДж → кВт·ч (÷3600)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Расход холода, кВт·ч/сутки"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: Q = 5000×1.7×22 + 5000×230 = 187 000 + 1 150 000 = 1 337 000 кДж ≈ 371 кВт·ч. С учётом ограждений + воздухообмен + COP=0.3 ≈ 1250 кВт·ч.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет мясокомбината</h2>
          <p className="text-slate-300">
            Мясокомбинат 50 т/смену (Караганда). ССЦ РК 2026Q2: главный корпус 12 000 м²
            (СЭС-цеха) — 7.2 млрд тг, оборудование убоя/обвалки — 1.4 млрд тг,
            колбасный цех с термокамерами — 1.6 млрд тг, холодильник 3000 м² −18°C — 980 млн тг,
            компрессорная аммиачная R717 — 520 млн тг, очистные сооружения — 380 млн тг,
            внутрипл. сети + благоустройство — 420 млн тг. Сметная стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~12.5 млрд тг (допуск ±10%). 7200+1400+1600+980+520+380+420 = 12 500 млн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Хладагент: выбор</h2>
          <p className="text-slate-300">
            Для холодильно-компрессорной мясокомбината проектировщик предложил R717 (NH₃).
            Какие требования по ПБ 09-595 (Правила безопасности аммиачных установок) ключевые?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "R717 запрещён в РК — заменить на R134a (фреон)" },
              { v: "b", t: "Достаточно вытяжной вентиляции в МКС" },
              { v: "c", t: "Допустимо размещение компрессорной в здании цеха без отдельного выноса" },
              { v: "d", t: "Отдельно стоящая МКС категории «А», аварийная вентиляция 8× в час, газоанализаторы NH₃ с автозапуском вытяжки, обвалование ресиверов, эвакуационные пути ≤25 м, СН РК 4.02-08" },
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
                {score === 4 ? "Отлично — готовы к проектированию мясокомбината" : score >= 2 ? "Перечитайте СанПиН РК 4.01-001-2024 и ВНТП-540" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СанПиН РК 4.01-001-2024, ВНТП-540, ПБ 09-595 (Аммиак), СН РК 4.02-08 (Холодоснабжение), ГОСТ Р 51074-2003.</p>
          <p><strong>Реальные объекты РК:</strong> «Май-Май» (Алматинская обл.), «Беккер и К», «Караганды Ет», ТОО «Кублей», Усть-Каменогорский мясокомбинат.</p>
        </section>
      </main>
    </div>
  );
}
