"use client";

import Link from "next/link";
import { useState } from "react";

export default function InfrastructureProjectsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => {
    // 25 км × 12 млрд тг/км = 300 млрд тг (метро бенчмарк) — но реально 8-15 млрд
    // Пусть метро 1 км = 12 млрд → 25 × 12 = 300 млрд тг
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 300) <= 10 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "c" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const megaprojects = [
    {
      name: "БАКАД — Большая Алматинская кольцевая",
      type: "Автомагистраль",
      params: "66 км, 4-6 полос, мосты + развязки, бюджет 750 млн $ (370 млрд тг)",
      who: "MIA Development (Malaysia) — концессионер, гарантия RoK",
      status: "Открытие 2024-2025 (поэтапно)",
      smeta: "FIDIC Red Book, EVMS, BIM 5D, RICS Quantity Surveyor",
    },
    {
      name: "Метро Алматы (расширение)",
      type: "Подземный транспорт",
      params: "Линия 2 (8 станций, ~ 11 км) + Линия 3, бюджет 1.5-2 млрд $",
      who: "KazTransServis (KZ) + Шанхайский Метро (CN) — субподряд",
      status: "Линия 2 — открытие 2025, Линия 3 — после 2030",
      smeta: "ЭСН Сб.31 (метро) + 5D BIM + EVMS + специализир. ТБМ-расчёты",
    },
    {
      name: "Аэропорт Алматы (Almaty Airport)",
      type: "Аэропортовая инфраструктура",
      params: "Новый терминал T2, 2-я ВПП, общая инвестиция 200 млн $",
      who: "TAV Airports (Турция) + местные подрядчики",
      status: "T2 — открытие 2026, ВПП-2 — 2028",
      smeta: "FIDIC + ICAO стандарты + специализированные ЭСН аэропорта",
    },
    {
      name: "Бейнеу-Бозой-Шымкент-2 (газопровод)",
      type: "Магистральный газопровод",
      params: "1480 км, Ø1067 мм, мощность 15 млрд м³/год, 1.5 млрд $",
      who: "QazaqGaz + China Petroleum (CNPC)",
      status: "В стадии строительства, ввод поэтапно 2025-2028",
      smeta: "СН РК 4.04-12 + НАКС-сварщики + 100% рентген швов + ICN ПОТ",
    },
    {
      name: "ВЛ-500 кВ Экибастуз-Шу-2",
      type: "Магистральная электросеть",
      params: "1115 км, 2-цепная, 700 опор, 300-400 млн $",
      who: "KEGOC + ЭСК «Самрук-Энерго»",
      status: "Введена 2024, плановое расширение до 2030",
      smeta: "СН РК 4.04-23 + ПУЭ-7 + спец. ЭСН по ВЛ + расчёты грозозащиты",
    },
    {
      name: "Тенгиз FGP (Future Growth Project)",
      type: "Нефтедобыча и обогащение",
      params: "Расширение нефтеперерабатывающего комплекса, бюджет 45 млрд $",
      who: "TengizChevroil (Chevron, ExxonMobil, KMG, LukArco)",
      status: "Завершено 2023-2024, плановая добыча до 2050",
      smeta: "FIDIC Silver Book (EPC), AACE Class 1-3, RICS, EVMS, английский",
    },
  ];

  const stages = [
    {
      n: 1,
      name: "Предпроектная стадия (Concept)",
      doc: "ТЭО (Технико-экономическое обоснование), AACE Class 4-5 (точность ±50%)",
      time: "6-18 мес",
      who: "Инвестор + проектировщик + сметчик-экономист",
    },
    {
      n: 2,
      name: "FEED (Front End Engineering Design)",
      doc: "Детальное ТЭО, AACE Class 3 (точность ±20%), предварительная BIM 3D",
      time: "6-12 мес",
      who: "Инженеры + сметчики-аналитики FIDIC",
    },
    {
      n: 3,
      name: "Проектирование (Detailed Design)",
      doc: "Рабочая документация + БИМ 5D, AACE Class 1-2 (±10%)",
      time: "12-24 мес",
      who: "Команда 50-200 проектировщиков и сметчиков",
    },
    {
      n: 4,
      name: "Тендер на ГП (EPC-контрактор)",
      doc: "Bill of Quantities (BoQ) по NRM2/FIDIC, заявки 3-10 претендентов",
      time: "3-6 мес",
      who: "Тендерный комитет + независимый эксперт",
    },
    {
      n: 5,
      name: "Строительство (Execution)",
      doc: "Ежемес. КС-2/КС-3, EVMS отчёты (CPI/SPI), Variation Orders",
      time: "24-60 мес (зависит от проекта)",
      who: "Тысячи рабочих + 10-30 главных сметчиков",
    },
    {
      n: 6,
      name: "Тестирование и приёмка (Commissioning)",
      doc: "Pre-commissioning + Commissioning + Performance Tests",
      time: "3-12 мес",
      who: "Заказчик + ГП + Независимая экспертиза + RICS оценка",
    },
    {
      n: 7,
      name: "Эксплуатация и пост-сдача (DLP)",
      doc: "DNP период FIDIC 12-36 мес, Performance Certificate",
      time: "1-3 года",
      who: "Эксплуатационная организация + ГП на гарантии",
    },
  ];

  const teams = [
    { role: "Главный сметчик (Chief Quantity Surveyor)", who: "1 на проект 1+ млрд $, обычно RICS Certified", salary: "3-7 млн тг/мес" },
    { role: "Сметчики-FEED (Cost Engineer)", who: "5-15 человек на этапе FEED", salary: "1.5-3.5 млн тг/мес" },
    { role: "Сметчики-EPC (Contract Cost Engineer)", who: "10-30 человек в процессе строительства", salary: "1-2.5 млн тг/мес" },
    { role: "EVMS-аналитик (Earned Value)", who: "2-5 человек, обязательно PMP / CCP", salary: "2-4 млн тг/мес" },
    { role: "Claims Manager (FIDIC Claims)", who: "1-2 человека, юридическое + сметное образование", salary: "3-6 млн тг/мес" },
    { role: "Контрактный сметчик от Инженера", who: "2-5 человек со стороны Engineer (FIDIC)", salary: "2-5 млн тг/мес" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Мегапроекты</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🌆 Инфраструктурные мегапроекты РК
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-zinc-300">Мегапроекты</strong> — это объекты стоимостью
            свыше 500 млн $ (~ 250 млрд тг), затрагивающие тысячи людей, годы строительства
            и национальную экономику РК. БАКАД, метро Алматы, аэропорт Алматы, газопровод
            Бейнеу-Бозой-Шымкент, нефтедобыча Кашаган и Тенгиз FGP — это совершенно другая
            методология сметного дела, FIDIC-контракты, EVMS-отчётность, RICS Quantity
            Surveyors, командная работа в десятки сметчиков. Профессиональный пик отрасли.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Порог мегапроекта</div>
              <div className="text-slate-300">&gt; 500 млн $ или &gt; 5 лет стр-ва</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Стандарт</div>
              <div className="text-slate-300">FIDIC + EVMS + AACE + BIM 5D + ISO 19650</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Команда сметчиков</div>
              <div className="text-slate-300">10-50 чел. в проекте, RICS / PMP / CCP</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 мегапроектов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 1. Шесть мегапроектов РК (2020-2030)
          </h2>
          <div className="space-y-3">
            {megaprojects.map((p) => (
              <div key={p.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-zinc-300">{p.name}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{p.type}</span>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Параметры</dt>
                    <dd className="text-slate-300 text-xs">{p.params}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Подрядчик</dt>
                    <dd className="text-slate-300 text-xs">{p.who}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Статус</dt>
                    <dd className="text-emerald-300 text-xs">{p.status}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Особенности сметы</dt>
                    <dd className="text-zinc-300 text-xs italic">{p.smeta}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Этапы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 2. Семь этапов жизненного цикла мегапроекта
          </h2>
          <div className="space-y-3">
            {stages.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-zinc-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{s.name}</h3>
                  <dl className="text-sm grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Документация</dt>
                      <dd className="text-slate-300 text-xs">{s.doc}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок</dt>
                      <dd className="text-amber-300 text-xs">{s.time}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Команда</dt>
                      <dd className="text-zinc-300 text-xs">{s.who}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: AACE Class */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📊 Section 3. AACE Class — классификация точности оценок
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-20">Class</th>
                  <th className="text-left px-4 py-3">Стадия проекта</th>
                  <th className="text-left px-4 py-3 w-32">Точность</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono text-rose-300 font-bold">Class 5</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">Идея проекта (Concept Screening)</td>
                  <td className="px-4 py-3 text-rose-300 text-xs font-mono">±50% до ±100%</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">Решение «делаем или нет»</td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono text-amber-300 font-bold">Class 4</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">ТЭО предварительное (Pre-FEED)</td>
                  <td className="px-4 py-3 text-amber-300 text-xs font-mono">±30% до ±50%</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">Бюджет на этап FEED</td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono text-yellow-300 font-bold">Class 3</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">ТЭО детальное / FEED</td>
                  <td className="px-4 py-3 text-yellow-300 text-xs font-mono">±20% до ±30%</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">Принятие инв. решения, привлечение финансирования</td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono text-lime-300 font-bold">Class 2</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">Проектирование (Detailed Design)</td>
                  <td className="px-4 py-3 text-lime-300 text-xs font-mono">±10% до ±20%</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">Контрольная сметная стоимость</td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono text-emerald-300 font-bold">Class 1</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">Окончательная (Tender, EPC)</td>
                  <td className="px-4 py-3 text-emerald-300 text-xs font-mono">±3% до ±10%</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">EPC-контракт, Bill of Quantities</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Команда сметчиков */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            👥 Section 4. Команда сметчиков мегапроекта
          </h2>
          <div className="space-y-3">
            {teams.map((t) => (
              <div key={t.role} className="border border-zinc-800/60 bg-zinc-950/30 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold text-zinc-300">{t.role}</h3>
                  <span className="text-xs text-emerald-300 font-mono shrink-0">{t.salary}</span>
                </div>
                <p className="text-xs text-slate-400 italic mt-1">{t.who}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Class на стадии FEED
            </div>
            <div className="text-slate-200 mb-4">
              Инвестор готовит ТЭО (FEED) для нового нефтеперерабатывающего завода в РК
              стоимостью ~ 2 млрд $. Какой <strong>класс точности оценки AACE</strong>
              должен быть на этой стадии?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Class 5 — это начальная стадия с грубой оценкой" },
                { v: "b", t: "Class 3 (точность ±20-30%) — FEED — это детальное ТЭО, на основе которого принимается инвестиционное решение и получается финансирование банков" },
                { v: "c", t: "Class 1 — на FEED уже окончательная оценка" },
                { v: "d", t: "Любая, главное общая идея" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-zinc-600 bg-zinc-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-zinc-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — Class 3 (±20-30%)</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-zinc-300">Решение:</strong> На стадии FEED (Front End
                Engineering Design) точность оценки должна быть Class 3 по AACE
                (±20-30%). Это связано с тем, что:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>На FEED проработана ~ 30% детальной документации</li>
                  <li>Известны основные параметры оборудования и материалов</li>
                  <li>Цены частично подтверждены тендерами поставщиков</li>
                  <li>BIM-модель 3D готова, начинается 5D</li>
                </ol>
                Class 3 — это «ставка инвестиционного решения». Банки кредитуют только при
                наличии Class 3 (с резервом на риски 15-20%). Class 1 (±3-10%) — это уже
                окончательная оценка перед EPC-тендером, после полного Detailed Design.
                Для проекта 2 млрд $ ошибка ±20% = ±400 млн $ — серьёзный риск, но
                приемлемый для FEED-стадии.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Бюджет метро Алматы
            </div>
            <div className="text-slate-200 mb-4">
              Планируется новая линия метро Алматы протяжённостью <strong>25 км</strong>.
              По бенчмарку РК стоимость 1 км подземного метро (с ТБМ-проходкой) —
              <strong> 12 млрд тг</strong>. Какой ориентировочный бюджет линии в
              <strong> МЛРД тг</strong>?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, млрд тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="300" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 300 млрд тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-zinc-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = 25 км × 12 млрд тг/км = 300 млрд тг

В долларах: 300 млрд / 450 (курс) ≈ 667 млн $

Что входит в эту сумму:
• ТБМ-проходка (тоннель Ø6-7 м): 35% = 105 млрд тг
• Станции (8-12 шт.): 25% = 75 млрд тг
• Оборудование систем (вент., кабели, освещение): 20% = 60 млрд
• Подвижной состав (5-8 поездов): 12% = 36 млрд тг
• Прочее (управление, наладка, пуско-наладка): 8% = 24 млрд тг

Сравнение с реалиями:
• Линия 1 Алматинского метро (8 станций, 11 км) — построена
  за ~ 1.2-1.5 млрд $ (≈ 500-600 млрд тг с учётом инфляции)
• Линия 2 — текущий бюджет 1-1.2 млрд $

Бенчмарки в мире (2024):
• Сингапур: 250-400 млн $/км
• Шанхай: 100-150 млн $/км (массовая постройка)
• Москва: 200-300 млн $/км
• Алматы: 80-110 млн $/км (12-15 млрд тг) — относительно дёшево
  благодаря китайским подрядчикам и технологиям

На метро работают сотни сметчиков, в РК такая команда есть
только у KazTransServis (государственная компания) + субподрядчики.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — FIDIC Silver Book
            </div>
            <div className="text-slate-200 mb-4">
              На проекте Тенгиз FGP применяется FIDIC <strong>Silver Book (EPC/Turnkey)</strong>.
              Что это означает для подрядчика?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Подрядчик только строит по готовому проекту, как в Red Book" },
                { v: "b", t: "Все этапы делает разные исполнители" },
                { v: "c", t: "EPC-турнкей — единственный подрядчик отвечает за всё: проектирование, закупки, строительство, наладку. Фиксированная цена и срок. Все непредвиденные риски — на подрядчике (Sub-Clause 4.12 — даже геология)" },
                { v: "d", t: "Заказчик берёт на себя все риски" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-zinc-600 bg-zinc-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-zinc-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — EPC под ключ</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-zinc-300">Решение:</strong> Silver Book (EPC/Turnkey
                — Engineering, Procurement, Construction под ключ) — самая жёсткая для
                Подрядчика модель FIDIC:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Единая ответственность: всё от проектирования до пуска</li>
                  <li>Фиксированная цена (Lump Sum) — изменения только по VO</li>
                  <li>Фиксированный срок с штрафами за просрочку (часто 0.1%/день)</li>
                  <li>Sub-Clause 4.12: Подрядчик принимает риск «непредвидимых условий»
                  (геология, погода, рынок)</li>
                  <li>Гарантия результата — Performance Tests (например, добыча нефти
                  ≥ 5000 баррелей/сут)</li>
                </ul>
                Применяется когда Заказчик хочет точно знать конечную цену и срок и не
                заниматься координацией. Подрядчик получает за это премию в виде высокой
                Profit Margin (обычно 12-18% против 7-10% в Red Book), но и риски в
                несколько раз выше. Для проектов как Тенгиз FGP (45 млрд $) Silver Book
                — стандарт, выбирается из 3-5 претендентов мирового уровня (Bechtel,
                Fluor, Saipem, Технип).
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Команда сметчиков
            </div>
            <div className="text-slate-200 mb-4">
              На мегапроекте стоимостью <strong>1.5 млрд $</strong> (например, метро
              Алматы Линия 2) сколько сметчиков и каких ролей потребуется в общей сложности
              на всех этапах?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "1 опытный сметчик с АВС-4 справится" },
                { v: "b", t: "3-5 сметчиков на проект" },
                { v: "c", t: "10-15 сметчиков с разделением труда" },
                { v: "d", t: "Команда из 20-50 сметчиков с ролями: Главный (RICS, 1), FEED (5-10), EPC (10-20), EVMS-аналитики (3-5), Claims Manager (1-2), от Engineer (5-10) — всего ~ 30 чел в активной фазе" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-zinc-600 bg-zinc-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-zinc-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — большая команда</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-zinc-300">Решение:</strong> На мегапроекте 1.5 млрд $
                команда сметчиков — это полноценный отдел в десятки человек, разделённый
                между:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Сметчики Заказчика</strong> (KazTransServis для метро) — 5-10
                  человек, FEED, контроль расходов, согласование VO</li>
                  <li><strong>Сметчики ГП</strong> (BI Group, Bazis, китайские подрядчики)
                  — 15-30 человек, КС-2/КС-3 ежемесячные, управление субподрядом</li>
                  <li><strong>Сметчики Инженера</strong> (FIDIC Engineer, чаще международная
                  фирма) — 5-10 человек, независимая проверка</li>
                  <li><strong>EVMS-аналитики</strong> — 3-5 человек со всех сторон, ведут
                  CPI/SPI отчётность для банков и Заказчика</li>
                  <li><strong>Claims Manager</strong> — 1-2 человека (адвокаты + сметчики)
                  для управления изменениями и спорами</li>
                </ol>
                Зарплаты от 1.5 до 7 млн тг/мес в зависимости от роли и квалификации.
                Для главного сметчика обязателен RICS Certified Quantity Surveyor +
                английский Proficient. Это вершина сметной карьеры — топ 0.1% профессии
                в РК (~ 30-50 человек на всю страну).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          FIDIC Red/Yellow/Silver Books. AACE Recommended Practice No. 18R-97 (Cost Estimate
          Classification). PMBOK 7th + ANSI/EIA-748 (EVMS). RICS NRM (New Rules of
          Measurement). ICAO Annex 14 (Aerodromes). Примеры РК: kegoc.kz, kazmunaygas.kz,
          tco.kz (Тенгизшевройл), kazaqgaz.kz, almatymetro.kz.
        </div>
      </main>
    </div>
  );
}
