"use client";
import Link from "next/link";
import { useState } from "react";

export default function SeismicIsolationPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 48) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 2_400_000_000) <= 240_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Сейсмоизоляция зданий</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌐 Сейсмоизоляция зданий</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #227. Сейсмоизоляция зданий в зоне 9-10 баллов MSK-64 (Алматы,
            Талдыкорган, Шымкент, Талгар, Каскелен). Резинометаллические опоры LRB
            (Lead Rubber Bearing) Bridgestone H=300-500 мм, скользящие FPS (Friction
            Pendulum System) Earthquake Protection Systems, маятниковые TMD (Tuned
            Mass Damper) как в Taipei 101 (660 т). Расчёт по СН РК 2.03-30,
            ASCE 7-22, Eurocode 8 (EN 1998), AISC 341.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Типы сейсмозащиты</h2>
          <p className="text-slate-300 leading-relaxed">
            Сейсмоизоляция (Base Isolation) и сейсмодемпфирование (Energy Dissipation):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>LRB</strong> — Lead Rubber Bearing: слои натур. каучука толщ. 5-10 мм + стальные пластины + центральный свинцовый стержень Ø80-150 мм. Период колебаний здания 2-3 с (вне резонанса с грунтом 0.1-1 с). Демпфирование ξ=15-20%.</li>
            <li><strong>FPS</strong> — Friction Pendulum System: сферическая чаша из нержавейки + скользящий слайдер с PTFE покрытием. Период T = 2π√(R/g), где R — радиус кривизны (типично 1.5-3 м).</li>
            <li><strong>HDRB</strong> — High Damping Rubber Bearing (без свинца, с добавками сажи/смол ξ=10-15%).</li>
            <li><strong>TMD</strong> — Tuned Mass Damper: маятник массой 0.5-1% от массы здания (Taipei 101 — 660 т шар Ø5.5 м на тросах L=42 м, период=демпфирует основную моду 6.8 с).</li>
            <li><strong>Viscous Damper</strong> — поршневые гидравлические Taylor Devices F=2-8 МН (как ноги Burj Al Arab).</li>
            <li><strong>BRB</strong> — Buckling Restrained Brace: стальной стержень в стальной трубе с заполнителем (предотвращает потерю устойчивости при сжатии, демпфирует через пластические деформации).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Выбор системы для Алматы</h2>
          <p className="text-slate-300">
            Здание 12 этажей (h=42 м, масса 8000 т) в Алматы, зона 9-10 баллов MSK-64,
            спектральная плотность пиков 0.3-1.5 с. Какая система оптимальна?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только усиление вертикальной арматуры в колоннах — традиционный подход" },
              { v: "b", t: "Жёсткое крепление в фундамент + TMD на крыше для уменьшения качаний" },
              { v: "c", t: "Только BRB-связи без базовой изоляции" },
              { v: "d", t: "Гибридная система Base Isolation + резерв: 48 LRB Bridgestone типа LRB-700 (Ø700 мм, грузоподъёмность 5000 кН, перемещ. ±500 мм, период 2.5 с) под каждой колонной, + 16 FPS Earthquake Protection Systems FPT8836 (R=2.5 м, ход ±400 мм) на периметре — комбинация для контроля кручения, + 8 viscous damper Taylor F=4 МН на критических осях для контроля повторных толчков (aftershocks). Период изолированного здания 2.5-3 с (вне резонанса с алмат. грунтом), ускорения сокращаются с 0.4g до 0.08g (фактор 5×), деформации в надстройке остаются упругими. СН РК 2.03-30 + ASCE 7-22 + AASHTO LRFD" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во опор</h2>
          <p className="text-slate-300">
            Здание 12 этажей, 8000 т массы, 36 колонн периодической сетки 6×6 м.
            Опора LRB-700 грузоподъёмность 5000 кН (с учётом сейсмики).
            Сколько LRB нужно (с учётом резервирования на критические оси)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N_min = M × g / Q_опоры × коэф_безопасности 1.3<br />
            +дополнит. опоры на угловые/торцевые колонны (двойные)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во LRB, шт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: N_min = 8000×9.81/5000×1.3 = 20.4 → но это по нагрузке. Конструктивно на каждой из 36 колонн нужна минимум 1 LRB → 36 шт, +12 дополнит. (резерв на торцевые/угловые, удвоенные на критич. осях) = 48 шт.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет сейсмоизоляции</h2>
          <p className="text-slate-300">
            Для здания 12 этажей в Алматы. ССЦ + импорт: 48 LRB Bridgestone LRB-700 — 720 млн тг,
            16 FPS Earthquake Protection Systems FPT8836 — 480 млн тг,
            8 viscous damper Taylor F=4 МН — 240 млн тг,
            ростверк сейсмоизоляции (плита B40 H=800 мм с раздельным колодцем для каждой опоры) — 380 млн тг,
            проектирование PBSD (Performance-Based Seismic Design) + динамич. расчёт + нелин. моделирование SAP2000/ETABS — 280 млн тг,
            монтаж сейсмоопор с подкатной системой + натяжение анкеров — 95 млн тг,
            сейсмические дилатации в надстройке (стыки EI120 с эластомерными вставками) — 65 млн тг,
            сейсмический мониторинг (акселерометры на каждом 3-м этаже + базовая станция) — 140 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~2.4 млрд тг (допуск ±10%). 720+480+240+380+280+95+65+140 = 2.4 млрд тг. Удорожание ~10-15% от стоимости каркаса, но снижение сейсм. ущерба в 5-10× при землетрясении 8-9 баллов окупается за 1-2 события.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Сейсмодилатации</h2>
          <p className="text-slate-300">
            Здание с сейсмоизоляцией должно иметь возможность смещения относительно
            окружения (тротуар, инжен. сети). Какое решение по СН РК 2.03-30?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Жёсткое крепление коммуникаций к зданию — пусть тротуар деформируется вместе" },
              { v: "b", t: "Зазор 100 мм между зданием и тротуаром — этого достаточно" },
              { v: "c", t: "Сейсмический зазор Δ_max + 200 мм запас (для LRB-700 с ходом ±500 мм: Δ_зазор=700 мм между зданием и тротуаром), заполнение зазора эластомерной вставкой Lubang Joint или Mageba Tensa-Modular (выдерживает перемещения ±500 мм во всех направлениях), все коммуникации (вода, канализация, газ, электричество, телекоммуникации) — через гибкие подключения Victaulic SeisFlex / Mason Industries DSR с дополнит. компенсаторами на длине 2-3 м, разрыв жёстких конструкций (пандусы, лестницы) в зоне зазора с подвижными плитами Mageba Reston-Eccentric, защита от проникновения пыли/воды специальные пластины DENWA Seismic Cover Plates, СН РК 2.03-30 разд. 9 + ASCE 7-22 + AASHTO LRFD Bridge Design" },
              { v: "d", t: "Жёсткие коммуникации, но с подвижным цокольным основанием" },
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
                {score === 4 ? "Отлично — готовы к проектированию сейсмоизоляции" : score >= 2 ? "Перечитайте СН РК 2.03-30 + ASCE 7-22 + Eurocode 8" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 2.03-30 (Сейсмостойкость), ASCE 7-22 (Min Design Loads, гл. 17 Seismic Isolation), Eurocode 8 EN 1998-1, AISC 341 (Steel Seismic), AASHTO LRFD Bridge, ISO 22762 (LRB/HDRB).</p>
          <p><strong>Реальные объекты:</strong> Госпиталь USC University Hospital (LA, LRB), Apple Park (Купертино, FPS), Taipei 101 (TMD 660 т), госпитали Стамбула после 1999, Алматинский метрополитен (виброизол. подушки).</p>
        </section>
      </main>
    </div>
  );
}
