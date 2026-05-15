"use client";

import Link from "next/link";
import { useState } from "react";

export default function SmetaAnalyticsPage() {
  const [ex1, setEx1] = useState("");
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState("");
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => {
    // 450 000 000 / 1500 = 300 000 тг/м²
    const v = parseFloat(ex1);
    if (!isFinite(v)) return setEx1Res("bad");
    setEx1Res(Math.abs(v - 300_000) <= 5_000 ? "ok" : "bad");
  };
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    // CPI = EV/AC = 4_500_000 / 5_000_000 = 0.9
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 0.9) <= 0.02 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "c" ? "ok" : "bad");

  const kpis = [
    {
      kpi: "Себестоимость 1 м² (Cost/m²)",
      formula: "ССР / S_общ.",
      what: "Базовая метрика сравнения объектов",
      bench: "Жильё эконом — 180-220 тыс. тг/м², бизнес-класс — 260-340, премиум — 400-600",
      use: "Для бюджетирования аналогов на стадии концепции",
    },
    {
      kpi: "Доля материалов в смете",
      formula: "Σ материалов / ССР × 100%",
      what: "% затрат на материалы относительно общей сметы",
      bench: "Жильё — 55-65%, отделка-heavy — до 75%, монолит-heavy — 45-55%",
      use: "Если &gt; 70% — стоит пересмотреть закупки",
    },
    {
      kpi: "ФОТ в стоимости",
      formula: "(ОТ + ОТМ) / ССР × 100%",
      what: "Доля заработной платы",
      bench: "10-18% для коммерч. строительства, 22-30% для отделочных работ",
      use: "Высокий ФОТ — много ручного труда, можно автоматизировать",
    },
    {
      kpi: "Накладные расходы (НР)",
      formula: "НР / Прямые затраты × 100%",
      what: "По МДС 81-33 для РК — 11-22% в зависимости от вида работ",
      bench: "Земля 11%, монолит 14%, отделка 15%, кровля 18%, инж. сети 19%, дороги 12%",
      use: "Если выше норматива — переделать обоснование. Если ниже — упускаем деньги",
    },
    {
      kpi: "Сметная прибыль (СП)",
      formula: "СП / (ПЗ + НР) × 100%",
      what: "Норматив 8% для жилых, 12% для коммерческих, до 15% для FIDIC",
      bench: "Жильё 8%, школы 8%, ТЦ 10-12%, нефтегаз 12-14%, FIDIC 12-15%",
      use: "СП — это плановая прибыль ГП, окончательная может быть выше или ниже",
    },
    {
      kpi: "CPI (Cost Performance Index)",
      formula: "EV / AC",
      what: "По EVMS — освоенный объём / фактические затраты",
      bench: "CPI &gt; 1.0 — экономия, CPI &lt; 1.0 — перерасход, ≈ 0.95-1.05 — норма",
      use: "Контроль исполнения сметы в процессе стройки",
    },
    {
      kpi: "SPI (Schedule Performance Index)",
      formula: "EV / PV",
      what: "Соотношение факт vs план графика",
      bench: "SPI &gt; 1.0 — опережение, &lt; 1.0 — отставание",
      use: "Если SPI &lt; 0.9 — серьёзное отставание, нужны меры",
    },
    {
      kpi: "Возврат на инвестиции (ROI)",
      formula: "(Доход − Себестоимость) / Себестоимость × 100%",
      what: "Финансовая эффективность объекта",
      bench: "Жильё 15-25%, ТЦ 18-30%, гостиницы 8-12% за период строительства",
      use: "Для инвестора — ключевой показатель целесообразности",
    },
  ];

  const benchmarks = [
    { city: "Алматы (бизнес-класс)", value: 290_000, note: "Монолит, отделка под чистовую, среднее качество" },
    { city: "Алматы (премиум)", value: 480_000, note: "Дизайн-проект, импортные материалы, smart-home" },
    { city: "Астана (бизнес-класс)", value: 310_000, note: "Холоднее → энергоэффективность дороже" },
    { city: "Шымкент (эконом)", value: 195_000, note: "Газоблок, типовое жильё" },
    { city: "Школа (типовая, бюджет)", value: 230_000, note: "Кирпич, базовая отделка, оборудование классов" },
    { city: "Больница (3 уровня)", value: 480_000, note: "Спец. требования СЭС, медицинское оборудование" },
    { city: "Торговый центр", value: 340_000, note: "Метраж под аренду, открытые планировки" },
    { city: "Промышл. цех (Караганда)", value: 165_000, note: "Каркас + сэндвич-панели, минимум отделки" },
  ];

  const dashboardSections = [
    { title: "Финансовый блок", widgets: "ССР с разбивкой по главам, кассовый план (cash-flow), фактические затраты vs план", who: "Финдиректор + Заказчик" },
    { title: "График выполнения", widgets: "Диаграмма Гантта, % готовности по этапам, SPI/CPI индексы", who: "Менеджер проекта + Прораб" },
    { title: "Аналитика по позициям", widgets: "Топ-10 дорогих позиций ВОР, ABC-анализ материалов, отклонения цен", who: "Сметчик" },
    { title: "Закупки и склад", widgets: "Поступления материалов, остатки, % исполнения договоров поставки", who: "Снабжение + Кладовщик" },
    { title: "Подрядчики", widgets: "Реестр субподрядчиков, % выполнения, открытые претензии, удержания", who: "ГП + Юрист" },
    { title: "Экспертиза и сертификация", widgets: "Статус АОСР, протоколы лаб., открытые замечания ТН/АН", who: "Тех. надзор + Авт. надзор" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Аналитика и KPI</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            📊 Аналитика и KPI сметчика
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Современный сметчик — это <strong className="text-indigo-300">аналитик данных</strong>,
            а не только исполнитель ВОР. Умение считать KPI, сравнивать с бенчмарками, строить
            ABC-аналитику и интерпретировать CPI/SPI отличает старшего сметчика от младшего.
            На больших объектах сметчик готовит еженедельные отчёты для Заказчика и финдиректора,
            и от его аналитики зависят решения о продолжении / приостановке этапов.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Методики</div>
              <div className="text-slate-300">EVMS (PMBOK) + МДС 81-33 + ABC-анализ</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Программы</div>
              <div className="text-slate-300">Excel + PowerBI + Tableau + 1С Финансы</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Частота отчётов</div>
              <div className="text-slate-300">Еженедельно факт, ежемесячно — анализ KPI</div>
            </div>
          </div>
        </section>

        {/* Section 1: KPI */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🎯 Section 1. Восемь ключевых KPI сметчика
          </h2>
          <div className="space-y-3">
            {kpis.map((k) => (
              <div key={k.kpi} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-indigo-300">{k.kpi}</h3>
                  <code className="text-xs text-emerald-300 bg-slate-950 px-2 py-1 rounded shrink-0">{k.formula}</code>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что это</dt>
                    <dd className="text-slate-300 text-xs">{k.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Бенчмарк РК</dt>
                    <dd className="text-amber-300 text-xs">{k.bench}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Использование</dt>
                    <dd className="text-slate-400 text-xs italic">{k.use}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Бенчмарки */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 2. Бенчмарки себестоимости м² по РК (2025)
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Средние значения для оценки на стадии концепции. Использовать как первичное
            приближение, для точной оценки — полный сметный расчёт.
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Тип объекта / город</th>
                  <th className="text-left px-4 py-3 w-44">Цена за м²</th>
                  <th className="text-left px-4 py-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {benchmarks.map((b) => (
                  <tr key={b.city} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100">{b.city}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300">{b.value.toLocaleString("ru-RU")} тг/м²</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Дашборд */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📈 Section 3. Состав дашборда строительного проекта
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dashboardSections.map((d) => (
              <div key={d.title} className="border border-indigo-800/40 bg-indigo-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-indigo-300 mb-2">{d.title}</h3>
                <div className="text-xs text-slate-300 mb-2">{d.widgets}</div>
                <div className="text-xs text-slate-500 italic">→ {d.who}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: ABC-анализ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔤 Section 4. ABC-анализ позиций сметы
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Принцип Парето 80/20 — обычно 20% позиций ВОР дают 80% стоимости. Этой группы
            (A-категория) достаточно для управления почти всей стоимостью проекта.
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-20">Группа</th>
                  <th className="text-left px-4 py-3">Доля позиций</th>
                  <th className="text-left px-4 py-3">Доля стоимости</th>
                  <th className="text-left px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="hover:bg-slate-900/40 bg-emerald-950/20">
                  <td className="px-4 py-3 font-bold text-emerald-300">A</td>
                  <td className="px-4 py-3 text-slate-300">~ 20%</td>
                  <td className="px-4 py-3 text-emerald-300">~ 80%</td>
                  <td className="px-4 py-3 text-xs text-slate-300">Тендеры на каждую позицию, 2-3 поставщика, личный контроль СМ-СД</td>
                </tr>
                <tr className="hover:bg-slate-900/40 bg-amber-950/20">
                  <td className="px-4 py-3 font-bold text-amber-300">B</td>
                  <td className="px-4 py-3 text-slate-300">~ 30%</td>
                  <td className="px-4 py-3 text-amber-300">~ 15%</td>
                  <td className="px-4 py-3 text-xs text-slate-300">Рамочные договоры, 1-2 поставщика, выборочный контроль</td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-bold text-slate-400">C</td>
                  <td className="px-4 py-3 text-slate-300">~ 50%</td>
                  <td className="px-4 py-3 text-slate-400">~ 5%</td>
                  <td className="px-4 py-3 text-xs text-slate-300">Хоз. снабжение, ближайший магазин, без тендеров</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-4 text-sm text-emerald-200">
            <strong>Пример A-категории для жилого дома:</strong> бетон, арматура, кирпич/газоблок,
            окна ПВХ, плитка керамогр., радиаторы, плиты перекрытия, кровельные материалы, кабельная
            продукция, лифты — 10-15 позиций из 300+ обычно дают 75-85% сметы.
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Себестоимость м²
            </div>
            <div className="text-slate-200 mb-4">
              Жилой дом в Алматы, общая площадь S = <strong>1 500 м²</strong>. Сметная
              стоимость работ ССР = <strong>450 000 000 тг</strong>. Какова себестоимость
              1 м² (тг/м²)?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Себестоимость, тг/м²</span>
              <input value={ex1} onChange={(e) => setEx1(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="300000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 300 000 тг/м²</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-indigo-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Cost/m² = ССР / S
        = 450 000 000 / 1 500
        = 300 000 тг/м²

Сравнение с бенчмарком Алматы (бизнес-класс):
  Бенчмарк = 290 000 тг/м²
  Превышение = 10 000 тг/м² (3.4%) — в пределах нормы

ВЫВОД: цена 300 тыс. тг/м² для Алматы — нормальная для
проектов бизнес-класса. Если бы получилось > 330 000 —
повод проверить, нет ли завышения в составе сметы.
Если бы < 250 000 — стоит проверить, не упустили ли что-то
(часто инж. сети или благоустройство).`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Принцип Парето
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик хочет сосредоточить усилия по контролю закупок. Согласно ABC-анализу,
              на какой группе позиций нужно сфокусироваться в первую очередь?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Все позиции одинаково важны — нужен полный контроль" },
                { v: "b", t: "Группа A (~20% позиций, ~80% стоимости) — тендеры, личный контроль" },
                { v: "c", t: "Группа C — самые дешёвые позиции (хоз. снабжение)" },
                { v: "d", t: "Только импортные материалы из-за курса валют" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-indigo-600 bg-indigo-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-indigo-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — A-категория</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-indigo-300">Решение:</strong> Принцип Парето 80/20 —
                это эмпирическое правило, что 20% причин дают 80% результата. В строительстве:
                10-15 позиций (бетон, арматура, кирпич, окна, плитка, кабель и т.д.) из 300+
                в смете обычно составляют 75-85% всей стоимости. Если сметчик сэкономит 5% на
                A-позициях — это 4% от всей сметы. Если 50% на C-позициях — всего 2.5%.
                Поэтому: A → тендеры, переговоры, личный контроль. B → рамочные договоры.
                C → ближайший магазин или подотчётные деньги прорабу.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — CPI по EVMS
            </div>
            <div className="text-slate-200 mb-4">
              Проект через 6 месяцев строительства. По плану должно быть выполнено работ
              на <strong>PV = 5 000 000 тг</strong> (Planned Value). Фактически выполнено
              на <strong>EV = 4 500 000 тг</strong> (Earned Value). Фактические затраты
              составили <strong>AC = 5 000 000 тг</strong> (Actual Cost). Какой CPI (Cost
              Performance Index)? Округлить до 2 знаков.
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">CPI</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="0.90" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — CPI = 0.90 (перерасход)</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Формула CPI = EV/AC</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-indigo-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`CPI = EV / AC
    = 4 500 000 / 5 000 000
    = 0.90

Интерпретация:
  CPI = 0.90 → на каждый 1 тг затраченных, освоено 0.90 тг
  Перерасход: 10% (нужно 1 тг тратить, чтобы освоить 0.90 тг)

SPI (для сравнения):
  SPI = EV / PV = 4 500 000 / 5 000 000 = 0.90
  → отстаём от графика на 10%

Прогноз: при сохранении тенденции CPI = 0.90, итоговая
стоимость превысит бюджет:
  EAC = BAC / CPI
  EAC = 100 млн / 0.90 = 111 млн тг

Действия менеджера проекта:
1. Анализ причин перерасхода (по позициям A-категории)
2. Усиление контроля закупок
3. Пересмотр графика — возможны простои подрядчиков
4. Если CPI < 0.85 — серьёзный кризис, нужен план восстановления`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Бенчмарк для премиум-класса
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик хочет построить апартаменты премиум-класса в центре Алматы. Какой
              ориентир по себестоимости 1 м² стоит закладывать в концепцию проекта на 2025 г.?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "180-220 тыс. тг/м² — типовое жильё эконом-класса" },
                { v: "b", t: "260-340 тыс. тг/м² — бизнес-класс" },
                { v: "c", t: "400-600 тыс. тг/м² — премиум (дизайн-проект, импорт, smart-home)" },
                { v: "d", t: "100-150 тыс. тг/м² — социальное жильё" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-indigo-600 bg-indigo-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-indigo-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 400-600 тыс. тг/м²</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-indigo-300">Решение:</strong> 400-600 тыс. тг/м² для
                премиум-класса Алматы. Сюда входят:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Импортные отделочные материалы (итальянская плитка, мрамор Гранит, паркет дуб)</li>
                  <li>Премиум-окна (Schüco, Veka, тройной стеклопакет)</li>
                  <li>Smart-home система (KNX, Crestron — 50-150 тыс. $/квартиру)</li>
                  <li>Дизайн-проект (10-15% к стоимости)</li>
                  <li>Авторский надзор премиум (5-7% от сметы)</li>
                  <li>Энергоэффективность класса A+ (тройные стеклопакеты, рекуперация)</li>
                  <li>Сертификация LEED Gold / EDGE Advanced</li>
                </ul>
                Известные премиум-проекты Алматы: Esentai Apartments (450-600 тыс. тг/м²),
                Talan Towers (480-650), Bayan Sulu Premium (400-550).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          МДС 81-33 (Накладные расходы). PMBOK Guide 7th + ANSI/EIA-748 (EVMS). Принцип
          Парето (80/20). ABC-анализ. Программы: MS Excel + Power BI + Tableau, специализир.
          Cubicost, Vico Office Cost Engineer. Бенчмарки — KazRealty.kz, krisha.kz/analytics.
        </div>
      </main>
    </div>
  );
}
