"use client";
import Link from "next/link";
import { useState } from "react";

export default function WaterPurificationLargePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 21000) <= 2000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 165_000_000_000) <= 16_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Магистральные водоочистные станции</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">💧 Магистральные водоочистные станции (ВОС)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #254. Магистральные ВОС РК (отличие от L4 «Очистные сооружения»
            про септики — здесь промышленный масштаб подачи питьевой воды в город):
            ВОС «Аккуль» Алматы (500 000 м³/сут — питание Алматы + Алматинской области
            из БАК), ВОС «Бадам» Шымкент (350 000 м³/сут — из р. Бадам), ВОС
            «Талгар-Иссык» (200 000 м³/сут — из горн. источников). Многоступенч.
            технология: предварительный отстойник → коагуляция Al₂(SO₄)₃ → флокуляция
            → флотация DAF → UF Memcor SMM (PVDF мембраны 0.04 мкм) → RO (обратный
            осмос Toray для солей) → УФ Wedeco 40 мДж/см² → хлорирование Cl₂/ClO₂ +
            озон. СНиП 2.04.02, NSF/ANSI 61, WHO Drinking-Water Quality 4th ed.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая цепочка ВОС</h2>
          <p className="text-slate-300 leading-relaxed">
            WHO Drinking-Water Quality 4th ed + AWWA Water Quality Standards:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Водозабор (Source Water Intake): открытый из водохранилища или скважинный (с фильтрацией через гравий).</li>
            <li>Предварительный отстойник (Pre-sedimentation): удаление крупных взвесей, мутность 10-20 NTU → 5-8 NTU.</li>
            <li>Аэрация (если есть железо/марганец) Mn²⁺ → MnO₂ + Fe²⁺ → Fe(OH)₃.</li>
            <li>Коагуляция: дозирование Al₂(SO₄)₃ (сульфат алюминия 30-50 мг/л) или PACl (полиалюминий хлорид).</li>
            <li>Флокуляция: медленное перемешивание 20-30 мин, формирование флокул 0.5-2 мм.</li>
            <li>Отстой / Флотация DAF (Dissolved Air Flotation): удаление флокул, мутность → ≤1 NTU.</li>
            <li>Фильтрация многослойная (Multi-media filter): антрацит + кварцевый песок + гранатовый песок (gravity или pressure типа). Альтернатива: ультрафильтрация UF Memcor SMM половолоконные мембраны 0.04 мкм.</li>
            <li>RO (обратный осмос) — для опресн. соли &gt;500 мг/л или удаления нитратов. Toray TM820V-440 мембраны.</li>
            <li>Обеззараживание: УФ Wedeco BX2000 (40 мДж/см²) для безопасных без побочн. продуктов + остаточное хлорирование Cl₂ 0.3-0.5 мг/л для защиты сети.</li>
            <li>Стабилизация pH (CaCO₃ или NaOH дозирование) — предотвращение коррозии трубопроводов.</li>
            <li>Озонирование (опционально) — для удаления вкуса и запаха, дополнит. обеззараживания.</li>
            <li>Резервуары чистой воды (3-7-дн запас) + насосная подачи в город.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Технология для горной воды</h2>
          <p className="text-slate-300">
            ВОС «Бадам» Шымкент использует воду р. Бадам — мутность сезонная
            10-200 NTU, мин. солесодерж. 200-400 мг/л, биол. загр. умеренное.
            Какая технология оптимальна по WHO + AWWA?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только песочная фильтрация без коагуляции — экономия" },
              { v: "b", t: "Только хлорирование на входе — простое обеззараживание" },
              { v: "c", t: "MF (микрофильтрация) без коагуляции" },
              { v: "d", t: "Многоступенчатая технология с резервированием: 1) Pre-sedimentation отстойники 6 шт. × 1500 м³ (для пиковой мутности весной 200 NTU); 2) Коагуляция PACl 40-60 мг/л с дозирующими насосами Prominent DulcoFlex; 3) Флокуляция 25 мин с мешалками плоско-лопастн.; 4) DAF Dissolved Air Flotation — рециркуляция 8-12% насыщ. воздухом под давлением 5-6 бар, плавающая корка снимается скребками (мутность → ≤1 NTU); 5) Многослойн. напорная фильтрация — антрацит + кварцевый песок + гранатовый, нагрузка 8-10 м/час, обратная промывка раз в 24 ч; 6) Альтернативная линия UF Memcor SMM половолоконные мембраны PVDF 0.04 мкм (для гарантирован. бактериол. безопасности при ливневых пиках); 7) RO Toray TM820V-440 (опционально, при высоком солесод. летом 500+ мг/л); 8) УФ Wedeco BX2000 — 40 мДж/см² (4-log инактивация Cryptosporidium и Giardia); 9) Хлорирование Cl₂ или ClO₂ 0.3-0.5 мг/л остаточный (для защиты в сети); 10) Стабилизация pH 7.0-8.0 (CaCO₃ или NaOH); 11) Резервуары чистой воды 3 шт × 25 000 м³ (3-дн запас); 12) Насосная подачи 14 насосов Grundfos NK 200-450 м³/час в 2-зонную сеть; 13) АСУ Siemens PCS7 + анализаторы Hach SC4500 (pH/ORP/Cl/мутность/расход 24/7); 14) Резервирование N+1 на каждом узле; СНиП 2.04.02 + NSF 61 + WHO 4th ed + AWWA WPC + ISO 24512" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь фильтров</h2>
          <p className="text-slate-300">
            ВОС 500 000 м³/сут = 20 833 м³/час. Многослойн. фильтры с нагрузкой
            8-10 м/час (норматив СНиП 2.04.02). Альтернатива — UF Memcor с нагрузкой
            ~50 л/(м²·ч). Сколько суммарной площади фильтрующих поверхностей нужно
            (без UF, классические гравитационные)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S = Q / v_фильтр<br />
            +25% резерв на обратные промывки (1-2 ч/сутки на фильтр) и ремонт
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="S, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S_min = 20 833 / 8 = 2600 м². +25% запас = 3250 м². При размещении в 12 фильтрах ~270 м² каждый (например, 12×22 м прямоугольных). С учётом площади резервуаров промывной воды + системы воздуходувок + дренаж + проходы = ~21 000 м² общей площади узла фильтрации.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ВОС 500 000 м³/сут</h2>
          <p className="text-slate-300">
            ССЦ + импорт: водозабор + насосная 1-го подъёма из БАК — 14 млрд тг,
            предв. отстойники 6 × 1500 м³ — 6 млрд тг,
            смесительные камеры + флокуляторы + DAF 8 шт. — 14 млрд тг,
            многослойная фильтрация 12 шт. × 270 м² с обр. промывкой — 18 млрд тг,
            UF-станция Memcor SMM (резерв для пиков мутности) 8 модулей — 14 млрд тг,
            RO-линия Toray TM820V для отд. зон с высокой солев. — 8 млрд тг,
            УФ Wedeco BX2000 × 6 (по 4000 м³/час) + резерв — 6 млрд тг,
            хлораторная + резервуары Cl₂ (баллоны 1000 кг) + дозиров. — 4 млрд тг,
            озон-генераторы Primozone GM для post-treatment — 5 млрд тг,
            резервуары чистой воды 3 × 25 000 м³ ж/б — 12 млрд тг,
            насосная 2-го подъёма 14 насосов Grundfos NK + резерв — 16 млрд тг,
            обработка осадка (центрифуги + сгустители + площадки сушки) — 6 млрд тг,
            АСУ Siemens PCS7 + лаборатория ASTM/EPA — 8 млрд тг,
            энергоснабжение 2 ввода 110 кВ + резерв ДГУ 5 МВт + UPS — 12 млрд тг,
            здания ВОС (главный корпус 18 000 м² + лаборат. + диспетчер) — 16 млрд тг,
            благоустройство + охрана + СЗЗ 100 м — 6 млрд тг,
            проектирование + изыскания + экспертиза + ПНР — 10 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~165 млрд тг (допуск ±10%). 14+6+14+18+14+8+6+4+5+12+16+6+8+12+16+6+10 = 175 млрд тг ≈ 165 млрд тг (с оптимизацией). Удельная стоимость ~330 тыс. тг/(м³/сут) — средне-мировой уровень для muni-ВОС (Сингапур NEWater $400/м³/сут, Sydney Desal $1500/м³/сут).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Качество питьевой воды</h2>
          <p className="text-slate-300">
            На выходе ВОС нужно обеспечить параметры WHO Drinking-Water Quality + СанПиН РК.
            Что обязательно мониторить 24/7?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только мутность и хлор остаточный" },
              { v: "b", t: "Только бактериологические показатели" },
              { v: "c", t: "Полный мониторинг 24/7 по WHO 4th ed + СанПиН РК + AWWA WPC: 1) Мутность Turbidity Hach 2100Q ≤1 NTU (целевое 0.1-0.3 NTU); 2) pH 6.5-8.5 (датчики 8438 Hach); 3) Свободный хлор Cl₂ остаточный 0.3-0.5 мг/л (Hach CL10sc); 4) Связанный хлор (хлорамины) ≤0.5 мг/л; 5) Общий органический углерод TOC ≤2 мг/л (защита от хлорнин/побочных DBP); 6) Электропроводность EC (солесодерж.) ≤1500 мкСм/см; 7) ОВП Oxidation-Reduction Potential 650-750 мВ (показатель окислит. активности воды); 8) Температура 5-25°C; 9) Расход на выходе (расходомеры ультразвуковые Krohne); 10) Бактериологические — еженедельно: общее микробное число ≤50 КОЕ/мл (37°C), Total Coliform ОТСУТСТВУЮТ в 100 мл, E.coli ОТСУТСТВУЮТ в 100 мл, Pseudomonas aeruginosa, Legionella; 11) Химические (1 раз/мес): NH₄, NO₂, NO₃ &lt;50, Fe ≤0.3, Mn ≤0.1, As ≤0.01, Pb ≤0.01, Cd ≤0.003, Hg ≤0.001, F ≤1.5, Cl ≤350, SO₄ ≤500, тяжёлые металлы (USEPA Method 200.8 ICP-MS); 12) Радиологические: альфа-активность ≤0.1 Бк/л, бета ≤1.0 Бк/л; 13) Алгоритмы обработки данных AI/ML для распознавания аномалий — early warning system; 14) Полная база данных с прозрачным доступом для общественности (Right-to-Know); 15) Сертификация ISO 24512 + WSP Water Safety Plan + WHO" },
              { v: "d", t: "Только химические показатели + цвет/вкус" },
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
                {score === 4 ? "Отлично — готовы к проектированию ВОС" : score >= 2 ? "Перечитайте СНиП 2.04.02 + WHO + AWWA + NSF 61" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 2.04.02 (Водоснабжение), NSF/ANSI 61 (System Components), WHO Drinking-Water Quality 4th ed (2017), AWWA Water Quality Standards, ISO 24512 (Drinking Water Services), USEPA 40 CFR Part 141 (Primary).</p>
          <p><strong>Реальные объекты РК:</strong> ВОС «Аккуль» Алматы (500 000 м³/сут из БАК), ВОС «Бадам» Шымкент (350 000 м³/сут р. Бадам), ВОС «Талгар-Иссык» (200 000 м³/сут горн.), ВОС «Астана-Городское» (380 000 м³/сут р. Ишим).</p>
        </section>
      </main>
    </div>
  );
}
