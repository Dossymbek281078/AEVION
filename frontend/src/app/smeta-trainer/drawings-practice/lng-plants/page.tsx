"use client";
import Link from "next/link";
import { useState } from "react";

export default function LngPlantsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 167000) <= 15000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 520_000_000_000) <= 50_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · СПГ-терминалы и сжижение</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🧊 СПГ-терминалы и установки сжижения</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #216. Проектирование и расчёт смет СПГ-объектов: терминалы регазификации
            (FSRU плавучие или onshore), установки сжижения природного газа (Mid-scale 1-3 млн т/год,
            small-scale 0.1-0.5 млн т/год). Криогенные резервуары полного сдерживания
            (Full Containment) Ø80 м H=42 м, T=−162°C. Теплоизоляция перлит/полиуретан,
            теплоприток ≤0.05%/сутки BOG. СНиП 2.05.13, EN 14620, NFPA 59A, API 625.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Схема СПГ-завода Mid-scale</h2>
          <p className="text-slate-300 leading-relaxed">
            Технология сжижения C3MR (Air Products) или DMR (Shell):
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Приём газа (P=6-8 МПа), сепарация и осушка от воды/H₂S/CO₂.</li>
            <li>Осушка цеолитом (точка росы &lt;−70°C) — обязательно перед криогенной.</li>
            <li>Удаление ртути на серном адсорбенте (Hg→HgS).</li>
            <li>Предохлаждение пропановой смесью до −33°C (C3MR ступень 1).</li>
            <li>Основное сжижение смешанным хладагентом MR (N₂/C1/C2/C3) до −162°C.</li>
            <li>Сепарация флэш-газа (BOG) и его рекомпрессия.</li>
            <li>Хранение в криогенных резервуарах Full Containment.</li>
            <li>Отгрузка: газовоз LNG carrier 150-180 тыс. м³ через эстакаду.</li>
            <li>Утилизация BOG (boil-off gas, ~0.05-0.15%/сут от V_резерв).</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Тип резервуара</h2>
          <p className="text-slate-300">
            Резервуар для хранения СПГ 180 000 м³ в порту регазификации.
            Какой тип конструкции по EN 14620 / API 625 безопаснее?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Single Containment: одна стенка низкоуглерод. стали, грунтовая обваловка снаружи" },
              { v: "b", t: "Double Containment: 2 стальные стенки, внешняя играет роль защитной" },
              { v: "c", t: "Full Containment 9% Ni-сталь + предв. напряж. ж/б наружный купол: внутренняя 9%Ni 30 мм (T=−162°C) + перлит + полиуретан, внешняя ж/б оболочка преднапряж. удерживает 100% объём при разгерметизации + защита от внешних воздействий (купол ракет, удары); самый дорогой, но обязательный по NFPA 59A для крупнотоннажных проектов и портовых терминалов" },
              { v: "d", t: "Membrane (мембранный): тонкая мембрана из инвара (36% Ni), наружный бетон. Дешевле, но не Full Containment" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём резервуара 180 000 м³</h2>
          <p className="text-slate-300">
            Резервуар Ø80 м (внутр.) с высотой стенки H=39 м. Купол сферический.
            Какой полезный объём СПГ (м³)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_полезн = π × R² × H_заполн − V_тех_объём<br />
            заполнение 85%, остаток 15% — для теплового расширения + BOG-камера
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Объём СПГ, м³"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: π × 40² × 39 × 0.85 = 167 000 м³ полезный (от номинального ~196 000 м³). Это эквивалент 80 000 т СПГ (плотность 0.42-0.46 т/м³).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет СПГ-завода 2 млн т/год</h2>
          <p className="text-slate-300">
            ССЦ + импорт: установка сжижения C3MR (Air Products) + основной хладагент — 165 млрд тг,
            2 криогенных резервуара 100 000 м³ Full Containment — 95 млрд тг,
            эстакада отгрузки газовозов + причал глубоководный 14 м — 78 млрд тг,
            компрессорная BOG + утилизация хладагента — 42 млрд тг,
            электростанция собств. + аварийные ДГУ — 38 млрд тг, факельная высокого/низкого давления — 28 млрд тг,
            водозабор + опреснение + противопожарная вода + ESD-система — 32 млрд тг,
            ОЗХ + АБК + лаборатория + охрана — 42 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~520 млрд тг (допуск ±10%). 165+95+78+42+38+28+32+42 = 520 млрд тг. Глобально удельная капёмкость СПГ ~$1500-3000/т, для 2 млн т/год = $3-6 млрд (1.4-2.8 трлн тг).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — ESD и пожарная безопасность</h2>
          <p className="text-slate-300">
            Аварийная остановка завода СПГ (ESD — Emergency Shutdown). Что обязательно по NFPA 59A?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно одной кнопки общей остановки на пульте оператора" },
              { v: "b", t: "Только сирена + датчики газа без автоматической остановки" },
              { v: "c", t: "ESD только для криокамеры, без остановки технологии" },
              { v: "d", t: "Иерархия ESD-уровней 1/2/3 (от частичной остановки секции до полного блэкаута), детектор газа CH₄/H₂S по периметру каждые 10-15 м (порог 20%/40%/60% НКПВ), детекторы пламени F&G (УФ+ИК), 4-х уровневая защита: сепаратор → блокировка → ESD-1 → блэкаут с депрессуризацией. Каждый ESD-сценарий моделируется в HAZOP/SIL. Класс безопасности SIL-3 (PFD=10⁻³−10⁻⁴), резервированные контроллеры Triconex/HIMA, аварийные клапаны Class V с пружинным возвратом, защитные стены H=15 м между секциями, противопожарная вода 1500 м³/ч × 2 ч, NFPA 59A + API 14C + IEC 61511" },
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
                {score === 4 ? "Отлично — готовы к проектированию СПГ-завода" : score >= 2 ? "Перечитайте EN 14620, NFPA 59A, API 625" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EN 14620 (LNG Tanks), NFPA 59A (LNG Production), API 625 (Tanks), IEC 61511 (SIL), CN РК 4.02-07, API 521 (Pressure Relief).</p>
          <p><strong>Реальные объекты:</strong> Atyrau LNG (проект КазМунайГаз — small-scale), Sabine Pass LNG (США), Yamal LNG (Россия), Qatargas, ADGAS Das Island.</p>
        </section>
      </main>
    </div>
  );
}
