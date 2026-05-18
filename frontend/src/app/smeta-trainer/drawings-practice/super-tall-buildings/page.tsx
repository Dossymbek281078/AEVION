"use client";
import Link from "next/link";
import { useState } from "react";

export default function SuperTallBuildingsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 320) <= 30;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 280_000_000_000) <= 28_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Сверхвысотные здания</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏙️ Сверхвысотные здания (200+ м)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #228. Сверхвысотные здания РК: Esentai Tower Алматы (168 м, 37 эт.,
            BBR/HOK), Astana Tower (Northern Lights) 165 м, Abu Dhabi Plaza Астана —
            планируемая 320 м (88 эт., RHWL Architects, в стадии возобновления стройки).
            Системы: Outrigger + Belt Truss, мегаколонны Ø1500-2500 мм с бетоном C70-C100,
            ядро жёсткости с переставной опалубкой PERI ACS, маятниковый демпфер
            TMD 500-1000 т, СН РК 2.03-30, ASCE 7-22, СТ EN 1993-1-1, CTBUH.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Конструктивные системы 200+ м</h2>
          <p className="text-slate-300 leading-relaxed">
            CTBUH Tall Buildings Classification:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Tube-in-Tube:</strong> внешняя стальная/ж/б труба + центральное ядро (WTC оригинал, 415 м).</li>
            <li><strong>Bundled Tube:</strong> связка 9 труб (Sears/Willis Tower Чикаго 442 м).</li>
            <li><strong>Outrigger + Belt Truss:</strong> мегаколонны по периметру + ядро + горизонт. фермы на технич. этажах через каждые 20-30 этажей (Taipei 101 509 м, Petronas Twin Towers 452 м).</li>
            <li><strong>Diagrid:</strong> диагональная решётка периметра (Hearst Tower NY, Gherkin London — 200 м).</li>
            <li><strong>Buttressed Core:</strong> Y-форма с тремя крыльями-контрфорсами (Burj Khalifa 828 м, Дубай).</li>
            <li>Ядро жёсткости — обычно ж/б 600-1200 мм толщ. стен, лифтовые шахты + лестницы + санузлы внутри.</li>
            <li>Бетон высокой прочности C70-C100 (HPC) с микрокремнезёмом + суперпластификаторами + полипропилен. фиброй (защита от спалинга при пожаре).</li>
            <li>Стальные элементы Q460 (предел текучести 460 МПа) или S690QL.</li>
            <li>Композитные колонны (сталь+бетон): несущая способность 50-150 МН на одну колонну.</li>
            <li>Технические этажи через каждые 15-30 этажей (АХУ, насосные, лифтовые редукторы, ВРУ).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструктив для 88-этажного</h2>
          <p className="text-slate-300">
            Abu Dhabi Plaza Астана 320 м, 88 этажей, в зоне 6-7 баллов MSK-64.
            Какая конструктивная система?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычный монолитный ж/б каркас с колоннами 8×8 м, бетон B30 — этого хватит" },
              { v: "b", t: "Простая Tube-in-Tube без outrigger — лишняя жёсткость не нужна" },
              { v: "c", t: "Стальной каркас без бетонного ядра — снизит вес" },
              { v: "d", t: "Outrigger + Belt Truss + Buttressed Core: ж/б ядро жёсткости толщ. 1000-1200 мм с бетоном C80 (форма треугольная Y-style для увеличения момента сопротивления), 8 мегаколонн периметра Ø2000 мм композит сталь+C100 (несущая способность 100 МН/колонна), горизонтальные стальные фермы Q460 на 3 технических уровнях (этажи 30, 55, 80) — соединяют ядро с мегаколоннами на эффективные «рычаги», диаф. жёсткости на каждом 10-м этаже, маятниковый демпфер TMD 500 т на 88-м этаже для аэродинамической устойчивости (зимние ветра до 35 м/с), фундамент — плитно-свайный с буронабивными сваями Ø1.5 м L=60 м (отказ в скальный грунт), всего 320 свай, расчёт BIM+CFD ветровая аэродин. модель в Niigata Wind Tunnel + RWDI Toronto, СН РК 2.03-30 + ASCE 7-22 + ACI 318 + CTBUH" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Количество свай</h2>
          <p className="text-slate-300">
            Здание 88 этажей, вес ~600 000 т (с временной нагрузкой). Геология Астаны
            (несущий скальный слой на h=42 м). Свая буронабивная Ø1.5 м L=60 м,
            несущая способность 25 МН (с учётом коэф. безопасности 2.5).
            Сколько свай нужно (с учётом резерв. и периметра)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N_свая = M × g / Q_свая<br />
            +25% резерв на момент опрокидывающий ветра/сейсм. + конструктив (под мегаколоннами свой блок)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во свай"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 600_000 × 9.81 / 1000 = 5886 МН вертикально. /25 МН = 236 свай. +25% запас = 295 свай. +дополнительно по 5-8 свай под каждую из 8 мегаколонн (40-50) = ~320 шт.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет 320 м башни</h2>
          <p className="text-slate-300">
            ССЦ + импорт: котлован H=18 м + ограждающая стена «в грунте» Ø10 м секций — 28 млрд тг,
            плитно-свайный фундамент: 320 свай Ø1.5 м L=60 м + ростверк 4 м толщ. — 48 млрд тг,
            монолитное ядро 88 эт. (C80, переставная опалубка PERI ACS) — 38 млрд тг,
            8 мегаколонн композит Ø2000 мм 320 м + перекрытия — 36 млрд тг,
            стальные outrigger-фермы Q460 на 3 техн. этажах — 18 млрд тг,
            TMD маятник 500 т + амортизация — 4 млрд тг,
            фасад навесной алюминий-стекло Schueco/Reynaers 75 000 м² с UV+IR-защитой — 22 млрд тг,
            лифты 24 шт. Kone UltraRope (двойные кабины double-deck для верхних) — 18 млрд тг,
            HVAC прецизионный (зональный VRF + чиллеры 30 МВт) — 24 млрд тг,
            электрика + ИБП + ДГУ 8 МВт резерв — 14 млрд тг,
            СОУЭ + пожаротушение спринклер + газ ECARO 25 для серверных — 12 млрд тг,
            отделка premium 70 000 м² (офис + 5★ отель верхние этажи) — 14 млрд тг,
            благоустройство + 4-уровневая парковка 1500 м/мест — 4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~280 млрд тг (допуск ±10%). 28+48+38+36+18+4+22+18+24+14+12+14+4 = 280 млрд тг. Реальная Abu Dhabi Plaza по сметам Aabar (инвестор) — ~$1.5 млрд ≈ 700 млрд тг (с инфраструктурой + интерьер). Только башня А — ~280 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Эвакуация при пожаре</h2>
          <p className="text-slate-300">
            Здание 88 этажей категории Ф1.2/Ф4.3. Время эвакуации пешком с верхних
            этажей ~30 мин. Какие требования по СН РК 2.02-15 + IBC?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только лестничные клетки + сирены — стандарт для общественных зданий" },
              { v: "b", t: "Достаточно одной лестницы и большого числа лифтов" },
              { v: "c", t: "Многоуровневая защита: 1) 3-4 независимые лестничные клетки Н1 типа (с подпором +50 Па, на каждые 10-15 этажей перепад давления для борьбы со stack-эффектом); 2) Refuge floors (этажи-убежища) каждые 25-30 этажей с автономной вентиляцией +HEPA, площадь 0.3 м²/чел, противопожарные перегородки REI180, прямая связь с пожарной службой; 3) Пожарные лифты (firefighter lifts) FUR с двойным контуром питания + батареи 2 ч автономии, доступ только пожарных через ключ; 4) Sky lobby — этажи пересадки на «локальные» и «экспресс» лифты, играющие роль зон сбора; 5) Pressurization системы для лест. клеток и refuge floors; 6) Спринклер во всех помещениях + ECARO 25 в серверных; 7) Раннее обнаружение VESDA Aspiration Smoke Detection; 8) АСУПС с речевым оповещением на 3 языках; 9) Эвакуац. план с лифтами для маломобильных (LULA) и горизонтальной эвакуацией через refuge; СН РК 2.02-15 + IBC 2024 + NFPA 101 + CTBUH" },
              { v: "d", t: "Лифты для эвакуации запрещены — только лестницы" },
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
                {score === 4 ? "Отлично — готовы к проектированию сверхвысотного здания" : score >= 2 ? "Перечитайте СН РК 2.03-30 + ASCE 7-22 + CTBUH" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 2.03-30, ASCE 7-22, ACI 318 (Concrete Buildings), AISC 360/341 (Steel), Eurocode 1+8, IBC 2024, NFPA 101, CTBUH Tall Buildings Guidelines.</p>
          <p><strong>Реальные объекты РК:</strong> Esentai Tower Алматы (168 м, BBR/HOK), Astana Tower 165 м, Abu Dhabi Plaza Астана (320 м планируется), Триумф Астаны 145 м, бизнес-центр Capital Towers 200 м (проект).</p>
        </section>
      </main>
    </div>
  );
}
