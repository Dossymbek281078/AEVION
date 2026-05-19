"use client";
import Link from "next/link";
import { useState } from "react";

export default function UnderwaterTunnelsSubseaPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 32) <= 3;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 450_000_000_000) <= 45_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Подводные трубопроводы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌊 Подводные трубопроводы (Subsea Pipelines)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #280. Каспий subsea pipeline Кашаган-Атырау 80-100 км Ø32"
            X70, Tengiz-Astrakhan TAPCO, ТШО Tengiz-Karachaganak.
            Сравнительно с глоб. проектами: Nord Stream 1+2 (1224+1230 км
            Ø48" из России в Германию), Blue Stream Турция-Россия (393 км),
            TurkStream (930 км). Сталь X70 / X80 API 5L PSL2, толщина
            стенки 25-32 мм + CTE-coating 3 мм + 4-5 см concrete weight
            coating CWC для balancing buoyancy. Прокладка J-lay barge
            Saipem FDS-2 / Allseas Solitaire с глубоководным spool reel.
            ROV Schilling Robotics Atlas для inspection + maintenance.
            DNV-OS-F101 + ISO 13628-1 + API 1104 (welding).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав subsea pipeline системы</h2>
          <p className="text-slate-300 leading-relaxed">
            DNV-OS-F101 + ISO 13628-1 + API 1104 + NACE TM0177 (sour service):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Pipe (тело трубы):</strong> сталь API 5L X70 PSL2 (предел текучести 485 МПа) или X65 для sour service, Ø32" (812 мм) для Тенгиз-Атырау, толщ. стенки 25-32 мм; pipe-mill ОМК Выкса / Pipemarc, длина секции 12.2 м, joint to joint girth weld.</li>
            <li><strong>External coating:</strong> 3-Layer Polyethylene (3LPE) или Fusion-Bonded Epoxy (FBE) 350-500 мкм + adhesive PE 250 мкм + outer PE 2.5-3 мм для механической защиты при укладке.</li>
            <li><strong>Concrete Weight Coating (CWC):</strong> 40-50 мм armored concrete с плотностью 3.04 т/м³ (с magnetite или iron-ore agg) — обеспечивает negative buoyancy (труба тонет даже пустая); spiral-wire reinforced для предотвращения cracking при изгибе.</li>
            <li><strong>Internal Flow Coating:</strong> для газовых трубопроводов — эпокси FBE 75 мкм (snug coating) для уменьшения friction, +1-5% throughput improvement.</li>
            <li><strong>Cathodic Protection sacrificial Al-anodes:</strong> алюминиевые аноды AlZnIn 50 кг каждый, на pipe каждые 200-300 м (бракелеты на трубе), срок защиты 30 лет; для длинных — ICCP с MMO-titanium анодами.</li>
            <li><strong>Subsea Manifolds:</strong> подводные коллекторы Cameron T-Bolt или Aker Solutions, для пуска/приёма скрепера (pig launcher/receiver), tie-in spools, control umbilical hub.</li>
            <li><strong>Control umbilical:</strong> мультижильный кабель Ø150-200 мм с гидравлическими шлангами (для управления subsea valves) + электрическими (signal) + fiber-optic (data); Nexans / Aker Solutions production.</li>
            <li><strong>Trenching:</strong> укладка в траншее 1.5-2.5 м глубиной (для защиты от якорей рыболовных судов + ледовых пропилов); ploughing с Trencher BJTV-3 или jetting с водяной струёй 50 бар; rocks/гравий покрытие сверху для stability.</li>
            <li><strong>Riser:</strong> вертикальный участок от subsea pipeline вверх к топсайду (FPSO/platform), 6-10 риcеров на платформе, защита Bend-Stiffener неопреновый от усталостных циклов.</li>
            <li><strong>Crossover (sleepers):</strong> при пересечении других трубопроводов/кабелей — bridge sleepers ж/б 3 м длины с anti-friction pad, минимальный clearance 0.5 м между трубами.</li>
            <li><strong>Inspection skids:</strong> intelligent pig (smart pig) Rosen MFL-A или PII PIPE-Tracker — magnetic flux leakage + UT для wall thickness mapping + corrosion features; запускается раз в 5 лет, проходит со скоростью 2-3 м/с по трубе.</li>
            <li><strong>ROV (Remote Operated Vehicle):</strong> Schilling Robotics Atlas или Oceaneering Magnum +, для visual inspection (HD-camera), CP measurement, valve operation, debris removal; tether 3000 м длиной от surface vessel.</li>
            <li><strong>AUV (Autonomous Underwater Vehicle):</strong> Hugin / Kongsberg HUGIN 6000, для pre-lay survey + post-lay as-built, sonar Multibeam EM3002 + side-scan.</li>
            <li><strong>SCADA/DCS:</strong> Honeywell Experion / Yokogawa CENTUM, контроль давления, температуры, расхода в реальном времени, аварийная сигнализация при leak (acoustic + balance pressure tests).</li>
            <li><strong>Pipeline End Manifold (PLEM) / Termination (PLET):</strong> конечные узлы трубопровода на дне моря с flange Ø32" + ESD valve + connection к platform riser.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Метод укладки</h2>
          <p className="text-slate-300">
            Subsea pipeline Кашаган-Атырау 80 км Ø32" X70 на мелководье 4-7 м.
            Какой метод укладки по DNV-OS-F101 + опыту Saipem/Allseas?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Pre-fab сборка на берегу + одной фурой на буксире по морю" },
              { v: "b", t: "Только с дайверами вручную по 1 секции в сутки" },
              { v: "c", t: "Drag with dredger из открытого канала" },
              { v: "d", t: "S-lay barge с tensioner system + concrete weight coating + post-lay trenching по DNV-OS-F101: 1) S-lay (S-образная укладка) — труба проходит через многоступенчатую конструкцию stinger (8-12 ролик-стенгеров) и принимает S-образную форму при погружении; рабочая глубина до 600 м, скорость укладки 3-5 км/сут; альтернатива — J-lay (для глубин >1000 м, вертикальный спуск трубы); 2) Lay-barge Saipem Castoro Sei (S-lay 264 м) или Allseas Lorelay (Pipelay Vessel 173 м) — на барже 6-8 welding stations (girth weld root + hot + fill + cap) + NDT (UT, RT, MPI) + field-joint coating (CTE shrink-sleeve); 3) Concrete Weight Coating Apply — отдельная плавучая установка для нанесения 4-5 см armored concrete на трубу перед укладкой, для negative buoyancy; 4) Tensioner system — на лай-барже 4-6 tensioners 50-100 т каждый, удерживают тяжесть подвешенной трубы между баржой и дном (Stinger curvature + overbend stress); 5) Trenching post-lay — после укладки трубы на дно, ploughing с trencher BJTV-3 или jetting + post-lay rock dumping; для Каспия минимальное burial 1.5-2 м из-за рыболовных тралов и ледового scouring; 6) Pre-lay survey AUV Hugin 6000 — pre-route bathymetry + side-scan для obstructions (wrecks, debris, boulders) + sub-bottom profiler для characterизация грунта; 7) Welding stations — automated GTAW + GMAW (Cranfield Welding Engineering CRC-Evans MachineTech), 8-10 mins/joint, NDT inspection 100% AUT (automated ultrasonic testing); 8) Field-joint coating — heat-shrink sleeve Canusa Aquawrap CTE на стыке (после welding покрытие нужно заново); 9) PLEM/PLET install — концевые узлы на subsea устанавливаются 1-м с лай-баржей + diver-assist tie-in + ROV verification; 10) As-built survey — post-lay AUV Hugin сонар проверяет actual position vs design + UT для wall thickness check; DNV-OS-F101 + ISO 13628-1 + API 1104 + NACE TM0177" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Диаметр трубы</h2>
          <p className="text-slate-300">
            Кашаган добывает 400 000 барр нефти/сут = 63 600 м³/сут. Pipeline
            transport до Атырау работает 24/7. Допустимая скорость в нефт.
            трубопроводе по DNV-OS-F101 = 1.5-2.5 м/с (выше — эрозия). Какой
            нужен внутренний диаметр трубы (дюймы, округл. до стандарта API
            5L: 24", 26", 28", 30", 32", 36"):
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder='&quot;'
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> Q = 63 600 м³/сут = 0.736 м³/с.
                A = Q/v = 0.736 / 2.0 = 0.368 м² (при v=2 м/с).
                D = √(4·A/π) = √(0.468) ≈ 0.685 м = 27 дюймов.
                С запасом на расширение и стандартами API 5L ⇒
                <strong>Ø32"</strong> (0.812 м). Реальный pipeline Кашаган-Атырау
                Ø32" Х70 (как и анонсировано). DNV-OS-F101 + API 5L PSL2.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс subsea pipeline</h2>
          <p className="text-slate-300">
            Subsea pipeline Кашаган-Атырау Ø32" X70 100 км «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Pipe X70 PSL2 Ø32" толщ. 32 мм (~640 кг/м), 100 км × 640 т × 800 000 тг/т = 51 млрд тг</li>
            <li>External coating 3LPE 200 000 м² × 9 000 тг = 1.8 млрд тг</li>
            <li>Concrete Weight Coating CWC armored 40 мм 100 км × 24 000 тг/м = 2.4 млрд тг</li>
            <li>Sacrificial Al-anodes AlZnIn 50 кг каждые 200 м × 500 шт × 280 000 тг = 0.14 млрд тг</li>
            <li>Pre-lay AUV survey Hugin 6000 100 км (3 мес) = 4 млрд тг</li>
            <li>S-lay barge Saipem Castoro Sei mobilization + lease 6 мес (60 дн на 100 км со скор. 1.5 км/сут) = 78 млрд тг</li>
            <li>Welding stations + automated GTAW/GMAW + NDT AUT × 100% × 8000 joints = 9 млрд тг</li>
            <li>Field-joint coating heat-shrink sleeve Canusa × 8000 шт = 1.2 млрд тг</li>
            <li>Post-lay trenching plough BJTV-3 (burial 2 м) 100 км × 320 млн тг/км = 32 млрд тг</li>
            <li>PLEM/PLET endpoint manifolds × 2 (Кашаган + Атырау берег) = 18 млрд тг</li>
            <li>Subsea ESD valve + tie-in spool + control umbilical 30 км кабель = 22 млрд тг</li>
            <li>Smart pig Rosen MFL-A baseline run + интерпретация = 0.85 млрд тг</li>
            <li>ROV Schilling Atlas + tether + лицензированный оператор (3 мес коммиссия) = 2.5 млрд тг</li>
            <li>SCADA/DCS Honeywell Experion + leak detection LICS + береговой control room = 6 млрд тг</li>
            <li>Береговой landfall + onshore custody-transfer (LACT-unit) + tank farm 200 000 м³ = 24 млрд тг</li>
            <li>Морские изыскания + ESIA EBRD + страхование стр.-монт. периода + гарантии = 12 млрд тг</li>
            <li>Pre-commissioning N2-purge + hydrotest 1.5× design pressure 200 бар + drying = 4 млрд тг</li>
            <li>Проектирование (5%) + ПИР + Pipeline Integrity Management System + НР + СП = 180 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="тг"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~450 млрд тг (~$1B USD) за subsea pipeline
                100 км Ø32". Удельная стоимость ~$10M/км для shallow water Каспия.
                Для глубоководных проектов (Nord Stream Ø48" 1200 км) — до
                $13B / 1200 км = $11M/км ($14M/км в текущ. ценах). Главные
                статьи — S-lay barge (17%) + post-lay trenching (7%) + береговой
                landfall (5%) + сами трубы (11%). DNV-OS-F101 + ISO 13628-1.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Inspection и leak detection</h2>
          <p className="text-slate-300">
            Subsea pipeline Кашаган-Атырау работает 20 лет. Что обязательно
            по DNV-OS-F101 + PIMS (Pipeline Integrity Management System)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Просто работать без проверок, ремонт по факту аварии" },
              { v: "b", t: "Только ежегодный визуальный осмотр дайвером" },
              { v: "c", t: "Полный комплекс PIMS по DNV-OS-F101 + API 1160 + ISO 55001: 1) Smart pig inspection (intelligent pig) каждые 3-5 лет — Rosen MFL-A (magnetic flux leakage) + PII PIPE-Tracker UT для wall thickness mapping, обнаруживает corrosion >10% wall loss и cracks >2 мм; 2) Cathodic Protection survey каждые 6 мес — ROV Schilling Atlas измеряет потенциал Cu/CuSO4 reference electrode в 50 точках по трассе, должно быть −0.85 to −1.10 V (более положительно = недостаточная защита, более отрицательно = риск hydrogen embrittlement); 3) Leak Detection System (LDS) — Honeywell SCADA balance method (in vs out flow), acoustic sensor cable (DistTibCo Distributed Temperature Sensing fiber-optic), пассивные гидрофоны вдоль pipeline; alarm при leak >0.1% от throughput; 4) Pipeline patrolling — AUV Hugin 6000 раз в год side-scan + multibeam для bathymetry changes + free-span detection (если pipeline висит между опор больше allowed VS = vortex-shedding risk); 5) Free-span correction — если span >40 м для Ø32 inch, укладка rock-bag mattress (Concrete Mattress 4×8 м × 200 кг) для поддержки; 6) Anchor strikes monitoring — VHF AIS tracking рыболовных и крупных судов в зоне 500 м от pipeline, alarm если drop anchor; 7) Repair clamps — Subsea Repair Clamp Type B (Diving Service) для emergency leak repair, hot-tapping для нового tie-in без shutdown; 8) Pipeline Cleaning — каждые 6-12 мес поливалентные foam pigs + brush pigs для удаления воска, asphaltenes, sand; 9) Database PIMS — Microsoft Power BI integrated database с historical inspection data, AI-predicted remaining life (PCM model для corrosion growth); 10) Регуляторный compliance — ежеквартальные отчёты в КАЭН РК + Министерство Энергетики РК + Caspian Convention Working Group + EBRD ESG reporting; DNV-OS-F101 + API 1160 (Managing System Integrity for Hazardous Liquid Pipelines) + ISO 55001 (Asset Management) + IMO MARPOL Annex I" },
              { v: "d", t: "Только при подозрении на утечку — реактивное обслуживание" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <button
          onClick={() => setShowResults(true)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition"
        >
          Проверить ответы
        </button>

        {showResults && (
          <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}>
            <h2 className="text-2xl font-bold text-slate-50">Результат: {score} / 4</h2>
            <p className="mt-2 text-slate-300">
              {score === 4 && "Отлично! Ты владеешь subsea pipeline engineering."}
              {score === 3 && "Хорошо. Перечитай DNV-OS-F101 + API 1160 для углубления."}
              {score === 2 && "Уровень C — пересмотри ISO 13628-1 + DNV-RP-F116."}
              {score <= 1 && "Нужно повторить. См. API 5L PSL2 + NACE MR0175 + DNV-OS-F101."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>DNV-OS-F101</strong> — Submarine Pipeline Systems (основной стандарт офшорных трубопроводов)</li>
            <li><strong>DNV-RP-F101</strong> — Corroded Pipelines (оценка остаточной прочности)</li>
            <li><strong>DNV-RP-F105</strong> — Free Spanning Pipelines (расчёт пролётов)</li>
            <li><strong>DNV-RP-F116</strong> — Integrity Management of Submarine Pipeline Systems</li>
            <li><strong>ISO 13628-1 to -16</strong> — Petroleum and natural gas — Design and operation of subsea production systems</li>
            <li><strong>API 5L PSL2</strong> — Specification for Line Pipe (X65/X70/X80 sour service)</li>
            <li><strong>API 1104</strong> — Welding of Pipelines and Related Facilities</li>
            <li><strong>API 1160</strong> — Managing System Integrity for Hazardous Liquid Pipelines</li>
            <li><strong>API RP 17B/17J/17L</strong> — Flexible pipe, Subsea umbilicals</li>
            <li><strong>NACE TM0177 / MR0175</strong> — Sour service материалы (H2S)</li>
            <li><strong>ASME B31.4 / B31.8</strong> — Pipeline Transportation Systems for Liquid/Gas</li>
            <li><strong>ISO 55001</strong> — Asset Management Systems (для PIMS)</li>
            <li><strong>СН РК 2.05-15</strong> — Морские нефтегазовые сооружения</li>
            <li><strong>СНиП 2.05.06-85*</strong> — Магистральные трубопроводы</li>
            <li><strong>СП 36.13330</strong> — Магистральные трубопроводы (актуализированная редакция СНиП)</li>
            <li><strong>IMO MARPOL Annex I</strong> — Prevention of pollution by oil</li>
            <li><strong>OSPAR Convention</strong> — protection of marine environment</li>
            <li><strong>EBRD ESIA</strong> — Environmental and Social Impact Assessment</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
