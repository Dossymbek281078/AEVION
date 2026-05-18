"use client";
import Link from "next/link";
import { useState } from "react";

export default function KindergartenDetsadPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1850) <= 180;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 1_600_000_000) <= 160_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Детские сады (ДДУ)</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🧸 Детские сады и ДДУ (детские дошкольные учреждения)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #257. Детские сады РК: типовой проект ПДОП Алматинская обл. на 150 мест
            (6 групп × 25 детей), Детский сад ясельного типа «Балапан» (с 2 лет),
            «Бөбек Бесігі» программы Минпросвещ. РК. Групповые комнаты 50 м²/группа,
            спальни 4 м²/реб, столовая, физкультурный + музыкальный залы, прогулочные
            площадки с теневыми навесами + игровое оборудование KOMPAN. СанПиН РК
            4.01-010 «Санитарно-эпид. требования к организациям дошкольного образования»,
            СП РК 3.02-04, освещение 300 лк по СНиП 23-05-95.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ДДУ на 150 мест</h2>
          <p className="text-slate-300 leading-relaxed">
            СП РК 3.02-04 + СанПиН РК 4.01-010:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Групповая ячейка (на каждые 25 детей одной возрастной группы): раздевалка 18 м², игровая 50 м², спальня 50 м², туалет 16 м², буфетная 4 м².</li>
            <li>Возрастные группы: ясли 2-3 года (площадь меньше + кроватки manége), младшая 3-4, средняя 4-5, старшая 5-6, подготовительная 6-7.</li>
            <li>Физкультурный зал: 75-100 м² (1.0-1.5 м²/реб), потолок 4-5 м, спортинвентарь.</li>
            <li>Музыкальный зал: 50-80 м², фортепиано, акустическая обработка.</li>
            <li>Медблок: кабинет врача 12 м², процедурная 8 м², изолятор на 2 кроватки 12 м².</li>
            <li>Пищеблок: кухня варочный цех 35 м² + загрузочн.+ заготовочн. + моечная посуды (раздельные «грязная»/«чистая» зоны).</li>
            <li>Прачечная и сушилка (для постельного белья и униформы).</li>
            <li>Административный блок: заведующая, методист, бухгалтерия, ст. воспитатель.</li>
            <li>Прогулочные площадки 150 м²/группа = 900 м² для 6 групп, теневые навесы, песочницы, игровое оборудование KOMPAN, прорезиновое покрытие из крошки EPDM.</li>
            <li>Спортивная площадка общая (футбол + полоса препятствий) — 200 м².</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Прогулочные площадки</h2>
          <p className="text-slate-300">
            ДДУ на 150 мест (6 групп). Какие требования к прогулочным площадкам по
            СанПиН РК 4.01-010 + ASTM F1487 / EN 1176 (игровое оборудование)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Один общий двор на всех с центральной горкой" },
              { v: "b", t: "Площадки разделены живыми изгородями без специф. покрытия" },
              { v: "c", t: "Раздельные площадки 100 м²/группа = 600 м² без navesov" },
              { v: "d", t: "Многозональные прогулочные площадки с защитой и безопасностью: 1) Индивидуальная площадка на каждую группу 150 м² (норма СанПиН 7 м²/ребёнка × 25 детей × 1.2 коэф. = 210, минимум 100-150 м²); 2) Разделение между группами живыми изгородями высотой ≥1.5 м (избежание перекрёстного заражения детских инфекций); 3) Теневые навесы (Pergolas) 30-40 м² на группу с поликарбонатным кровельным покрытием Tronyan UV-protected (защита от ультрафиолета и осадков); 4) Защитное прорезиновое покрытие из крошки EPDM толщ. 40-50 мм Tetra Sport (для высоты падения с горки ≤2 м), сертификация EN 1177 (Impact Absorbing Surfaces); 5) Игровое оборудование KOMPAN Galaxy/MoMo сертифицированное EN 1176 (с возрастной маркировкой 2-3, 3-6, 6-12 лет), металлические части horizon-cycle тестированы 100 000 циклов; 6) Песочница 4×4 м с песком кварцевым крупн. фракции (для защиты от грязи + чистка раз в год), крышка-тент от животных и осадков; 7) Травяная площадка 30-50% общ. площади (для босоного хождения); 8) Спортивная зона: полоса препятствий KOMPAN Junior + турник + лазалка с высотой падения ≤1.2 м (нижнее ограничение для ясли-сада); 9) Освещение площадок (для зимы) 60-100 лк + камеры наблюдения; 10) Ограждение по периметру H=1.5 м (металлическая сетка ПВХ-покрытие, антитравматич. закруглённые элементы); 11) Регулярный осмотр оборудования и сертификации каждые 12 мес EN 1176-7; СанПиН РК 4.01-010 + СП РК 3.02-04 + EN 1176/1177 + ASTM F1487" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Общая площадь ДДУ</h2>
          <p className="text-slate-300">
            Детский сад 150 мест (6 групп × 25 детей). Норматив СП РК 3.02-04:
            12-14 м²/реб общей площади (групповая + спальня + столовая + админ +
            коридоры + санузлы + технические). Сколько м² нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S = N × норматив; S_общ = S_осн × 1.2 (с инфра/коридорами)<br />
            +30% технические + лестницы<br />
            +20% прогулочные площадки и спорт-зона снаружи (для расчёта застройки)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 150 × 12.5 = 1875 м² ≈ 1850 м². Типовой ДДУ 150 мест занимает 1800-2000 м² застройки + 1000-1500 м² прогулочные площадки и спорт-зона = земельный участок ~3000-3500 м² (0.3-0.35 га). Реально: типовой проект Минпросвещ. РК ПДОП-150 — 1900 м² + 1100 м² двор = 0.3 га.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ДДУ 150 мест</h2>
          <p className="text-slate-300">
            ССЦ + спец. оборудование: монолит каркас + перекрытия 1850 м² 2-этажн. — 360 млн тг,
            фасад НВФ + кровля + витражи — 140 млн тг,
            отделка групповых + спален + залов с антибакт. покрытиями — 220 млн тг,
            кухня-пищеблок с проф. оборудованием Электролюкс — 120 млн тг,
            мебель детская KOMPAN/IKEA + кровати + столы — 80 млн тг,
            физкультурный зал + музыкальный (фортепиано + акустика) — 60 млн тг,
            медблок (кабинет + изолятор + процедурная) — 38 млн тг,
            прачечная + котельная мини + ИТП — 65 млн тг,
            HVAC бесшумная + вентиляция кратность 1.5-2 1/час — 95 млн тг,
            СОУЭ + СОТ + СКУД биометрия родителей + противопожарная — 80 млн тг,
            прогулочные площадки 6 шт × 150 м² + EPDM покрытие + KOMPAN — 110 млн тг,
            спорт-площадка + ограждение периметра + ландшафт — 65 млн тг,
            ИТ-инфра + СКС + интерактивные доски в группах — 38 млн тг,
            энергоснабжение ТП + резерв + UPS — 45 млн тг,
            проектирование + изыскания + Минпросвещ. экспертиза — 84 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~1.6 млрд тг (допуск ±10%). 360+140+220+120+80+60+38+65+95+80+110+65+38+45+84 = 1600 млн тг = 1.6 млрд тг. Удельная стоимость ~860 тыс. тг/м² или ~10.7 млн тг/место — соответствует типовым проектам ПДОП-150 Минпросвещения РК 2026.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность детей</h2>
          <p className="text-slate-300">
            Дети 2-7 лет особенно уязвимы. Что обязательно для пассивной защиты по
            СанПиН РК + ISO 14688?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только тревожная кнопка у воспитателей" },
              { v: "b", t: "Только круглосуточная охрана на КПП" },
              { v: "c", t: "Multi-layer Child Safety по СанПиН РК 4.01-010 + ISO 14688 + EN 71: 1) Лестницы с двойными перилами H=600 мм + 900 мм (для детей и взрослых), ступени с противоскольз. накладками, проёмы между балясинами ≤100 мм (предотвращ. застревания головы); 2) Углы мебели + дверей закругл. R=10-20 мм или защитные мягкие накладки; 3) Окна с ограничителями открывания ≤100 мм (блокираторы Securistyle на ручках) — невозможность выпадения; 4) Розетки 220 В с защитными шторками или установка на h≥1.6 м; 5) Двери с медленным закрыванием (Hold-Open arms Geze + soft-close) — защита от прищемлений; 6) Антибакт. покрытия мебели Microban + полы Forbo Marmoleum (биодинамичный); 7) Пожбез: 2 эвакуац. выхода из каждой групповой, тренировки эвакуации с детьми 4 раза/год, СОУЭ 3-го типа речевая; 8) Контроль доступа: домофоны на входе в группу + биометрия родителей при заборе детей, видеонаблюдение во всех общих зонах (с возможностью просмотра родителей через app); 9) Безопасные краски Sherwin-Williams Harmony Zero-VOC (без свинца и формальдегида, без испарения опасных газов); 10) Стекло триплекс (Laminated) в окнах и дверных проёмах детских зон (не разбивается на острые осколки); 11) Игрушки EN 71 сертифицированные (без свинца, фталатов, кадмия); 12) Регулярный аудит безопасности 2 раза/год + после ремонтов; СанПиН РК 4.01-010 + ISO 14688 + EN 71 + EN 1176/1177" },
              { v: "d", t: "Только ограждение периметра выше 2 м" },
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
                {score === 4 ? "Отлично — готовы к проектированию ДДУ" : score >= 2 ? "Перечитайте СП РК 3.02-04 + СанПиН 4.01-010 + EN 1176" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 3.02-04 (Учебные здания), СанПиН РК 4.01-010 (Дошкольные), EN 1176/1177 (Playground), ASTM F1487, EN 71 (Toys Safety), СНиП 23-05-95 (Освещение).</p>
          <p><strong>Реальные объекты РК:</strong> Типовой проект ПДОП-150 Алматинская обл., ДДУ «Балапан» (с 2 лет), сетевые «Бөбек Бесігі», «Маленький Прин» (премиум Алматы, 12 групп × 20 детей).</p>
        </section>
      </main>
    </div>
  );
}
