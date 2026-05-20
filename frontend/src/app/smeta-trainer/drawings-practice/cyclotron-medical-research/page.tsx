"use client";
import Link from "next/link";
import { useState } from "react";

export default function CyclotronMedicalResearchPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 2_500) <= 250;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 12_000_000_000) <= 1_200_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Циклотроны и мед. изотопы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚛️ Циклотроны и производство мед. изотопов</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #276. ИЯФ РК Алматы (Институт ядерной физики, циклотрон
            Cyclone 18/9 IBA), Центр ядерной медицины Астана (циклотрон
            BC1710 GE Healthcare 16.5 МэВ), КИНТ. Производство фтор-18 (F-18
            FDG) для ПЭТ/КТ онкодиагностики, галлий-68 (Ga-68) для нейроэндо-
            кринных опухолей, технеций-99m (Tc-99m) для сцинтиграфии,
            углерод-11 (C-11) для кардиологии. Циклотрон Cyclone 18/9 IBA:
            масса 25 т, ускорение H⁻ до 18 МэВ + D⁻ до 9 МэВ, фарадей-сэндвич,
            ВЧ-резонатор 75 МГц, dee voltage 50 кВ, ток пучка 200 µA на target.
            СН РК 4.05-14 (радиационная безопасность) + НРБ-99/2009 + ICRP 103
            + IAEA TRS-471 (Cyclotron Produced Radionuclides).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав циклотронного комплекса</h2>
          <p className="text-slate-300 leading-relaxed">
            IAEA TRS-471 + EU GMP Annex 1 + НРБ-99/2009 для GMP-производства РФП:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Бункер циклотрона:</strong> ж/б тяжёлый бетон ρ=3.5 т/м³ (с баритом и магнетитом), стены 2.0-2.5 м толщ., потолок 2.5 м, дверь свинцово-стальная 50 т (Bertin-Cnim) — экран от нейтронного потока 10⁸ н/см²/с.</li>
            <li><strong>Циклотрон Cyclone 18/9 IBA:</strong> масса 25 т, габариты Ø3.5 × H2.2 м, магнит NbTi superferric 1.6 Т, vacuum 10⁻⁷ мбар (turbomolecular Pfeiffer), охлаждение водой замкнутый контур + cooling tower.</li>
            <li><strong>Target station:</strong> 4-8 мишеней (F-18, Ga-68, C-11, N-13) на ротационной головке, target body Nb или Ag с H₂¹⁸O для F-18 (изотопно-обогащённая вода 97% O-18, цена $1500/мл).</li>
            <li><strong>Hot cells (горячие камеры):</strong> 4-8 шт в ряд, свинцовое стекло 75 мм + Pb стены 100 мм, manipulators телескопические Wälischmiller A-100 (двусторонние).</li>
            <li><strong>Synthesis module:</strong> автомат. модули радиосинтеза (IBA Synthera + GE FASTlab + Trasis AllInOne) — заполнение «холодных» прекурсоров → нагрев → reverse-phase HPLC → стерилизация фильтром 0.22 µm.</li>
            <li><strong>Hot lab (лаборатория QC):</strong> ISO 14644 класс A (ламинар-кабинет) в окружении класса B, HPLC + GC + radio-TLC + multichannel γ-spectrometer для контроля изотопной чистоты.</li>
            <li><strong>Dispensing room:</strong> асептическая фасовка дозы пациенту во флаконы 5-30 мСв активности (для PET = 250-400 MBq на пациента), Ledn rolling shielded в свинц. сейфах 5 см.</li>
            <li><strong>Зона хранения отходов (Decay tank):</strong> отстаивание 10-15 период. полураспада F-18 (T½=109 мин → 18 ч полный распад до фон), металлических Ni-target — захоронение в КАЭН.</li>
            <li><strong>Cooling pond:</strong> бассейн с водой для активированных target бортов (Y-86, Sr-87, F-18 residual), время выдержки 30-90 дн.</li>
            <li><strong>Радиационный контроль:</strong> γ-area monitors (LB6500 Berthold) на стенах бункера + dose rate at door + personal dosimetry (TLD+ICAM Mirion).</li>
            <li><strong>QA-лаборатория и метрология:</strong> dose calibrator Capintec CRC-55tR для активности, mass spectrometer для радиохим. чистоты, sterility/endotoxin Q.C.</li>
            <li><strong>Резерв питания:</strong> 2 трансформатора 2×630 кВА (1+1) + UPS Eaton 9395 100 кВА × 10 мин + диз-генератор 800 кВА на 12 ч.</li>
            <li><strong>HVAC class A/B/C/D:</strong> HEPA H14 + 20-40 air changes/hr + −15 Па к коридору (отрицательное давление для радиоконтрольных зон).</li>
            <li><strong>Транспортная зона:</strong> «горячая» курьерская комната с автотранспортом-холодильником для доставки дозы в Алматы Онкоцентр / Астана РОЦ за ≤90 мин (T½ F-18 ограничивает радиус доставки 200 км).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Защита бункера</h2>
          <p className="text-slate-300">
            Циклотрон Cyclone 18/9 IBA 25 т, нейтронный поток 10⁸ н/см²/с
            при работе на 200 µA. Какая защита по СН РК 4.05-14 + НРБ-99?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычный бетон B25 стена 0.5 м без свинца — экономия 50%" },
              { v: "b", t: "Только свинцовые листы Pb 30 мм на стенах кирпичных" },
              { v: "c", t: "Стальной кожух 100 мм без бетона — компактно" },
              { v: "d", t: "Многослойная биозащита по IAEA TRS-188 + НРБ-99/2009 + СН РК 4.05-14: 1) Базовая стена — ж/б тяжёлый бетон ρ=3.5 т/м³ (с баритом BaSO₄ или магнетитом Fe₃O₄ как наполнитель + микроборное добавление H₃BO₃ 1-2%), толщина 2.0 м для бокового излучения + 2.5 м для потолка (расчётно по NCRP Report 79: HVL=8 см для нейтронов 18 МэВ, требуется 25 HVL = 200 см при ослабл. до 10⁻⁵); 2) Внутренний слой полиэтилена борированного (B-PE, 5% бор) 50 мм — замедляет быстрые нейтроны + поглощает термальные (B-10 + n → α + Li); 3) Внешний слой свинца Pb 30 мм — экранирует жёсткое γ-излучение от прометьего захвата нейтрона ¹H(n,γ)²H 2.2 МэВ; 4) Дверь бункера — свинцово-стальная композитная (3-секционная Bertin-Cnim Maglev) массой 50 т, толщ. эквивалент бетона + interlock-блокировка от двери до ВЧ-питания циклотрона; 5) Лабиринт входа — 2-3 поворота на 90° для рассеяния «уличного» излучения (sky-shine), длина лабиринта ≥6 м; 6) Воздуховод HVAC — Z-образный с blocked-line-of-sight, длина 8 м + HEPA фильтр на радиоактивные аэрозоли N-13 и O-15; 7) Активационный анализ материалов — все конструкционные элементы (анкера, кабельные лотки) только из низкоактивируемых сплавов (Al + Mg, не Fe); 8) Расчёт по программам MCNPX/Geant4 (нейтронно-фотонный транспорт) с верификацией измерениями TLD после пуска; 9) Радиационный контроль — γ-area monitor Berthold LB6500 на 4 стенах + door interlock + interlock на купол; 10) Допуск персонала 1 мЗв/год (НРБ-99 категория Б: население) для нерабочей зоны и 20 мЗв/год для категории А (персонал); СН РК 4.05-14 + НРБ-99/2009 + IAEA TRS-188 + ICRP 103" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Годовой выпуск F-18 FDG</h2>
          <p className="text-slate-300">
            Циклотрон IBA Cyclone 18/9 на токе 200 µA × 2 часа облучения → выход
            F-18 = 3 700 mCi (137 ГБк) end-of-bombardment. После QC + потери
            синтеза 50% → ~70 ГБк готового FDG за смену. 1 пациент = 370 МБк.
            Циклотрон работает 250 дней/год × 1 смена/день. Сколько пациентов
            в год можно обеспечить? Введи число пациентов:
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="пациентов/год"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 70 ГБк ÷ 0.370 ГБк/пац = ~190 пац/день
                × 250 раб. дней = ~47 500 пац/год потенциально, НО с учётом
                T½ F-18 = 109 мин и логистики (доставка в Онкоцентр Алматы +
                Астана РОЦ + Шымкент Онко за ≤90 мин) реально обеспечивается
                ~10-12 пац/день × 250 дн ≈ <strong>2 500-3 000 пациентов/год</strong>.
                Это покрывает ~30-40% потребности РК в PET/CT диагностике
                (общая потребность 7-8 тыс пациентов/год). IAEA TRS-471 + ICRP 106.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс центра</h2>
          <p className="text-slate-300">
            Центр ядерной медицины с циклотроном IBA Cyclone 18/9 (под ключ):
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + фундамент ж/б ρ=2.5 т/м³ под циклотрон 25 т (фундаментная плита 8×8×1.5 м) = 0.18 млрд тг</li>
            <li>Бункер ж/б тяжёлый бетон ρ=3.5 т/м³ (баритовый), стены 2.0 м + потолок 2.5 м, объём 220 м³ × 180 000 тг/м³ = 0.4 млрд тг</li>
            <li>Защитный слой свинца Pb 30 мм по стенам + B-PE 50 мм (220 м² × 80 000 тг) = 0.018 млрд тг</li>
            <li>Дверь свинцово-стальная 50 т Bertin-Cnim Maglev с interlock = 0.25 млрд тг</li>
            <li>Лабиринт входа ж/б + воздуховоды Z-образные = 0.08 млрд тг</li>
            <li>Циклотрон IBA Cyclone 18/9 (под ключ + монтаж + ввод в эксплуатацию + сертификация) = 4.8 млрд тг (~ $10M)</li>
            <li>Hot cells × 6 шт (Wälischmiller A-100, Pb 100 мм + свинц. стекло 75 мм) = 0.95 млрд тг</li>
            <li>Synthesis modules: IBA Synthera × 2 (F-18) + GE FASTlab × 1 (Ga-68) + Trasis AllInOne (C-11) = 0.7 млрд тг</li>
            <li>QC-лаборатория: HPLC Waters + GC + multichannel γ-spectrometer + dose calibrator Capintec = 0.45 млрд тг</li>
            <li>Hot lab ISO 14644 класс A/B (HEPA H14 + 40 ACH + LAF-кабинеты) = 0.6 млрд тг</li>
            <li>Системы безопасности: γ-area monitor Berthold LB6500 + TLD-dosimetry + interlock + СКУД биометрия = 0.18 млрд тг</li>
            <li>HVAC специальный (отрицат. давление, отдельные стояки для радио- и не-радио-зон) + чиллер 250 кВт = 0.4 млрд тг</li>
            <li>Электропитание 2×630 кВА + UPS Eaton 9395 100 кВА + DG 800 кВА = 0.32 млрд тг</li>
            <li>Декай-танк + cooling pond + система отходов класса А = 0.16 млрд тг</li>
            <li>Адм. корпус + 6 кабинетов ПЭТ-врачей + чистые helmet-room для гермозоны + проектирование (4% бюджета) + ПИР + НР + СП = 2.5 млрд тг</li>
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
                <strong>Ответ:</strong> ~12 млрд тг (~$25M USD) — стандарт мирового
                центра ядерной медицины «под ключ» с собственным циклотроном.
                Окупаемость 7-10 лет при 2 500-3 000 ПЭТ/КТ в год по цене 200-300 тыс. тг/обследование
                (выручка 700 млн – 1 млрд тг/год). Доля циклотрона = 40% бюджета. СН РК 4.05-14.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Логистика и T½</h2>
          <p className="text-slate-300">
            F-18 FDG имеет T½ = 109 мин. Циклотрон выдаёт дозу 70 ГБк в 8:00.
            Что ограничивает географический радиус доставки в клиники РК?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только цена транспортировки специализированным курьером" },
              { v: "b", t: "Нет ограничений — F-18 хранится 6+ часов без потерь" },
              { v: "c", t: "Радиус ≤200 км / ≤90 мин доставки — после 3-4 T½ (~6 часов) активность падает до ≤6.25%, что не покрывает диагностическую дозу 250-400 МБк/пациента: 1) Закон распада F-18 — A(t) = A₀ × 2^(-t/T½), где T½ = 109 мин (1.82 ч); 2) За 90 мин доставки активность падает на 43% (остаётся 57% от EOB) — приемлемо для пациентов в 200 км радиусе; 3) За 3 часа доставки (200-400 км) активность падает на 67% — нужно вводить ×2 дозу циклотрона на старте; 4) За 6 часов доставки (Алматы → Шымкент 700 км / Алматы → Астана 1200 км) активность падает на 88% — экономически неэффективно (требуется ×8 дозы); 5) Эффективная сеть РК с одним циклотроном в Алматы — Талдыкорган (300 км / 4 часа на машине = слишком), значит Талдыкорган не покрыть → нужен второй циклотрон в Астане для покрытия центрального + северного РК; 6) Транспортировка — спец. контейнер «горячий» с свинцовой защитой 30 мм Pb (масса 150-300 кг) + GPS + температура + dose monitor (контейнер EDIA T-12 с активностью 100 ГБк); 7) Лицензированный курьер по UN 2916 «Radioactive material, Type A» — авто Pajero / Land Cruiser с спец. крепления + двое сопровождающих радиолога + страховка $1M; 8) Воздушная доставка ИЛ-76 / Boeing 737 cargo — но требует разрешения IATA Dangerous Goods Class 7 + ICAO Annex 18 + Air Astana cargo dept; 9) Кросс-граница (импорт F-18 из Новосибирска / Москвы) — нет смысла, T½ съест 80% активности за 6+ часов; 10) Решение РК — построить второй циклотрон в Астане (BC1710 GE Healthcare уже там), плюс план третий в Шымкенте; СН РК 4.05-14 + НРБ-99 + IAEA TRS-471 + UN 2916 IATA-DGR + ICAO Annex 18" },
              { v: "d", t: "Расстояние до ближайшей таможни (1 час экспорт-формальностей)" },
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
              {score === 4 && "Отлично! Ты владеешь радиофармацевтикой и циклотронной экономикой."}
              {score === 3 && "Хорошо. Перечитай IAEA TRS-471 + НРБ-99/2009 для углубления."}
              {score === 2 && "Уровень C — пересмотри СН РК 4.05-14 + ICRP 103."}
              {score <= 1 && "Нужно повторить. См. IAEA TRS-188 (Cyclotron Shielding) + UN 2916 IATA-DGR."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>СН РК 4.05-14</strong> — Радиационная безопасность ядерно-физических установок</li>
            <li><strong>НРБ-99/2009 РК</strong> — Нормы радиационной безопасности (категории А/Б, пределы доз)</li>
            <li><strong>ОСПОРБ-99/2010</strong> — Основные санитарные правила обеспечения радиационной безопасности</li>
            <li><strong>IAEA TRS-471</strong> — Cyclotron Produced Radionuclides: Operation and Maintenance</li>
            <li><strong>IAEA TRS-465</strong> — Cyclotron Produced Radionuclides: Principles and Practice</li>
            <li><strong>IAEA TRS-188</strong> — Cyclotron Shielding Design (расчёт защиты бункеров)</li>
            <li><strong>ICRP 103 (2007)</strong> — Recommendations on Radiological Protection</li>
            <li><strong>ICRP 106</strong> — Radiation Dose to Patients from Radiopharmaceuticals</li>
            <li><strong>EU GMP Annex 1 (2022)</strong> — Manufacture of Sterile Medicinal Products (для радио-фарм.)</li>
            <li><strong>EANM Guidelines on Good Radiopharmacy Practice (GRPP) 2007</strong></li>
            <li><strong>ISO 14644</strong> — Cleanrooms (классы A/B/C/D для дисп. РФП)</li>
            <li><strong>UN 2916</strong> — Type A Radioactive Material (транспортировка)</li>
            <li><strong>IATA Dangerous Goods Regulations Class 7</strong> — авиадоставка</li>
            <li><strong>ICAO Annex 18</strong> — The Safe Transport of Dangerous Goods by Air</li>
            <li><strong>NCRP Report 79</strong> — Neutron Contamination from Medical Accelerators (расчёт защиты)</li>
            <li><strong>Приказ МЗ РК № 7 от 2010</strong> — лицензирование радиофарм. деятельности</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
