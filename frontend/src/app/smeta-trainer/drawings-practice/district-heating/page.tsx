"use client";
import Link from "next/link";
import { useState } from "react";

export default function DistrictHeatingPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1500) <= 150;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Теплоэлектроцентрали (ТЭЦ)</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🔥 Теплоэлектроцентрали ТЭЦ и District Heating</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #255. Теплоэлектроцентрали (ТЭЦ) и магистральные тепловые сети РК
            (отличие от L4 «Тепловые сети» — здесь промышленный масштаб с генерацией):
            Алматинская ТЭЦ-1 (380 МВт электр. + 1200 Гкал/ч тепла), ТЭЦ-2 (510 МВт +
            1800 Гкал/ч), ТЭЦ-3 (750 МВт + 2400 Гкал/ч), ТЭЦ Астана 1 + 2 + 3 общей
            мощностью ~1.5 ГВт. Паровые турбины Siemens SST-700 / Mitsubishi Heavy
            Industries T-100/130-130 теплофикационные, паровые котлы Babcock & Wilcox
            420 т/час пара, угольное топливо Экибастуз + газ (двухтопливные). Тепло-сеть
            РК 5000+ км магистральных трубопроводов Ø600-1400 мм. СН РК 4.02-12,
            ASME B31.1, EN 13941, ISO 9869, ВНТП-1 ТЭС.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технология ТЭЦ + сеть</h2>
          <p className="text-slate-300 leading-relaxed">
            ВНТП-1 ТЭС + ASME B31.1 + EN 13941 (Pre-insulated bonded pipes):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Котельный цех:</strong> 3-6 паровых котлов Babcock&Wilcox или Foster Wheeler 320-500 т/час пара при 138 бар × 540°C, угольное (Экибастуз) или газовое топливо, дымосос+дутьевые вентиляторы.</li>
            <li><strong>Машинный зал:</strong> 3-5 теплофикационных турбин Siemens SST-700 или Mitsubishi T-100-130 (100 МВт каждая, отборы пара для тепла), генераторы синхронные ABB 13.8 кВ × 110 МВт.</li>
            <li><strong>Конденсаторы пара:</strong> поверхностные с охлаждением речн./городской водой, 14-метровые трубы Cu-Ni.</li>
            <li><strong>Бойлерная (Heat Recovery):</strong> теплообменники между паром отборов турбин и сетевой водой 130°C/70°C двухтрубной системы.</li>
            <li><strong>Тепловая магистраль:</strong> Ø800-1400 мм предв. изолированные стальные трубы DN800 (Зворыкина или Polish Gilex с PUR-изоляцией 100-200 мм), сигнальная система DET-WERK для обнаружения течей.</li>
            <li><strong>Тепловые камеры:</strong> ж/б колодцы с задвижками Vexve DN800 PN16, расходомерами Endress+Hauser Promag W, отводными точками каждые 500-1500 м.</li>
            <li><strong>Перемычки и резервирование:</strong> кольцевая схема с возможностью переключения, 2 источника на каждого потребителя.</li>
            <li><strong>Тепловые пункты ИТП:</strong> для жилых домов — Danfoss / Honeywell автоматич. регуляторы, узел учёта Карат-Энерго.</li>
            <li><strong>Топливный цех:</strong> разгрузочное устройство ж/д цистерн, угольный склад 30-сут запас, дробилки + конвейеры подачи в бункеры.</li>
            <li><strong>Дымовые трубы:</strong> 150-180 м из ж/б преднапряж. с футеровкой внутри + жаростойким бетоном, газоочистка ESP + сухая известковая (для SO₂).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Парогенератор и турбина</h2>
          <p className="text-slate-300">
            ТЭЦ 380 МВт электр. + 1200 Гкал/ч тепла на угле Экибастуз (зольность 30%,
            калорийность 4000 ккал/кг). Какая комбинация котёл-турбина?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Газовая турбина GE 9HA на природном газе — самая чистая, но в РК нет газа" },
              { v: "b", t: "Один паровой котёл 500 т/час и одна конденсационная турбина 350 МВт" },
              { v: "c", t: "Только конденсационная схема без отбора пара на тепло" },
              { v: "d", t: "Угольная ТЭЦ с теплофикацией: 1) 4 паровых котла Babcock&Wilcox PFB (Pulverized Fuel-fired Boiler) производительность 420 т/час пара 138 бар × 540°C каждый, общая 1680 т/час (с резервом N+1 = 3 рабочих, 1 резерв при ремонте); 2) Газо-воздушный тракт: дымосос ДН-26×2 (2 шт. на котёл) + дутьевые вентилятор; 3) Топливоподготовка: угольная мельница ШБМ-370/850 4 шт. на котёл с производит. 65 т/час пыли; 4) 4 теплофикационных турбины Siemens SST-700 или ОАО «Силовые Машины» T-100/130-130 с двумя теплофикационными отборами (Heating Extraction) при 1.2 бар (для подогрева сетевой воды до 130°C) и 0.12 бар (для предв. подогрева); 5) Генераторы синхронные ABB или Siemens 13.8 кВ / 110 МВт × 4 = 440 МВт установленная (брутто), после собств. нужд 60 МВт = 380 МВт нетто; 6) Конденсатор поверхностный с охлаждением Cu-Ni трубками 14 м длины 25 000 м² поверхности, охлаждение реверсной/городской водой; 7) Бойлерная теплообменники (5 шт N+1) — пар отборов → сетевая вода 130/70°C, мощность 280 Гкал/ч каждый = 1200 Гкал/ч обще; 8) КПД: электр. брутто 38-42% (при работе только на электр.), теплофикационный комбинированный КПД 80-85% (электр. + тепло одновременно); 9) Газоочистка: ESP электрофильтр 99.5% пыль + сухая известковая SO₂-очистка + DeNOx SCR; 10) Дымовая труба H=180 м ж/б преднапряж.; ВНТП-1 ТЭС + ASME B31.1" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Магистральная труба</h2>
          <p className="text-slate-300">
            Алматинская тепло-сеть: основная магистраль от ТЭЦ-2 к городу должна
            передавать 1500 Гкал/час при перепаде t° 130°C прямой / 70°C обратки.
            Скорость теплоносителя ≤2.5 м/с (норма). Какой диаметр Ø трубы (мм)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Q = G × Cp × ΔT (Гкал/час)<br />
            G = Q × 10⁶ / (Cp × ΔT) (кг/час)<br />
            V_объём = G / ρ (м³/час)<br />
            S_сечения = V_объём / (3600 × v_скорости)<br />
            d = √(4 × S / π)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="d, мм"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: Cp = 1 ккал/(кг·°C); G = 1500×10⁶ / (1×60) = 25 × 10⁶ кг/час; V = 25 × 10⁶ / 970 (ρ при 100°C) = 25 773 м³/час = 7.16 м³/с; S = 7.16 / 2.5 = 2.86 м²; d = √(4×2.86/π) = 1.91 м = 1910 мм. С учётом потерь на трение и теплоотдачи ≈ Ø 1500 мм (стандартный ряд DN1400-1500). Размещается в подземн. бесканальной прокладке с PUR-изоляцией 200 мм по EN 13941.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ТЭЦ 380 МВт + 1200 Гкал/ч</h2>
          <p className="text-slate-300">
            ССЦ + импорт: главный корпус 30 000 м² (котельный + машинный) — 28 млрд тг,
            4 паровых котла Babcock&Wilcox 420 т/час 138 бар — 96 млрд тг,
            4 турбины Siemens SST-700 + генераторы ABB 110 МВт — 65 млрд тг,
            конденсаторы Cu-Ni + охлаждающие башни градирни — 12 млрд тг,
            бойлерная теплообменники 5 × 280 Гкал/ч + сетевая насосная — 14 млрд тг,
            топливный цех: угольный склад 30 сут × 4 котла = ~80 000 т + конвейеры — 22 млрд тг,
            водоподготовка для котлов (деминерализация Veolia ION+) — 8 млрд тг,
            ХВО (Химическая Водоочистка) — 4 млрд тг,
            газоочистка: ESP + DeNOx SCR + Sulfur scrubber — 28 млрд тг,
            дымовая труба H=180 м ж/б преднапр. + футеровка — 14 млрд тг,
            ж/д подъездная + разгрузочное устройство 24 цистерн — 8 млрд тг,
            энергоснабжение собств. нужд + блочные ТП + ОПУ — 16 млрд тг,
            АСУ ТП Siemens SPPA-T3000 + лаборатория контроля топлива — 12 млрд тг,
            тепло-магистраль Ø1500 мм 5 км предв. изол. — 8 млрд тг,
            благоустройство + офисы + проектирование + ПНР — 35 млрд тг,
            страхование EPC + резерв подрядчик — 10 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~380 млрд тг (допуск ±10%). 28+96+65+12+14+22+8+4+28+14+8+16+12+8+35+10 = 380 млрд тг. Удельная стоимость ~1.0 млрд тг/МВт_эл — соответствует мировым угольным ТЭЦ (Bełchatów Польша $1.5/Вт, Indian NTPC $1.0-1.2/Вт). ТЭЦ-2 Алматы (модернизация) — оценочно $0.8 млрд = 380 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита тепло-магистрали</h2>
          <p className="text-slate-300">
            Магистральная тепло-сеть Ø1500 мм должна работать 30+ лет с минимумом
            аварий. Что обязательно по EN 13941 + ASME B31.1?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Толстая изоляция минвата 200 мм — стандарт" },
              { v: "b", t: "Только обходной канал бетонный (channel system)" },
              { v: "c", t: "Pre-insulated Bonded Pipe System по EN 13941: 1) Стальная труба (рабочая) ст.20 или 17ГС толщ. 16-18 мм с антикоррозионным покрытием zinc-rich epoxy; 2) Жёсткая теплоизоляция полиуретан PUR plus 200 мм (λ=0.024 Вт/м·К) — заводская заливка прямо на сталь, сцепление с трубой и с наружным защитным «кожухом»; 3) Наружный защитный кожух — полиэтилен PE-HD 8 мм или гофрированная сталь; 4) Бесканальная прокладка прямо в траншее без камер — самая экономичная и надёжная; 5) Сигнальная система Det-Werk Brandes или Logstor с медными проводниками 2× встроенными в изоляцию — обнаружение влаги от утечки за ≤24 ч с точностью ±10 м; 6) Компенсация теплового удлинения через пред-натяжение (pre-stressed installation): труба нагревается до t°_рабоч в магазине, затем монтируется в траншею с заваркой при холодном состоянии — снимает 50% термических напряжений; 7) Заводская сертификация EN 14419 (для сборки сегментов трубы) + EN 489 (для стыков на трассе с термоусадочной муфтой); 8) Гарантия производителя 20 лет (Logstor, Brugg, ZRRC); 9) ИТП Танк-Линк ЭШМ узлы учёта + регуляторы перепада давления + автоматич. подача; 10) Скрытые крепления и расширительные сильфонные компенсаторы Belmore RC50 на длинных прямых участках; 11) Срок службы 30-50 лет с минимумом TO; EN 13941 + EN 489 + ISO 9869 + ВНТП-1 ТЭС" },
              { v: "d", t: "Только обычная сталь с минватой и без сигнализации" },
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
                {score === 4 ? "Отлично — готовы к проектированию ТЭЦ" : score >= 2 ? "Перечитайте ВНТП-1 ТЭС + ASME B31.1 + EN 13941" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ВНТП-1 ТЭС (Тепловые Электростанции), СН РК 4.02-12, ASME B31.1 (Power Piping), EN 13941 (Pre-insulated Bonded Pipes), EN 489 (Joint Assemblies), ISO 9869 (In-situ Thermal Performance).</p>
          <p><strong>Реальные объекты РК:</strong> Алматинская ТЭЦ-1 (380 МВт + 1200 Гкал/ч), ТЭЦ-2 (510 МВт), ТЭЦ-3 (750 МВт), Астанинская ТЭЦ-1 (160 МВт), ТЭЦ-2 (480 МВт), Карагандинская ТЭЦ-3 (435 МВт), Экибастузская ГРЭС-1+2 (4000+1000 МВт).</p>
        </section>
      </main>
    </div>
  );
}
