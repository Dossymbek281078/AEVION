"use client";

import Link from "next/link";
import { useState } from "react";

export default function ConstructionTaxesPage() {
  // Exercise 1: ИПН с зарплаты
  const [ex1, setEx1] = useState("");
  const [ex1Result, setEx1Result] = useState<null | "ok" | "fail">(null);
  const [ex1Show, setEx1Show] = useState(false);

  // Exercise 2: полная стоимость месяца сметчика
  const [ex2, setEx2] = useState("");
  const [ex2Result, setEx2Result] = useState<null | "ok" | "fail">(null);
  const [ex2Show, setEx2Show] = useState(false);

  // Exercise 3: порог НДС (multiple choice)
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Result, setEx3Result] = useState<null | "ok" | "fail">(null);
  const [ex3Show, setEx3Show] = useState(false);

  // Exercise 4: НДС с КС-2
  const [ex4, setEx4] = useState("");
  const [ex4Result, setEx4Result] = useState<null | "ok" | "fail">(null);
  const [ex4Show, setEx4Show] = useState(false);

  const checkNumeric = (value: string, target: number, tolerancePct: number) => {
    const num = parseFloat(value.replace(/\s/g, "").replace(",", "."));
    if (isNaN(num)) return "fail" as const;
    const diff = Math.abs(num - target) / target;
    return diff <= tolerancePct / 100 ? ("ok" as const) : ("fail" as const);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-emerald-900/40 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-emerald-400 hover:text-emerald-300 transition flex items-center gap-2"
          >
            <span>&larr;</span>
            <span>К разделам</span>
          </Link>
          <div className="text-xs text-slate-500">Модуль 34 / Налоги РК</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        {/* Title */}
        <section>
          <h1 className="text-4xl md:text-5xl font-bold text-emerald-300 mb-4">
            💰 Налоги строительной фирмы РК
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed">
            Полный обзор налогообложения строительных компаний в Республике Казахстан
            на 2025 год: КПН, ИПН, соцналог, ОПВ, ОСМС, НДС, спецрежимы и
            практические упражнения для сметчиков и руководителей.
          </p>
          <div className="mt-4 p-4 rounded-lg bg-emerald-950/30 border border-emerald-900/50 text-sm text-emerald-100">
            <div className="font-semibold mb-1 text-emerald-300">Нормативная база:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Налоговый кодекс РК (Кодекс «О налогах и других обязательных платежах в бюджет»)</li>
              <li>Закон РК «О бухгалтерском учёте и финансовой отчётности» от 28.02.2007 № 234-III</li>
              <li>ИПЛЛ-РК — Инструкции и письма Министерства финансов / КГД</li>
              <li>МРП на 2025 = 3 932 тг; МЗП = 85 000 тг</li>
            </ul>
          </div>
        </section>

        {/* Section 1: основные налоги */}
        <section>
          <h2 className="text-2xl font-bold text-emerald-300 mb-4">
            📋 1. Налоги и обязательные платежи
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-emerald-950/40 text-emerald-300">
                <tr>
                  <th className="text-left px-4 py-3">Налог / платёж</th>
                  <th className="text-left px-4 py-3">Ставка</th>
                  <th className="text-left px-4 py-3">База / комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">КПН</td>
                  <td className="px-4 py-3 text-emerald-400">20%</td>
                  <td className="px-4 py-3 text-slate-300">Корпоративный подоходный налог, общеустановленный режим, с прибыли</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">ИПН</td>
                  <td className="px-4 py-3 text-emerald-400">10%</td>
                  <td className="px-4 py-3 text-slate-300">Индивидуальный подоходный налог с зарплаты сотрудников</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">Соц. налог</td>
                  <td className="px-4 py-3 text-emerald-400">9.5%</td>
                  <td className="px-4 py-3 text-slate-300">С фонда оплаты труда (ФОТ), за счёт работодателя</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">Соц. отчисления (СО)</td>
                  <td className="px-4 py-3 text-emerald-400">5%</td>
                  <td className="px-4 py-3 text-slate-300">В ГФСС, за счёт работодателя</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">ОПВ</td>
                  <td className="px-4 py-3 text-emerald-400">10%</td>
                  <td className="px-4 py-3 text-slate-300">Обязательные пенсионные взносы, удерживаются с зарплаты работника</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">ОСМС</td>
                  <td className="px-4 py-3 text-emerald-400">3%</td>
                  <td className="px-4 py-3 text-slate-300">Медстрахование (2% работодатель + 1% работник)</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">НДС</td>
                  <td className="px-4 py-3 text-emerald-400">12%</td>
                  <td className="px-4 py-3 text-slate-300">При обороте {">"} 30 000 МРП в год обязательная постановка на учёт по НДС</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Примечание: ставки актуальны на 2025 год. Часть нагрузки несёт работодатель,
            часть удерживается из дохода работника. Полный «нагруз» на работодателя — около 17.5% сверх ФОТ.
          </p>
        </section>

        {/* Section 2: спецрежимы */}
        <section>
          <h2 className="text-2xl font-bold text-emerald-300 mb-4">
            🏗️ 2. Спецрежимы для строителей
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-5 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
              <div className="text-emerald-400 text-2xl font-bold mb-2">3%</div>
              <div className="font-semibold mb-1">Упрощённая декларация</div>
              <p className="text-sm text-slate-300">
                Доход до <b>24 038 МРП</b> за полугодие. 3% от дохода (1.5% ИПН/КПН + 1.5% соцналог).
                Подходит малым подрядчикам и СМР-фирмам без больших оборотов.
              </p>
            </div>
            <div className="p-5 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
              <div className="text-emerald-400 text-2xl font-bold mb-2">Патент</div>
              <div className="font-semibold mb-1">Только для ИП</div>
              <p className="text-sm text-slate-300">
                Доход до <b>3 528 МРП в год</b>. Без наёмных работников. Подходит самозанятым
                сметчикам и мастерам отделки.
              </p>
            </div>
            <div className="p-5 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
              <div className="text-emerald-400 text-2xl font-bold mb-2">4%</div>
              <div className="font-semibold mb-1">Розничный налог (с 2024)</div>
              <p className="text-sm text-slate-300">
                Новый режим. 4% с дохода для розничных видов деятельности. Для строителей —
                ограниченно (например, продажа стройматериалов конечному потребителю).
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-amber-950/20 border border-amber-900/40 text-sm text-amber-100">
            ⚠️ Важно: при превышении лимита спецрежима — автоматический переход на общеустановленный
            и обязательная постановка на учёт по НДС.
          </div>
        </section>

        {/* Section 3: интерактивные упражнения */}
        <section>
          <h2 className="text-2xl font-bold text-emerald-300 mb-6">
            🎯 3. Практические упражнения
          </h2>

          {/* Exercise 1 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-sm text-emerald-400 mb-1">Упражнение 1 / ИПН</div>
            <div className="font-semibold mb-3">
              Сметчик получает зарплату 350 000 тг (брутто, без вычетов). Какой ИПН удержит работодатель?
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={ex1}
                onChange={(e) => setEx1(e.target.value)}
                placeholder="введите сумму в тг"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48"
              />
              <button
                onClick={() => setEx1Result(checkNumeric(ex1, 35000, 5))}
                className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Show(!ex1Show)}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
              >
                {ex1Show ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Result === "ok" && (
                <span className="text-emerald-400 font-semibold">✓ Верно!</span>
              )}
              {ex1Result === "fail" && (
                <span className="text-rose-400 font-semibold">✗ Неверно, попробуйте ещё</span>
              )}
            </div>
            {ex1Show && (
              <div className="mt-3 p-3 rounded bg-emerald-950/30 border border-emerald-900/40 text-sm text-emerald-100">
                <div className="font-semibold mb-1">Решение:</div>
                <div>ИПН = 350 000 × 10% = <b>35 000 тг</b></div>
                <div className="text-xs mt-1 text-slate-400">
                  (без учёта стандартного вычета 14 МРП и ОПВ для упрощения примера)
                </div>
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-sm text-emerald-400 mb-1">Упражнение 2 / полная стоимость работника</div>
            <div className="font-semibold mb-3">
              Брутто з/п сметчика — 350 000 тг. Посчитайте полную стоимость одного месяца для работодателя
              (з/п + соцналог 9.5% + соц. отчисления 5%).
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Подсказка: ИПН и ОПВ удерживаются из самой з/п, а соцналог + соц. отчисления — поверх ФОТ.
              К стоимости работника добавляйте ~14.5% сверху + ОСМС 2%.
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={ex2}
                onChange={(e) => setEx2(e.target.value)}
                placeholder="полная сумма в тг"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48"
              />
              <button
                onClick={() => setEx2Result(checkNumeric(ex2, 485000, 10))}
                className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Show(!ex2Show)}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
              >
                {ex2Show ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Result === "ok" && (
                <span className="text-emerald-400 font-semibold">✓ Верно!</span>
              )}
              {ex2Result === "fail" && (
                <span className="text-rose-400 font-semibold">✗ Неверно, попробуйте ещё</span>
              )}
            </div>
            {ex2Show && (
              <div className="mt-3 p-3 rounded bg-emerald-950/30 border border-emerald-900/40 text-sm text-emerald-100">
                <div className="font-semibold mb-1">Решение:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>З/п (брутто) = 350 000 тг</li>
                  <li>+ Соцналог 9.5% = 33 250 тг</li>
                  <li>+ Соц. отчисления 5% = 17 500 тг</li>
                  <li>+ ОСМС работодатель 2% = 7 000 тг</li>
                  <li>+ Прочие отчисления (упрощённо учитываем все «нагрузки сверху»)</li>
                </ul>
                <div className="mt-2">
                  Итого: <b>~485 000 тг</b> в месяц на одного сметчика.
                </div>
                <div className="text-xs mt-1 text-slate-400">
                  Из этой суммы работник «на руки» получит примерно 280 000 тг
                  (после ИПН 10% + ОПВ 10% + ОСМС 1%).
                </div>
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-sm text-emerald-400 mb-1">Упражнение 3 / порог НДС</div>
            <div className="font-semibold mb-3">
              При каком годовом обороте у строительной фирмы возникает обязанность встать на учёт по НДС?
            </div>
            <div className="space-y-2">
              {[
                { id: "a", label: "Свыше 10 000 МРП в год" },
                { id: "b", label: "Свыше 20 000 МРП в год" },
                { id: "c", label: "Свыше 30 000 МРП в год" },
                { id: "d", label: "Свыше 50 000 МРП в год" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded cursor-pointer border transition ${
                    ex3 === opt.id
                      ? "bg-emerald-950/40 border-emerald-700"
                      : "bg-slate-800/40 border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex3"
                    value={opt.id}
                    checked={ex3 === opt.id}
                    onChange={() => setEx3(opt.id)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-200">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 items-center mt-4">
              <button
                onClick={() => setEx3Result(ex3 === "c" ? "ok" : "fail")}
                className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Show(!ex3Show)}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
              >
                {ex3Show ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Result === "ok" && (
                <span className="text-emerald-400 font-semibold">✓ Верно!</span>
              )}
              {ex3Result === "fail" && (
                <span className="text-rose-400 font-semibold">✗ Неверно, попробуйте ещё</span>
              )}
            </div>
            {ex3Show && (
              <div className="mt-3 p-3 rounded bg-emerald-950/30 border border-emerald-900/40 text-sm text-emerald-100">
                <div className="font-semibold mb-1">Решение:</div>
                <div>
                  Правильный ответ — <b>(c) свыше 30 000 МРП в год</b>.
                </div>
                <div className="text-xs mt-1 text-slate-400">
                  В 2025 году это: 30 000 × 3 932 = ~117 960 000 тг.
                  При превышении необходимо в течение 10 рабочих дней встать на учёт по НДС.
                </div>
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-sm text-emerald-400 mb-1">Упражнение 4 / НДС с КС-2</div>
            <div className="font-semibold mb-3">
              Подрядчик закрыл КС-2 на 12 000 000 тг (без НДС в смете). Сколько НДС он должен начислить и
              отразить в счёте-фактуре?
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={ex4}
                onChange={(e) => setEx4(e.target.value)}
                placeholder="сумма НДС в тг"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48"
              />
              <button
                onClick={() => setEx4Result(checkNumeric(ex4, 1440000, 5))}
                className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Show(!ex4Show)}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
              >
                {ex4Show ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Result === "ok" && (
                <span className="text-emerald-400 font-semibold">✓ Верно!</span>
              )}
              {ex4Result === "fail" && (
                <span className="text-rose-400 font-semibold">✗ Неверно, попробуйте ещё</span>
              )}
            </div>
            {ex4Show && (
              <div className="mt-3 p-3 rounded bg-emerald-950/30 border border-emerald-900/40 text-sm text-emerald-100">
                <div className="font-semibold mb-1">Решение:</div>
                <div>НДС = 12 000 000 × 12% = <b>1 440 000 тг</b></div>
                <div className="text-xs mt-1 text-slate-400">
                  Итоговая сумма к оплате заказчиком = 12 000 000 + 1 440 000 = 13 440 000 тг.
                  Подрядчик обязан выписать ЭСФ в течение 15 календарных дней.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: чек-лист отчётности */}
        <section>
          <h2 className="text-2xl font-bold text-emerald-300 mb-4">
            ✅ 4. Чек-лист сдачи отчётности
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-3">📅 Ежемесячно (до 25 числа)</div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>☐ Форма 200.00 — ИПН, соцналог, СО, ОПВ, ОСМС</li>
                <li>☐ Перечисление удержанных налогов в бюджет</li>
                <li>☐ ЭСФ (электронные счёт-фактуры) на закрытые КС-2</li>
                <li>☐ Сверка с КГД по лицевым счетам</li>
              </ul>
            </div>
            <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-3">📅 Ежеквартально (до 15 числа 2-го месяца)</div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>☐ Форма 300.00 — декларация по НДС</li>
                <li>☐ Уплата НДС за квартал</li>
                <li>☐ Форма 910.00 — для упрощёнки (раз в полугодие)</li>
                <li>☐ Сверка реестров покупок и продаж</li>
              </ul>
            </div>
            <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-3">📅 Ежегодно (до 31 марта)</div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>☐ Форма 100.00 — декларация по КПН</li>
                <li>☐ Финансовая отчётность (баланс + отчёт о прибылях)</li>
                <li>☐ Аудит (если применимо)</li>
                <li>☐ Подтверждение льгот / спецрежимов</li>
              </ul>
            </div>
            <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-3">🏗️ Специфика стройки</div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>☐ КС-2 / КС-3 — акты выполненных работ</li>
                <li>☐ Журналы КС-6, КС-6а</li>
                <li>☐ Реестр субподрядчиков (если есть)</li>
                <li>☐ Расчёт долевого участия с генподрядчиком</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: расценки и факт-блок */}
        <section>
          <h2 className="text-2xl font-bold text-emerald-300 mb-4">
            📊 Полезные расценки
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="font-semibold mb-3 text-slate-200">Бухгалтерское обслуживание (Алматы, 2025)</div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>ТОО на упрощёнке (до 30 операций / мес) — от <b className="text-emerald-400">35 000 тг/мес</b></li>
                <li>ТОО на ОУР без НДС — от <b className="text-emerald-400">60 000 тг/мес</b></li>
                <li>ТОО на ОУР + НДС — от <b className="text-emerald-400">90 000 тг/мес</b></li>
                <li>Главбух «под ключ» (стройка) — от <b className="text-emerald-400">350 000 тг/мес</b></li>
                <li>Постановка / снятие с НДС — <b className="text-emerald-400">15 000–25 000 тг</b></li>
              </ul>
            </div>
            <div className="p-5 rounded-lg bg-emerald-950/30 border border-emerald-700/50">
              <div className="text-emerald-300 font-bold text-lg mb-2">💡 Факт-блок: штрафы по НДС</div>
              <p className="text-sm text-emerald-100 leading-relaxed">
                За несвоевременную сдачу декларации по НДС (форма 300.00) в РК предусмотрены штрафы:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-emerald-100">
                <li>
                  <b className="text-emerald-300">Первый раз:</b> 30 МРП = ~117 960 тг (2025 г.)
                </li>
                <li>
                  <b className="text-emerald-300">Повторно в течение года:</b> до 100 МРП = ~393 200 тг
                </li>
                <li>
                  + пеня за каждый день просрочки уплаты налога (1.25-кратная ставка рефинансирования НБ РК)
                </li>
              </ul>
              <div className="mt-3 text-xs text-emerald-200/80">
                💼 Совет: настройте календарь сдачи отчётности и автоматические уведомления —
                один пропуск декларации съедает чистую прибыль с десятка КС-2.
              </div>
            </div>
          </div>
        </section>

        {/* Footer nav */}
        <section className="pt-6 border-t border-slate-800">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition"
          >
            <span>&larr;</span>
            <span>Вернуться к разделам</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
