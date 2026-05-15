"use client";
import Link from "next/link";
import { useState } from "react";

interface ChoiceExercise {
  id: string;
  title: string;
  q: string;
  options: string[];
  correctIdx: number;
  e: string;
}

const SYSTEMS: { name: string; country: string; org: string; descr: string; usage: string }[] = [
  {
    name: "NRM2",
    country: "Великобритания",
    org: "RICS (Royal Institution of Chartered Surveyors)",
    descr: "Detailed Measurement for Building Works — детальные обмеры по 35 разделам (Work Sections)",
    usage: "Для крупных международных проектов, тендеров на условиях FIDIC",
  },
  {
    name: "RSMeans",
    country: "США",
    org: "IHS Markit / Gordian",
    descr: "Справочник 50 000+ позиций (Construction Cost Data) с обновлением раз в квартал",
    usage: "Базовый источник цен в США и для экспортных смет, программа CostWorks",
  },
  {
    name: "AACE International",
    country: "США / международная",
    org: "Association for the Advancement of Cost Engineering",
    descr: "Recommended Practices: Cost Estimate Classification (Class 1-5), TCM Framework",
    usage: "Методология оценки стоимости на разных стадиях проекта (от концепции до контрактной)",
  },
  {
    name: "ISO 19650",
    country: "Международная (ISO)",
    org: "International Organization for Standardization",
    descr: "BIM workflow — Information Management using BIM, интеграция модели и сметы (5D)",
    usage: "Для BIM-проектов, обязательный стандарт в UK Government Soft Landings",
  },
];

const COMPARISON: { aspect: string; rk: string; nrm2: string; rsmeans: string }[] = [
  {
    aspect: "Структура расценки",
    rk: "ЭСН РК — позиции «как есть» с накладными и СП внутри",
    nrm2: "NRM2 — отдельно прямые работы + Preliminaries (НР) + OH&P (СП)",
    rsmeans: "RSMeans — позиции с включёнными OH&P, индексирование по городам",
  },
  {
    aspect: "Источник цен",
    rk: "ССЦ РК (НШ КСМ), индексы РГП «КазЦентрНОТ»",
    nrm2: "BCIS (Building Cost Information Service от RICS), субподрядные котировки",
    rsmeans: "Собственные данные RSMeans, City Cost Indexes (CCI) для 970+ городов",
  },
  {
    aspect: "Обновление",
    rk: "Индексы РК — поквартально, ССЦ — раз в год",
    nrm2: "BCIS — ежемесячно, NRM2 редакция — раз в 5-7 лет",
    rsmeans: "Ежеквартально в CostWorks, ежегодно в печатной книге",
  },
  {
    aspect: "Накладные расходы",
    rk: "По МДС 81-25 — % от ФОТ, дифференцированно по видам работ",
    nrm2: "Preliminaries — отдельная глава (часто 10-15% от Net Value)",
    rsmeans: "OH&P встроены в позицию (обычно 10% Overhead + 10% Profit)",
  },
  {
    aspect: "Применимость к уникальным позициям",
    rk: "Прайс-листы — для уникальных позиций без аналога в ЭСН",
    nrm2: "Bespoke rates — собственные расценки подрядчика по NRM2 шаблону",
    rsmeans: "Калькуляция себестоимости — индивидуальная (Crew + Material + Equipment)",
  },
];

const NRM2_SECTIONS: { num: string; title: string }[] = [
  { num: "1", title: "Preliminaries — подготовительные работы и накладные" },
  { num: "2", title: "Off-site manufactured materials, components and buildings" },
  { num: "3", title: "Demolitions — снос" },
  { num: "4", title: "Alterations, repairs and conservation" },
  { num: "5", title: "Excavating and filling — земляные работы" },
  { num: "6", title: "Ground remediation and soil stabilisation" },
  { num: "7", title: "Reinforcement of concrete — арматурные работы" },
  { num: "8", title: "In situ concrete works — бетонные работы" },
  { num: "9", title: "Precast / composite concrete" },
  { num: "10", title: "Brickwork, blockwork — кирпичная кладка" },
  { num: "14", title: "Masonry — каменная кладка" },
  { num: "20", title: "Doors, shutters and hatches" },
  { num: "33", title: "Drainage above ground — внутренняя канализация" },
];

const AACE_CLASSES: { cls: string; range: string; stage: string; effort: string }[] = [
  { cls: "Class 5", range: "-50% / +100%", stage: "Концептуальная (Concept Screening)", effort: "0.005-0.05% от стоимости проекта" },
  { cls: "Class 4", range: "-30% / +50%", stage: "Технико-экономическое обоснование (Feasibility)", effort: "0.02-0.2%" },
  { cls: "Class 3", range: "-20% / +30%", stage: "Бюджетная авторизация (Budget Authorization)", effort: "0.1-2%" },
  { cls: "Class 2", range: "-15% / +20%", stage: "Контрольная (Control / Bid Tender)", effort: "0.4-2%" },
  { cls: "Class 1", range: "-3% / +5% до -10% / +15%", stage: "Финальная контрактная (Final Definitive)", effort: "1-10%" },
];

const RK_USE_CASES: { title: string; descr: string; example: string }[] = [
  {
    title: "Проекты МБРР / ЕБРР / АБР",
    descr: "Международные финансовые институты требуют сметы по NRM2 / RSMeans для своих кредитных проектов",
    example: "Реконструкция автодороги Алматы-Усть-Каменогорск (АБР), реабилитация водоснабжения (МБРР)",
  },
  {
    title: "FDI-объекты иностранных компаний",
    descr: "Международные операторы (Chevron, Eni, BP) ведут сметы на своих объектах в РК по американским/британским стандартам",
    example: "Будущие расширения ТШО, Кашаган, проекты в СЭЗ Хоргос, заводы Hyundai, KIA",
  },
  {
    title: "Экспортные сметы для иностранных тендеров",
    descr: "Казахстанские подрядчики выходят на тендеры в Узбекистан, Грузию, Африку — там требуют формат NRM2 или AACE",
    example: "Тендеры в Узбекистане (CASA-1000), Грузии (Tbilisi Bypass), Африке (TICAD проекты)",
  },
];

const EXERCISES: ChoiceExercise[] = [
  {
    id: "ex1-aace5",
    title: "Упражнение 1: Точность AACE Class 5 estimate",
    q: "По AACE International, какая допустимая точность для Class 5 estimate (концептуальной оценки на стадии скрининга)?",
    options: ["±5%", "±15%", "-30% / +50%", "-50% / +100%"],
    correctIdx: 3,
    e: "Class 5 — самая ранняя концептуальная оценка (Concept Screening), когда известно менее 2% объёма проектной информации. Точность по AACE 18R-97: -50% / +100%. Используется для предварительного отбора вариантов, прикидки бюджета владельца.",
  },
  {
    id: "ex2-aace1",
    title: "Упражнение 2: Точность AACE Class 1 estimate",
    q: "Какая точность у AACE Class 1 estimate (финальной контрактной сметы)?",
    options: ["±3-5%", "±10%", "±20%", "±50%"],
    correctIdx: 0,
    e: "Class 1 — финальная сметная оценка (Final Definitive), когда проект готов на 65-100%. Точность ±3-5% (или до ±10% для сложных). Используется для контрактных переговоров, финальной сметы заказчика. В РК аналог — окончательная ЛСР по П-стадии.",
  },
  {
    id: "ex3-nrm2-7",
    title: "Упражнение 3: Раздел 7 NRM2",
    q: "В стандарте NRM2 (RICS) раздел 7 (Work Section 7) — что он включает?",
    options: ["Excavation (земляные работы)", "Concrete (бетонные работы)", "Reinforcement of concrete (арматурные работы)", "Brickwork (кирпичная кладка)"],
    correctIdx: 2,
    e: "NRM2 Work Section 7 = Reinforcement of concrete (арматурные работы для бетона). Земляные работы — Section 5 (Excavating and filling), бетон — Section 8 (In situ concrete works), кирпич — Section 10 (Brickwork). Всего 35 разделов в NRM2.",
  },
  {
    id: "ex4-rsmeans-vs-rk",
    title: "Упражнение 4: Отличие RSMeans от ЭСН РК",
    q: "В чём ключевое отличие RSMeans (США) от ЭСН РК?",
    options: [
      "RSMeans проще структурно",
      "RSMeans обновляется ежеквартально и содержит региональные индексы для 970+ городов США",
      "RSMeans не учитывает накладные расходы",
      "RSMeans применяется только для жилых зданий",
    ],
    correctIdx: 1,
    e: "RSMeans обновляется ежеквартально (через CostWorks online) и включает City Cost Indexes (CCI) для 970+ городов США + 100+ международных. ЭСН РК — обновляются раз в год (ССЦ) или поквартально (индексы РГП). По объёму RSMeans (50 000+ позиций) превышает ЭСН РК (~30 000). Накладные у RSMeans встроены (10% OH + 10% P).",
  },
];

export default function InternationalStandardsPage() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});

  const setAnswer = (id: string, idx: number) => setAnswers((s) => ({ ...s, [id]: idx }));
  const toggleSolution = (id: string) => setShowSolution((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice" className="text-violet-400 hover:text-violet-300 text-sm">
            ← К разделам
          </Link>
          <div className="text-slate-400 text-sm">/ Международные стандарты сметы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            🌍 Международные стандарты сметы — NRM2 / RICS / RSMeans / ISO
          </h1>
          <p className="text-slate-300 leading-relaxed">
            Международные системы оценки стоимости строительства принципиально отличаются от ЭСН РК структурой расценок, источниками цен,
            обработкой накладных расходов и подходом к индексации. В РК они применяются для проектов с международным финансированием
            (МБРР, ЕБРР, АБР), на FDI-объектах и в экспортных тендерах. Знание этих стандартов — критическое преимущество для сметчика
            на крупных проектах.
          </p>
          <div className="mt-4 p-4 rounded-lg bg-violet-900/20 border border-violet-700/40 text-sm text-violet-100">
            <span className="font-semibold">Ключевые нормативы:</span> RICS NRM2 Detailed Measurement, RSMeans CostWorks Online,
            AACE International Recommended Practices (18R-97), ISO 19650 (Information Management using BIM),
            FIDIC Conditions of Contract (Red / Yellow / Silver Book).
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">1. Четыре основные системы</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-violet-200">Система</th>
                  <th className="px-3 py-2 text-left text-violet-200">Страна</th>
                  <th className="px-3 py-2 text-left text-violet-200">Организация</th>
                  <th className="px-3 py-2 text-left text-violet-200">Описание</th>
                  <th className="px-3 py-2 text-left text-violet-200">Где применяется</th>
                </tr>
              </thead>
              <tbody>
                {SYSTEMS.map((s) => (
                  <tr key={s.name} className="border-t border-slate-800 hover:bg-slate-900/50">
                    <td className="px-3 py-2 font-semibold text-indigo-300">{s.name}</td>
                    <td className="px-3 py-2 text-slate-300">{s.country}</td>
                    <td className="px-3 py-2 text-slate-300">{s.org}</td>
                    <td className="px-3 py-2 text-slate-300">{s.descr}</td>
                    <td className="px-3 py-2 text-slate-300">{s.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-violet-300 font-semibold mb-1">NRM2 — структура документа</div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>Part 1: General — общие правила обмера</li>
                <li>Part 2: Detailed Measurement (Work Sections 1-35)</li>
                <li>Part 3: Tabulated rules — табличный формат</li>
                <li>Appendices A-G — пояснения, примеры, словарь</li>
              </ul>
            </div>
            <div className="p-3 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-violet-300 font-semibold mb-1">RSMeans — линейка продуктов</div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>Building Construction Cost Data — основной том</li>
                <li>Heavy Construction Cost Data — инфраструктура</li>
                <li>Mechanical / Electrical / Plumbing Data</li>
                <li>Site Work / Landscape / Light Commercial</li>
                <li>Square Foot Costs — укрупнённые показатели</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">2. Сравнение со СНБ РК</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-indigo-200">Аспект</th>
                  <th className="px-3 py-2 text-left text-indigo-200">СНБ РК (ЭСН)</th>
                  <th className="px-3 py-2 text-left text-indigo-200">NRM2 (Великобритания)</th>
                  <th className="px-3 py-2 text-left text-indigo-200">RSMeans (США)</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-900/50">
                    <td className="px-3 py-2 font-medium text-violet-300">{row.aspect}</td>
                    <td className="px-3 py-2 text-slate-300">{row.rk}</td>
                    <td className="px-3 py-2 text-slate-300">{row.nrm2}</td>
                    <td className="px-3 py-2 text-slate-300">{row.rsmeans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-900/60 border border-indigo-700/40">
              <h3 className="text-indigo-300 font-semibold mb-2">NRM2 — пример структуры расценки</h3>
              <pre className="text-xs text-slate-300 overflow-x-auto">{`Section 8: In situ concrete works
  8.1.1 Mass concrete C20/25, foundations
        Unit: m³
        Net rate: £85.00 (Material £45 + Labour £35 + Plant £5)
        + Preliminaries: 12% (отдельная глава)
        + OH&P: 15% (Overhead 10% + Profit 5%)
        ITEM TOTAL: £85 × 1.12 × 1.15 = £109.48/m³`}</pre>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/60 border border-violet-700/40">
              <h3 className="text-violet-300 font-semibold mb-2">RSMeans — пример позиции</h3>
              <pre className="text-xs text-slate-300 overflow-x-auto">{`03 31 05.35 0050
  Concrete in place, footings, 3000 PSI
  Crew: C-14C (5 workers + 1 equipment)
  Daily Output: 35 CY
  Labor-Hours: 1.143 per CY
  Bare Material: $145.00/CY
  Bare Labor:    $52.50/CY
  Bare Equip:    $4.85/CY
  Total Bare:   $202.35/CY
  Total Incl. O&P: $245.00/CY  (×1.21 = +OH&P)
  CCI Almaty: ×0.45 → $110.25/CY equiv`}</pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">2.1 NRM2 — основные разделы (выборка)</h2>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            {NRM2_SECTIONS.map((s) => (
              <div key={s.num} className="p-2 rounded bg-slate-900/40 border border-slate-800 flex gap-2">
                <span className="text-violet-300 font-mono font-semibold w-8">{s.num}</span>
                <span className="text-slate-300">{s.title}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Всего в NRM2 — 35 Work Sections. Аналог в РК — главы МДС 81-25 (12 глав сводного сметного расчёта),
            но с принципиально другим разрезом: NRM2 идёт по видам работ, МДС — по этапам подготовки/строительства/благоустройства.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">2.2 AACE Cost Estimate Classification</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-violet-200">Class</th>
                  <th className="px-3 py-2 text-left text-violet-200">Точность</th>
                  <th className="px-3 py-2 text-left text-violet-200">Стадия</th>
                  <th className="px-3 py-2 text-left text-violet-200">Трудоёмкость</th>
                </tr>
              </thead>
              <tbody>
                {AACE_CLASSES.map((c) => (
                  <tr key={c.cls} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-semibold text-indigo-300">{c.cls}</td>
                    <td className="px-3 py-2 text-amber-300">{c.range}</td>
                    <td className="px-3 py-2 text-slate-300">{c.stage}</td>
                    <td className="px-3 py-2 text-slate-300">{c.effort}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            AACE 18R-97 (Recommended Practice) — стандарт классификации сметных оценок по стадиям проекта.
            В РК аналогами выступают стадии П (проектная) и Р (рабочая) с соответствующими ЛСР, но без чёткой формализации точности.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">3. Интерактивные упражнения</h2>
          <div className="space-y-6">
            {EXERCISES.map((ex) => {
              const userIdx = answers[ex.id];
              const answered = userIdx !== undefined;
              const correct = answered && userIdx === ex.correctIdx;
              const open = !!showSolution[ex.id];
              return (
                <div key={ex.id} className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <h3 className="font-semibold text-indigo-300 mb-2">{ex.title}</h3>
                  <p className="text-slate-300 text-sm mb-4">{ex.q}</p>
                  <div className="space-y-2">
                    {ex.options.map((opt, i) => {
                      const isUser = userIdx === i;
                      const isCorrectOpt = ex.correctIdx === i;
                      let cls = "border-slate-700 bg-slate-900/40 hover:bg-slate-800/60";
                      if (answered && isCorrectOpt) cls = "border-emerald-600 bg-emerald-900/30";
                      else if (isUser && !correct) cls = "border-rose-600 bg-rose-900/30";
                      return (
                        <button
                          key={i}
                          onClick={() => setAnswer(ex.id, i)}
                          className={`w-full text-left p-3 rounded border text-sm transition ${cls}`}
                        >
                          <span className="font-mono text-violet-300 mr-2">{String.fromCharCode(97 + i)})</span>
                          <span className="text-slate-200">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <div className={`mt-3 text-sm font-medium ${correct ? "text-emerald-400" : "text-rose-400"}`}>
                      {correct ? "✓ Верно!" : "✗ Неверно. Попробуйте ещё или посмотрите решение."}
                    </div>
                  )}
                  <button
                    onClick={() => toggleSolution(ex.id)}
                    className="mt-3 text-xs text-violet-400 hover:text-violet-300 underline"
                  >
                    {open ? "Скрыть решение" : "Показать решение"}
                  </button>
                  {open && (
                    <div className="mt-3 p-3 rounded bg-violet-950/40 border border-violet-800/40 text-sm text-violet-100">
                      <span className="font-semibold">Решение:</span> {ex.e}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">4. Когда применять международные стандарты в РК</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {RK_USE_CASES.map((c, i) => (
              <div key={i} className="p-4 rounded-lg bg-slate-900/60 border border-indigo-700/40">
                <div className="text-indigo-300 font-semibold mb-2">{c.title}</div>
                <p className="text-slate-300 text-sm mb-3">{c.descr}</p>
                <div className="text-xs text-slate-400">
                  <span className="text-violet-400 font-medium">Пример: </span>{c.example}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">5. Расценки, индексы и стоимость стандартов</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-violet-200">Стандарт / продукт</th>
                  <th className="px-3 py-2 text-left text-violet-200">Стоимость подписки</th>
                  <th className="px-3 py-2 text-left text-violet-200">Что входит</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 text-indigo-300 font-semibold">RICS NRM2 (методичка)</td>
                  <td className="px-3 py-2 text-amber-300">£60-80 (одноразово)</td>
                  <td className="px-3 py-2 text-slate-300">PDF с правилами обмера, 470 страниц</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 text-indigo-300 font-semibold">RICS BCIS (Building Cost Information Service)</td>
                  <td className="px-3 py-2 text-amber-300">£1 200 / год</td>
                  <td className="px-3 py-2 text-slate-300">Онлайн-база цен UK, ежемесячное обновление</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 text-indigo-300 font-semibold">RSMeans CostWorks Online (Standard)</td>
                  <td className="px-3 py-2 text-amber-300">$1 875 / год</td>
                  <td className="px-3 py-2 text-slate-300">Доступ ко всем 9 базам, City Cost Indexes</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 text-indigo-300 font-semibold">RSMeans Building Construction (книга)</td>
                  <td className="px-3 py-2 text-amber-300">$295 / год</td>
                  <td className="px-3 py-2 text-slate-300">Печатный том с базовыми расценками</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 text-indigo-300 font-semibold">AACE Recommended Practices</td>
                  <td className="px-3 py-2 text-amber-300">$200 / год (membership)</td>
                  <td className="px-3 py-2 text-slate-300">Доступ к 100+ методическим документам</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 text-indigo-300 font-semibold">ISO 19650 (комплект частей 1-5)</td>
                  <td className="px-3 py-2 text-amber-300">CHF 800-1 000</td>
                  <td className="px-3 py-2 text-slate-300">Стандарты Information Management в BIM</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-5 rounded-lg bg-violet-900/30 border border-violet-600/50">
            <h3 className="text-violet-200 font-semibold mb-2">📌 Факт: сертификация RICS Quantity Surveyor в РК</h3>
            <p className="text-slate-200 text-sm leading-relaxed">
              <span className="text-violet-300 font-semibold">RICS Quantity Surveyor (MRICS / FRICS)</span> — международная сертификация
              специалистов по управлению стоимостью строительства. В Казахстане квалифицированных RICS QS — около 30 человек на всю страну
              (для сравнения: в Великобритании — более 60 000, в Гонконге — около 10 000). Средняя зарплата сертифицированного
              RICS QS в РК — <span className="text-amber-300 font-semibold">в 1.5-3 раза выше</span> обычного сметчика
              (от 800 000 до 2 500 000 тенге в месяц), особенно на проектах международных нефтегазовых операторов и финансируемых
              МБРР/ЕБРР объектах. Путь к сертификации: 5+ лет опыта + APC (Assessment of Professional Competence) + экзамен в RICS.
              Подготовительные курсы есть в KIMEP, AlmaU, заочно через RICS School of Built Environment.
            </p>
            <div className="mt-3 text-xs text-violet-300/80">
              💡 Совет: даже без сертификации знание NRM2 + RSMeans даёт +30-50% к окладу при найме на проекты с иностранным капиталом.
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">6. Чек-лист сметчика для международного проекта</h2>
          <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
            <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
              <li>Уточнить у заказчика: по какому стандарту составляется смета (NRM2, RSMeans, FIDIC, локальный)</li>
              <li>Получить актуальные City Cost Indexes (CCI) для региона проекта (RSMeans) или BCIS All-In Tender Price Index (NRM2)</li>
              <li>Определить класс оценки по AACE (Class 1-5) — это влияет на детализацию и допустимую погрешность</li>
              <li>Согласовать структуру Bill of Quantities (BoQ) с заказчиком до начала обмеров</li>
              <li>Если работаем по NRM2 — отдельной главой выделить Preliminaries (НР), отдельно OH&P (СП)</li>
              <li>Если RSMeans — конвертировать через CCI и применить курс USD/KZT на дату оценки</li>
              <li>Для BIM-проектов — настроить связь модели с classifications (Uniclass 2015 для UK, OmniClass для US)</li>
              <li>Зарезервировать Contingency: 10-15% для Class 3, 5-8% для Class 1 (по AACE)</li>
              <li>Указать в спецификации: единицы измерения (метрические vs imperial), валюта, дата оценки, обменный курс</li>
              <li>Перед сдачей — Cost Plan Review с привлечением сертифицированного RICS QS (если возможно)</li>
            </ol>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-violet-300">7. Полезные ресурсы</h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded bg-slate-900/40 border border-slate-800">
              <div className="text-indigo-300 font-semibold mb-1">RICS</div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-xs">
                <li>rics.org — официальный сайт стандартов</li>
                <li>BCIS Online — база цен UK</li>
                <li>isurv.com — портал для практикующих QS</li>
              </ul>
            </div>
            <div className="p-3 rounded bg-slate-900/40 border border-slate-800">
              <div className="text-indigo-300 font-semibold mb-1">RSMeans / Gordian</div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-xs">
                <li>rsmeansonline.com — CostWorks Online</li>
                <li>gordian.com — материнская компания</li>
                <li>RSMeans Insights — отраслевые отчёты</li>
              </ul>
            </div>
            <div className="p-3 rounded bg-slate-900/40 border border-slate-800">
              <div className="text-indigo-300 font-semibold mb-1">AACE International</div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-xs">
                <li>aacei.org — сертификации CCP, EVP, PSP</li>
                <li>Cost Engineering Journal — ежемесячный журнал</li>
                <li>Recommended Practices — каталог 100+ RP</li>
              </ul>
            </div>
            <div className="p-3 rounded bg-slate-900/40 border border-slate-800">
              <div className="text-indigo-300 font-semibold mb-1">ISO / BIM</div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-xs">
                <li>iso.org/standard/68078.html — ISO 19650-1</li>
                <li>buildingsmart.org — IFC схемы</li>
                <li>Uniclass 2015 — классификатор для UK BIM</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t border-slate-800 text-xs text-slate-500">
          AEVION Smeta Trainer · Drawings Practice · Международные стандарты сметы (NRM2 / RICS / RSMeans / AACE / ISO 19650)
        </footer>
      </main>
    </div>
  );
}
