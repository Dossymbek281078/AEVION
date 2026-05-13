"use client";

import Link from "next/link";
import { useState } from "react";

export default function FidicContractsPage() {
  // Упражнение 1: какая книга FIDIC (multiple-choice)
  const [ex1Answer, setEx1Answer] = useState<string | null>(null);
  const [ex1Result, setEx1Result] = useState<null | "ok" | "bad">(null);
  const [ex1ShowSolution, setEx1ShowSolution] = useState(false);

  // Упражнение 2: кто утверждает Variation Order (multiple-choice)
  const [ex2Answer, setEx2Answer] = useState<string | null>(null);
  const [ex2Result, setEx2Result] = useState<null | "ok" | "bad">(null);
  const [ex2ShowSolution, setEx2ShowSolution] = useState(false);

  // Упражнение 3: срок ответа Engineer (multiple-choice)
  const [ex3Answer, setEx3Answer] = useState<string | null>(null);
  const [ex3Result, setEx3Result] = useState<null | "ok" | "bad">(null);
  const [ex3ShowSolution, setEx3ShowSolution] = useState(false);

  // Упражнение 4: размер обеспечения исполнения (multiple-choice)
  const [ex4Answer, setEx4Answer] = useState<string | null>(null);
  const [ex4Result, setEx4Result] = useState<null | "ok" | "bad">(null);
  const [ex4ShowSolution, setEx4ShowSolution] = useState(false);

  const checkEx1 = () => setEx1Result(ex1Answer === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Result(ex2Answer === "b" ? "ok" : "bad");
  const checkEx3 = () => setEx3Result(ex3Answer === "c" ? "ok" : "bad");
  const checkEx4 = () => setEx4Result(ex4Answer === "c" ? "ok" : "bad");

  const books = [
    {
      color: "red",
      name: "Red Book",
      sub: "Conditions of Contract for Construction",
      yr: "1999 / 2017",
      who: "Заказчик готовит проект (стадия Detailed Design), подрядчик строит",
      pay: "Re-measurement — оплата по фактическим обмерам",
      use: "~80% мировых проектов EPC по строительству объектов финансируемых МБРР/ЕБРР/АБР",
      ex: "Школа, больница, дорога, мост по готовому проекту заказчика",
    },
    {
      color: "yellow",
      name: "Yellow Book",
      sub: "Plant & Design-Build",
      yr: "1999 / 2017",
      who: "Подрядчик и проектирует и строит (Design-Build, EPC-light)",
      pay: "Lump Sum — фиксированная цена, риск проектирования у подрядчика",
      use: "Заводы, котельные, ТЭЦ, очистные с типовой технологией",
      ex: "Сахарный завод, ВЭС, СЭС, мини-НПЗ, фабрика по производству КИРПИЧА",
    },
    {
      color: "sky",
      name: "Silver Book",
      sub: "EPC / Turnkey Projects",
      yr: "1999 / 2017",
      who: "Единая ответственность подрядчика «под ключ» (EPC-Turnkey, BOOT-проекты)",
      pay: "Lump Sum + гарантия срока, цена и срок «заморожены»",
      use: "BOT/PPP/концессионные проекты, частные инвестиции",
      ex: "Платная автодорога, аэропорт-терминал, ГЭС с гарантией мощности",
    },
  ];

  const roles = [
    {
      role: "Employer",
      ru: "Заказчик",
      duty:
        "Финансирует проект, передаёт площадку (Site Possession), оплачивает Interim Payment Certificates, утверждает Final Payment",
    },
    {
      role: "Engineer",
      ru: "Независимый Инженер-Консультант",
      duty:
        "Администратор контракта, не сторона — выдаёт инструкции, утверждает Variation Orders, оценивает Claims, выпускает Taking-Over Certificate",
    },
    {
      role: "Contractor",
      ru: "Подрядчик",
      duty:
        "Выполняет Works в соответствии с Specification и Drawings, несёт риск качества, подаёт Notices и Claims, готовит Statement at Completion",
    },
    {
      role: "DAB / DAAB",
      ru: "Совет по разрешению споров",
      duty:
        "Dispute Adjudication Board (1999) / Dispute Avoidance and Adjudication Board (2017) — 1 или 3 эксперта, рассматривают споры до арбитража, решение обязательно к исполнению (но обжалуемо)",
    },
  ];

  const diffs = [
    {
      topic: "Администратор контракта",
      fidic: "Engineer — независимое третье лицо (часто инжиниринговая фирма), действует «справедливо» (fairly)",
      kz: "Технический надзор заказчика — сотрудник или нанятая ТН-организация, представляет интересы заказчика",
    },
    {
      topic: "Variation Order (изменение работ)",
      fidic:
        "Формализованная процедура Sub-Clause 13: Engineer выдаёт письменную Variation Instruction, Подрядчик подаёт оценку в 28 дней, итог — Variation Order с пересчётом цены",
      kz:
        "Допсоглашение к договору, подписи Сторон. Часто оформляется задним числом, споры о цене — через суд",
    },
    {
      topic: "Time Extension (продление срока)",
      fidic:
        "Sub-Clause 8.5 / 20.1 — Notice в 28 дней, обоснование, Engineer выдаёт Determination. Без Notice — право на EOT теряется",
      kz:
        "Часто устная договорённость, потом — письмо в произвольной форме. Юридически слабо защищено, последствия — штрафы за просрочку",
    },
    {
      topic: "Performance Security (обеспечение исполнения)",
      fidic:
        "10% от Contract Price — банковская гарантия первого требования (on-demand), действует до Performance Certificate (после DLP)",
      kz:
        "1–3% от суммы договора по Закону о госзакупках, банковская гарантия или обеспечительный депозит, возврат после подписания формы 2 с примечанием",
    },
    {
      topic: "Dispute Resolution",
      fidic:
        "Многоступенчатая: Notice → Engineer Determination → DAB/DAAB → Amicable Settlement → ICC Arbitration (Лондон/Париж/Сингапур)",
      kz:
        "Претензионный порядок (30 дней) → СМЭС или МКАС при НПП Атамекен. Иностранный арбитраж — редкость",
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; chip: string }> = {
    red: {
      bg: "bg-red-950/30",
      border: "border-red-800/60",
      text: "text-red-300",
      chip: "bg-red-900/40 text-red-200 border-red-700",
    },
    yellow: {
      bg: "bg-yellow-950/30",
      border: "border-yellow-800/60",
      text: "text-yellow-300",
      chip: "bg-yellow-900/40 text-yellow-200 border-yellow-700",
    },
    sky: {
      bg: "bg-sky-950/30",
      border: "border-sky-800/60",
      text: "text-sky-300",
      chip: "bg-sky-900/40 text-sky-200 border-sky-700",
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-sky-300 hover:text-sky-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">
            AEVION Smeta Trainer · Международные контракты
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Заголовок */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            📜 FIDIC контракты — Red/Yellow/Silver Book
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Международные типовые контракты{" "}
            <span className="text-sky-300 font-medium">
              Federation Internationale des Ingenieurs-Conseils
            </span>{" "}
            (Международная федерация инженеров-консультантов, штаб-квартира — Женева).
            Обязательны для проектов МБРР (World Bank), ЕБРР (EBRD), Азиатского банка развития (ADB),
            Исламского банка развития (IsDB) и Европейского инвестиционного банка (EIB). В РК
            применяются для всех инфраструктурных проектов с долей международного финансирования
            (например, дороги БАКАД, аэропорт Алматы, ВЛ-500 кВ Экибастуз–Шу, проекты по линии
            «Нурлы Жол»).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Нормативы</div>
              <div className="text-slate-300">FIDIC 1999 (1st Ed.) и 2017 (2nd Ed.)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Тендерные документы</div>
              <div className="text-slate-300">
                World Bank Standard Bidding Documents (SBD) для Works
              </div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Применение в РК</div>
              <div className="text-slate-300">
                Проекты МФО ~ 8–12 млрд $ за 2020–2025, &gt;200 контрактов
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Три книги */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📚 Section 1. Три основные книги FIDIC
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            FIDIC выпускает «радугу» контрактов (Rainbow Suite). Для строительных проектов в РК
            практически значимы три: Red, Yellow, Silver. Выбор книги определяет, кто несёт риск
            проектирования и как формируется цена.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {books.map((b) => {
              const c = colorMap[b.color];
              return (
                <div
                  key={b.name}
                  className={`border ${c.border} ${c.bg} rounded-xl p-5 flex flex-col`}
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className={`text-xl font-bold ${c.text}`}>{b.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${c.chip}`}>
                      {b.yr}
                    </span>
                  </div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                    {b.sub}
                  </div>
                  <dl className="text-sm text-slate-300 space-y-2 flex-1">
                    <div>
                      <dt className="text-slate-500 text-xs">Кто проектирует / строит</dt>
                      <dd>{b.who}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs">Цена</dt>
                      <dd>{b.pay}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs">Применение</dt>
                      <dd>{b.use}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs">Пример</dt>
                      <dd className="italic text-slate-400">{b.ex}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 mt-2">
            Кроме «трёх китов» существуют: Green Book (короткая форма для мелких работ), Gold Book
            (DBO — Design-Build-Operate, 20 лет), Pink Book (адаптированный Red для МБРР), White
            Book (договор Заказчик–Консультант), Emerald Book (тоннели и подземные работы, 2019 г.).
          </div>
        </section>

        {/* Section 2: Роли */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            👥 Section 2. Ключевые роли в контракте FIDIC
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-32">Роль (EN)</th>
                  <th className="text-left px-4 py-3 w-48">Русский эквивалент</th>
                  <th className="text-left px-4 py-3">Функции и обязанности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {roles.map((r) => (
                  <tr key={r.role} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-mono text-sky-300 align-top">{r.role}</td>
                    <td className="px-4 py-3 text-slate-200 align-top">{r.ru}</td>
                    <td className="px-4 py-3 text-slate-300 align-top">{r.duty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-yellow-950/30 border border-yellow-800/60 rounded-lg p-4 text-sm text-yellow-200">
            <strong>Важно:</strong> в Silver Book (EPC) фигуры Engineer нет — его функции выполняет
            Employer&apos;s Representative, что усиливает позицию заказчика. В Red и Yellow Engineer
            обязан действовать «нейтрально» при определении Claims (Sub-Clause 3.7 редакции 2017).
          </div>
        </section>

        {/* Section 3: Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">
            🧩 Section 3. Интерактивные упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Выбор книги FIDIC
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик финансирует строительство частного завода (фабрики строительных смесей) и
              хочет получить объект «под ключ» с гарантированной фиксированной ценой и сроком,
              перенеся на подрядчика максимум рисков (включая риск проектирования и
              геологический). Какая книга FIDIC применяется?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Red Book — Construction Contract" },
                { v: "b", t: "Yellow Book — Plant & Design-Build" },
                { v: "c", t: "Silver Book — EPC / Turnkey Projects" },
                { v: "d", t: "Green Book — Short Form of Contract" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1Answer === opt.v
                      ? "border-sky-600 bg-sky-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1Answer === opt.v}
                    onChange={() => setEx1Answer(opt.v)}
                    className="accent-sky-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1ShowSolution((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex1ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Result === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — Silver Book
                </span>
              )}
              {ex1Result === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно. Подсказка: ключевые слова — «под ключ», «фикс. цена», «риск
                  подрядчика»
                </span>
              )}
            </div>
            {ex1ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> Silver Book (EPC/Turnkey)
                разработан именно для проектов с частным финансированием (BOT, BOOT, концессии),
                где банк-кредитор требует от EPC-подрядчика гарантию срока и цены, а также принятие
                всех «непредвидимых» рисков (в Sub-Clause 4.12 — фиксация: подрядчик не может
                ссылаться на unforeseeable physical conditions). Red Book — для проектов заказчика с
                готовым проектом, Yellow — для типовых заводов с разделяемыми рисками, Green —
                короткая форма для контрактов до 500 тыс. $.
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Variation Order
            </div>
            <div className="text-slate-200 mb-4">
              Кто на стороне FIDIC утверждает Variation Order (изменение объёма или характера работ)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Employer (Заказчик) напрямую — подписывает изменение" },
                {
                  v: "b",
                  t: "Engineer — выпускает Variation Instruction по Sub-Clause 13",
                },
                { v: "c", t: "Contractor — самостоятельно вносит и уведомляет" },
                { v: "d", t: "DAB / DAAB — Совет по разрешению споров" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2Answer === opt.v
                      ? "border-sky-600 bg-sky-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2Answer === opt.v}
                    onChange={() => setEx2Answer(opt.v)}
                    className="accent-sky-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2ShowSolution((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex2ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Result === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — Engineer
                </span>
              )}
              {ex2Result === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно. Подсказка: администратор контракта в Red/Yellow Book
                </span>
              )}
            </div>
            {ex2ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> по Sub-Clause 13.1 (Right to
                Vary) и 13.3 (Variation Procedure) Variation выпускается Инженером в форме
                Instruction. Подрядчик в течение 28 дней представляет Proposal с оценкой времени и
                стоимости (Sub-Clause 13.3.1). После согласования Engineer выпускает Variation
                Order. В Silver Book роль Engineer выполняет Employer&apos;s Representative.
                Заказчик напрямую инструкции не выдаёт — это нарушение процедуры и основание для
                Claim&apos;a со стороны Подрядчика.
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Срок ответа Engineer
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик направил запрос Инженеру по Sub-Clause 4.7 (Setting Out — установочные
              данные/высотные отметки) о расхождении между чертежами и фактической геодезией. В
              течение какого срока Engineer обязан ответить (issue Notice / Instruction) согласно
              FIDIC 1999/2017?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "7 дней" },
                { v: "b", t: "14 дней" },
                { v: "c", t: "21 день" },
                { v: "d", t: "30 дней" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3Answer === opt.v
                      ? "border-sky-600 bg-sky-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex3"
                    value={opt.v}
                    checked={ex3Answer === opt.v}
                    onChange={() => setEx3Answer(opt.v)}
                    className="accent-sky-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3ShowSolution((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex3ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Result === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — 21 день
                </span>
              )}
              {ex3Result === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно. Стандартный срок реакции Engineer по запросам Подрядчика
                </span>
              )}
            </div>
            {ex3ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> Sub-Clause 4.7 (Red Book 1999) и
                Sub-Clause 1.9 (Delayed Drawings or Instructions) предусматривают типовой срок 21
                день для ответа Инженера. Превышение этого срока даёт Подрядчику право подать Notice
                по Sub-Clause 20.1 на Extension of Time + Cost. В редакции 2017 общий принцип «28
                дней на Notice + 21 день на Determination» формализован в Sub-Clause 3.7
                (Agreement or Determination).
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Performance Security
            </div>
            <div className="text-slate-200 mb-4">
              Какой типовой размер Performance Security (обеспечения исполнения) предусмотрен в
              стандартном FIDIC Red Book для проектов МБРР?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "3% от Contract Price" },
                { v: "b", t: "5% от Contract Price" },
                { v: "c", t: "10% от Contract Price" },
                { v: "d", t: "15% от Contract Price" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4Answer === opt.v
                      ? "border-sky-600 bg-sky-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4Answer === opt.v}
                    onChange={() => setEx4Answer(opt.v)}
                    className="accent-sky-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4ShowSolution((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex4ShowSolution ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Result === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — 10%
                </span>
              )}
              {ex4Result === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно. Типовое значение по World Bank SBD заметно выше казахстанских 1–3%
                </span>
              )}
            </div>
            {ex4ShowSolution && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> Sub-Clause 4.2 (Performance
                Security) — типовой размер 10% от Accepted Contract Amount, форма — банковская
                гарантия первого требования (on-demand) или standby Letter of Credit от банка с
                рейтингом не ниже A- (S&amp;P/Fitch). Действует до выпуска Performance Certificate
                (после Defects Notification Period — обычно 365 дней). В РК такая гарантия
                открывается в Halyk, Forte, Jysan или ВТБ; стоимость для подрядчика — 1,5–3% годовых
                от суммы гарантии.
              </div>
            )}
          </div>
        </section>

        {/* Section 4: FIDIC vs ГК РК */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚖️ Section 4. FIDIC vs ГК РК — 5 ключевых различий
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Аспект</th>
                  <th className="text-left px-4 py-3">FIDIC (международное)</th>
                  <th className="text-left px-4 py-3">ГК РК + Закон о госзакупках</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {diffs.map((d) => (
                  <tr key={d.topic} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-medium text-slate-200 align-top">{d.topic}</td>
                    <td className="px-4 py-3 text-slate-300 align-top">{d.fidic}</td>
                    <td className="px-4 py-3 text-slate-400 align-top">{d.kz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Расценки и факт о сертификации */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">
              💰 Расценки на работы по FIDIC-проектам в РК
            </h3>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>
                <span className="text-slate-500">Адаптация локальной сметы под BoQ FIDIC:</span>{" "}
                <span className="text-emerald-300">800 000 – 1 800 000 тг</span> за объект
              </li>
              <li>
                <span className="text-slate-500">Подготовка Tender Documents (Vol. 1–4):</span>{" "}
                <span className="text-emerald-300">2,5 – 6 млн тг</span>
              </li>
              <li>
                <span className="text-slate-500">FIDIC Engineer (administer contract):</span>{" "}
                <span className="text-emerald-300">3,5 – 7% от стоимости работ</span>
              </li>
              <li>
                <span className="text-slate-500">Сметчик-claims-specialist (in-house EPC):</span>{" "}
                <span className="text-emerald-300">800 000 – 1 600 000 тг/мес</span>
              </li>
              <li>
                <span className="text-slate-500">Подготовка Claim для DAB (под ключ):</span>{" "}
                <span className="text-emerald-300">от 1,5 млн тг</span>
              </li>
            </ul>
          </div>

          <div className="border border-red-800/60 bg-red-950/30 rounded-xl p-5">
            <div className="text-xs uppercase tracking-wider text-red-400 mb-2">
              🔥 Red Factoid — сертификация FIDIC
            </div>
            <p className="text-sm text-red-100 leading-relaxed">
              На территории Казахстана сертифицированных FIDIC-инженеров (FIDIC Certified Adjudicator
              / Certified Trainer / Module 1–3 graduate) — <strong>менее 50 человек</strong>. На
              проекты МБРР, ЕБРР, АБР наличие в команде «администратора контракта» с FIDIC-сертификатом
              является <strong>обязательным тендерным требованием</strong>. Стоимость прохождения
              базового модуля — около <strong>3 500 € + перелёт</strong> (Цюрих/Лондон/Дубай),
              экзамен — раз в год. По состоянию на 2026 г. крупнейшие держатели сертификатов в РК:{" "}
              <em>KazRoad, NCOC, Kazakh Engineering, AECOM Kazakhstan, Larsen &amp; Toubro KZ</em>.
              Сметчик с FIDIC-знаниями получает зарплату на <strong>40–80% выше</strong> рынка.
            </p>
          </div>
        </section>

        {/* Footer-card */}
        <section className="border border-slate-800 rounded-xl p-5 bg-gradient-to-br from-slate-900 to-slate-950">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            📝 Резюме модуля
          </h3>
          <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
            <li>
              FIDIC = типовые международные строительные контракты, 3 основные книги: Red, Yellow,
              Silver
            </li>
            <li>
              Red — заказчик проектирует, оплата по обмерам; Yellow — Design-Build EPC; Silver — EPC
              «под ключ» с фикс. ценой
            </li>
            <li>
              Engineer — независимый администратор контракта (в Silver его роль играет
              Employer&apos;s Representative)
            </li>
            <li>
              Отличия от ГК РК: формализованная процедура Variation, Notice-режим, 10% Performance
              Bond, DAB до арбитража
            </li>
            <li>
              В РК FIDIC обязателен для проектов МБРР/ЕБРР/АБР, сертифицированных инженеров — менее
              50 человек
            </li>
          </ul>
        </section>

        <div className="text-center text-xs text-slate-600 pt-4">
          AEVION Smeta Trainer · Модуль «FIDIC контракты» · обновлено 2026-05
        </div>
      </main>
    </div>
  );
}
