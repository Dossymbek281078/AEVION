"use client";
import Link from "next/link";
import { useState } from "react";

export default function TramwayLightRailPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1980) <= 200;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 285_000_000_000) <= 28_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Трамваи и LRT</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚊 Трамваи и легкорельсовый транспорт (LRT)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #220. LRT и трамвайные системы РК: Астана LRT 22 км (в стадии стройки 2024-2027),
            Алматинский трамвай (исторический, демонтирован в 2015), Усть-Каменогорский (действующий
            7 км). Контактная сеть 750 В DC, рельсы Р65 на ж/б шпалах + щебёночное основание,
            стрелочные переводы EW R-300 1/9. СН РК 4.04, ГОСТ 32586, IEC 62128, СП 245.1326000.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав LRT-системы</h2>
          <p className="text-slate-300 leading-relaxed">
            По СН РК 4.04 + СП 245.1326000 «Трамвайные и троллейбусные линии»:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Верхнее строение пути: рельсы Р65 (длина 25 или 100 м), ж/б шпалы (1840 шт/км), щебень фракции 25-60 мм.</li>
            <li>Стрелочные переводы EW R-300 1/9 (электроприводные с обогревом).</li>
            <li>Контактная сеть КС-160 или КС-200: контактный провод МФ-100 (медь-серебро 100 мм²), несущий трос ПБСМ-95, опоры 8-10 м через 30-40 м, спайка пайо.</li>
            <li>Тяговая подстанция (ТПС) 27.5 кВ AC → 0.75 кВ DC, мощность 1500-2400 кВт через каждые 1.5-2 км.</li>
            <li>Депо на 60-80 поездов (Stadler/CAF/Hyundai Rotem 3-секционные).</li>
            <li>Платформы остановочные L=45 м (под 3-секц. поезд), низкопольные для маломобильных.</li>
            <li>СЦБ-системы: ETCS Level 1/2 (на скоростных LRT), классические для трамвая.</li>
            <li>Светофоры приоритета трамвая на перекрёстках, СУ ОДД координированная.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Тип верхнего строения</h2>
          <p className="text-slate-300">
            LRT Астана 22 км: 12 км по выделенному эстакадному полотну + 10 км по
            существующему дорожному покрытию совмещённо с трамвайным полотном.
            Какой тип ВСП оптимален?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Бесшпальный путь EBS (с заливкой бетоном) — экономичнее всего" },
              { v: "b", t: "Классический ВСП на деревянных шпалах — традиционно" },
              { v: "c", t: "Гибридное решение: эстакада — безбалластный путь Rheda 2000 на бетонных плитах (минимум вибраций, ТО 1 раз в 5 лет, срок службы 60+ лет); городские участки — путь с резинометаллическими амортизаторами Edilon Corkelast ERS в ж/б корыте с виброгасящими матами USP (для шумоизоляции у жилья), рельсы непрерывно сваренные RIPS 60E1, ширина колеи 1520 мм СНГ или 1435 мм EU-стандарт, СП 245.1326000" },
              { v: "d", t: "Деревянные шпалы + рельсы Р50 без подходящего основания" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Контактная сеть</h2>
          <p className="text-slate-300">
            LRT-линия 22 км, контактная сеть КС-160 (140 мм² МФ + 95 мм² ПБСМ).
            Опоры через 30 м, провод подвешен на 5.5 м над УГР (уровнем головки рельса).
            Сколько метров контактного провода нужно (с учётом анкерных и допусков)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 space-y-1 font-mono">
            <div>Полная длина = 2 × длина линии (контакт+несущий)</div>
            <div>+10% запас на анкерные участки, спайки, депо</div>
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Длина провода (×100 м для удобства)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 22 км × 2 пути × 2 провода (несущий+контактн.) = 88 км провода. +10% запас + участки на стрелках/депо = ~98 км ≈ 980×100 м провода. С учётом 2× для прямого и обратного полотна и резервных участков → ~1980 × 100 м = 198 км общая длина проводов всех типов в системе.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет LRT 22 км</h2>
          <p className="text-slate-300">
            ССЦ + импорт: эстакада 12 км × 2-путная (опоры + балки + плиты) — 85 млрд тг,
            земляное полотно 10 км + ВСП щебёнка/шпалы/рельсы — 38 млрд тг,
            18 платформенных остановок (45 м) + 3 узловые станции — 14 млрд тг,
            контактная сеть КС-160 с опорами + анкеровка — 18 млрд тг,
            8 ТПС (тяговые подстанции) 1500 кВт + кабельная сеть 10 кВ — 28 млрд тг,
            27 поездов Stadler Tango 3-секц. (40 м, 250 пасс.) — 38 млрд тг,
            депо на 30 поездов с мастерскими + центром управления — 28 млрд тг,
            СЦБ + СУ ОДД светофоры приоритета + АСКОУП — 12 млрд тг,
            благоустройство + пешеходные настилы + остеклённые навесы — 18 млрд тг,
            проектирование + ПНР + страхование EPC FIDIC — 6 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~285 млрд тг (допуск ±10%). 85+38+14+18+28+38+28+12+18+6 = 285 млрд тг. Удельная стоимость ~13 млрд тг/км — соответствует LRT-проектам мира (Дубай Metro Red Line ~$170 млн/км).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Тяговая подстанция</h2>
          <p className="text-slate-300">
            ТПС 27.5 кВ → 0.75 кВ DC обеспечивает питание контактной сети.
            Какие особенности по ПУЭ глава 7.5 и IEC 62128?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычная городская ТП 6/0.4 кВ + выпрямитель" },
              { v: "b", t: "Достаточно одного трансформатора без резервирования" },
              { v: "c", t: "Двухстороннее питание контактной сети без секционирования" },
              { v: "d", t: "ТПС 1500-2400 кВт с резервированием N+1, ввод 27.5 кВ AC от 2 независимых фидеров энергосистемы, понижающий трансформатор + 12-пульсный выпрямитель (или 24-пульсный для меньших гармоник), сглаживающий реактор и LC-фильтр, выходное 0.75 кВ DC через быстродействующие автоматич. выключатели (БВ-1, отключение за 6-8 мс), секционирование контактной сети через 1.5-2 км для локализации повреждений, заземление по системе TN-S с раздельным защитным проводником, рекуперативное торможение поездов с обратной отдачей в сеть, мониторинг ИТР через SCADA, ПУЭ глава 7.5 + IEC 62128 + EN 50124" },
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
                {score === 4 ? "Отлично — готовы к проектированию LRT/трамвая" : score >= 2 ? "Перечитайте СН РК 4.04 + СП 245.1326000" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 4.04, СП 245.1326000 (Трамвайные линии), ГОСТ 32586 (Контактная сеть), ПУЭ глава 7.5, IEC 62128 (Rail Power), EN 50124 (Insulation), TSI ENE EU.</p>
          <p><strong>Реальные объекты РК:</strong> Астана LRT 22 км (Hyundai Engineering + Алматыметрокурылыс, в стройке 2024-2027), Усть-Каменогорский трамвай 7 км (действ.), исторический Алматинский трамвай 1959-2015.</p>
        </section>
      </main>
    </div>
  );
}
