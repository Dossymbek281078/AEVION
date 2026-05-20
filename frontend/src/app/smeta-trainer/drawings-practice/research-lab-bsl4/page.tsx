"use client";
import Link from "next/link";
import { useState } from "react";

export default function ResearchLabBsl4Page() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 18) <= 2;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 56_000_000_000) <= 5_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · BSL-4 лаборатории</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🦠 BSL-4 лаборатории (макс. биозащита)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #274. Биолаборатории высшего уровня BSL-4 (отличие от L5
            «Университеты-кампусы» батча 63 про BSL-3 в Назарбаев Универс. — здесь
            высший уровень для работы с возбудителями летальных инфекций без вакцин
            и лечения: Эбола, Марбург, Ласса, оспа variola): Казахстанский Научный
            Институт особо опасных инфекций (КНИИОИ) Алматы (планируемое BSL-4
            отделение), КНИИ карантинных особо опасных инфекций (BSL-3+ с возможностью
            расширения до BSL-4). Класс IV Biosafety Cabinets (полностью изолир.),
            decon-air тройная HEPA H14, positive-pressure suit для входа.
            ВОЗ Laboratory Biosafety Manual 4th ed (2020), CDC BMBL 6th ed.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Уровни биозащиты BSL-1 → BSL-4</h2>
          <p className="text-slate-300 leading-relaxed">
            WHO Lab Biosafety Manual 4th ed + CDC BMBL 6th ed:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>BSL-1:</strong> базовые лаборатории, неопасные микроорганизмы (E.coli K-12), стандартная PPE халаты+перчатки.</li>
            <li><strong>BSL-2:</strong> опасные на средне-низком уровне (вирусы гепатита, ВИЧ, сальмонеллы), биосейфти-кабинеты Class II, ограниченный доступ.</li>
            <li><strong>BSL-3:</strong> возбудители респираторных опасных (туберкулёз, SARS-CoV-2, сибирская язва), отрицательное давление, биосейфти Class II B2, herald маски PAPR.</li>
            <li><strong>BSL-4:</strong> возбудители смертельных без лечения/вакцин (Эбола, Марбург, Ласса, Hantavirus, оспа variola), полностью изолированный лаб. блок.</li>
            <li><strong>BSL-4 Suit Lab:</strong> работа в positive-pressure suits Trelleborg или ILC Dover (как космонавтские, с подачей дыхат. воздуха через шланг от потолка с резерв. баллонами SCBA на 30 мин).</li>
            <li><strong>BSL-4 Cabinet Lab:</strong> работа в Class III полностью гермет. боксах с резиновыми перчатками-манипуляторами (как медицинский СИЗ-бокс при Эболе).</li>
            <li><strong>Decon Shower:</strong> при выходе из BSL-4 обязательная декон. химическим раствором Vesphene IIIse или дистил. водой 7+ мин под душем.</li>
            <li><strong>Autoclave Pass-through:</strong> двухсторонний автоклав 250+ кг на стене между BSL-4 и внешней зоной — все материалы стерилизуются перед выводом.</li>
            <li><strong>Air Handling:</strong> отрицательное давление каскадом −30/−15/−5 Па от BSL-4 к коридору, тройная HEPA H14 (99.995% эффект.) на вытяжке + UV-облучение перед выпуском.</li>
            <li><strong>Effluent Treatment:</strong> все стоки из BSL-4 (раковины, душевые, унитазы) — нагрев до +121°C × 60 мин в Effluent Decon Tank (термич. стерилиз.) перед сбросом.</li>
            <li><strong>Электропитание:</strong> N+1 резервирование + ДГУ автозапуск ≤10 сек + UPS для критич. систем (давление, вытяжка) — нельзя терять отрицательное давление.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Air Handling BSL-4</h2>
          <p className="text-slate-300">
            BSL-4 лаборатория должна обеспечить полную защиту окружающей среды от утечки
            патогенов. Какая система air handling по ВОЗ Lab Biosafety Manual 4th ed?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Тройная HEPA H14 на вытяжке без отрицательного давления" },
              { v: "b", t: "Только отрицательное давление −5 Па + одна HEPA H13" },
              { v: "c", t: "Отдельная вентиляция без герметизации между зонами" },
              { v: "d", t: "Multi-layered Air Containment BSL-4 по ВОЗ + CDC + ASHRAE Standard 170: 1) **Каскадное отрицательное давление**: BSL-4 lab суит −30 Па → промежут. шлюз −15 Па → personnel decon shower −10 Па → buffer corridor −5 Па → внешний коридор 0 Па (приток воздуха только «изнутри-наружу», never reverse); 2) **Полная герметизация зданий**: ж/б монолит без проникновений, все швы герметизированы Sika Sikaflex 3WF, кабельные/трубные проёмы через bag-out filters и gas-tight bulkheads; 3) **Вытяжная вентиляция**: тройная HEPA H14 (99.995% эффективность на 0.3 мкм) в КАСКАДЕ перед выпуском в атмосферу + UV-облучение 254 нм для дополнит. стерилиз.; 4) **Bag-in/Bag-out filters** для замены HEPA — без контакта оператора с потенциально заражённым фильтром; 5) **Резервирование N+2** на вентиляторах вытяжки (2 рабочих + 2 резерв на автозапуске при отказе) — defense in depth; 6) **Air-tight HEPA housing** Filtra-Systems или Camfil с GTFK (Gas-Tight) сертификатом; 7) **Continuous monitoring** дифференц. давлений Setra 264 + сигнал тревоги при потере −30 Па (catastrophe → автозапуск backup вентилятора); 8) **Decontamination мгнов.** при разгерметизации — autoclaving всего oborud. и помещения VHP (Vaporized Hydrogen Peroxide) Steris VHP1000ED после инцидента; 9) **Independent monitoring** by external regulator (ВОЗ + НМФ + КНБ); 10) **Annual integrity testing** PSD (Pressure Decay Test) для каждой комнаты, газовая утечка ≤0.01% объёма/час; ВОЗ Lab Biosafety Manual 4th ed (2020) + CDC BMBL 6th ed + ASHRAE Standard 170 + EN 12128 + НРБ-99" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кратность воздухообмена</h2>
          <p className="text-slate-300">
            BSL-4 suit lab объёмом 300 м³ (10×6×5 м). Каждая работающая там
            personnel suit требует приток дыхат. воздуха 75-100 л/мин (для работы
            оператора). 4-6 человек одновременно. Какая кратность воздухообмена в
            самой лаборатории (раз/час)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Норматив ВОЗ для BSL-4: ≥15 крат/час свежий воздух<br />
            Для тёплого климата при работе людей: до 25 крат/час<br />
            +резерв на пик при decon
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кратность, 1/час"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: ВОЗ требует ≥15 крат/час для BSL-4. На практике строят с запасом 18-20 1/час. Для нашего объёма 300 м³ × 18 = 5400 м³/час свежего воздуха через тройную HEPA H14. Скорость воздуха в воздуховодах не должна превышать 5 м/с (для предотвращения вторичного аэрозолирования).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет BSL-4</h2>
          <p className="text-slate-300">
            BSL-4 лабораторный комплекс 4500 м² (включая buffer-зоны и technical
            mechanical spaces). ССЦ + импорт: монолит ж/б каркас + перекрытия с
            повышенным армированием — 4.2 млрд тг,
            внутренние стены полностью герметичные (нерж. сталь + эпоксид) — 5.4 млрд тг,
            полы эпокси полно-сварные Sika SikaFloor бесшовные, антибакт. — 1.4 млрд тг,
            гермет. двери Industrias Pino с шлюзами interlocking × 12 шт. — 1.2 млрд тг,
            personnel decon shower 6 шт + Vesphene IIIse дозирование — 1.6 млрд тг,
            HVAC специальная: тройная HEPA H14 каскад + UV + bag-out + Setra мониторинг — 11 млрд тг,
            Class III Biosafety Cabinets гермет. + перчатки манипуляторы × 8 — 1.4 млрд тг,
            8 positive-pressure suits Trelleborg/ILC Dover + дыхат. система воздухоподачи — 0.96 млрд тг,
            autoclave pass-through 250 кг × 4 — 0.85 млрд тг,
            Effluent Decon Tank 5000 л термическая стерилиз. +121°C — 2.4 млрд тг,
            CCTV IP HD 4K на каждом метре + центр мониторинга — 0.5 млрд тг,
            СКУД биометрия + photo-iris сканеры + двухфакторная — 0.6 млрд тг,
            VHP Steris VHP1000ED для decon при инцидентах × 2 — 0.5 млрд тг,
            аварийное газовое пожаротушение Inergen IG-541 — 1.8 млрд тг,
            энергоснабжение 2 независим. ввода 35 кВ + ДГУ 2 МВт N+2 + UPS — 5 млрд тг,
            лаборатория контроля качества (НТР-99 дозиметрия + микробиол. контроль) — 1.6 млрд тг,
            здания административных + офисы + storage — 1.8 млрд тг,
            проектирование + ВОЗ certification + IAEA + КНБ согласование + ПНР — 4.8 млрд тг,
            обучение персонала BSL-4 (полугодовой курс + сертификация WHO) — 2.5 млрд тг,
            оборотные ср-ва (расходники, реагенты, программы исследований) — 6.5 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~56 млрд тг (допуск ±10%). 4.2+5.4+1.4+1.2+1.6+11+1.4+0.96+0.85+2.4+0.5+0.6+0.5+1.8+5+1.6+1.8+4.8+2.5+6.5 = 55.5 млрд тг. Удельная стоимость BSL-4 — $1500-3000/м² (в РК с учётом импорта оборудования = ~12 млн тг/м² = 56 млрд тг для 4500 м²). Сравнение: NIH Galveston BSL-4 (Texas) ~$174 млн = 81 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Биобезопасность персонала</h2>
          <p className="text-slate-300">
            Работа в BSL-4 с Эболой / Марбургом — высочайший риск. Что обязательно по
            CDC BMBL 6th ed + ВОЗ для защиты персонала?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только перчатки одноразовые + халат" },
              { v: "b", t: "Только защитные очки + маска FFP3" },
              { v: "c", t: "Multi-layer Personnel Protection по CDC BMBL 6th ed + ВОЗ Lab Biosafety: 1) **Positive-pressure suit** Trelleborg или ILC Dover — полностью изолированный костюм с подачей дыхательного воздуха через шланг от потолка (Building Air HEPA-фильтр обеспечивает 75-100 л/мин на каждого), резервный баллон SCBA на спине 30 мин автономии при отключении центральной подачи; 2) **3 пары перчаток** под костюм: внутренние нитриловые, средние latex (если нет аллергии), внешние butyl rubber (химически устойчивые); 3) **Pre-entry training**: обязательное обучение минимум 6 мес (теория + 200+ часов симуляций) + ежегодная переподготовка + ежеквартальный re-фит-тест костюма; 4) **Buddy system**: запрет на работу одиночно, минимум 2 человека одновременно (один спасает другого при ЧС); 5) **Continuous monitoring**: видеонаблюдение всех работ + аудио связь с диспетчером + emergency buttons на стенах каждые 3 м; 6) **Pre-employment health screening**: иммунизация против всех доступных вакцин (yellow fever, hep B, rabies, smallpox если работа с variola), регулярный медчекап каждые 6 мес, психологическая оценка; 7) **Mandatory exit decontamination**: 7+ минут под душем с Vesphene IIIse → проверка integrity костюма по выходе → снятие костюма по строгому SOP (один контаминант. наружу пов., другой — внутр. чистый); 8) **Post-exposure protocol**: если incident — immediate quarantine 21 день (incubation Ebola), серологический мониторинг, contact tracing; 9) **Insurance coverage**: ответственность работодателя $1+ млн на персонал; 10) **Запрет на vivisuence** (живое размножение опасных штаммов вне strict protocol), запрет на dual-use research (потенциально применимых в bioweapons); 11) Сертификация ВОЗ Pathogen Inventory + biothreat assessment + IFBA International Federation Biosafety Associations; CDC BMBL 6th ed + ВОЗ Lab Biosafety Manual 4th ed + НРБ-99 + Cartagena Protocol on Biosafety" },
              { v: "d", t: "Только маска N95 + защитный комбинезон Tyvek" },
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
                {score === 4 ? "Отлично — готовы к проектированию BSL-4" : score >= 2 ? "Перечитайте ВОЗ Lab Biosafety + CDC BMBL + EN 12128" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ВОЗ Laboratory Biosafety Manual 4th ed (2020), CDC Biosafety in Microbiological and Biomedical Laboratories BMBL 6th ed, EN 12128, ASHRAE Standard 170 (Health Care Facilities), НРБ-99, Cartagena Protocol on Biosafety.</p>
          <p><strong>Реальные объекты РК и мир:</strong> КНИИОИ Алматы (планируемое BSL-4 отделение), КНИИ карантинных особо опасных инф. (BSL-3+), Galveston BSL-4 Texas USA, Wuhan Institute of Virology BSL-4 China, Inserm-Mérieux Lyon Жан Мерье BSL-4 France, Vector Сибирь Россия BSL-4.</p>
        </section>
      </main>
    </div>
  );
}
