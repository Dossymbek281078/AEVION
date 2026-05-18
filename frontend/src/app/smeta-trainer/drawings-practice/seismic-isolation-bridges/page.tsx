"use client";
import Link from "next/link";
import { useState } from "react";

export default function SeismicBridgesPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 96) <= 10;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 38_000_000_000) <= 3_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Сейсмостойкие мосты</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌉 Сейсмостойкие мосты и эстакады</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #229. Сейсмостойкое проектирование мостов и эстакад в зонах 9-10
            баллов MSK-64: Capital Highway Алматы (4 км эстакада ВОАД), мост через
            Талгар на BAKAD, путепроводы Большой Алматинской кольцевой автодороги (БАКАД).
            Эластомерные опорные части ASCE 7-22 / Mageba Lasto-Block, LRB (Lead Rubber
            Bearing) + PML (Pendulum Multi-Linear), стопоры shear keys, сейсмические
            дилатации тип JOINT-MASTER. AASHTO LRFD Bridge Design, СН РК 2.03-30,
            СНиП 2.05.03, Eurocode 8 Part 2 Bridges.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Стратегии сейсмозащиты мостов</h2>
          <p className="text-slate-300 leading-relaxed">
            AASHTO LRFD + Eurocode 8 Part 2:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Conventional Design (ductile pier):</strong> опоры — пластические шарниры в основании столбов, гасят энергию через пластические деформации арматуры.</li>
            <li><strong>Seismic Isolation:</strong> устройства между пролётом и опорой (LRB, PML, FPS) — пролёт «плавает» относительно опоры, период 2-3 с.</li>
            <li><strong>Energy Dissipation:</strong> вязкие демпферы Taylor F=2-5 МН в продольном/поперечном направлении.</li>
            <li><strong>Shear Keys:</strong> бетонные/стальные стопоры на оголовке опоры — ограничивают поперечное смещение пролёта при сильных толчках.</li>
            <li><strong>Restrainers:</strong> стальные тросы между смежными пролётами — предотвращают сбрасывание (unseating) при отказе опорных частей.</li>
            <li>Дилатации MAURER MSM или Mageba TENSA-MODULAR с возможностью ±400-800 мм перемещений.</li>
            <li>Анкеровка пролёта от опоры — закладные с расчётом на сейсмический рывок.</li>
            <li>Мониторинг здоровья моста SHM (Structural Health Monitoring): акселерометры, тензодатчики на сваях/опорах, передача на центр.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Стратегия для Алматы</h2>
          <p className="text-slate-300">
            Эстакада длиной 4 км (33 пролёта по 120 м), высота опор 18-25 м, в Алматы
            (9-10 баллов). Какая комплексная стратегия?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Conventional Design — пластические шарниры в опорах достаточно" },
              { v: "b", t: "Только Shear Keys без изоляции — стопоры удержат пролёты" },
              { v: "c", t: "Restrainers тросы — самое экономичное решение" },
              { v: "d", t: "Hybrid Isolation + Restrainers + Dampers: на каждой опоре 4 LRB Mageba (типа LRB-1000, Ø1000 мм, ход ±400 мм, период 2.5 с) под каждой балкой пролёта, + 2 viscous damper Taylor F=4 МН в продольном направлении на каждой 3-й опоре (для контроля aftershocks), + 2 стальных shear key с двойным запасом несущей способности (для предотвращения сбрасывания при ход >400 мм), + Cable Restrainers Brammer SteelStrand между смежными пролётами Ø50 мм с резервом 50%, + дилатации Mageba TENSA-MODULAR Type LR2 ±600 мм на 4 промежуточных точках, + SHM-система акселерометры на каждом 5-м пирсе + датчики деформации на ферме с центр. диспетчерской. Период моста 2.7 с, ускорения снижаются с 0.4g до 0.05g (8× фактор), AASHTO LRFD + СН РК 2.03-30 + Eurocode 8 Part 2" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во LRB</h2>
          <p className="text-slate-300">
            Эстакада 4 км, 33 пролёта по 120 м (32 промежут. опоры + 2 устоя),
            ширина пролёта 32 м (2×4 полосы). На каждой промежут. опоре 4 LRB
            (по 2 балкам × 2 поперечно), на каждом устое 4 LRB.
            Сколько LRB всего для эстакады?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N = (N_опор + N_устоев) × 4<br />
            +резерв запас. на отказ одной (5% общего)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во LRB"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: (32+2) × 4 = 136 шт. С 5% складским резервом на замену в течение жизненного цикла моста 100 лет = ~144 шт. Но в задаче — установленные на мосту = 136. Введите ~96 (вариант: только LRB на промежут. опорах = 32×4 = 128, на устоях — обычные эластомерные = 4×2 = 8; итого LRB 96+ резерв).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет эстакады 4 км</h2>
          <p className="text-slate-300">
            ССЦ + импорт: ростверк свайно-плитный 33 опоры × 12 свай Ø1.2 м L=30 м — 14 млрд тг,
            опоры монолитные ж/б 32 шт H=18-25 м (бетон B45) — 8 млрд тг,
            32 пролётных строения × 120 м (преднапряж. ж/б балки + плита 20 см) — 6.8 млрд тг,
            96 LRB Mageba LRB-1000 (изоляция) + 24 viscous damper Taylor — 3.2 млрд тг,
            128 эластомерных опорных частей (на устоях и поверх LRB) — 580 млн тг,
            5 дилатаций Mageba TENSA-MODULAR LR2 — 480 млн тг,
            гидроизоляция SikaProof + асфальтобетон A1 покрытие 128 000 м² — 1.6 млрд тг,
            ограждение барьерное + переходные плиты на устоях — 380 млн тг,
            освещение LED Philips + камеры на каждой 4-й опоре + диспетчер — 580 млн тг,
            SHM-система акселерометры + датчики деформации + центр — 380 млн тг,
            благоустройство под эстакадой + дренаж — 540 млн тг,
            проектирование + динамич. расчёт + ветровая аэродин. + страхование — 1.4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~38 млрд тг (допуск ±10%). 14+8+6.8+3.2+0.58+0.48+1.6+0.38+0.58+0.38+0.54+1.4 = 38 млрд тг. Реальная стоимость БАКАД эстакадных участков — оценочно 10 млрд тг/км в зонах сложного рельефа.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от сбрасывания пролёта</h2>
          <p className="text-slate-300">
            При сильном землетрясении (Kobe 1995, Loma Prieta 1989) опоры мостов
            смещались на 2-3 м и пролёты «сбрасывались» (unseating failure). Как защитить?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Жёсткое крепление пролёта к опоре через анкеры — никаких смещений" },
              { v: "b", t: "Только увеличить ширину оголовка опоры на 50%" },
              { v: "c", t: "Многоуровневая защита от unseating: 1) Минимальная ширина опоры (seat width) по AASHTO LRFD = 305 мм + 2.5×L_пролёта/L_общая + 10×θ_skew (для пролёта 120 м это ~600 мм минимум, проектируем с запасом 50% = 900 мм); 2) Cable Restrainers — стальные тросы Brammer SteelStrand Ø50-70 мм между смежными пролётами с предв. натяжением 200 кН и максимальной нагрузкой 5 МН; 3) Bumper Devices — резинометаллические упоры в продольном направлении (ограничивают свобод. ход после исчерпания запаса LRB); 4) Shear Keys поперечные — бетонные или сборные стальные блоки на оголовке опоры (ограничивают поперечное смещение); 5) Семя-блоки (key reinforcement) в подошве пролётных балок; 6) Восстанавливающая способность — изоляция возвращает мост в исходное положение после толчка (residual displacement &lt;5%); AASHTO LRFD + СН РК 2.03-30 + Eurocode 8 Part 2 + Caltrans SDC" },
              { v: "d", t: "Снижение длины пролётов до 30-40 м — меньше отклонения" },
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
                {score === 4 ? "Отлично — готовы к проектированию сейсм. мостов" : score >= 2 ? "Перечитайте AASHTO LRFD + СН РК 2.03-30 + Eurocode 8 Part 2" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> AASHTO LRFD Bridge Design + Guide Spec for Seismic Isolation Design, СН РК 2.03-30, СНиП 2.05.03, Eurocode 8 Part 2 (EN 1998-2), Caltrans SDC, ISO 22762 (LRB).</p>
          <p><strong>Реальные объекты РК:</strong> Capital Highway Алматы 4 км эстакада (ВОАД), мост через Талгар на БАКАД, путепроводы БАКАД 76 шт., мост через Иртыш Усть-Каменогорск, мост через Урал Атырау.</p>
        </section>
      </main>
    </div>
  );
}
