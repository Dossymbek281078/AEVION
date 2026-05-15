"use client";

import Link from "next/link";
import { useState } from "react";

type GuaranteeRow = { type: string; size: string; purpose: string; term: string };

const GUARANTEE_TYPES: GuaranteeRow[] = [
  {
    type: "Гарантия заявки (тендерная)",
    size: "1% от тендерной суммы",
    purpose: "Обеспечение участия в конкурсе, защита заказчика от отзыва заявки",
    term: "До подписания договора + 30 дней",
  },
  {
    type: "Гарантия исполнения договора",
    size: "3% от суммы договора",
    purpose: "Гарантия выполнения подрядчиком обязательств по СМР",
    term: "Срок выполнения работ + 30 дней",
  },
  {
    type: "Гарантия аванса (возврата)",
    size: "100% от суммы аванса",
    purpose: "Возврат заказчику неотработанного аванса при расторжении",
    term: "До полного освоения аванса (по актам КС-2)",
  },
  {
    type: "Гарантия гарантийного обслуживания",
    size: "5% от суммы договора",
    purpose: "Устранение скрытых дефектов в гарантийный период",
    term: "12-24 месяца после ввода объекта в эксплуатацию",
  },
  {
    type: "Гарантия возврата НДС",
    size: "Сумма заявленного к возврату НДС",
    purpose: "Для крупных проектов с экспортом или льготным НДС",
    term: "До завершения камеральной проверки КГД",
  },
];

type BankRow = { bank: string; rate: string; minSum: string; collateral: string };

const BANK_RATES: BankRow[] = [
  {
    bank: "Halyk Bank",
    rate: "1.5-3.5% годовых",
    minSum: "от 500 000 тг",
    collateral: "Депозит 20-100% или залог недвижимости",
  },
  {
    bank: "Kaspi Bank",
    rate: "2.0-4.0% годовых",
    minSum: "от 1 000 000 тг",
    collateral: "Депозит 30-100%, корпоративные клиенты — без залога до 50 млн",
  },
  {
    bank: "Forte Bank",
    rate: "1.8-3.0% годовых",
    minSum: "от 300 000 тг",
    collateral: "Депозит 25-100% или поручительство",
  },
  {
    bank: "Bank Centerkredit (БЦК)",
    rate: "2.5-4.5% годовых",
    minSum: "от 500 000 тг",
    collateral: "Депозит 30-100%, недвижимость, оборудование",
  },
  {
    bank: "Jysan Bank",
    rate: "2.0-3.5% годовых",
    minSum: "от 1 000 000 тг",
    collateral: "Депозит 20-100% или комбинированный залог",
  },
];

type InsuranceRow = { kind: string; coverage: string; tariff: string; example: string };

const INSURANCE_TYPES: InsuranceRow[] = [
  {
    kind: "Страхование строймонтажа (CAR + EAR)",
    coverage: "Cargo (CAR) + Erection (EAR) — материалы, конструкции, оборудование на стройплощадке",
    tariff: "0.3-0.6% от стоимости СМР",
    example: "Объект 100 млн тг, тариф 0.4% ⇒ премия 400 000 тг",
  },
  {
    kind: "Страхование ответственности перед 3-ми лицами (TPL)",
    coverage: "Вред жизни, здоровью, имуществу третьих лиц при производстве СМР",
    tariff: "0.05-0.15% от лимита покрытия",
    example: "Лимит 5 000 МРП (~18.46 млн тг 2026), премия ~30 000 тг",
  },
  {
    kind: "Страхование рабочих от несчастных случаев",
    coverage: "Травмы, инвалидность, гибель работников на стройплощадке (обязательно по ТК РК)",
    tariff: "0.5-2.5% от ФОТ (зависит от класса проф. риска)",
    example: "ФОТ 30 млн тг, тариф 1.5% ⇒ 450 000 тг/год",
  },
  {
    kind: "Страхование завершённого объекта (post-construction)",
    coverage: "Скрытые дефекты, разрушения, пожар после ввода в эксплуатацию",
    tariff: "0.1-0.3% от стоимости объекта в год",
    example: "Срок покрытия — 5-7 лет (гарантийный период)",
  },
  {
    kind: "Страхование оборудования и техники",
    coverage: "Краны, экскаваторы, бетононасосы — поломка, кража, повреждения",
    tariff: "0.8-1.5% от балансовой стоимости/год",
    example: "Башенный кран 80 млн тг, премия 800 000-1 200 000 тг/год",
  },
];

const BANK_DOCUMENTS: { num: number; doc: string }[] = [
  { num: 1, doc: "Заявление-анкета на выдачу гарантии (форма банка)" },
  { num: 2, doc: "Учредительные документы (Устав, свидетельство о регистрации, приказы о назначении)" },
  { num: 3, doc: "Финансовая отчётность за последние 2-3 года (Ф-1, Ф-2, аудиторское заключение)" },
  { num: 4, doc: "Справки об отсутствии задолженности перед бюджетом (КГД) и банками (ПКБ)" },
  { num: 5, doc: "Тендерная документация / проект договора (объект, сумма, сроки, бенефициар)" },
  { num: 6, doc: "Лицензия СМР соответствующей категории (1, 2 или 3) и СТ-РК ИСО 9001" },
  { num: 7, doc: "Документы на залог (правоустанавливающие, оценка, технический паспорт) или депозит" },
  { num: 8, doc: "Бизнес-план / расчёт денежных потоков по контракту (для гарантий свыше 50 млн тг)" },
];

interface NumericExercise {
  id: string;
  kind: "numeric";
  title: string;
  question: string;
  hint: string;
  answer: number;
  unit: string;
  tolerancePct: number;
  solution: string;
}

interface ChoiceExercise {
  id: string;
  kind: "choice";
  title: string;
  question: string;
  hint: string;
  options: { key: "a" | "b" | "c" | "d"; label: string }[];
  correct: "a" | "b" | "c" | "d";
  solution: string;
}

type Exercise = NumericExercise | ChoiceExercise;

const EXERCISES: Exercise[] = [
  {
    id: "ex1-bg-cost",
    kind: "numeric",
    title: "Упражнение 1. Стоимость банковской гарантии",
    question:
      "Подрядчик берёт гарантию исполнения договора на сумму 50 000 000 тг в Halyk Bank по тарифу 2.5% годовых на срок 12 месяцев. Какова стоимость БГ (комиссия банка) в тенге?",
    hint: "Формула: Сумма БГ × Тариф × (Срок мес. / 12). Считаем простой процент.",
    answer: 1_250_000,
    unit: "тг",
    tolerancePct: 5,
    solution:
      "50 000 000 × 0.025 × (12/12) = 1 250 000 тг. На практике комиссия удерживается единовременно при выдаче гарантии. Если срок < 12 мес. — пропорционально (например, 6 мес. ⇒ 625 000 тг).",
  },
  {
    id: "ex2-insurance-premium",
    kind: "numeric",
    title: "Упражнение 2. Премия за страхование СМР",
    question:
      "Объект СМР стоимостью 100 000 000 тг страхуется по полису CAR+EAR с тарифом 0.4% от стоимости. Какова страховая премия за весь период строительства?",
    hint: "Формула: Стоимость СМР × Тариф (доля от 1). Премия — единоразовый платёж за весь период.",
    answer: 400_000,
    unit: "тг",
    tolerancePct: 5,
    solution:
      "100 000 000 × 0.004 = 400 000 тг. Премия закладывается в смету как накладные расходы (статья «страхование СМР»). При продлении полиса (например, при сдвиге сроков) — доплата пропорционально периоду.",
  },
  {
    id: "ex3-guarantee-term",
    kind: "choice",
    title: "Упражнение 3. Срок гарантии исполнения по типовому ДКУ РК",
    question:
      "По типовому Договору о государственных закупках (ДКУ) РК (приложение к Закону «О гос. закупках» от 4.12.2015) на какой срок должна быть выдана банковская гарантия исполнения договора?",
    hint: "Гарантия должна перекрывать риск неисполнения по всем работам + период приёмки.",
    options: [
      { key: "a", label: "Только на срок выполнения работ" },
      { key: "b", label: "Срок выполнения работ + 30 календарных дней" },
      { key: "c", label: "Срок выполнения работ + 90 календарных дней" },
      { key: "d", label: "Фиксированно 12 месяцев независимо от срока работ" },
    ],
    correct: "b",
    solution:
      "Согласно типовому ДКУ РК (Закон «О гос. закупках» от 4.12.2015, типовая форма) — срок выполнения работ + 30 календарных дней. Эти 30 дней нужны для подписания акта окончательной приёмки и предъявления претензий по объёмам/качеству. Если работы продлены (доп. соглашение) — гарантия пролонгируется автоматически или новой выдачей.",
  },
  {
    id: "ex4-tpl-coverage",
    kind: "choice",
    title: "Упражнение 4. Минимальное покрытие ответственности перед 3-ми лицами",
    question:
      "По постановлению МЧС РК для строительства объектов в Алматы (сейсмическая зона) — каков минимальный обязательный лимит покрытия страхования ответственности перед третьими лицами для капитальных объектов класса II?",
    hint: "Покрытие выражается в МРП. 1 МРП в 2026 году = 3 692 тг (учебный курс).",
    options: [
      { key: "a", label: "1 000 МРП (~3.69 млн тг)" },
      { key: "b", label: "3 000 МРП (~11.08 млн тг)" },
      { key: "c", label: "5 000 МРП (~18.46 млн тг)" },
      { key: "d", label: "10 000 МРП (~36.92 млн тг)" },
    ],
    correct: "c",
    solution:
      "По постановлению МЧС РК — минимум 5 000 МРП (~18 460 000 тг при МРП 3 692). Для объектов I класса опасности (высотные, школы, больницы) — лимит может быть увеличен до 10 000-20 000 МРП. Полис TPL обязателен при подаче в комиссию по приёмке СМР.",
  },
];

type AnswerState = Record<string, string>;
type ResultState = Record<string, "correct" | "wrong" | null>;
type SolutionState = Record<string, boolean>;

export default function BankGuaranteesInsurancePage() {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [results, setResults] = useState<ResultState>({});
  const [shown, setShown] = useState<SolutionState>({});

  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const checkAnswer = (ex: Exercise) => {
    const raw = answers[ex.id]?.trim() ?? "";
    if (!raw) {
      setResults((prev) => ({ ...prev, [ex.id]: "wrong" }));
      return;
    }
    if (ex.kind === "numeric") {
      const cleaned = raw.replace(/[\s_]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      if (Number.isNaN(num)) {
        setResults((prev) => ({ ...prev, [ex.id]: "wrong" }));
        return;
      }
      const diff = Math.abs(num - ex.answer);
      const tol = (ex.answer * ex.tolerancePct) / 100;
      setResults((prev) => ({
        ...prev,
        [ex.id]: diff <= tol ? "correct" : "wrong",
      }));
    } else {
      setResults((prev) => ({
        ...prev,
        [ex.id]: raw.toLowerCase() === ex.correct ? "correct" : "wrong",
      }));
    }
  };

  const toggleSolution = (id: string) =>
    setShown((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            &larr; К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta Trainer &middot; Финансовое сопровождение СМР
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-amber-300">
            🏦 Банковские гарантии и страхование СМР
          </h1>
          <p className="mt-4 text-slate-300 leading-relaxed">
            Банковская гарантия (БГ) — безотзывное обязательство банка выплатить заказчику
            определённую сумму при невыполнении подрядчиком условий договора. Страхование СМР —
            защита подрядчика от рисков повреждения объекта, оборудования и ответственности перед
            третьими лицами в период строительства и гарантийной эксплуатации.
          </p>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
              <div className="text-xs uppercase tracking-wide text-amber-400">Норматив 1</div>
              <div className="mt-2 text-sm text-slate-200">
                Гражданский кодекс РК — гл. 18 «Обеспечение исполнения обязательств» (ст. 329-336)
              </div>
            </div>
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
              <div className="text-xs uppercase tracking-wide text-amber-400">Норматив 2</div>
              <div className="mt-2 text-sm text-slate-200">
                Закон РК «О государственных закупках» от 4 декабря 2015 года № 434-V
              </div>
            </div>
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
              <div className="text-xs uppercase tracking-wide text-amber-400">Норматив 3</div>
              <div className="mt-2 text-sm text-slate-200">
                Закон РК «О страховой деятельности» от 18 декабря 2000 года № 126-II
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-orange-300">
            1. Виды банковских гарантий в строительстве
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            5 основных типов БГ, применяемых на разных этапах жизненного цикла подряда — от подачи
            заявки до завершения гарантийного обслуживания.
          </p>
          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Тип гарантии</th>
                  <th className="text-left px-4 py-3 font-medium">Размер</th>
                  <th className="text-left px-4 py-3 font-medium">Назначение</th>
                  <th className="text-left px-4 py-3 font-medium">Срок действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {GUARANTEE_TYPES.map((row) => (
                  <tr key={row.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-medium text-amber-200">{row.type}</td>
                    <td className="px-4 py-3 text-slate-200">{row.size}</td>
                    <td className="px-4 py-3 text-slate-400">{row.purpose}</td>
                    <td className="px-4 py-3 text-slate-300">{row.term}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-orange-300">
            2. Тарифы банков РК на выдачу БГ (2025-2026)
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Сравнение условий 5 крупнейших банков второго уровня РК. Тарифы зависят от суммы,
            срока, наличия залога и финансового состояния клиента.
          </p>
          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Банк</th>
                  <th className="text-left px-4 py-3 font-medium">Тариф</th>
                  <th className="text-left px-4 py-3 font-medium">Минимальная сумма</th>
                  <th className="text-left px-4 py-3 font-medium">Залог / обеспечение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {BANK_RATES.map((row) => (
                  <tr key={row.bank} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-medium text-amber-200">{row.bank}</td>
                    <td className="px-4 py-3 text-orange-300">{row.rate}</td>
                    <td className="px-4 py-3 text-slate-300">{row.minSum}</td>
                    <td className="px-4 py-3 text-slate-400">{row.collateral}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-md border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-100">
            <strong className="text-amber-300">⚠️ Стоп-лист заёмщиков РК:</strong> ПКБ (Первое
            кредитное бюро) ведёт учёт просрочек по БГ. После 3 просрочек подряд по обязательствам
            (платежи банку или выплаты по гарантии) банки РК автоматически вносят клиента в
            стоп-лист и отказывают в выдаче новых БГ на срок до 2 лет. Восстановление кредитной
            истории — закрытие всех просрочек + 6-12 месяцев чистой истории.
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-orange-300">
            3. Страхование строительно-монтажных работ
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            5 ключевых видов страхования в строительстве РК. Полисы CAR/EAR и страхование рабочих
            от несчастных случаев — обязательные требования при подаче в гос. комиссии.
          </p>
          <div className="mt-6 grid gap-4">
            {INSURANCE_TYPES.map((row, idx) => (
              <div
                key={row.kind}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl font-bold text-amber-400 leading-none">
                    {idx + 1}.
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-amber-200">{row.kind}</div>
                    <div className="mt-2 text-sm text-slate-300">
                      <span className="text-slate-400">Покрытие:</span> {row.coverage}
                    </div>
                    <div className="mt-2 grid md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded border border-orange-900/40 bg-orange-950/20 px-3 py-2">
                        <span className="text-orange-300">Тариф:</span> {row.tariff}
                      </div>
                      <div className="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2">
                        <span className="text-amber-300">Пример:</span> {row.example}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-orange-300">
            4. Практические упражнения
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Числовые ответы — допуск ±5% от эталона. Для выбора — введите букву (a/b/c/d).
          </p>
          <div className="mt-6 space-y-6">
            {EXERCISES.map((ex) => {
              const result = results[ex.id];
              const isCorrect = result === "correct";
              const isWrong = result === "wrong";
              return (
                <div
                  key={ex.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-6"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-lg font-semibold text-amber-300">{ex.title}</h3>
                    {isCorrect && (
                      <span className="text-xs px-2 py-1 rounded bg-green-900/40 text-green-300 border border-green-800">
                        Верно
                      </span>
                    )}
                    {isWrong && (
                      <span className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 border border-red-800">
                        Ошибка
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-slate-200 leading-relaxed">{ex.question}</p>
                  <p className="mt-2 text-xs text-slate-500 italic">💡 {ex.hint}</p>

                  {ex.kind === "numeric" ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={answers[ex.id] ?? ""}
                        onChange={(e) => setAnswer(ex.id, e.target.value)}
                        placeholder="Введите число"
                        className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none w-48"
                      />
                      <span className="text-sm text-slate-400">{ex.unit}</span>
                      <button
                        type="button"
                        onClick={() => checkAnswer(ex)}
                        className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-sm font-medium"
                      >
                        Проверить
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSolution(ex.id)}
                        className="px-4 py-2 rounded border border-slate-700 hover:border-amber-500 text-sm text-slate-300"
                      >
                        {shown[ex.id] ? "Скрыть решение" : "Показать решение"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {ex.options.map((opt) => {
                        const selected = (answers[ex.id] ?? "").toLowerCase() === opt.key;
                        return (
                          <label
                            key={opt.key}
                            className={`flex items-start gap-3 rounded border px-3 py-2 cursor-pointer ${
                              selected
                                ? "border-amber-500 bg-amber-950/30"
                                : "border-slate-700 hover:border-slate-600"
                            }`}
                          >
                            <input
                              type="radio"
                              name={ex.id}
                              value={opt.key}
                              checked={selected}
                              onChange={() => setAnswer(ex.id, opt.key)}
                              className="mt-1 accent-amber-500"
                            />
                            <span className="text-sm text-slate-200">
                              <span className="font-medium text-amber-300">{opt.key})</span>{" "}
                              {opt.label}
                            </span>
                          </label>
                        );
                      })}
                      <div className="pt-2 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => checkAnswer(ex)}
                          className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-sm font-medium"
                        >
                          Проверить
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSolution(ex.id)}
                          className="px-4 py-2 rounded border border-slate-700 hover:border-amber-500 text-sm text-slate-300"
                        >
                          {shown[ex.id] ? "Скрыть решение" : "Показать решение"}
                        </button>
                      </div>
                    </div>
                  )}

                  {shown[ex.id] && (
                    <div className="mt-4 rounded border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                      <div className="text-xs uppercase tracking-wide text-amber-400 mb-2">
                        Решение
                      </div>
                      {ex.solution}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-orange-300">
            5. Чек-лист подачи документов в банк за БГ
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Стандартный пакет документов для рассмотрения заявки на банковскую гарантию. Срок
            рассмотрения в банках РК — 3-10 рабочих дней.
          </p>
          <div className="mt-6 grid md:grid-cols-2 gap-3">
            {BANK_DOCUMENTS.map((item) => (
              <div
                key={item.num}
                className="flex items-start gap-3 rounded border border-slate-800 bg-slate-900/30 px-4 py-3"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-600 text-slate-950 text-sm font-bold flex items-center justify-center">
                  {item.num}
                </span>
                <span className="text-sm text-slate-200">{item.doc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-orange-900/50 bg-orange-950/20 p-6">
          <h3 className="text-lg font-semibold text-orange-300">
            📌 Ключевые расценки (учебный квартал 2026)
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            <li>
              <span className="text-orange-300">•</span> МРП 2026: 3 692 тг (для расчёта лимитов
              страхования и штрафов)
            </li>
            <li>
              <span className="text-orange-300">•</span> Средний тариф БГ исполнения договора в РК:
              2.0-3.0% годовых при наличии депозита 30%
            </li>
            <li>
              <span className="text-orange-300">•</span> Тариф CAR+EAR для типового объекта СМР:
              0.3-0.6% от стоимости (закладывается в накладные расходы сметы)
            </li>
            <li>
              <span className="text-orange-300">•</span> Срок выдачи БГ при наличии полного
              пакета: 3-5 дней (Halyk, Forte) — 7-10 дней (Centerkredit, Jysan)
            </li>
            <li>
              <span className="text-orange-300">•</span> Обязательное страхование рабочих от НС:
              тариф зависит от класса проф. риска (СМР — III-V класс, 0.5-2.5% ФОТ)
            </li>
          </ul>
        </section>

        <footer className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          AEVION Smeta Trainer &middot; Учебный модуль: Банковские гарантии и страхование СМР
          &middot; Нормативная база РК 2026
        </footer>
      </main>
    </div>
  );
}
