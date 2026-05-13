"use client";

import Link from "next/link";
import { useState } from "react";

export default function PriceDatabasePage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    // Δ% = (45 - 38) / 38 × 100 = 18.42%
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 18.42) <= 0.5 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => {
    // Поставщик A: цена 1000 + доставка 50 + срок 7 дней = 1050
    // Поставщик B: цена 950 + доставка 100 + срок 14 дней = 1050
    // Но при сроке * стоимость хранения 0.5%/нед: B экономит 0 + штраф простоя
    // По цене с доставкой: A 1050, B 1050 — равные. Но скорость дороже стоимости → A
    // Просто введите цену с доставкой: 1050
    const v = parseFloat(ex4);
    if (!isFinite(v)) return setEx4Res("bad");
    setEx4Res(Math.abs(v - 1050) <= 10 ? "ok" : "bad");
  };

  const sources = [
    {
      name: "ССЦ РК (НШ КСМ)",
      type: "Государственная база",
      url: "new-shop.ksm.kz/egfntd/ntdgo/kds",
      format: ".rar/.docx → .json",
      coverage: "172 МБ, 92 .docx файлов, 17 регионов × Кн.1+7 + Кн.2-6",
      update: "Раз в год (актуализация 8.04-08 — на 2025)",
      cost: "Бесплатно",
    },
    {
      name: "Индексы РК (РГП КазЦентрНОТ)",
      type: "Государственная база",
      url: "kazcenter-not.kz",
      format: ".xlsx + бюллетень",
      coverage: "Индексы стоимости по 16 регионам и 15 видам работ",
      update: "Поквартально",
      cost: "Бесплатно для гос. сектора, лицензия для частных",
    },
    {
      name: "ИСТ Эталон",
      type: "Коммерческая (Etalon-Russia)",
      url: "etalonsmeta.ru/kz",
      format: "Программа АВС-4 + .est-файлы",
      coverage: "Полный корпус ЭСН + ССЦ + индексы",
      update: "Подписка, ежеквартально",
      cost: "150-450 тыс. тг/год",
    },
    {
      name: "АВС-4 (Visual Estimator)",
      type: "Коммерческая (KazSoft)",
      url: "avs-4.kz",
      format: "Native .avs формат",
      coverage: "Адаптировано под РК, импорт смет",
      update: "Ежегодно",
      cost: "180-500 тыс. тг + поддержка",
    },
    {
      name: "Свои базы поставщиков",
      type: "Внутренняя",
      url: "В 1С или Excel",
      format: "Excel / БД 1С Поставщики",
      coverage: "Только материалы, с которыми работает компания",
      update: "При каждой закупке + раз в неделю обзвон",
      cost: "Своими силами",
    },
    {
      name: "Прайсы поставщиков (KZ.market)",
      type: "Маркетплейс",
      url: "stroydom.kz, satu.kz, krepysh.kz",
      format: "API + парсинг + Excel",
      coverage: "Розничные цены, не оптовые",
      update: "В реальном времени",
      cost: "Бесплатно для просмотра, парсинг через API — платный",
    },
  ];

  const fields = [
    { name: "code", what: "Код позиции — НП-расценка, ЭСН-номер или внутр. идентификатор", example: "ЭСН Сб.6-15-1, ССЦ.08.001.001, INT-2025-1234" },
    { name: "name", what: "Полное наименование с маркой/типом/ГОСТ", example: "Цемент М500 Д0 АБРО (Састобе), ГОСТ 31108-2020" },
    { name: "unit", what: "Единица измерения по справочнику", example: "м³, т, м², шт., компл., 100м" },
    { name: "price_supplier", what: "Цена поставщика без НДС и доставки", example: "32 500 тг/т" },
    { name: "price_total", what: "С НДС 12% + доставка + ССЦ-индекс", example: "32 500 × 1.12 + 1 200 = 37 600 тг/т" },
    { name: "supplier_id", what: "Ссылка на запись в каталоге поставщиков", example: "Састобецемент_TOO_124005056" },
    { name: "delivery_days", what: "Срок поставки в днях", example: "5-7 (с доставкой по Алматы)" },
    { name: "valid_until", what: "До какой даты гарантирована цена", example: "До 31.12.2025 (зимний прайс)" },
    { name: "min_qty", what: "Минимальная партия для получения цены", example: "20 т (полный КамАЗ-цементовоз)" },
    { name: "kpd_indexing", what: "Привязка к индексам стоимости", example: "Индекс ССЦ 1.32 — Алматы 2025 кв.2" },
  ];

  const flow = [
    "Источник (ССЦ docx / Excel / Web) → ", "Парсер (Python / Node) → ", "Валидация (Zod-схема) → ",
    "БД (PostgreSQL / SQLite) → ", "API → ", "UI сметчика (фильтры, поиск) → ", "Применение в смете",
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · База цен</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🗄 База цен и нормативный корпус
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Сметчик работает с десятками тысяч позиций цен из разных источников: государственные
            ССЦ РК, индексы, прайсы поставщиков, импорт из АВС-4, собственные исторические базы.
            <strong className="text-teal-300"> Управление базой цен</strong> — это процесс
            ингеста, валидации, индексирования и поддержания актуальности данных. Профессиональный
            сметчик не работает «по памяти» или «гугля каждую цену» — у него есть структурированная
            база, которую он обновляет регулярно.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Источники</div>
              <div className="text-slate-300">ССЦ РК + индексы + 5-15 поставщиков</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Объём базы</div>
              <div className="text-slate-300">3 000-10 000 позиций активных + архив</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Цикл обновления</div>
              <div className="text-slate-300">A-категория — еженедельно, B — раз в месяц</div>
            </div>
          </div>
        </section>

        {/* Section 1: Источники */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📚 Section 1. Шесть основных источников цен в РК
          </h2>
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-teal-300">{s.name}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{s.type}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">URL</dt>
                    <dd className="text-sky-300 text-xs font-mono">{s.url}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Формат</dt>
                    <dd className="text-slate-300 text-xs">{s.format}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Покрытие</dt>
                    <dd className="text-slate-300 text-xs">{s.coverage}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Обновление</dt>
                    <dd className="text-slate-300 text-xs">{s.update}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость</dt>
                    <dd className="text-emerald-300 text-xs">{s.cost}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Структура */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🧱 Section 2. Структура записи в базе цен
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Каждая позиция — это объект с обязательными полями. Без структурированных данных
            невозможна автоматизация — фильтрация, расчёты, сравнения, поиск дубликатов.
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Поле</th>
                  <th className="text-left px-4 py-3">Что хранит</th>
                  <th className="text-left px-4 py-3">Пример</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fields.map((f) => (
                  <tr key={f.name} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-mono text-teal-300">{f.name}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{f.what}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs font-mono">{f.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Пайплайн */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔄 Section 3. Пайплайн обновления базы цен
          </h2>
          <div className="border border-teal-800/60 bg-teal-950/30 rounded-xl p-5">
            <div className="text-sm text-slate-300 mb-4">
              Автоматизированный поток обновления (как реализовано в AEVION Smeta):
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {flow.map((step, idx) => (
                <span key={idx} className={`px-3 py-2 rounded ${idx % 2 === 0 ? "bg-teal-950/50 border border-teal-700 text-teal-200" : "text-slate-400"}`}>
                  {step}
                </span>
              ))}
            </div>
            <pre className="mt-4 text-xs whitespace-pre-wrap font-mono text-slate-300 bg-slate-950 p-3 rounded border border-slate-800">
{`# Пример скрипта обновления ССЦ (AEVION Smeta Trainer)
# Файл: raw-corpus/fetch-ksm.py
# Запускается через .github/workflows/update-ksm.yml
# еженедельно, по воскресеньям в 02:00 UTC

WANTED_PREFIXES = ["8.04-08", "8.04-09", "8.04-11", "8.04-12", "8.04-13"]

# 1. Парсинг каталога new-shop.ksm.kz
# 2. Diff с raw-corpus/ksm-state.json
# 3. Скачивание изменённых .rar
# 4. Распаковка → docx → ElementTree
# 5. Конвертация → frontend/public/ssc/ssc-2025-*.json
# 6. Автоматический PR с diff

if changed:
    create_pr(branch="feat/smeta-update-ksm", files=updated)`}
            </pre>
          </div>
        </section>

        {/* Section 4: Контроль качества */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ✅ Section 4. Контроль качества базы цен
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h3 className="font-semibold text-teal-300 mb-2">Z-score аномалий</h3>
              <p className="text-slate-300 text-xs">Каждый месяц расчёт стандартного отклонения цен. Z &gt; 3σ — повод для проверки (опечатка или поставщик задрал цену).</p>
            </div>
            <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h3 className="font-semibold text-teal-300 mb-2">Дубликаты</h3>
              <p className="text-slate-300 text-xs">Fuzzy-match по названию (Levenshtein), нормализация единиц («м3» vs «м³»), маркировка похожих позиций.</p>
            </div>
            <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h3 className="font-semibold text-teal-300 mb-2">Срок действия</h3>
              <p className="text-slate-300 text-xs">Поле valid_until + автоматическое выделение красным для просроченных. Алерт на email сметчику.</p>
            </div>
            <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h3 className="font-semibold text-teal-300 mb-2">История изменений</h3>
              <p className="text-slate-300 text-xs">Версионирование цен — была 32 000, стала 36 000 (+12.5%). Анализ трендов помогает прогнозировать.</p>
            </div>
            <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h3 className="font-semibold text-teal-300 mb-2">Сравнение поставщиков</h3>
              <p className="text-slate-300 text-xs">Минимум 2-3 цены на одну позицию. ABC-категория A — обязательно 3+ источника. Автоматич. рейтинг по сумме.</p>
            </div>
            <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h3 className="font-semibold text-teal-300 mb-2">Связь с реальными КС-2</h3>
              <p className="text-slate-300 text-xs">Сравнение плановой цены из базы с фактической в КС-2 закрытых объектов. Корректировка коэффициентов.</p>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Источник для бюджетного объекта
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик готовит смету для бюджетного объекта (государственное финансирование).
              Какой источник цен он <strong>обязан</strong> использовать в качестве базового?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только прайсы krisha.kz и satu.kz" },
                { v: "b", t: "АВС-4 коммерческая программа" },
                { v: "c", t: "Официальные ССЦ РК (НШ КСМ) + индексы РК (КазЦентрНОТ)" },
                { v: "d", t: "RSMeans (США) для прозрачности" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-teal-600 bg-teal-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-teal-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ССЦ РК + индексы</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> Для бюджетных объектов
                смета проходит ГосЭкспертизу, которая принимает только официальные нормативы:
                ССЦ РК (Сметные цены на материалы) + ЭСН РК (Элементные сметные нормы) +
                индексы РК. АВС-4 — это лишь программа, в которой ведутся расчёты, но
                источник данных всё равно ССЦ. krisha.kz и satu.kz — розничные цены, не
                принимаются как основа сметы. RSMeans — только для FIDIC-проектов с
                международным финансированием. На частных объектах сметчик может использовать
                любые источники, но для гос. сектора — только официальные.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Рост цены год к году
            </div>
            <div className="text-slate-200 mb-4">
              Цемент М500 в 2024 г. стоил <strong>38 000 тг/т</strong>. В 2025 г. цена выросла
              до <strong>45 000 тг/т</strong>. На сколько % выросла цена (округление 2 знака)?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Рост, %</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="18.42" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — +18.42%</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Δ% = (Цена_2025 − Цена_2024) / Цена_2024 × 100%
   = (45 000 − 38 000) / 38 000 × 100%
   = 7 000 / 38 000 × 100%
   = 18.42%

Сравнение с инфляцией:
  Официальная инфляция РК 2024 (по НБ РК) ≈ 8.5%
  Рост цемента 18.42% — в 2 раза выше инфляции

Возможные причины:
• Рост цен на газ (Састобецемент использует газ для печей)
• Рост стоимости транспортировки (тариф КТЖ +12%)
• Дефицит цемента в РК (часть импорт из RU/UZ)
• Курс валют (импортное оборудование заводов)

Для индексации сметы 2024 г. в цены 2025 г. сметчик:
1. Получает индексы по позициям (от КазЦентрНОТ)
2. Применяет к ССЦ или фактическим ценам поставщика
3. По цементу — индекс ~ 1.18 (как у нас)`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Z-score аномалия
            </div>
            <div className="text-slate-200 mb-4">
              В базе цен из 20 поставщиков плитки керамогр. средняя цена 4 500 тг/м²,
              стандартное отклонение σ = 600 тг/м². Один поставщик предлагает
              <strong> 7 000 тг/м²</strong>. Z-score = (7 000 − 4 500) / 600 = 4.17.
              Что это означает и что должен сделать сметчик?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Z=4.17 — нормальный поставщик, можно работать" },
                { v: "b", t: "Z &gt; 3σ — аномалия. Проверить: опечатка / премиум-категория плитки / надбавка за упаковку — и принять решение" },
                { v: "c", t: "Z=4.17 — лучшая цена, обязательно брать" },
                { v: "d", t: "Z-score не применяется к ценам стройматериалов" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-teal-600 bg-teal-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-teal-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — аномалия, проверить</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> Z-score 4.17 означает, что
                цена на 4.17 стандартных отклонений выше средней. По нормальному распределению
                вероятность такого случайного отклонения — менее 0.003%. Это явный outlier.
                Варианты объяснения:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Опечатка в прайс-листе (вместо 4700 вписали 7000)</li>
                  <li>Это другая категория плитки (премиум, импорт из Италии)</li>
                  <li>В цену включена доставка и подъём, что обычно отдельно</li>
                  <li>Поставщик попытался «подзаработать», предполагая малую вероятность сравнения</li>
                </ul>
                <strong>Действия:</strong> позвонить поставщику, уточнить состав цены,
                сравнить с прайс-листом, при подтверждении — пометить как «премиум»
                в отдельную категорию или отказаться от поставщика. Никогда не использовать
                «как есть» без анализа.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Сравнение поставщиков
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик сравнивает 2 предложения на одну позицию:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Поставщик A</strong>: цена 1 000 тг + доставка 50 тг = ? за единицу</li>
                <li><strong>Поставщик B</strong>: цена 950 тг + доставка 100 тг = ? за единицу</li>
              </ul>
              <p className="mt-2">Какова <strong>полная цена с доставкой</strong> у каждого
              (одна и та же для обоих, поэтому введите её)?</p>
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Полная цена, тг</span>
              <input value={ex4} onChange={(e) => setEx4(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="1050" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 1 050 тг (равны)</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Поставщик A: 1 000 + 50 = 1 050 тг/единицу
Поставщик B: 950 + 100 = 1 050 тг/единицу

Цена идентична — теперь решает дополнительные факторы:

КРИТЕРИЙ            A           B           Победитель
─────────────────────────────────────────────────────────
Цена с доставкой   1 050       1 050       Равны
Срок поставки      5 дней      14 дней     A (важно)
Минимальная партия 5 т         50 т        A (гибче)
Отсрочка платежа   30 дней     7 дней      A (cash-flow)
История работы     5 лет       Новый       A (надёжность)
Сертификаты        Все         Не все      A (для АОСР)
Регион поставщика  Алматы      Усть-Кам.   A (быстрее)
─────────────────────────────────────────────────────────
ИТОГ: Поставщик A — оптимален при равной цене.

ПРАВИЛО: цена — лишь один из 6-8 критериев. Сравнение
поставщиков должно быть многокритериальным. На крупных
объектах внедряют систему оценки субподрядчиков с
балльной системой (Vendor Rating System).`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ССЦ РК НШ КСМ — new-shop.ksm.kz. Индексы — kazcenter-not.kz. ИСТ Эталон —
          etalonsmeta.ru/kz. АВС-4 — avs-4.kz. Парсинг ССЦ в AEVION Smeta Trainer: см.
          raw-corpus/parse-ssc.py + weekly cron .github/workflows/update-ksm.yml.
        </div>
      </main>
    </div>
  );
}
