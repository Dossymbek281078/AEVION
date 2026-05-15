"use client";

import { useState } from "react";
import Link from "next/link";

export default function EvmsEarnedValuePage() {
  // ============= Exercise 1: CV (Cost Variance) =============
  const [cvAnswer, setCvAnswer] = useState("");
  const [cvResult, setCvResult] = useState<null | "correct" | "wrong">(null);
  const [cvShow, setCvShow] = useState(false);

  const checkCv = () => {
    const value = parseFloat(cvAnswer.replace(",", "."));
    if (isNaN(value)) {
      setCvResult("wrong");
      return;
    }
    const correct = -5;
    const tolerance = Math.abs(correct * 0.05) || 0.25;
    setCvResult(Math.abs(value - correct) <= tolerance ? "correct" : "wrong");
  };

  // ============= Exercise 2: SPI (Schedule Performance Index) =============
  const [spiAnswer, setSpiAnswer] = useState("");
  const [spiResult, setSpiResult] = useState<null | "correct" | "wrong">(null);
  const [spiShow, setSpiShow] = useState(false);

  const checkSpi = () => {
    const value = parseFloat(spiAnswer.replace(",", "."));
    if (isNaN(value)) {
      setSpiResult("wrong");
      return;
    }
    const correct = 0.75;
    const tolerance = correct * 0.05;
    setSpiResult(Math.abs(value - correct) <= tolerance ? "correct" : "wrong");
  };

  // ============= Exercise 3: EAC (Estimate at Completion) =============
  const [eacAnswer, setEacAnswer] = useState("");
  const [eacResult, setEacResult] = useState<null | "correct" | "wrong">(null);
  const [eacShow, setEacShow] = useState(false);

  const checkEac = () => {
    const value = parseFloat(eacAnswer.replace(",", "."));
    if (isNaN(value)) {
      setEacResult("wrong");
      return;
    }
    const correct = 117.6;
    const tolerance = correct * 0.05;
    setEacResult(Math.abs(value - correct) <= tolerance ? "correct" : "wrong");
  };

  // ============= Exercise 4: CPI Interpretation =============
  const [cpiChoice, setCpiChoice] = useState<string | null>(null);
  const [cpiResult, setCpiResult] = useState<null | "correct" | "wrong">(null);
  const [cpiShow, setCpiShow] = useState(false);

  const checkCpi = () => {
    if (!cpiChoice) return;
    setCpiResult(cpiChoice === "b" ? "correct" : "wrong");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            AEVION Smeta Trainer
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Title */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            📈 EVMS — освоенный объём (Earned Value)
          </h1>
          <p className="text-slate-300 leading-relaxed mb-3">
            <span className="text-blue-400 font-semibold">EVMS (Earned Value Management System)</span>{" "}
            — метод комплексного контроля проектов через сравнение плановых, фактических
            и освоенных объёмов работ как по графику, так и по стоимости. Позволяет на
            ранней стадии выявить отклонения и спрогнозировать итоговую стоимость и сроки
            выполнения проекта.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed">
            <span className="font-semibold text-slate-300">Нормативная база:</span>{" "}
            PMBOK Guide 7th Edition (PMI, 2021), ANSI/EIA-748-D (Standard for Earned Value
            Management Systems), ISO 21500 (Guidance on project management). В РК
            обязателен для проектов с инвестициями ЕБРР, МБРР, KFW, JICA, ИБР.
          </p>
        </section>

        {/* Section 1: 3 ключевые величины */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-blue-300 mb-4">
            1. Три ключевые величины EVMS
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Все расчёты EVMS строятся на трёх базовых метриках, которые фиксируются на
            отчётную дату (data date / status date).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="py-3 px-3 text-blue-300 font-semibold">Обозначение</th>
                  <th className="py-3 px-3 text-blue-300 font-semibold">Расшифровка</th>
                  <th className="py-3 px-3 text-blue-300 font-semibold">Описание</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3 font-mono text-indigo-300 font-semibold">PV</td>
                  <td className="py-3 px-3">Planned Value</td>
                  <td className="py-3 px-3">
                    Плановая стоимость работ, которые{" "}
                    <span className="text-slate-100">должны были быть выполнены</span> к
                    отчётной дате согласно базовому графику (BCWS — Budgeted Cost of
                    Work Scheduled).
                  </td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3 font-mono text-indigo-300 font-semibold">EV</td>
                  <td className="py-3 px-3">Earned Value</td>
                  <td className="py-3 px-3">
                    <span className="text-slate-100">Освоенный объём</span> = % физического
                    выполнения × бюджет работы. Сколько «заработано» по плановой стоимости
                    за фактически сделанное (BCWP — Budgeted Cost of Work Performed).
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-mono text-indigo-300 font-semibold">AC</td>
                  <td className="py-3 px-3">Actual Cost</td>
                  <td className="py-3 px-3">
                    <span className="text-slate-100">Фактические затраты</span> на
                    выполнение работ к отчётной дате (ACWP — Actual Cost of Work
                    Performed). Берётся из бухгалтерского учёта проекта.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Ключевые показатели */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-blue-300 mb-4">
            2. Ключевые показатели отклонений и эффективности
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            На базе PV, EV и AC рассчитываются 4 главных показателя: два{" "}
            <span className="text-slate-200">отклонения</span> (variances) и два{" "}
            <span className="text-slate-200">индекса эффективности</span> (performance
            indices).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="py-3 px-3 text-blue-300 font-semibold">Показатель</th>
                  <th className="py-3 px-3 text-blue-300 font-semibold">Формула</th>
                  <th className="py-3 px-3 text-blue-300 font-semibold">Что означает</th>
                  <th className="py-3 px-3 text-blue-300 font-semibold">Интерпретация</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3 font-mono text-indigo-300 font-semibold">CV</td>
                  <td className="py-3 px-3 font-mono text-slate-200">EV − AC</td>
                  <td className="py-3 px-3">
                    Cost Variance — отклонение по стоимости в денежном выражении
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {">"} 0 — экономия;{" "}
                    {"< 0"} — перерасход бюджета
                  </td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3 font-mono text-indigo-300 font-semibold">SV</td>
                  <td className="py-3 px-3 font-mono text-slate-200">EV − PV</td>
                  <td className="py-3 px-3">
                    Schedule Variance — отклонение по графику в денежном выражении
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {">"} 0 — опережение графика;{" "}
                    {"< 0"} — отставание
                  </td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3 font-mono text-indigo-300 font-semibold">CPI</td>
                  <td className="py-3 px-3 font-mono text-slate-200">EV / AC</td>
                  <td className="py-3 px-3">
                    Cost Performance Index — индекс эффективности затрат
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {">"} 1 — экономия;{" "}
                    {"< 1"} — перерасход
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-mono text-indigo-300 font-semibold">SPI</td>
                  <td className="py-3 px-3 font-mono text-slate-200">EV / PV</td>
                  <td className="py-3 px-3">
                    Schedule Performance Index — индекс эффективности графика
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {">"} 1 — опережение;{" "}
                    {"< 1"} — отставание
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-5 p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-lg">
            <p className="text-sm text-indigo-200 leading-relaxed">
              <span className="font-semibold">Прогнозные показатели:</span>{" "}
              <span className="font-mono text-indigo-300">EAC = BAC / CPI</span> —
              прогноз итоговой стоимости проекта при сохранении текущих темпов;{" "}
              <span className="font-mono text-indigo-300">ETC = EAC − AC</span> —
              сколько ещё потребуется потратить;{" "}
              <span className="font-mono text-indigo-300">VAC = BAC − EAC</span> —
              прогнозируемое отклонение от исходного бюджета (BAC = Budget at
              Completion).
            </p>
          </div>
        </section>

        {/* Section 3: Interactive Exercises */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-blue-300 mb-2">
            3. Интерактивные упражнения
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Решите 4 практических задачи на расчёт показателей EVMS. Допуск ±5%.
          </p>

          {/* Exercise 1: CV */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 mb-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              Задача 1. Расчёт CV (Cost Variance)
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Бюджет проекта строительства склада — <span className="text-blue-300 font-semibold">100 млн тг</span>.
              На отчётную дату (1-е число месяца) по графику планировалось выполнить
              работ на <span className="font-mono text-indigo-300">PV = 40 млн тг</span>,
              фактически освоено{" "}
              <span className="font-mono text-indigo-300">EV = 30 млн тг</span>,
              фактически потрачено{" "}
              <span className="font-mono text-indigo-300">AC = 35 млн тг</span>.
            </p>
            <p className="text-slate-200 text-sm mb-3">
              Вопрос: чему равно <span className="font-mono text-blue-300">CV</span>{" "}
              (отклонение по стоимости) в млн тг?
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={cvAnswer}
                onChange={(e) => setCvAnswer(e.target.value)}
                placeholder="например: -5"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm w-40 focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 text-sm">млн тг</span>
              <button
                onClick={checkCv}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setCvShow(!cvShow)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                {cvShow ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {cvResult && (
              <div
                className={`mt-3 text-sm font-medium ${
                  cvResult === "correct" ? "text-green-400" : "text-red-400"
                }`}
              >
                {cvResult === "correct"
                  ? "✓ Верно! CV = −5 млн тг — перерасход бюджета."
                  : "✗ Неверно. Проверьте формулу CV = EV − AC."}
              </div>
            )}
            {cvShow && (
              <div className="mt-4 p-4 bg-blue-950/30 border border-blue-800/40 rounded text-sm text-slate-200 leading-relaxed">
                <span className="font-semibold text-blue-300">Решение:</span>{" "}
                CV = EV − AC = 30 − 35 = <span className="font-mono">−5 млн тг</span>.
                Отрицательное значение CV означает{" "}
                <span className="text-red-300">перерасход бюджета</span>: на выполненный
                объём работ потрачено на 5 млн тг больше, чем заложено в смете.
              </div>
            )}
          </div>

          {/* Exercise 2: SPI */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 mb-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              Задача 2. Расчёт SPI (Schedule Performance Index)
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Используем те же данные: PV = 40 млн, EV = 30 млн, AC = 35 млн. Рассчитайте{" "}
              <span className="font-mono text-blue-300">SPI</span> — индекс эффективности
              графика. Ответ — десятичная дробь с 2 знаками после запятой.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={spiAnswer}
                onChange={(e) => setSpiAnswer(e.target.value)}
                placeholder="например: 0.75"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm w-40 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={checkSpi}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setSpiShow(!spiShow)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                {spiShow ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {spiResult && (
              <div
                className={`mt-3 text-sm font-medium ${
                  spiResult === "correct" ? "text-green-400" : "text-red-400"
                }`}
              >
                {spiResult === "correct"
                  ? "✓ Верно! SPI = 0.75 — отстаём от графика."
                  : "✗ Неверно. Проверьте формулу SPI = EV / PV."}
              </div>
            )}
            {spiShow && (
              <div className="mt-4 p-4 bg-blue-950/30 border border-blue-800/40 rounded text-sm text-slate-200 leading-relaxed">
                <span className="font-semibold text-blue-300">Решение:</span>{" "}
                SPI = EV / PV = 30 / 40 = <span className="font-mono">0.75</span>.
                Значение меньше 1 означает{" "}
                <span className="text-red-300">отставание от графика на 25%</span>:
                фактически выполнено только 75% от запланированного к этой дате объёма
                работ.
              </div>
            )}
          </div>

          {/* Exercise 3: EAC */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 mb-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              Задача 3. Прогноз EAC (Estimate at Completion)
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Бюджет проекта (BAC) = <span className="text-blue-300 font-semibold">100 млн тг</span>.
              По данным контроля на отчётную дату индекс эффективности затрат{" "}
              <span className="font-mono text-indigo-300">CPI = 0.85</span>. Если темпы
              сохранятся, рассчитайте прогноз итоговой стоимости проекта{" "}
              <span className="font-mono text-blue-300">EAC</span> в млн тг.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={eacAnswer}
                onChange={(e) => setEacAnswer(e.target.value)}
                placeholder="например: 117.6"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm w-40 focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 text-sm">млн тг</span>
              <button
                onClick={checkEac}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEacShow(!eacShow)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                {eacShow ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {eacResult && (
              <div
                className={`mt-3 text-sm font-medium ${
                  eacResult === "correct" ? "text-green-400" : "text-red-400"
                }`}
              >
                {eacResult === "correct"
                  ? "✓ Верно! EAC ≈ 117.6 млн тг — превышение бюджета на 17.6 млн."
                  : "✗ Неверно. Проверьте формулу EAC = BAC / CPI."}
              </div>
            )}
            {eacShow && (
              <div className="mt-4 p-4 bg-blue-950/30 border border-blue-800/40 rounded text-sm text-slate-200 leading-relaxed">
                <span className="font-semibold text-blue-300">Решение:</span>{" "}
                EAC = BAC / CPI = 100 / 0.85 ={" "}
                <span className="font-mono">117.65 млн тг</span>. Это означает прогнозное{" "}
                <span className="text-red-300">превышение бюджета на 17.6 млн тг</span>{" "}
                (VAC = BAC − EAC = 100 − 117.6 = −17.6). Заказчику необходимо
                инициировать корректирующие меры либо согласовать дополнительное
                финансирование.
              </div>
            )}
          </div>

          {/* Exercise 4: CPI Interpretation */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              Задача 4. Интерпретация CPI
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              На отчётную дату индекс эффективности затрат проекта{" "}
              <span className="font-mono text-indigo-300">CPI = 1.10</span>. Что это
              означает для проекта?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: "a", text: "Проект отстаёт от графика на 10%" },
                { id: "b", text: "Работы обходятся на 10% дешевле плана (экономия)" },
                { id: "c", text: "Перерасход бюджета на 10%" },
                { id: "d", text: "План выполнен ровно по бюджету" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    cpiChoice === opt.id
                      ? "border-blue-500 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700 bg-slate-900/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="cpi-choice"
                    value={opt.id}
                    checked={cpiChoice === opt.id}
                    onChange={(e) => setCpiChoice(e.target.value)}
                    className="mt-1 accent-blue-500"
                  />
                  <span className="text-sm text-slate-200">
                    <span className="font-mono text-blue-300 mr-2">{opt.id})</span>
                    {opt.text}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={checkCpi}
                disabled={!cpiChoice}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setCpiShow(!cpiShow)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                {cpiShow ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {cpiResult && (
              <div
                className={`mt-3 text-sm font-medium ${
                  cpiResult === "correct" ? "text-green-400" : "text-red-400"
                }`}
              >
                {cpiResult === "correct"
                  ? "✓ Верно! Ответ b — экономия 10%."
                  : "✗ Неверно. Подумайте, что означает CPI > 1."}
              </div>
            )}
            {cpiShow && (
              <div className="mt-4 p-4 bg-blue-950/30 border border-blue-800/40 rounded text-sm text-slate-200 leading-relaxed">
                <span className="font-semibold text-blue-300">Решение:</span>{" "}
                CPI = EV / AC. Если CPI = 1.10, значит на каждый потраченный 1 тг
                освоено 1.10 тг плановой стоимости — это{" "}
                <span className="text-green-300">экономия 10%</span> относительно
                бюджета. График и стоимость — разные оси: для оценки графика смотрят SPI,
                а не CPI. Правильный ответ —{" "}
                <span className="font-mono text-blue-300">b</span>.
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Применение в РК */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-blue-300 mb-4">
            4. Применение EVMS в Республике Казахстан
          </h2>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed">
            EVMS обязателен на проектах с международным финансированием. Отечественные
            заказчики (КТЖ, КазМунайГаз, Самрук-Казына) внедряют метод по аналогии с
            требованиями международных банков.
          </p>
          <div className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
              <h3 className="text-base font-semibold text-blue-200 mb-2">
                Пример 1. Проекты ЕБРР (EBRD)
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Реконструкция автодороги «Центр–Юг», модернизация водоснабжения
                Шымкента, проекты ВИЭ. ЕБРР требует ежемесячный отчёт PMR (Project
                Monitoring Report) с расчётами PV/EV/AC, CPI/SPI и обновлённым EAC.
                Отклонение CPI {"<"} 0.90 или SPI {"< 0.85"} запускает процедуру{" "}
                <span className="text-blue-300">corrective action plan</span>.
              </p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
              <h3 className="text-base font-semibold text-blue-200 mb-2">
                Пример 2. KIDF (Kazakhstan Infrastructure Development Fund)
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                ГЧП-проекты (государственно-частное партнёрство): школы, больницы,
                социальная инфраструктура. KIDF использует EVMS для верификации траншей
                финансирования. Платёж по этапу производится только после подтверждения
                EV ≥ заявленного объёма по графику и независимой проверки факта.
              </p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
              <h3 className="text-base font-semibold text-blue-200 mb-2">
                Пример 3. BTS — крупные стройки (BI Group, BAZIS-A, KSS)
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Жилые комплексы свыше 100 тыс. м², ТРЦ, бизнес-центры. Внутренние
                системы PMO застройщиков (Primavera P6, MS Project + 1С) автоматически
                рассчитывают EVMS-метрики по WBS-элементам. Прогноз EAC используется для
                принятия решений о пересмотре цен ДДУ и условий с подрядчиками.
              </p>
            </div>
          </div>
        </section>

        {/* Расценки */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-blue-300 mb-4">
            5. Расценки на услуги по EVMS-отчётности (РК, 2026)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="py-3 px-3 text-blue-300 font-semibold">Услуга</th>
                  <th className="py-3 px-3 text-blue-300 font-semibold">Ед. изм.</th>
                  <th className="py-3 px-3 text-blue-300 font-semibold text-right">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3">
                    Разработка базового плана EVMS (WBS, BAC, базовый график)
                  </td>
                  <td className="py-3 px-3">проект</td>
                  <td className="py-3 px-3 text-right font-mono text-blue-200">
                    1 200 000 — 4 500 000 тг
                  </td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3">Ежемесячный PMR-отчёт по EVMS</td>
                  <td className="py-3 px-3">отчёт/мес</td>
                  <td className="py-3 px-3 text-right font-mono text-blue-200">
                    250 000 — 800 000 тг
                  </td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3">
                    Внедрение Primavera P6 + EVMS-модуль
                  </td>
                  <td className="py-3 px-3">проект</td>
                  <td className="py-3 px-3 text-right font-mono text-blue-200">
                    3 500 000 — 12 000 000 тг
                  </td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 px-3">
                    Обучение PMO команды (PMP / EVP сертификация)
                  </td>
                  <td className="py-3 px-3">чел.</td>
                  <td className="py-3 px-3 text-right font-mono text-blue-200">
                    450 000 — 1 100 000 тг
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3">
                    Аудит/верификация EVMS-данных (3rd party)
                  </td>
                  <td className="py-3 px-3">отчёт</td>
                  <td className="py-3 px-3 text-right font-mono text-blue-200">
                    600 000 — 2 200 000 тг
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Blue factoid */}
        <section className="bg-blue-950/30 border border-blue-700/50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-200 mb-3 flex items-center gap-2">
            <span>💡</span> Важный факт
          </h3>
          <p className="text-blue-100 text-sm leading-relaxed">
            На проектах с финансированием{" "}
            <span className="font-semibold">ЕБРР, KFW, JICA, Всемирного банка и АБР</span>{" "}
            в Республике Казахстан EVMS-отчётность является{" "}
            <span className="font-semibold text-white">
              обязательной и подаётся не реже одного раза в месяц
            </span>{" "}
            (форма PMR — Project Monitoring Report). Несвоевременное предоставление
            отчёта или превышение пороговых отклонений (CPI {"<"} 0.90, SPI {"<"} 0.85)
            влечёт приостановку выборки траншей до утверждения корректирующего плана.
            На крупных инфраструктурных проектах ({">"} 50 млн USD) требуется также
            независимый verification report от международной аудиторской компании
            (Deloitte, PwC, KPMG, EY) с подтверждением EV-данных по физическим обмерам.
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800 pt-6 pb-2">
          <p className="text-xs text-slate-500 text-center">
            AEVION Smeta Trainer · Модуль EVMS · PMBOK Guide 7th Ed., ANSI/EIA-748-D, ISO 21500
          </p>
        </footer>
      </main>
    </div>
  );
}
