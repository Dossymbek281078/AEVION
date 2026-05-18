"use client";
import Link from "next/link";
import { useState } from "react";

export default function SpaceLaunchFacilityPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 12500) <= 1200;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 380_000_000_000) <= 38_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Космодромы и стартовые комплексы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚀 Космодромы и стартовые комплексы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #233. Космодром Байконур (Кызылординская обл., аренда России до 2050 г.,
            17 стартовых комплексов — Союз/Зенит/Протон, площадка №1 «Гагаринский старт»),
            планируемый Российско-Казахский стартовый комплекс «Байтерек» (для ракет Союз-5).
            Стартовые столы (Launch Pad), башня обслуживания подвижная Mobile Service Tower
            50 м, кабельная мачта, опасная зона 5 км по периметру, бункер ЛКЗ 6 м ж/б,
            водяная система гашения акустики (флейм-трен на старте). Russian Roscosmos
            Standards РД-13, NASA NPR 8715.7, СН РК 4.04.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав стартового комплекса</h2>
          <p className="text-slate-300 leading-relaxed">
            Roscosmos РД-13 + NASA NPR 8715.7:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Launch Pad (стартовый стол):</strong> ж/б фундамент с газоходом «flame trench» — отвод раскалённых газов реактивной струи (для Союза: глубина 30 м, ширина 12 м, бетон B60 жаростойкий с шамотной футеровкой).</li>
            <li><strong>Mobile Service Tower (башня обслуживания):</strong> стальная ферма 50-100 м, перемещается по рельсам на колёсах от ракеты в день старта (T-1 час).</li>
            <li><strong>Кабельная мачта (Umbilical Tower):</strong> подвод электричества, топлива, газов и связи к ракете до старта.</li>
            <li><strong>Топливохранилище:</strong> резервуары для керосина (РГ-1), жидкого кислорода LOX (−183°C), водорода LH2 (−253°C, для Протона). Удаление 600-1000 м от старта.</li>
            <li><strong>Бункер ЛКЗ (Launch Control Center):</strong> ж/б монолит h_стен=6 м, защита от взрыва 1500 т ТТ (Тротиловый Эквивалент), удаление 2-3 км.</li>
            <li><strong>Sound Suppression System:</strong> водяная система гашения акустики — 1.1 млн литров воды за 40 сек на старте (защита ракеты от собственного шума 200 дБ).</li>
            <li><strong>Опасная зона:</strong> радиус 5 км от старта (зона разрушений при катастрофе), внутри только бункеры/датчики.</li>
            <li><strong>Молниезащита:</strong> 4 стержневых молниеотвода H=120 м по углам стартового стола, заземление R≤0.5 Ом.</li>
            <li><strong>Газоразрядники и водородоочистка:</strong> для предотвращения накопления взрывоопасных смесей.</li>
            <li><strong>Дороги и ж/д:</strong> подъездная ж/д на старт + автодорога к МИК (монтажно-испытат. корпус 12 км от старта).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Газоход (Flame Trench)</h2>
          <p className="text-slate-300">
            Стартовый стол для ракеты Союз-2.1а (стартовая тяга 4×РД-107А = 4 МН) или Союз-5
            (тяга 1×РД-171МВ = 7.4 МН). Какая конструкция газохода?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Прямой канал глубиной 5 м в обычном бетоне — экономично" },
              { v: "b", t: "Вертикальная труба отвода вверх — газы уходят в атмосферу" },
              { v: "c", t: "U-образный канал без специального покрытия" },
              { v: "d", t: "Flame trench V-образного сечения: глубина 30 м, ширина горловины 12 м, длина 80 м, отклоняющая стенка под 30° от вертикали для перенаправления газовой струи в горизонталь и далее наружу через 2 рукава. Конструкция: монолит ж/б B60 (с микрокремнезёмом и стальной фиброй 60 кг/м³), толщина стен 1.5-2 м с дополнит. шамотной футеровкой (огнеупорный бетон ШБ 150 мм + Magnesite Castable, выдержка T=2500°C мгновенная), охлаждение водяным дождевым каскадом 1.1 млн л в первые 40 сек после зажигания, газоход рассчитан на ударную волну до 2 кПа от выбросов несгоревшего топлива при аварии, защита датчиков IP69 + промывные форсунки для удаления нагара, инспекция газохода после каждого старта — Roscosmos РД-13 + NASA Engineering and Safety Center (NESC)" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём ж/б стартового стола</h2>
          <p className="text-slate-300">
            Стартовый стол с газоходом: фундамент 80×60×3 м монолит, плюс
            газоход V-образного сечения (глубина 30 м, ширина 12 м, длина 80 м,
            толщина стен 2 м, шамотная футеровка 150 мм). Какой суммарный объём
            ж/б B60 (без шамота, м³)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_фундамент = 80×60×3<br />
            V_газоход = (стены 2 шт + дно + отклоняющая стенка) — расчёт по площадям × толщ.<br />
            +10% узлы крепления, анкеры, проёмы для коммуникаций
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V_бетона, м³"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V_фунд = 80×60×3 = 14 400 м³. Стенки газохода: 2×(80×30) × 2 м толщ. = 9600 м³. Дно газохода 80×12×2 = 1920 м³. Отклоняющая стенка ~600 м³. Итого без +10% = ~26 500 м³, минус полости/проёмы (~50%) → реальный ж/б B60 для интенсивной арматуры = ~12 500 м³.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет стартового комплекса</h2>
          <p className="text-slate-300">
            «Байтерек» — российско-казахстанский стартовый для Союз-5. ССЦ + импорт:
            земляные работы 80 га (планировка, защитные дамбы) — 18 млрд тг,
            стартовый стол с газоходом (~12 500 м³ B60 + шамот) — 48 млрд тг,
            башня обслуживания MST стальная 60 м перемещаемая — 32 млрд тг,
            кабельная мачта 45 м + системы подачи топлива/газов — 18 млрд тг,
            топливохранилище керосин РГ-1 (12 РВС × 5000 м³) + ЛОХ-LOX резервуары крио — 38 млрд тг,
            подземный криогенный комплекс LOX/LN2 с производством — 42 млрд тг,
            бункер ЛКЗ ж/б монолит 30×40 м H=15 м со стенами 6 м B40 — 28 млрд тг,
            sound suppression water deluge система 1.1 млн л — 14 млрд тг,
            молниезащита 4 мачты H=120 м + заземление сетка 200×200 м — 8 млрд тг,
            ж/д подъездная 15 км + автодорога Кат. II 25 км — 22 млрд тг,
            МИК (монтажно-испытательный корпус) 12 000 м² с 50-тонным мостовым краном — 38 млрд тг,
            электростанция автономная 50 МВт + резерв ДГУ 20 МВт — 32 млрд тг,
            СУДС РЛС телеметрия + диспетчер. центр + связь — 18 млрд тг,
            проектирование + ТЭО + ОВОС + лицензии Roscosmos/КазКосмос — 24 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~380 млрд тг (допуск ±10%). 18+48+32+18+38+42+28+14+8+22+38+32+18+24 = 380 млрд тг. Реальный «Байтерек» (с инфраструктурой) оценочно $1-1.5 млрд ≈ 470-700 млрд тг (по соглашению РФ-РК 2023). Стартовый комплекс — ~$0.8 млрд ≈ 380 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Аварийная безопасность</h2>
          <p className="text-slate-300">
            Ракета Союз-5 везёт 410 т топлива (керосин + LOX). При катастрофическом отказе
            на старте взрыв эквивалентен 1500 т ТНТ. Что обязательно по NASA NPR 8715.7?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно сирен и эвакуации персонала за 5 минут" },
              { v: "b", t: "Только бункер ЛКЗ + защитный спутник наблюдения" },
              { v: "c", t: "Многоуровневая система безопасности: 1) Безопасная зона 5 км по периметру старта (запрет на постоянное пребывание, охранный периметр с радарным наблюдением и БПЛА-патрулями); 2) Бункер Launch Control Center на расстоянии 2-3 км от старта — ж/б монолит стены H=6 м B40 с двойной арматурой, потолок 4 м, EMP-защита (металлический клетка Фарадея), автономное жизнеобеспечение на 72 ч, два независимых выхода через шлюзы; 3) Aborted Launch System на ракете — твердотопливные пороховые ускорители для отделения капсулы с экипажем (для пилотируемых стартов); 4) Range Safety Officer (RSO) с правом самостоятельного дистанционного подрыва ракеты при отклонении от траектории (Flight Termination System FTS); 5) Эвакуационная капсула для персонала башни — закрытая бронированная капсула с тормозными системами вниз по канату 200 м/мин (как на Шаттлах); 6) Бункеры наблюдения зашиты радиоэлектроники + блочные защитные стены B100 толщиной 2 м; 7) Зенитные радары с предупреждением о подходящих самолётах/спутниках мусора; 8) Hydrogen Detection Sensor сеть в радиусе 1 км для предотвращения накопления взрывоопасных смесей; 9) Тренировки персонала с симуляцией аварий 4 раза в год; NASA NPR 8715.7 + Roscosmos РД-50 + ESA Safety Standards" },
              { v: "d", t: "Только мониторинг датчиков давления и температуры" },
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
                {score === 4 ? "Отлично — готовы к проектированию стартового комплекса" : score >= 2 ? "Перечитайте Roscosmos РД-13 + NASA NPR 8715.7" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> Roscosmos РД-13 (Безопасность стартов), NASA NPR 8715.7 (Range Safety), ESA Safety Standards ECSS, СН РК 4.04, ISO 17666 (Space Safety).</p>
          <p><strong>Реальные объекты РК:</strong> Байконур (17 стартовых комплексов, аренда РФ до 2050), Площадка №1 «Гагаринский старт», Площадка №110 (Энергия-Буран, законсервирована), планируемый «Байтерек» для Союз-5 (2026-2030).</p>
        </section>
      </main>
    </div>
  );
}
