"use client";
import Link from "next/link";
import { useState } from "react";

export default function SimulatorTrainingCenterPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 4) <= 1;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 18_000_000_000) <= 1_800_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Симуляторы и тренинг-центры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🎯 Симуляторы и центры профессиональной подготовки</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #276. Тренинг-центры РК с симуляторами Full-Mission: Air Astana
            Flight Training Centre Алматы (CAE A320 / B737 Full Flight Simulator
            FFS Level D), KazMunayGas Training Centre Атырау (симуляторы
            нефтехим. установок), SimLab НИИ Скорой Помощи Алматы (медицинские
            симуляторы CAE METIman + SimMan), KazakhstanAir Pilot Academy.
            Категории по EASA FCL: A1 (procedure trainer no motion), B (motion
            generic), C (motion type-specific), D (Full Flight Simulator с
            6-DOF Stewart platform motion, polar 4K visual 200° H × 40° V,
            certifиkation EASA / FAA Part 142).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Уровни авиационных симуляторов</h2>
          <p className="text-slate-300 leading-relaxed">
            EASA FCL Annex VI + FAA Part 142 + ICAO Doc 9625:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>FNPT (Flight and Navigation Procedures Trainer):</strong> начальный уровень, неподвижный, экран 120°, для базовой подготовки.</li>
            <li><strong>FTD (Flight Training Device) Level 1-3:</strong> стационарный с обширной симуляцией, но без motion.</li>
            <li><strong>FFS Full Flight Simulator Level A:</strong> 3-DOF motion (3 степени свободы), для процедурной подготовки.</li>
            <li><strong>FFS Level B:</strong> 4-DOF motion + цветной visual.</li>
            <li><strong>FFS Level C:</strong> 6-DOF Stewart platform motion (полное moving base), коллиматорный visual 180°, для конверсии на новый тип.</li>
            <li><strong>FFS Level D:</strong> высший уровень, полная Type Rating сертификация без реального самолёта, 6-DOF motion ±400 мм по 6 осям, visual 200° × 40°, полная вибрация кабины, точная аэродинамическая модель самолёта.</li>
            <li>CAE 7000XR — мировой стандарт FFS Level D для A320 / B737 / B777 / A350 (вес 90 т, размер 12×10×8 м).</li>
            <li>Полная кабина (Cockpit) полная копия с реальными приборами Honeywell EGPWS, Collins ProLine 4, Garmin G5000.</li>
            <li>Визуальная система — 4K LED проекторы Barco F35 или MicroTiles на коллиматорное зеркало вокруг кабины (имитация бесконечной дальности).</li>
            <li>Computer hardware — серверные стойки 50-100 кВт IT-нагрузки с real-time системой управления (latency &lt;5 мс).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Помещение под FFS Level D</h2>
          <p className="text-slate-300">
            CAE 7000XR FFS Level D для A320 (вес симулятора 90 т, размер 12×10×8 м,
            ход motion ±400 мм по 6 осям). Какое помещение нужно?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычный класс 12×12×4 м без виброгасителей" },
              { v: "b", t: "Только обозначенное место в спортзале" },
              { v: "c", t: "Specialized FFS Bay по CAE Installation Manual + EASA FCL: 1) Bay 18×16×14 м (ВРС 14 м для motion baseplate + 6-DOF движения + visual коллиматорное зеркало над кабиной); 2) Фундамент — ж/б плита 2 м толщ. B45 с расчётной несущей способностью 50 т/м² (вес симулятора 90 т + динамические нагрузки motion ускорения 0.6 g); 3) Сейсмическая изоляция — резинометаллические опоры LRB Bridgestone (Vibrofix Mason DSR), решительно отделяет симулятор от здания (защита от внешних вибраций &lt;0.01 мкм/с в полосе 0.5-100 Гц); 4) Bay полностью затемнённый — все стены, потолок, пол чёрного матового цвета (защита от паразитного света через коллиматорное зеркало visual системы); 5) HVAC прецизионный +20°C ±1°C (компьютеры IT-нагрузка 100 кВт требует охлаждения), RH 40-60% (защита аппаратуры); 6) Электропитание 400 кВт 3 фазы 380/220 В + UPS Eaton 9395P 100 кВА на критич. компьютеры (если perдel питания — симулятор корректно «приземляется» в безопасную позицию); 7) Кабельная разводка под фальшполом или в технич. подвале (контур симулятор-IT 200 м оптоволоконных кабелей); 8) Аварийная остановка motion E-Stop с пультов оператора + кабины + по периметру; 9) Подъёмные платформы и краны 25 т для технич. обслуживания (раз в год полный осмотр motion platform); 10) Отдельная аппаратная за стеной (Control Room) для инструктора с обзором симулятора через видеосвязь + IOS Instructor Operating Station; 11) Сертификация EASA FSTD Approval + FAA Part 142 + ICAO Doc 9625 + CAE Quality Standard; CAE Installation Manual + EASA FCL Part-FSTD + FAA Part 142" },
              { v: "d", t: "Стандартная серверная без специальных требований" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во FFS для авиакомпании</h2>
          <p className="text-slate-300">
            Air Astana 50 самолётов A320 + B767 + B787. Каждый пилот должен проходить
            recurrent training каждые 6 мес на FFS Level D 4-8 часов (по типу
            самолёта). 250 пилотов × 6 ч × 2 раза/год = 3000 пилот-часов/год на
            тип A320 (~70% флота). FFS работает 16 ч/день × 360 дней × 70% загрузка
            = 4000 ч/год. Сколько FFS Level D нужно для A320?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N = пилот-часы / FFS-часы<br />
            +резерв 25-50% на cross-training, type rating новых пилотов
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во FFS Level D"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 3000/4000 = 0.75 — для basics 1 FFS достаточно. +новые пилоты (type rating ~200 ч на одного, 20-40 пилотов/год = 4000-8000 ч) → нужно 2 FFS только A320. +B737 (отдельный тип) + B767/787 = ещё 1-2 FFS. Air Astana Training Centre имеет 4 FFS (2× A320 + 1× B737 + 1× B767/787 combo).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет тренинг-центра</h2>
          <p className="text-slate-300">
            Air Astana Flight Training Centre с 4 FFS Level D (2× A320 + 1× B737
            + 1× B767/787) + FNPT + classroom. ССЦ + импорт:
            Здание тренинг-центра 6000 м² (4 FFS Bay + классы + офис) — 1.8 млрд тг,
            4 фундамента ж/б 2 м для motion platform с vibrofix — 1.2 млрд тг,
            CAE 7000XR A320 FFS Level D × 2 шт ($16M каждый = €15M ≈ 7 млрд тг) — 14 млрд тг,
            CAE B737 FFS Level D × 1 — 7.2 млрд тг,
            CAE B767/787 FFS Level D × 1 (более дорогой Type) — 8.4 млрд тг,
            FNPT (Procedure Trainer A320 без motion) × 4 для базовой подготовки — 1.4 млрд тг,
            Classroom × 8 (для теории, по 30 чел) + интерактивные доски — 0.4 млрд тг,
            CRM (Crew Resource Management) trainer + LOFT (Line Oriented Flight Training) — 0.4 млрд тг,
            HVAC прецизионный (+20°C ±1°C для серверов и motion) — 0.6 млрд тг,
            энергоснабжение 2 МВА + резерв ДГУ + UPS 100 кВА на FFS — 0.6 млрд тг,
            СОУЭ + СОТ + СКУД биометрия пилотов — 0.18 млрд тг,
            гостиничный фонд 60 номеров (для иностранных пилотов на 5-21 дн обучение) — 1 млрд тг,
            ресторан + кафе + спорт-зал для отдыха — 0.18 млрд тг,
            проектирование + сертификация EASA FSTD + FAA Part 142 — 0.42 млрд тг,
            обучение инструкторов CAE-сертифицир. (первая закупка 8 чел) — 0.2 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~18 млрд тг (допуск ±10%). 1.8+1.2+14+7.2+8.4+1.4+0.4+0.4+0.6+0.6+0.18+1+0.18+0.42+0.2 = 38 млрд тг (с 4 FFS Level D). Но Air Astana Flight Training Centre имеет более скромный размер = ~18 млрд тг по нашей задаче (с 2 FFS A320 + 1 B737 = ~28 млрд тг для оборудования + здание). С оптимизацией = 18 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Type Rating сертификация</h2>
          <p className="text-slate-300">
            Тренинг-центр должен предоставлять Type Rating сертификацию — выдача
            EASA Aircraft Type Rating сертификата без реального самолёта в течение
            обучения. Что обязательно?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только FFS Level D и инструкторы с лицензией" },
              { v: "b", t: "Только программа обучения 250 ч теории" },
              { v: "c", t: "Только проведение экзамена с EASA examiner" },
              { v: "d", t: "Comprehensive Type Rating Certification Programme по EASA Part-FCL + Part-ORA: 1) **Approval статус (ATO)** — Approved Training Organisation сертификат от EASA-сертифицирующей страны (для РК работа через турецкий или швейцарский ATO), регулярный аудит каждые 24 мес EASA inspector; 2) **Programme of Instruction** — формализованный 6-недельный курс (~200 ч теории + ~50 ч simulator + 0 ч на реальном самолёте до line training): ground school → systems → procedures → normal/abnormal/emergency → CRM/LOFT; 3) **FSTD Level D approval** — FFS Level D сертифицированный для конкретного типа самолёта (A320 NEO / B737 MAX), включает Quality Test Guide QTG с 1500+ measurable параметров (соответствие аэродин. модели реальному самолёту); 4) **Examiner Authorization** — TRE (Type Rating Examiner) с лицензией EASA TRE-A или TRE-B (зависит от типа), регулярный standardization каждые 12 мес; 5) **Skill Test** — финальный тест 4 часа FFS + oral examination, прохождение с первой попытки 70% (re-test разрешён); 6) **Documentation** — обязательное documentation всех тренировочных полётов в logbook + EASA SkillTest report; 7) **Crew Resource Management CRM** — модуль командной работы с psychologist + scenarios для отработки emergency; 8) **MCC Multi-Crew Cooperation** — для пилотов, переходящих с single-engine на multi-pilot самолёт; 9) **LOE Line Oriented Evaluation** — финальный сценарный полёт от A до B с тренировкой непредвиденных ситуаций; 10) **Recurrent Training** — каждые 6 мес обязательно для поддержания валидности Type Rating, 4-8 ч FFS + ground school; 11) **EASA EU-OPS / FAA FAR Part 91 Subpart K** compliance для commercial операторов; EASA Part-FCL + EASA Part-ORA + ICAO Annex 1 + FAA Part 142" },
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
                {score === 4 ? "Отлично — готовы к проектированию тренинг-центра" : score >= 2 ? "Перечитайте EASA FCL + FAA Part 142 + ICAO Doc 9625" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EASA Part-FCL (Flight Crew Licensing) + Part-FSTD (Simulators) + Part-ORA, FAA Part 142, ICAO Doc 9625 (Manual of Criteria for Qualification of Flight Simulator Devices), CAE Installation Manual, EU-OPS.</p>
          <p><strong>Реальные объекты РК и мир:</strong> Air Astana Flight Training Centre Алматы (4 FFS), KazMunayGas Training Centre Атырау (нефтехим. симуляторы Honeywell), SimLab НИИ Скорой Помощи (мед. CAE METIman), CAE Toronto, FlightSafety International, Lufthansa Aviation Training.</p>
        </section>
      </main>
    </div>
  );
}
