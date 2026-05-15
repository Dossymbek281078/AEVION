"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface PaymentRow {
  stage: string;
  pct: string;
  when: string;
  use: string;
}

const PAYMENTS: PaymentRow[] = [
  {
    stage: "Авансовый платёж",
    pct: "20-30%",
    when: "До начала работ",
    use: "На закупку материалов и аренду техники",
  },
  {
    stage: "Промежуточные платежи (ежемесячно)",
    pct: "По КС-2 за выполненные работы",
    when: "По отчётам",
    use: "Текущие расходы",
  },
  {
    stage: "Окончательный платёж",
    pct: "5-10%",
    when: "После сдачи объекта",
    use: "Отложенный платёж до устранения замечаний",
  },
  {
    stage: "Гарантийные удержания",
    pct: "5-10% от каждого платежа",
    when: "На депозит",
    use: "Возврат через 12-24 мес. (гарантийный срок)",
  },
];

const WARRANTY_BULLETS: string[] = [
  "Из каждого платежа удерживается 5-10% (по договору)",
  "Хранятся на эскроу-счёте или у заказчика",
  "Возвращаются через 12-24 мес после сдачи (гарантийный срок)",
  "Используются для покрытия гарантийных дефектов",
  "Ставка по эскроу обычно 0% (заказчику выгодно)",
  "Альтернатива: банковская гарантия от подрядчика (стоит 1-3% от суммы гарантии)",
];

const CASH_FLOW_RISK_CHECKLIST: string[] = [
  "Договор содержит чёткие условия платежей (даты, %)",
  "Авансовый платёж получен до начала работ",
  "Резервный фонд минимум 10% от стоимости (на 1 месяц задержки)",
  "Кредитная линия в банке открыта (можно не использовать, но иметь)",
  "Договоры с поставщиками — отсрочка платежа 30-60 дней",
  "Договоры с субподрядчиками — оплата по факту работ + удержания",
  "Месячные отчёты cash flow для собственника",
  "Прогноз cash flow на 3 месяца вперёд",
  "Лимиты расходов согласованы с финансовым директором",
  "Резерв на форс-мажоры (5% от бюджета)",
];

const CASH_FLOW_EXAMPLE = `Объект: Школа №47 (стоимость по смете 250 млн тг)

ПОСТУПЛЕНИЯ:
- Аванс (25%): 62.5 млн
- КС-2 за месяц 1: 8 млн
- КС-2 за месяц 2: 18 млн
- ...
- КС-2 за месяц 12: 25 млн (пик отделки)

РАСХОДЫ:
- Материалы (35%): 87.5 млн (большая часть в первые 6 мес)
- ФОТ (15%): 37.5 млн (равномерно)
- Машины аренда (8%): 20 млн (в 1-3 мес — техника)
- Субподрядчики (25%): 62.5 млн (в 4-9 мес)
- НР подрядчика (10%): 25 млн (равномерно)
- Прибыль (7%): 17.5 млн (в конце)

КАССОВЫЙ РАЗРЫВ ПИК (между поступлением аванса и КС-2):
- Месяцы 2-3: расходы превышают поступления на ~15-25 млн
- Решение: банковская кредитная линия или резервный фонд`;

interface Exercise {
  id: string;
  title: string;
  question: string;
  hint: string;
  expected: number;
  tolerancePct: number;
  unit: string;
  solution: string;
  acceptNegative?: number;
}

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Упражнение 1. Размер аванса",
    question:
      "Контракт на 250 млн тг. По договору авансовый платёж — 25% от стоимости. Какова сумма аванса (в млн тг)?",
    hint: "Аванс = стоимость × ставка аванса.",
    expected: 62.5,
    tolerancePct: 2,
    unit: "млн тг",
    solution:
      "250 · 0.25 = 62.5 млн тг. Авансовый платёж приходит до начала работ — на закупку материалов и аренду техники.",
  },
  {
    id: "ex2",
    title: "Упражнение 2. Кассовый разрыв",
    question:
      "Аванс 62.5 млн получен, КС-2 за 2-й месяц задерживается. Расходы за первые 2 мес: материалы 30 + ФОТ 6 + машины 8 = 44 млн. К концу 3-го месяца ещё 22 млн расходов. Какова потребность в кредите на конец 3-го месяца (млн тг)?",
    hint: "Считаем остаток денежных средств: 62.5 − 44 − 22. Если отрицательный — это разрыв.",
    expected: 3.5,
    tolerancePct: 20,
    unit: "млн тг",
    acceptNegative: -3.5,
    solution:
      "Остаток на конец 2-го мес: 62.5 − 44 = 18.5 млн (разрыва нет). К концу 3-го мес: 18.5 − 22 = −3.5 млн. Это и есть кассовый разрыв. Принимается ответ −3.5 (разрыв) или 3.5 (потребность в кредите).",
  },
  {
    id: "ex3",
    title: "Упражнение 3. Стоимость банковской гарантии",
    question:
      "Подрядчик берёт банковскую гарантию на 50 млн тг сроком на 1 год. Тариф банка — в среднем 2% от суммы гарантии. Сколько это стоит (в тыс. тг)?",
    hint: "Стоимость = сумма гарантии · тариф.",
    expected: 1000,
    tolerancePct: 25,
    unit: "тыс. тг",
    solution:
      "50 000 000 · 0.02 = 1 000 000 тг = 1 000 тыс. тг. Банковская гарантия — альтернатива удержанию средств заказчиком.",
  },
  {
    id: "ex4",
    title: "Упражнение 4. Стоимость замороженных средств",
    question:
      "Контракт 250 млн тг. Гарантийные удержания — 10%. Возврат через 24 мес. Какова упущенная выгода подрядчика при ставке 12% годовых (в млн тг)?",
    hint: "Удержано = 250 · 0.10. Упущенная выгода = удержано · 12% × 2 года.",
    expected: 6,
    tolerancePct: 10,
    unit: "млн тг",
    solution:
      "Удержано: 250 · 0.10 = 25 млн тг. Упущенная выгода: 25 · 0.12 · 2 = 6 млн тг. Это реальная цена гарантийных удержаний для подрядчика.",
  },
];

interface AnswerState {
  value: string;
  status: "idle" | "ok" | "near" | "wrong";
}

const initialAnswers: Record<string, AnswerState> = EXERCISES.reduce(
  (acc, ex) => {
    acc[ex.id] = { value: "", status: "idle" };
    return acc;
  },
  {} as Record<string, AnswerState>,
);

export default function BudgetManagementPage() {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(initialAnswers);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const totalChecked = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );

  function check(id: string) {
    const ex = EXERCISES.find((e) => e.id === id);
    if (!ex) return;
    const raw = answers[id]?.value ?? "";
    const num = Number(raw.replace(",", ".").replace(/\s+/g, ""));
    if (Number.isNaN(num)) {
      setAnswers((s) => ({ ...s, [id]: { value: raw, status: "wrong" } }));
      return;
    }
    const candidates: number[] = [ex.expected];
    if (typeof ex.acceptNegative === "number") candidates.push(ex.acceptNegative);
    let best: "ok" | "near" | "wrong" = "wrong";
    for (const target of candidates) {
      const tolAbs = Math.abs(target) * (ex.tolerancePct / 100);
      const diff = Math.abs(num - target);
      if (diff <= tolAbs) {
        best = "ok";
        break;
      }
      if (diff <= tolAbs * 2) best = "near";
    }
    setAnswers((s) => ({ ...s, [id]: { value: raw, status: best } }));
  }

  function reveal(id: string) {
    setRevealed((s) => ({ ...s, [id]: true }));
  }

  function reset(id: string) {
    setAnswers((s) => ({ ...s, [id]: { value: "", status: "idle" } }));
    setRevealed((s) => ({ ...s, [id]: false }));
  }

  function toggleCheck(idx: number) {
    setChecked((s) => ({ ...s, [idx]: !s[idx] }));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-emerald-400 transition hover:text-emerald-300"
          >
            ← К разделам
          </Link>
          <span className="text-xs uppercase tracking-widest text-slate-500">
            Финансы стройки
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold text-emerald-300 md:text-4xl">
          💰 Управление бюджетом — аванс, удержания, cash flow
        </h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          Сметчик не только считает, но и управляет финансовыми потоками проекта.
          Без cash flow — стройка останавливается из-за нехватки оборотных средств.
        </p>

        {/* Section 1: Структура платежей */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-emerald-300">
            1. Структура платежей по типовому контракту
          </h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/70 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Этап</th>
                  <th className="px-4 py-3 font-medium">% от контракта</th>
                  <th className="px-4 py-3 font-medium">Когда</th>
                  <th className="px-4 py-3 font-medium">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {PAYMENTS.map((row) => (
                  <tr key={row.stage} className="bg-slate-900/30">
                    <td className="px-4 py-3 font-medium text-emerald-200">
                      {row.stage}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.pct}</td>
                    <td className="px-4 py-3 text-slate-300">{row.when}</td>
                    <td className="px-4 py-3 text-slate-300">{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Cash Flow */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-emerald-300">
            2. Cash Flow (денежный поток) для стройки
          </h2>
          <p className="mt-3 max-w-3xl text-slate-300">
            Cash flow — это календарный график поступлений и расходов. Прибыль может
            быть «на бумаге», но если в момент X на счёте нет денег — стройка встаёт.
          </p>
          <div className="mt-6 rounded-2xl border border-emerald-800/40 bg-slate-900/60 p-1 shadow-lg shadow-emerald-900/10">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-5 font-mono text-xs leading-relaxed text-emerald-100 md:text-sm">
              {CASH_FLOW_EXAMPLE}
            </pre>
          </div>
        </section>

        {/* Section 3: Гарантийные удержания */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-emerald-300">
            3. Гарантийные удержания
          </h2>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <ul className="space-y-3 text-slate-200">
              {WARRANTY_BULLETS.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-emerald-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 4: Exercises */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-emerald-300">
            4. Интерактивные упражнения
          </h2>
          <div className="mt-6 space-y-6">
            {EXERCISES.map((ex) => {
              const a = answers[ex.id];
              const isRevealed = revealed[ex.id];
              const borderClass =
                a.status === "ok"
                  ? "border-emerald-500/70"
                  : a.status === "near"
                    ? "border-amber-500/70"
                    : a.status === "wrong"
                      ? "border-rose-500/70"
                      : "border-slate-800";
              return (
                <div
                  key={ex.id}
                  className={`rounded-2xl border ${borderClass} bg-slate-900/40 p-6 transition`}
                >
                  <h3 className="text-lg font-semibold text-emerald-200">
                    {ex.title}
                  </h3>
                  <p className="mt-2 text-slate-300">{ex.question}</p>
                  <p className="mt-3 text-xs italic text-slate-500">
                    Подсказка: {ex.hint}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={a.value}
                      onChange={(e) =>
                        setAnswers((s) => ({
                          ...s,
                          [ex.id]: { value: e.target.value, status: "idle" },
                        }))
                      }
                      placeholder="Ваш ответ"
                      className="w-40 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500">{ex.unit}</span>
                    <button
                      onClick={() => check(ex.id)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
                    >
                      Проверить
                    </button>
                    <button
                      onClick={() => reveal(ex.id)}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-emerald-500/50 hover:text-emerald-300"
                    >
                      Показать решение
                    </button>
                    <button
                      onClick={() => reset(ex.id)}
                      className="rounded-lg px-3 py-2 text-xs text-slate-500 transition hover:text-slate-300"
                    >
                      Сброс
                    </button>
                  </div>
                  {a.status === "ok" && (
                    <p className="mt-3 text-sm text-emerald-400">
                      ✓ Верно — в пределах допустимой погрешности.
                    </p>
                  )}
                  {a.status === "near" && (
                    <p className="mt-3 text-sm text-amber-400">
                      Близко, но за границей допуска. Перепроверьте расчёт.
                    </p>
                  )}
                  {a.status === "wrong" && (
                    <p className="mt-3 text-sm text-rose-400">
                      Неверно. Попробуйте ещё раз или посмотрите решение.
                    </p>
                  )}
                  {isRevealed && (
                    <div className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
                      <span className="font-semibold text-emerald-300">
                        Решение:
                      </span>{" "}
                      {ex.solution}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 5: Чек-лист */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-emerald-300">
            5. Управление рисками cash flow
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Отметьте пункты, которые уже закрыты в вашем проекте.
            Прогресс: {totalChecked}/{CASH_FLOW_RISK_CHECKLIST.length}.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <ul className="space-y-3">
              {CASH_FLOW_RISK_CHECKLIST.map((item, idx) => {
                const isOn = !!checked[idx];
                return (
                  <li key={item}>
                    <button
                      onClick={() => toggleCheck(idx)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded border transition ${
                          isOn
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                            : "border-slate-600 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span
                        className={`text-sm transition ${
                          isOn
                            ? "text-emerald-200 line-through decoration-emerald-500/40"
                            : "text-slate-200"
                        }`}
                      >
                        {item}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Factoid */}
        <section className="mt-12">
          <div className="rounded-2xl border border-emerald-700/50 bg-gradient-to-br from-emerald-950/60 via-slate-900/40 to-slate-900/40 p-6 shadow-lg shadow-emerald-900/20">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Факт
            </p>
            <p className="mt-2 text-base text-emerald-100 md:text-lg">
              По статистике <span className="font-bold">60% строительных
              компаний РК</span> банкротятся не из-за убытков, а из-за{" "}
              <span className="font-bold">кассовых разрывов</span>. Cash flow
              важнее прибыли в моменте.
            </p>
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          AEVION Smeta Trainer · Управление бюджетом стройки
        </footer>
      </main>
    </div>
  );
}
