"use client";
import Link from "next/link";
import { useState } from "react";

export default function WindSolarFarmsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 91) <= 8;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 78_000_000_000) <= 7_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · ВЭС и СЭС (ВИЭ)</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌬️ Ветровые и солнечные электростанции (ВИЭ)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #217. Возобновляемые источники энергии РК: ВЭС Жанатас 100 МВт
            (Жамбылская обл.), ВЭС Кордайская 21 МВт, ВЭС Ерейментау 45 МВт,
            СЭС Бурное 100 МВт (Жамбылская), СЭС Сарань 50 МВт (Карагандинская),
            СЭС Капшагай 1 МВт (исследовательская). Башни Vestas V150/V162 H=120-150 м,
            фотомодули JinkoSolar Tiger Neo 550 Вт, трекеры NEXTracker NX Horizon.
            ПУЭ глава 7.7 (ветроустановки), СН РК 4.04, FIDIC EPC контракты.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ветроэлектростанции</h2>
          <p className="text-slate-300 leading-relaxed">
            ВЭС 100 МВт (20 турбин × 5 МВт V150) занимает 30-40 км²:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Ветрогенератор: гондола (~70 т) на башне 120 м, ротор Ø150 м, лопасти GRP 73 м/шт.</li>
            <li>Фундамент: ж/б плита Ø22 м H=3.5 м, объём 350-450 м³ бетона В40, армир. 35-50 т ст.А-III.</li>
            <li>Внутрипл. дороги Кат. III (ширина 6 м, радиусы кривых R≥120 м для перевозки лопасти).</li>
            <li>Кабельная сеть 33 кВ (XLPE кабели в траншеях, кольцевая топология «daisy chain»).</li>
            <li>Подстанция ПС 33/110 кВ для выдачи в общую сеть (трансформатор 100 МВА).</li>
            <li>Высоковольтный кабель 110-220 кВ до точки присоединения KEGOC (часто 20-50 км).</li>
            <li>SCADA-система мониторинга и управления (Vestas / GE / Siemens Gamesa).</li>
            <li>Эксплуатационный корпус (О&М, склад запчастей, кран для гондолы).</li>
            <li>Метеостанция (на ветроизмерительной мачте H≥80 м перед строительством).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Фундамент ветроустановки</h2>
          <p className="text-slate-300">
            Турбина Vestas V150-5.6 МВт, башня 120 м. Грунт — суглинок плотный (R=300 кПа).
            Какое решение по фундаменту по СН РК 5.01-01 и API RP 2A?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Свайный из 6 свай Ø1 м L=30 м — экономично" },
              { v: "b", t: "Ленточный мелкозаглубл. — для лёгких турбин достаточно" },
              { v: "c", t: "Плитный 12×12×2 м без анкерного устройства — стандарт для средних" },
              { v: "d", t: "Гравитационный круглый фундамент Ø22 м, H_заглуб=3.5 м, плита ж/б B40 толщиной 1.0-3.5 м (с переменным сечением — толще к центру), общий объём 400-500 м³ бетона + 40-55 т арматуры А-III/А-IV, анкерная клетка 144 анкерных болта M64 8.8 в кольце Ø5 м, переходная вставка башни, заземление сетка 30×30 м (R≤1 Ом), расчёт на опрокидывающий момент 80 МН·м от ветра при 50 м/с, СН РК 5.01-01, ГОСТ Р 54418, IEC 61400-1" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь СЭС 50 МВт</h2>
          <p className="text-slate-300">
            СЭС Сарань 50 МВт, фотомодули JinkoSolar 550 Вт (площадь 2.6 м² на модуль).
            Учётный коэффициент использования площади (с учётом трекеров, межрядных
            расстояний для исключения затенения) = 1:3.
            Какая площадь нужна (га)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N_модулей = P_DC / P_модуль (с учётом overpanel ratio 1.3, DC/AC)<br />
            S_общ = N × S_модуль × коэф. использования
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, га"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: P_DC = 50×1.3 = 65 МВт DC; N = 65_000_000 / 550 ≈ 118_000 модулей; S_панелей = 118_000×2.6 ≈ 307 000 м²; S_общ = 307_000 × 3 = 921 000 м² ≈ 92 га. Для трекеров типично 1.5-2 га/МВт DC, для фикс. рядов 2.5-3 га/МВт.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ВЭС 100 МВт</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2 + импорт: 20 турбин Vestas V150-5.0 МВт (поставка + монтаж) — 38 млрд тг,
            фундаменты 20 шт × Ø22 м (бетон+арматура+анкерн.) — 5.4 млрд тг,
            внутрипл. дороги 60 км Кат. III + площадки крановые — 4.2 млрд тг,
            кабельная сеть 33 кВ 80 км (XLPE 240 мм², траншеи) — 3.8 млрд тг,
            ПС повышающая 33/110 кВ 110 МВА + ОПУ — 6.8 млрд тг,
            ЛЭП 110 кВ 35 км до KEGOC точки присоединения — 4.5 млрд тг,
            SCADA + метеомачта + ЭКБ + охрана периметра — 2.4 млрд тг,
            проектирование + лицензии + экспертиза + ПНР — 3.6 млрд тг,
            страхование + банковские гарантии EPC — 1.8 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~78 млрд тг (допуск ±10%). 38+5.4+4.2+3.8+6.8+4.5+2.4+3.6+1.8 = 70.5 млрд → + НР+СП ≈ 78 млрд тг (~780 млн тг/МВт = $1.7 млн/МВт — типично для onshore wind 2024-2026).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Молниезащита ВЭС</h2>
          <p className="text-slate-300">
            Лопасть Vestas длиной 73 м притягивает молнии (1-2 удара/год/турбину).
            Какая молниезащита по IEC 61400-24 / ПУЭ глава 7.7?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Один стержневой молниеотвод на гондоле H=2 м — этого достаточно" },
              { v: "b", t: "Достаточно заземления через башню без специальной защиты лопасти" },
              { v: "c", t: "Полная система LPS уровня I (защита 99% разрядов 200 кА): лопасть с интегрированным медным кабелем 50 мм² от кончика до корня + 3-5 рецепторов в углеродном волокне, токоотвод через ступицу к башне (кольцевые скользящие контакты с щётками графитовыми, ток до 100 кА) → металлическая башня как естественный молниеотвод (R≤4 Ом) → заземление 30×30 м сетка + 4 вертик. электрода L=10 м (R≤1 Ом), УЗИП для электроники (Type 1+2+3 SPD), мониторинг ударов через АПК Vestas, IEC 61400-24 + ПУЭ 7.7 + ГОСТ Р МЭК 62305" },
              { v: "d", t: "Грозоотвод по контуру парка не требуется — стандартное защ. устройство" },
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
                {score === 4 ? "Отлично — готовы к проектированию ВЭС/СЭС" : score >= 2 ? "Перечитайте ПУЭ 7.7, IEC 61400, СН РК 5.01-01" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ПУЭ глава 7.7 (Ветроустановки), IEC 61400-1/24 (Wind Turbines), СН РК 4.04, ГОСТ Р 54418, IEC 62305 (Lightning Protection), FIDIC Silver Book EPC.</p>
          <p><strong>Реальные объекты РК:</strong> ВЭС Жанатас 100 МВт (CPECC + Hyundai E&C), ВЭС Кордайская 21 МВт, ВЭС Ерейментау 45 МВт, СЭС Бурное 100 МВт, СЭС Сарань 50 МВт.</p>
        </section>
      </main>
    </div>
  );
}
