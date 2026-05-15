"use client";

import Link from "next/link";
import { useState } from "react";

export default function DrillingBlastingPage() {
  const [ex1, setEx1] = useState<string | null>(null);
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

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 450000) <= 30000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const explosives = [
    {
      type: "ANFO (АС-ДТ)",
      price: "800–1 200 тг/кг",
      use: "Массовые взрывы в сухих скважинах — карьеры, открытая разработка",
    },
    {
      type: "Эмульсии «Сибирит»",
      price: "1 500–2 200 тг/кг",
      use: "Обводнённые скважины, повышенная мощность, безопасность транспортировки",
    },
    {
      type: "Гранулит АС-8",
      price: "900–1 400 тг/кг",
      use: "Гранулированное ВВ для сухих скважин в породах средней крепости",
    },
    {
      type: "Аммонит 6ЖВ",
      price: "1 300–1 800 тг/кг",
      use: "Шпуровые заряды, тоннели, подземная разработка, патронированный",
    },
    {
      type: "Тротил (ТНТ)",
      price: "3 000–4 500 тг/кг",
      use: "Боевики-инициаторы, особо крепкие породы, спецназначение",
    },
  ];

  const drillingMachines = [
    {
      machine: "СБШ-250МНА",
      type: "Шарошечный, Ø250 мм",
      use: "Крупные карьеры (ССГПО, Богатырь), скважины глубиной до 32 м",
    },
    {
      machine: "БТС-150 / БТС-75",
      type: "Шарошечный/ударно-вращательный, Ø85–165 мм",
      use: "Средние карьеры, строительные котлованы в скальных грунтах",
    },
    {
      machine: "Atlas Copco ROC",
      type: "Ударно-вращательный (DTH), Ø85–165 мм",
      use: "Универсальные станки, импортные — карьеры известняка и гранита",
    },
    {
      machine: "Перфораторы ПП-63",
      type: "Ручные/колонковые, Ø42–52 мм",
      use: "Шпуры в тоннелях и подземных выработках, малые объёмы",
    },
    {
      machine: "Алмазные коронки",
      type: "Бурение Ø42–112 мм",
      use: "Точное бурение в железобетоне и крепких породах, реконструкция",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-blue-300 hover:text-blue-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">
            AEVION Smeta Trainer · Взрывные и буровые работы
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            💥 Взрывные и буровые работы
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Буровзрывные работы (БВР) — основной способ разработки скальных грунтов и
            добычи нерудных полезных ископаемых в РК. Применяются в карьерах
            (известняк, гранит, мрамор), при строительстве дорог в горной местности,
            устройстве котлованов в скальных грунтах, в подземной разработке. Требуют{" "}
            <strong className="text-amber-300">лицензии МЧС РК</strong> на работу с ВВ
            и строжайшего соблюдения техники безопасности.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">
                Удельный расход (скала)
              </div>
              <div className="text-slate-300">q = 1.5–3.0 кг/м³ массива</div>
            </div>
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">
                Безопасная зона
              </div>
              <div className="text-slate-300">Радиус разлёта 150–300 м</div>
            </div>
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">
                Нормативная база РК
              </div>
              <div className="text-slate-300">ЭСН Сб.36, ПБ ВВ, лицензия МЧС РК</div>
            </div>
          </div>
        </section>

        {/* Раздел 1 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            📊 Раздел 1. ЭСН Сб.36 — буровзрывные работы
          </h2>
          <p className="text-sm text-slate-400">
            Все буровзрывные работы в РК нормируются по{" "}
            <strong className="text-blue-300">сборнику ЭСН Сб.36</strong>. Включает
            нормативы на бурение шпуров и скважин, заряжание, взрывание, разработку
            взорванной массы, дробление негабарита вторичными взрывами.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-300 mb-3">
                Основные разделы Сб.36
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Раздел 1: Бурение шпуров перфораторами (Ø42–52 мм, глубина до 4 м)
                </li>
                <li>
                  Раздел 2: Бурение скважин станками шарошечного бурения (Ø85–250 мм)
                </li>
                <li>
                  Раздел 3: Заряжание скважин и шпуров промышленными ВВ
                </li>
                <li>Раздел 4: Взрывание зарядов, монтаж взрывной сети</li>
                <li>
                  Раздел 5: Вторичное дробление негабарита (накладные/шпуровые заряды)
                </li>
                <li>Раздел 6: Контурное взрывание (предщелевое, гладкое)</li>
              </ul>
            </div>
            <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-300 mb-3">
                Что входит в нормативную расценку
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>Бурение шпура/скважины расчётного диаметра и глубины</li>
                <li>Заряжание ВВ согласно паспорту БВР</li>
                <li>Изготовление и установка боевиков-инициаторов</li>
                <li>Монтаж взрывной сети (ДШ, СИНВ, ЭД)</li>
                <li>Производство взрыва, осмотр и приёмка результата</li>
                <li>Ликвидация отказов (отказавших зарядов)</li>
                <li>
                  ВВ и СВ (средства взрывания) — закладываются в смету{" "}
                  <strong className="text-amber-300">отдельной строкой по ССЦ</strong>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Раздел 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🕳 Раздел 2. Типы шпуров и скважин
          </h2>
          <div className="overflow-x-auto border border-blue-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-32">Тип</th>
                  <th className="text-left px-4 py-3 w-28">Диаметр</th>
                  <th className="text-left px-4 py-3 w-28">Глубина</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-bold text-blue-300 text-sm">
                    Шпур малый
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-300 text-xs">
                    Ø42 мм
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">
                    до 4 м
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    Тоннели, выработки, котлованы, дробление негабарита
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-bold text-blue-300 text-sm">
                    Скважина средняя
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-300 text-xs">
                    Ø85–105 мм
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">
                    5–15 м
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    Средние карьеры, строительные котлованы в скальных грунтах
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-bold text-blue-300 text-sm">
                    Скважина крупная
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-300 text-xs">
                    Ø165 мм
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">
                    10–20 м
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    Карьеры известняка, гранита; уступная отбойка
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-bold text-blue-300 text-sm">
                    Скважина массовая
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-300 text-xs">
                    Ø215–250 мм
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">
                    15–32 м
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    Крупные карьеры ССГПО, Богатырь Аксесс Комир, массовые взрывы
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🧨 Раздел 3. Взрывчатые вещества (ВВ)
          </h2>
          <p className="text-sm text-slate-400">
            Промышленные ВВ относятся к опасным грузам класса 1 (взрывчатые). В РК
            оборот ВВ контролируется МЧС РК и МВД РК. Цены на 2024–2025 гг.
            ориентировочные, зависят от поставщика (Орика-Казахстан, Каз ВВ Сервис).
          </p>
          <div className="overflow-x-auto border border-blue-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Тип ВВ</th>
                  <th className="text-left px-4 py-3 w-40">Цена (тг/кг)</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {explosives.map((r) => (
                  <tr key={r.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-blue-300 text-sm whitespace-nowrap">
                      {r.type}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-300 text-xs">
                      {r.price}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            ⚖ Раздел 4. Удельный расход ВВ (q, кг/м³)
          </h2>
          <p className="text-sm text-slate-400">
            Удельный расход ВВ <span className="font-mono text-amber-300">q</span> —
            масса ВВ, необходимая для разрушения 1 м³ массива. Зависит от крепости
            породы по шкале Протодьяконова (f), трещиноватости, требуемой
            кусковатости.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-300 mb-3">
                Грунты и нерудные породы
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Глины, суглинки с включениями:{" "}
                  <span className="font-mono text-emerald-300">q = 0.4–0.6 кг/м³</span>
                </li>
                <li>
                  Лёссы плотные, мергели:{" "}
                  <span className="font-mono text-emerald-300">q = 0.5–0.8 кг/м³</span>
                </li>
                <li>
                  Известняк-ракушечник:{" "}
                  <span className="font-mono text-emerald-300">q = 0.4–0.7 кг/м³</span>
                </li>
                <li>
                  Известняк средней крепости (f=6):{" "}
                  <span className="font-mono text-emerald-300">q = 0.6–1.0 кг/м³</span>
                </li>
                <li>
                  Песчаники, доломиты:{" "}
                  <span className="font-mono text-emerald-300">q = 0.8–1.2 кг/м³</span>
                </li>
              </ul>
            </div>
            <div className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-300 mb-3">
                Скальные породы
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Известняк крепкий (f=8–10):{" "}
                  <span className="font-mono text-emerald-300">q = 1.0–1.5 кг/м³</span>
                </li>
                <li>
                  Гранит средней крепости (f=12):{" "}
                  <span className="font-mono text-emerald-300">q = 1.5–2.0 кг/м³</span>
                </li>
                <li>
                  Гранит крепкий (f=14–18):{" "}
                  <span className="font-mono text-emerald-300">q = 1.8–2.5 кг/м³</span>
                </li>
                <li>
                  Кварциты, базальты (f=18–20):{" "}
                  <span className="font-mono text-emerald-300">q = 2.0–3.0 кг/м³</span>
                </li>
                <li>
                  Особо крепкие (f={">"}20):{" "}
                  <span className="font-mono text-emerald-300">q = 2.5–3.5 кг/м³</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border border-amber-900/30 bg-amber-950/10 rounded-xl p-4 text-sm">
            <strong className="text-amber-300">Формула расхода ВВ:</strong>{" "}
            <span className="font-mono text-emerald-300">
              Q (кг) = V (м³) × q (кг/м³)
            </span>{" "}
            — общая масса ВВ для взрыва массива объёмом V с удельным расходом q.
            Стоимость ВВ в смете: <span className="font-mono">Q × Cена/кг</span>.
          </div>
        </section>

        {/* Раздел 5 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🚧 Раздел 5. Безопасные зоны при взрывных работах
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: "💨",
                title: "Радиус разлёта осколков",
                desc: "150–300 м для скважинных зарядов в карьерах. Зависит от массы заряда, забойки, направления взрыва. Расчёт по ПБ ВВ РК. На границе — обязательное оцепление.",
              },
              {
                icon: "📈",
                title: "Сейсмическое действие",
                desc: "Колебания грунта от взрыва — могут разрушить здания вблизи. Безопасное расстояние по сейсмике: 50–500 м от заряда (в зависимости от массы ВВ и категории зданий).",
              },
              {
                icon: "🌬",
                title: "Ударная воздушная волна",
                desc: "Может разрушить остекление в радиусе 300–800 м. Снижается забойкой скважин (инертный материал в верхней части скважины) и направлением взрыва.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-red-900/30 bg-red-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-red-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-xs text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="border border-red-900/30 bg-red-950/10 rounded-xl p-4 text-sm">
            <strong className="text-red-300">⚠ Опасная зона:</strong> рассчитывается
            в паспорте БВР как максимум из трёх радиусов (осколки, сейсмика, воздушная
            волна). На время взрыва — обязательно оцепление, сирена-предупреждение
            (1 сигнал — за 30 мин; 2 сигнала — за 5 мин; 3 сигнала — отбой).
          </div>
        </section>

        {/* Раздел 6 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            📋 Раздел 6. Документация и лицензии
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "📝",
                title: "Паспорт БВР",
                desc: "Основной технологический документ. Содержит: схему расположения скважин/шпуров, расчёт ВВ и СВ, схему монтажа взрывной сети, расчёт опасной зоны, мероприятия по безопасности, инструктаж персонала. Утверждается главным инженером.",
              },
              {
                icon: "📐",
                title: "Проект массового взрыва (ПМВ)",
                desc: "Для масштабных взрывов (>1000 кг ВВ). Содержит обоснование объёмов, расчёт сейсмики, согласования с надзорными органами. Обязателен для карьеров. Согласовывается с МЧС РК.",
              },
              {
                icon: "🏛",
                title: "Лицензия МЧС РК",
                desc: "Лицензия на оборот ВВ — обязательна для подрядчика, выполняющего БВР. Включает: хранение, перевозку, использование промышленных ВВ. Сроки получения 3–6 месяцев, обновление каждые 5 лет.",
              },
              {
                icon: "🧾",
                title: "Журналы и акты",
                desc: "Журнал учёта ВВ и СВ, журнал инструктажа взрывников, акт о результатах взрыва, акт списания ВВ. Хранятся на предприятии 5 лет, проверяются МЧС/Промнадзором.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-blue-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 7 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🛠 Раздел 7. Буровое оборудование
          </h2>
          <p className="text-sm text-slate-400">
            Выбор станка зависит от диаметра скважины, крепости породы, объёма работ.
            Производительность бурения: 50–250 пог.м/смену в зависимости от
            оборудования и категории породы.
          </p>
          <div className="overflow-x-auto border border-blue-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Станок</th>
                  <th className="text-left px-4 py-3 w-56">Тип / диаметр</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {drillingMachines.map((r) => (
                  <tr key={r.machine} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-blue-300 text-sm whitespace-nowrap">
                      {r.machine}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.type}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 8 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🇰🇿 Раздел 8. Бенчмарки РК (карьеры и стоимость)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-emerald-300 mb-3">
                Крупнейшие карьеры РК
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  <strong className="text-emerald-300">ССГПО (Качарский ГОК)</strong>{" "}
                  — Костанайская обл., железная руда, скважины Ø250 мм, годовая добыча
                  до 40 млн т
                </li>
                <li>
                  <strong className="text-emerald-300">Богатырь Аксесс Комир</strong>{" "}
                  — Экибастуз, угольный разрез, крупнейший в мире по добыче угля
                  открытым способом
                </li>
                <li>
                  <strong className="text-emerald-300">Жарминский ГОК</strong> — ВКО,
                  медно-цинковые руды, скважины Ø165–215 мм
                </li>
                <li>
                  <strong className="text-emerald-300">
                    Карьеры известняка Алматинской обл.
                  </strong>{" "}
                  — Капчагай, для цемзаводов; объёмы 1–3 млн т/год
                </li>
                <li>
                  <strong className="text-emerald-300">
                    Карьеры гранита Кызылординской обл.
                  </strong>{" "}
                  — облицовочный, дорожный щебень, скважины Ø85–105 мм
                </li>
              </ul>
            </div>
            <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-emerald-300 mb-3">
                Стоимость БВР в смете (РК, 2024–2025)
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Бурение скважин Ø85–105 мм:{" "}
                  <span className="font-mono text-emerald-300">
                    1 200–2 500 тг/пог.м
                  </span>
                </li>
                <li>
                  Бурение скважин Ø165 мм:{" "}
                  <span className="font-mono text-emerald-300">
                    2 800–5 000 тг/пог.м
                  </span>
                </li>
                <li>
                  Бурение скважин Ø250 мм:{" "}
                  <span className="font-mono text-emerald-300">
                    5 500–9 000 тг/пог.м
                  </span>
                </li>
                <li>
                  БВР под ключ (известняк, средняя крепость):{" "}
                  <span className="font-mono text-emerald-300">
                    1 800–3 500 тг/м³ массива
                  </span>
                </li>
                <li>
                  БВР под ключ (гранит крепкий):{" "}
                  <span className="font-mono text-emerald-300">
                    4 500–8 000 тг/м³ массива
                  </span>
                </li>
                <li>
                  Дробление негабарита накладными зарядами:{" "}
                  <span className="font-mono text-emerald-300">
                    1 500–3 000 тг/шт
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр. 1 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Удельный расход ВВ для гранита
            </div>
            <div className="text-slate-200 mb-4">
              Какой удельный расход ВВ для разработки гранитного массива (крепкий
              гранит, f=14–18)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "0.2–0.4 кг/м³ — лёгкий массив, минимальный расход" },
                { v: "b", t: "0.6–1.0 кг/м³ — средний расход для нерудных пород" },
                {
                  v: "c",
                  t: "1.5–3.0 кг/м³ — для крепких скальных пород, включая гранит",
                },
                { v: "d", t: "5–10 кг/м³ — для особо крепких массивов под водой" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно!
                </span>
              )}
              {ex1Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — см. раздел 4
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>в</strong>. Удельный расход ВВ для крепких скальных пород
                (гранит, кварциты, базальты) составляет{" "}
                <span className="font-mono text-emerald-300">1.5–3.0 кг/м³</span>.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Гранит средней крепости (f=12): q ≈ 1.5–2.0 кг/м³
                  </li>
                  <li>
                    Гранит крепкий (f=14–18): q ≈ 1.8–2.5 кг/м³
                  </li>
                  <li>
                    Кварциты, базальты (f=18–20): q ≈ 2.0–3.0 кг/м³
                  </li>
                  <li>
                    Для сравнения: глины и суглинки — всего 0.4–0.6 кг/м³, в 3–5 раз
                    меньше
                  </li>
                  <li>
                    Удельный расход зависит от трещиноватости массива и требуемой
                    кусковатости (для крупного дробления — меньше, для мелкого —
                    больше)
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Сборник ЭСН для БВР
            </div>
            <div className="text-slate-200 mb-4">
              По какому сборнику ЭСН РК нормируются буровзрывные работы?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Сб.1 «Земляные работы» — все разработки грунта" },
                {
                  v: "b",
                  t: "Сб.36 «Буровзрывные работы» — бурение и взрывание в скальных породах",
                },
                { v: "c", t: "Сб.46 «Работы при реконструкции»" },
                { v: "d", t: "Сб.9 «Строительные металлические конструкции»" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно!
                </span>
              )}
              {ex2Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>б</strong>. Все буровзрывные работы в РК нормируются по
                сборнику <strong className="text-emerald-300">ЭСН Сб.36</strong>.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Сб.36 включает бурение шпуров и скважин, заряжание, взрывание,
                    разработку взорванной массы, дробление негабарита
                  </li>
                  <li>
                    Сб.1 «Земляные работы» — для грунтов I–IV категорий без взрыва
                    (механическая разработка экскаватором/бульдозером)
                  </li>
                  <li>
                    ВВ и СВ (детонирующий шнур, электродетонаторы, СИНВ) — закладываются
                    в смету отдельной строкой по ССЦ РК
                  </li>
                  <li>
                    Применение Сб.36 требует обоснования: акт о категории грунта,
                    геология, ПОС с обоснованием способа разработки
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расчёт стоимости ВВ (ANFO)
            </div>
            <div className="text-slate-200 mb-4">
              Рассчитайте стоимость ANFO для взрыва массива известняка объёмом{" "}
              <strong>1 000 м³</strong> при удельном расходе{" "}
              <strong>q = 0.45 кг/м³</strong>. Цена ANFO —{" "}
              <strong>1 000 тг/кг</strong>. Введите итоговую стоимость в тенге.
            </div>
            <div className="text-xs text-slate-400 italic mb-3">
              💡 Масса ВВ (кг) = V × q; Стоимость (тг) = масса × цена
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkEx3()}
                placeholder="Введите стоимость в тг..."
                className="flex-1 min-w-[200px] border border-slate-700 rounded px-3 py-2 text-sm font-mono bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Res === "ok" && (
              <p className="mt-3 text-emerald-300 text-sm">✅ Верно!</p>
            )}
            {ex3Res === "bad" && (
              <p className="mt-3 text-red-300 text-sm">
                ❌ Неверно. Проверьте расчёт массы и стоимости.
              </p>
            )}
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Масса ВВ ={" "}
                    <span className="font-mono text-amber-300">
                      V × q = 1 000 × 0.45 = 450 кг
                    </span>
                  </li>
                  <li>
                    Стоимость ВВ ={" "}
                    <span className="font-mono text-amber-300">
                      450 × 1 000 = 450 000 тг
                    </span>
                  </li>
                  <li>
                    Ответ:{" "}
                    <strong className="text-emerald-300">450 000 тг</strong> (допуск
                    ±30 000)
                  </li>
                </ul>
                <p className="text-xs mt-2 text-slate-400">
                  В реальной смете к стоимости ВВ добавляются: средства взрывания (ДШ,
                  СИНВ, ЭД) — обычно 5–15% от стоимости ВВ; бурение скважин — отдельной
                  строкой по ЭСН Сб.36; зарплата взрывников и накладные расходы. Итого
                  полная стоимость БВР для массива 1 000 м³ известняка ≈ 1.8–3.5 млн тг.
                </p>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Содержание паспорта БВР
            </div>
            <div className="text-slate-200 mb-4">
              Что входит в паспорт буровзрывных работ (паспорт БВР)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Только схема расположения скважин на уступе — этого достаточно",
                },
                {
                  v: "b",
                  t: "Только расчёт массы ВВ и средств взрывания",
                },
                {
                  v: "c",
                  t: "Только расчёт сейсмики и опасной зоны для взрывной волны",
                },
                {
                  v: "d",
                  t: "Всё перечисленное: схема скважин, расчёт ВВ и СВ, расчёт сейсмики и опасной зоны, схема монтажа взрывной сети, мероприятия по ТБ, инструктаж персонала",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно!
                </span>
              )}
              {ex4Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>г</strong>. Паспорт БВР — комплексный технологический документ.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    <strong>Схема скважин/шпуров</strong>: координаты, диаметры,
                    глубины, ЛНС (линия наименьшего сопротивления), сетка бурения
                  </li>
                  <li>
                    <strong>Расчёт ВВ и СВ</strong>: масса заряда по скважинам, тип ВВ,
                    конструкция заряда, тип забойки, средства инициирования
                  </li>
                  <li>
                    <strong>Расчёт сейсмики</strong>: безопасное расстояние до зданий,
                    допустимая масса заряда в группе при одновременном взрывании
                  </li>
                  <li>
                    <strong>Опасная зона</strong>: радиус разлёта осколков, ударная
                    волна, схема оцепления, посты охраны
                  </li>
                  <li>
                    <strong>Схема взрывной сети</strong>: монтаж ДШ/СИНВ/ЭД,
                    замедление, проверка цепи
                  </li>
                  <li>
                    <strong>Мероприятия по ТБ + инструктаж</strong>: список взрывников,
                    их допуски, маршруты ухода, сигналы оповещения
                  </li>
                  <li>
                    Паспорт утверждается главным инженером и согласуется с МЧС РК для
                    массовых взрывов
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Нормативная база */}
        <section className="border border-blue-900/20 bg-blue-950/10 rounded-xl p-5 space-y-2">
          <h2 className="text-base font-bold text-blue-300">
            📑 Расценки ЭСН РК (буровзрывные работы)
          </h2>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>
              <strong className="text-blue-300">ЭСН Сб.36 «Буровзрывные работы»</strong>{" "}
              — бурение шпуров и скважин, заряжание, взрывание, дробление негабарита,
              контурное взрывание
            </li>
            <li>
              <strong className="text-blue-300">
                Правила безопасности при взрывных работах РК (ПБ ВВ)
              </strong>{" "}
              — основной нормативный документ, утверждается МЧС РК
            </li>
            <li>
              <strong className="text-blue-300">СН РК 1.03-26 «ПОС и ППР»</strong> —
              требования к проектной документации, паспорту БВР
            </li>
            <li>
              <strong className="text-blue-300">ЭСН Сб.1 «Земляные работы»</strong> —
              разработка взорванной массы экскаватором (отдельная операция после БВР)
            </li>
            <li>
              <strong className="text-blue-300">ССЦ РК</strong> — цены на ВВ (ANFO,
              Сибирит, Гранулит, Аммонит 6ЖВ), СВ (ДШ, СИНВ, ЭД), буровой инструмент
              (коронки, штанги)
            </li>
            <li>
              <strong className="text-blue-300">Лицензия МЧС РК</strong> на оборот ВВ —
              обязательна для подрядчика, без неё БВР не закрываются актами
            </li>
          </ul>
        </section>

        {/* Факт сметчика */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-bold mb-1 text-blue-300">Факт сметчика</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Стоимость ВВ и СВ в смете на БВР составляет{" "}
                <strong className="text-blue-300">30–50%</strong> от полной стоимости
                работ — остальное это бурение, зарплата взрывников, накладные. Главная
                ошибка начинающих сметчиков: применять Сб.1 «Земляные работы» к
                скальным грунтам V–XI категорий. Скальные грунты разрабатываются{" "}
                <strong>только</strong> с предварительным взрыванием по Сб.36, а
                механическая разработка экскаватором применяется уже к{" "}
                <strong className="text-amber-300">взорванной массе</strong>. Также
                критично: без лицензии МЧС РК на оборот ВВ ни один акт КС-2 по Сб.36
                не будет принят заказчиком — проверяется на стадии подготовки договора.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
