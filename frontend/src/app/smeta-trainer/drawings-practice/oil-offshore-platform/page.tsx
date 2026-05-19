"use client";
import Link from "next/link";
import { useState } from "react";

export default function OilOffshorePlatformPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 600_000) <= 60_000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 2_500_000_000_000) <= 250_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Морские нефтяные платформы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🛢️ Морские нефтяные платформы (Offshore Oil & Gas)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #279. Кашаган D-Island — крупнейшее в мире искусственное
            месторождение на ледовом мелководье Каспия (запасы 38 млрд барр,
            глубина моря 4-7 м, расстояние от Атырау 80 км). 4 искусственных
            острова (A/D/EPC-2/EPC-3), GBS Gravity-Base Structure 270×100 м
            из бетона B60 объёмом 0.6 млн м³, ледостойкая «голова» как у
            месторождения Hibernia (Канада 1997). Также Тенгиз-Корпорей
            (наземное), Карачаганак (газовый), Кумколь, OKIOC (BG-Eni 1990s).
            ISO 19906 (Arctic Offshore Structures) + DNV-OS-C502 + СН РК 2.05-15.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав GBS-платформы Кашаган</h2>
          <p className="text-slate-300 leading-relaxed">
            ISO 19906 + DNV-OS-C502 + API RP 2A-WSD + СН РК 2.05-15:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Основание GBS (Gravity-Base Structure):</strong> монолитный бетонный «остров» 270×100×30 м, бетон B60 D300 (морозостойкий, водонепроницаемый, расход 0.6 млн м³), масса 800 000 т, заглублён в дно Каспия на 4-6 м с подсыпкой каменно-щебёночной подушки.</li>
            <li><strong>Армирование:</strong> двухслойная сетка A-III Ø32-40 мм, антикоррозийное цинковое покрытие epoxy-coated rebar (ECR) или термодиффузионное Galvalume; в зоне переменного уровня воды — стеклофибровая arm (GFRP).</li>
            <li><strong>Защита от льда (ice belt):</strong> по периметру на отметке −2 / +4 м — наклонная коническая стенка 45° с покрытием Belzona 1391 (эпокси-керамика), для отвода льда вверх; ледовая нагрузка по ISO 19906 = 12-15 МН/м для битого льда 1.5-2 м толщины.</li>
            <li><strong>Топсайд (topside processing module):</strong> производственная палуба над GBS 50 000 т, 6 этажей: добыча (Christmas tree manifold), сепарация (oil-gas-water 3-phase), компрессия газа (Solar Mars 100 turbocompressor 13 МВт × 4 шт), факельная стрела (flare boom) H=80 м.</li>
            <li><strong>Жилой модуль (LQ — Living Quarters):</strong> 250 коек для вахтовиков 28/28 (28 дней работа / 28 дней отдых), helideck Sikorsky S-92 на крыше, кафетерий, медпункт, спортзал.</li>
            <li><strong>Антикоррозийная защита:</strong> ICCP (Impressed-Current Cathodic Protection) с MMO-анодами Ti+Pt-coated, ток 50-200 мА/м², 1 анод на 50 м² подводной поверхности; для надводной части — 3-слойное полиуретановое покрытие Hempel Hempaprime Multi 500.</li>
            <li><strong>Скважинный куст (well slots):</strong> 40-60 устьевых колонн (Ø762 мм Christmas tree Cameron T-Bolt + 5-slot manifold), drilling derrick Sembcorp Marine 1700 т грузоподъёмность.</li>
            <li><strong>Нефтехранилище в основании:</strong> ёмкости 16 шт × 50 000 м³ в монолитном бетоне GBS (концепция Statfjord Norway 1979), для буфера 7-10 сут добычи перед отгрузкой в трубопровод.</li>
            <li><strong>Системы безопасности:</strong> ESD (Emergency Shutdown), F&G (Fire & Gas Detection — ИК-датчики Det-Tronics CGS, deluge ESFR, водяные туманы), spill recovery skimmer Lamor для разлива нефти.</li>
            <li><strong>Связь:</strong> подводный fiber-optic кабель Кашаган-Атырау 80 км (Norddeutsche Seekabelwerke), резервный VSAT C-band; offshore VHF для морских судов.</li>
            <li><strong>Подводные трубопроводы:</strong> Каспий subsea pipeline Кашаган-Атырау Ø32" Х70, в траншее 2 м под морским дном (для защиты от якорей и льда), CTP coating + bitumen.</li>
            <li><strong>Резервное питание:</strong> 4× Solar Mars 100 газовые турбины 13 МВт = 52 МВт совокупно, на собственном газе sweet gas (после H2S removal); резерв DG-2000 Caterpillar 2 МВт × 2 шт на 72 ч.</li>
            <li><strong>Десульфуризация (H2S removal):</strong> Кашаган имеет нефть с очень высоким содержанием H2S 15-20% (smartiest на планете) — требует amine treatment (MDEA) + Claus процесс для серы, и весь персонал в SCBA-масках 24/7.</li>
            <li><strong>Доступ:</strong> вертолётом Sikorsky S-92 (40 мин из Атырау), морским судном AHTS 6 часов в зимн. период льдокол Vaygach класс Arc4 нужен.</li>
            <li><strong>Срок службы:</strong> design life 50 лет (как Hibernia, Troll A Norway), но 100% replacement компонентов topside после 25 лет.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Ледовая нагрузка</h2>
          <p className="text-slate-300">
            Платформа Кашаган D-Island, акватория Северный Каспий, лёд 1.5-2 м
            толщ. зимой Nov-Apr. Какая конструкция GBS обеспечивает работу
            по ISO 19906 + DNV-OS-C502?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Вертикальный стальной кессон Ø50 м толщ. 30 мм без бетонной защиты" },
              { v: "b", t: "Плавучая полупогружная Semi-submersible как Deepwater Horizon" },
              { v: "c", t: "Стандартный jacket steel template (как Северное море) — 4 ноги Ø3 м" },
              { v: "d", t: "Концептуальный GBS Gravity-Base ледостойкий по ISO 19906 + DNV-OS-C502 + опыту Hibernia: 1) Бетонный монолитный «остров» 270×100×30 м из бетона B60 D300 морозостойкий W12 водонепроницаемый, расход 0.6 млн м³ + 70 000 т арматуры A-III Ø32-40 с epoxy-coating; 2) Ice belt — наклонная коническая стенка 45° от −2 м до +4 м (зона переменного уровня льда), функция «ice-breaking cone» — лёд при наезде ломается вверх и отъезжает в стороны, минимизируя горизонтальную нагрузку; 3) Расчёт ледовой нагрузки по ISO 19906 — для битого льда 1.5-2 м толщ. = 12-15 МН на 1 м периметра, для торосов 5-8 м = 25-40 МН/м (Каспий имеет торосы при дрейфе льда вдоль СЗ ветра); 4) Подсыпка каменно-щебёночной подушки под GBS 5-8 м (для распределения нагрузки на грунт + дренаж + предотвращение размыва дна); 5) Покрытие Belzona 1391 ceramic-эпокси на стенках ice belt + Belzona 1111 super metal на изношенных участках после 5-7 лет (ремонт без сухого дока); 6) Антикоррозийная защита ICCP — MMO-аноды Titan+Pt 50-200 мА/м² на подводной части (защита от sulfate-reducing bacteria + хлоридной коррозии); 7) Внутренние нефтехранилища 16×50 000 м³ — двойная функция: storage + ballast (для regulating draft + stability); 8) Топсайд из стали S420 / S460 на бетонных «ногах» GBS с базовой пластиной 2×2×0.5 м (передача 800 000 т веса на грунт); 9) Сейсмика — Каспий 6-7 баллов (СНиП II-7-81*), Кашаган дополнительно ressonance check с MOR plates; 10) Доставка на место — буксировка плавучего GBS из dock-сухого Атырауского завода (4 буксира Smit 200 т × 80 км) + затопление на месте по ballast valve (как Troll A Norway 1995); ISO 19906 + DNV-OS-C502 + API RP 2N + СН РК 2.05-15 + СНиП II-7-81*" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём бетона GBS</h2>
          <p className="text-slate-300">
            GBS Кашаган D-Island 270×100×30 м (LxBxH общий габарит), внутренние
            каверны для нефтехранилищ занимают 50% объёма (16 шт × 50 000 м³ =
            800 000 м³), остальное — монолитный бетон + ребра жёсткости.
            Расход бетона B60 морозостойкий W12 (м³):
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="м³"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 270 × 100 × 30 = 810 000 м³ общий объём GBS.
                Каверны хранилищ 16 × 50 000 = 800 000 м³ внутр. полости.
                Бетонные стенки/днище/ребра ≈ 50% общего объёма ⇒
                ≈ <strong>600 000 м³</strong> бетона B60. Для сравнения Hibernia
                Canada 1997 — 450 000 м³ (Statoil Troll A Norway 1995 — 245 000 м³,
                но в 2 раза глубже Каспия). ISO 19906 + DNV-OS-C502.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс платформы Кашаган</h2>
          <p className="text-slate-300">
            GBS-платформа Кашаган D-Island «под ключ» (для оценки масштаба):
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Подсыпка каменно-щебёночной подушки 6 м (270×100×6 = 162 000 м³ × 30 000 тг) = 4.9 млрд тг</li>
            <li>Бетон B60 W12 600 000 м³ × 75 000 тг/м³ = 45 млрд тг</li>
            <li>Арматура A-III Ø32-40 epoxy-coated 70 000 т × 380 000 тг/т = 26.6 млрд тг</li>
            <li>Опалубка GBS (сухой док Атырау) + buoyancy валы + ballast valves = 18 млрд тг</li>
            <li>Покрытие Belzona ice belt 270×8 = 2 160 м² × 95 000 тг + Hempaprime 5 000 м² × 12 000 тг = 0.3 млрд тг</li>
            <li>ICCP-система MMO-аноды Ti+Pt 5 000 м² × 25 000 тг + power supply Cathwell = 0.18 млрд тг</li>
            <li>Топсайд modules 50 000 т × 18 млн тг/т (предв. сборка South Korea Hyundai Heavy) = 900 млрд тг</li>
            <li>Christmas trees Cameron T-Bolt 60 шт × 1.8 млрд тг = 108 млрд тг</li>
            <li>Сепарация 3-phase Sulzer 6 шт + amine treatment MDEA + Claus desulfurization = 78 млрд тг</li>
            <li>Компрессоры Solar Mars 100 13 МВт × 4 + турбогенераторы = 65 млрд тг</li>
            <li>Жилой модуль LQ 250 коек + helideck S-92 Sikorsky + кухня + медпункт = 28 млрд тг</li>
            <li>Drilling derrick Sembcorp 1700 т + 30 скважин (drilling + completion + casing) = 280 млрд тг</li>
            <li>Subsea pipeline Кашаган-Атырау Ø32" 80 км × 4.5 млрд тг/км + береговой LACT-unit = 380 млрд тг</li>
            <li>Submarine fiber-optic cable 80 км + landing station Атырау = 6 млрд тг</li>
            <li>ESD + F&G + deluge ESFR + spill recovery Lamor + safety equipment = 22 млрд тг</li>
            <li>VSAT C-band + VHF marine + helicopter operations center = 4 млрд тг</li>
            <li>Буксировка + ballasting + установка GBS на дно (4 буксира Smit 200 т × 6 мес) = 35 млрд тг</li>
            <li>Морские изыскания + EIA + СН РК сертификация + ESIA EBRD = 18 млрд тг</li>
            <li>Проектирование (3% бюджета) + ПИР + ICCP commissioning + НР + СП + страхование зап.-стр. периода = 480 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до трлн):</p>
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
                <strong>Ответ:</strong> ~2.5 трлн тг (~$5B USD) за одну GBS-платформу
                (1 из 4 у Кашагана). Реальный общий capex проекта Кашаган
                (2002-2016) — $50B USD (~25 трлн тг) с инфраструктурой +
                наземным заводом + трубопроводами. Это самый дорогой нефтяной
                проект в истории на одно месторождение (Bloomberg 2014).
                Окупаемость 25-35 лет при цене $50-70/барр и добыче 400 000 барр/сут.
                ISO 19906 + DNV-OS-C502 + СН РК 2.05-15.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — H2S и сера</h2>
          <p className="text-slate-300">
            Кашаган имеет нефть с 15-20% H2S (sour gas). Какие специфические
            требования к платформе по СН РК 2.05-15 + API RP 55 + DNV-OS-C502?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких специальных — обычная конструкция" },
              { v: "b", t: "Только дополнительный детектор H2S на топсайде" },
              { v: "c", t: "Полный комплекс H2S-mitigation по NACE MR0175 + API RP 55 + IEC 60079: 1) Все материалы трубопроводов, клапанов, christmas tree — sour service по NACE MR0175 (ISO 15156): низкоуглеродистая сталь L80 / API 5L X65 sour, твёрдость ≤22 HRC, без чувствительности к Sulfide Stress Cracking SSC; 2) Christmas trees Cameron T-Bolt sour service spec с monel-плакировкой каналов и Inconel 625 cladding для valves; 3) Amine treatment MDEA (MethylDiEthanolAmine) для удаления H2S из газа — 2 stripper towers Ø3 м H=30 м, регенерация при +120 °C, output sweet gas <4 ppm H2S; 4) Claus процесс для конверсии H2S → элементарная сера (2 H2S + SO2 → 3 S + 2 H2O), output 95-97% conversion, продаётся как товарная сера 1000 тг/т; 5) Tail-gas treatment SCOT для оставшихся 3-5% — каталитическая reduction в H2S → возврат в Claus; 6) Faktel-стрела (flare boom) H=80 м для аварийной разгрузки H2S/гипертокс. газов с pilot ignition continuous + steam injection для smoke-less burning; 7) F&G детекторы Det-Tronics PointWatch IR + open-path PIR9400 каждые 5-10 м на платформе, alarm при 5 ppm H2S, ESD при 20 ppm (LC50 для H2S = 712 ppm за 1 ч); 8) SCBA self-contained breathing apparatus у всего персонала 24/7 на работе (Drager PSS-7000 с маской + 30-мин баллон), эваккорабль с подавлением водяных туманов; 9) Maintenance — все ремонтные работы только после полного N2-purge (5 air-changes), confined-space entry permit с personal H2S monitor BW Clip; 10) Жилой модуль LQ с positive-pressure HVAC + H2S filtration через carbon + KMnO4 — защита от ингаляции вахтовиков; NACE MR0175 + API RP 55 + СН РК 2.05-15 + IEC 60079 (взрывозащита) + EN ISO 9001" },
              { v: "d", t: "Только катодная защита от коррозии" },
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
              {score === 4 && "Отлично! Ты знаешь стандарты offshore + GBS + sour service."}
              {score === 3 && "Хорошо. Перечитай ISO 19906 + NACE MR0175 для углубления."}
              {score === 2 && "Уровень C — пересмотри DNV-OS-C502 + API RP 2A-WSD."}
              {score <= 1 && "Нужно повторить. См. СН РК 2.05-15 + ISO 19901 + опыт Hibernia."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>СН РК 2.05-15</strong> — Морские нефтегазовые сооружения</li>
            <li><strong>СНиП II-7-81*</strong> — Сейсмостойкое проектирование (для Каспия 6-7 баллов)</li>
            <li><strong>ISO 19906</strong> — Petroleum and natural gas — Arctic offshore structures</li>
            <li><strong>ISO 19901-1 to -9</strong> — Specific requirements for offshore structures (metocean, foundations, topsides)</li>
            <li><strong>DNV-OS-C502</strong> — Offshore Concrete Structures</li>
            <li><strong>DNV-OS-C101</strong> — Design of Offshore Steel Structures, General</li>
            <li><strong>API RP 2A-WSD</strong> — Planning, Designing and Constructing Fixed Offshore Platforms</li>
            <li><strong>API RP 2N</strong> — Planning, Designing and Constructing Structures in Arctic Conditions</li>
            <li><strong>API RP 55</strong> — Oil and Gas Drilling and Producing Operations Involving H2S</li>
            <li><strong>NACE MR0175 / ISO 15156</strong> — Materials for use in H2S-containing environments (sour service)</li>
            <li><strong>IEC 60079</strong> — Explosive atmospheres (Ex-rated electrical equipment)</li>
            <li><strong>IMO MARPOL Annex I</strong> — Prevention of pollution by oil</li>
            <li><strong>OSPAR Convention 1992</strong> — Convention for the Protection of the Marine Environment</li>
            <li><strong>EBRD ESIA</strong> — Environmental and Social Impact Assessment</li>
            <li><strong>Каспийская конвенция 2018</strong> (Актау) — правовой статус Каспийского моря</li>
            <li><strong>SOLAS Chapter II-2</strong> — Construction (Fire protection)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
