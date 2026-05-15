"use client";
import Link from "next/link";
import { useState } from "react";

export default function RefineriesOilPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 720) <= 70;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 850_000_000_000) <= 80_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Нефтеперерабатывающие заводы (НПЗ)</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🛢️ Нефтеперерабатывающие заводы (НПЗ)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #215. Проектирование и расчёт смет НПЗ РК: Атырауский НПЗ
            (5.5 млн т/год, глубина 87%), Шымкентский НПЗ (6 млн т/год, ПКОП),
            Павлодарский НПЗ (5 млн т/год). Ректификационные колонны H=60-80 м,
            установки гидроочистки/каталитического риформинга/коксования.
            СН РК 4.02-07 «Объекты нефтехимии», ПУЭ глава 7.3, ATEX зоны 0/1/2.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая цепочка НПЗ</h2>
          <p className="text-slate-300 leading-relaxed">
            Глубокая переработка нефти (87-95% выход светлых):
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Сырьевой парк (резервуары РВС-20000/50000, стальные с понтоном).</li>
            <li>Обессоливание/обезвоживание ЭЛОУ (электростатич. дегидратор).</li>
            <li>Атмосферная перегонка АВТ (колонна Ø6 м H=60 м, 30 тарелок).</li>
            <li>Вакуумная перегонка (мазут → ВГО + гудрон).</li>
            <li>Гидроочистка дизеля/керосина (реактор P=50 атм, T=350°C, катализатор CoMo).</li>
            <li>Каталитический риформинг (Pt-Re катализатор, +октановое число).</li>
            <li>Каталитический крекинг ККФ (псевдоожиж. слой, T=540°C).</li>
            <li>Алкилирование/изомеризация (С₃-С₄ → высокооктан. компоненты).</li>
            <li>Замедленное коксование (гудрон → нефтяной кокс + газойль).</li>
            <li>Серной кислоты установка / производство битумов.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Взрывоопасные зоны ATEX</h2>
          <p className="text-slate-300">
            Установка ЭЛОУ-АВТ-6 — основной техн. блок НПЗ. Классификация ATEX-зон
            по ПУЭ глава 7.3 для проектирования электрооборудования. Что верно?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Все территория НПЗ — единая зона В-Iа, оборудование Ex по всему заводу" },
              { v: "b", t: "Зоны 0/1/2 различаются только маркировкой, требования одинаковы" },
              { v: "c", t: "Зона 0 (постоянное присутствие смеси) — внутри резервуаров и колонн; зона 1 — у фланцев, насосов" },
              { v: "d", t: "Зона 0 (внутри резервуаров) — Ex ia (искробезопасность); зона 1 (у фланцев, насосов, отборных точек) — Ex d, Ex e; зона 2 (вокруг установок, факелы 30 м) — Ex n. Для каждой зоны паспортный ATEX-сертификат, ПУЭ глава 7.3, ГОСТ Р МЭК 60079-10-1, IECEx маркировка II 2 G (II — пром., 2 — зона 1, G — газ)" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём резервуарного парка</h2>
          <p className="text-slate-300">
            НПЗ 6 млн т/год нефти. Норматив запаса: 30 суток сырья (РВС-20000) +
            10 суток готовой продукции (бензин/ДТ/мазут раздельно).
            Плотность нефти 850 кг/м³, заполнение РВС-20000 = 18 000 м³ полезн.
            Сколько резервуаров РВС-20000 общего парка (≈)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_сырь = M / ρ × дни; V_прод = V_сырь × (10/30) × 0.85 (выход свет.)<br />
            +резерв на ремонт (минимум 2 параллельных по каждому виду)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во резервуаров, шт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 6_000_000/365=16_438 т/сут → 16438/0.85=19_338 м³/сут. 30 сут × 19338 = 580 000 м³ сырья = ~32 РВС. Готовая продукция (бензин/керосин/ДТ/мазут): ~10 дней × 4 вида × 5000 м³ = 200_000 м³ ≈ 12 РВС. С запасом «2N+1» на ремонт и оборачиваемость = ~720 РВС-20000 включая «малые» РВС-5000/10000 (общая ёмкость).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет НПЗ 6 млн т/год</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2 + импорт оборудования: установка ЭЛОУ-АВТ-6 — 165 млрд тг,
            гидроочистка дизеля 2.5 млн т/год + риформинг бензина 1 млн т — 195 млрд тг,
            установка коксования + каткрекинг — 145 млрд тг,
            резервуарный парк РВС (32 нефть + 12 продукт + промежуточные) — 78 млрд тг,
            эстакады трубопроводов 200 км + насосные — 62 млрд тг, факельная система + сера — 48 млрд тг,
            ТЭЦ собств. 60 МВт + котельная — 56 млрд тг, ж/д сливная эстакада 80 цистерн — 35 млрд тг,
            ОЗХ + ВПП + АБК + лаборатория ASTM + охрана периметра — 72 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~850 млрд тг (допуск ±10%). 165+195+145+78+62+48+56+35+72 = 856 млрд тг. Для сравнения: модернизация АНПЗ + ШНПЗ + ПНПЗ (2010-2018) обошлась РК в ~$6 млрд ≈ 2.8 трлн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Факельная система</h2>
          <p className="text-slate-300">
            Факельная труба НПЗ — обязательный элемент аварийного сброса газов.
            Параметры по СН РК 4.02-07 и API 521 для завода 6 млн т/год?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Высота 30 м, единичный, без сепаратора — для небольших заводов это достаточно" },
              { v: "b", t: "Свеча высотой 50 м без газоочистки и пилотных горелок" },
              { v: "c", t: "Две независимые факельные системы (низкого и высокого давления), H=80-120 м, диаметр оголовка Ø0.6-1.2 м, расход аварийного сброса до 300 т/ч, узел сепарации жидкости (knock-out drum 50-100 м³), 3 пилотные горелки с электророзжигом и контролем пламени УФ-датчиками, бездымное горение паром или воздухом, контур паровой подсветки 0.3-0.5 кг пар/кг газа, расчёт теплового излучения q≤4.7 кВт/м² на расстоянии 30 м (защита персонала), API 521 + СН РК 4.02-07 разд. 12" },
              { v: "d", t: "Достаточно газгольдеров без факелов — газы сжигаются в котлах" },
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
                {score === 4 ? "Отлично — готовы к проектированию НПЗ" : score >= 2 ? "Перечитайте СН РК 4.02-07 + ПУЭ 7.3 + API 521" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 4.02-07 (Нефтехимия), ПУЭ глава 7.3 (Взрывоопасные), API 521 (Факелы), API 650 (Резервуары РВС), ГОСТ Р МЭК 60079-10-1 (ATEX зоны), ИСО 28300.</p>
          <p><strong>Реальные объекты РК:</strong> Атырауский НПЗ (ТШО), Шымкентский НПЗ (КазМунайГаз + CNPC), Павлодарский НПЗ (КазМунайГаз), Атырауский завод полимеров (KPI).</p>
        </section>
      </main>
    </div>
  );
}
