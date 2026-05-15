"use client";

import Link from "next/link";
import { useState } from "react";

export default function PressureStationsPage() {
  const [showSol1, setShowSol1] = useState(false);
  const [showSol2, setShowSol2] = useState(false);
  const [showSol3, setShowSol3] = useState(false);
  const [showSol4, setShowSol4] = useState(false);

  const [answer1, setAnswer1] = useState<string>("");
  const [answer2, setAnswer2] = useState<string>("");
  const [answer3, setAnswer3] = useState<string>("");
  const [answer4, setAnswer4] = useState<string>("");

  const [result1, setResult1] = useState<string>("");
  const [result2, setResult2] = useState<string>("");
  const [result3, setResult3] = useState<string>("");
  const [result4, setResult4] = useState<string>("");

  const check1 = () => {
    if (answer1 === "c") setResult1("✓ Верно! 2 рабочих + 1 резервный = N+1");
    else setResult1("✗ Неверно. По СП РК 4.01-101 для жилых домов требуется N+1 (рабочий + резерв)");
  };

  const check2 = () => {
    const v = parseFloat(answer2.replace(",", "."));
    const target = 1.0;
    if (!isNaN(v) && Math.abs(v - target) / target <= 0.15) {
      setResult2(`✓ Верно! Ответ ≈ ${target} кВт (допуск ±15%)`);
    } else {
      setResult2("✗ Неверно. Ожидается ≈ 1.0 кВт (±15%)");
    }
  };

  const check3 = () => {
    const v = parseFloat(answer3.replace(",", "."));
    const target = 750;
    if (!isNaN(v) && Math.abs(v - target) / target <= 0.2) {
      setResult3(`✓ Верно! Ответ ≈ ${target} л (допуск ±20%)`);
    } else {
      setResult3("✗ Неверно. Ожидается ≈ 750 л (±20%)");
    }
  };

  const check4 = () => {
    const v = parseFloat(answer4.replace(/[\s,]/g, ""));
    const target = 2800000;
    if (!isNaN(v) && Math.abs(v - target) / target <= 0.15) {
      setResult4(`✓ Верно! Ответ ≈ ${target.toLocaleString("ru-RU")} тг (±15%)`);
    } else {
      setResult4("✗ Неверно. Ожидается ≈ 2 800 000 тг (±15%)");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            ← К разделам
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-6 text-cyan-300">
          💧 ГНС — групповые насосные станции повышения давления
        </h1>

        {/* Intro */}
        <div className="bg-slate-900 border border-cyan-900/50 rounded-lg p-6 mb-8">
          <p className="text-slate-300 leading-relaxed mb-3">
            <strong className="text-cyan-300">ГНС (групповая насосная станция)</strong> — комплекс из насосов,
            гидробака, шкафа автоматики и трубопроводной обвязки, обеспечивающий повышение давления холодной
            воды в системе хозяйственно-питьевого и/или противопожарного водоснабжения здания, когда давления
            в городском водопроводе недостаточно (типично выше 4-5 этажа).
          </p>
          <p className="text-slate-300 leading-relaxed mb-3">
            <strong className="text-cyan-300">Нормативная база РК:</strong>
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
            <li>СНиП РК 4.01-02-2009 — Внутренний водопровод и канализация зданий</li>
            <li>СП РК 4.01-101 — Проектирование систем водоснабжения и водоотведения</li>
            <li>СН РК 4.01-43-2007 — Насосные станции систем водоснабжения</li>
            <li>СП РК 2.02-15 — Противопожарное водоснабжение</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-3">
            <strong className="text-cyan-300">Стоимость ГНС для жилого дома (РК, 2026):</strong> от{" "}
            <span className="text-cyan-200 font-semibold">800 000 тг</span> (5-эт малоквартирный) до{" "}
            <span className="text-cyan-200 font-semibold">5 000 000 тг</span> (25-эт высотка с противопожаркой).
          </p>
        </div>

        {/* Section 1 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">
            1. Типы ГНС повышения давления
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse bg-slate-900 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-cyan-950/60 text-cyan-200">
                  <th className="border border-slate-800 px-4 py-3">Тип</th>
                  <th className="border border-slate-800 px-4 py-3">Конфигурация</th>
                  <th className="border border-slate-800 px-4 py-3">Применение</th>
                  <th className="border border-slate-800 px-4 py-3">Стоимость, тг</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr>
                  <td className="border border-slate-800 px-4 py-3 font-semibold text-cyan-200">
                    1. Минимальная
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    1 насос (Grundfos CM/Wilo MHIE) + мембранный гидробак 24-100 л
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    Коттеджи, малоквартирные 1-2 эт., дачи (Q ≤ 3 м³/ч)
                  </td>
                  <td className="border border-slate-800 px-4 py-3 text-cyan-200">
                    250 000 — 600 000
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-800 px-4 py-3 font-semibold text-cyan-200">
                    2. Базовое дублирование
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    2 насоса (1 раб. + 1 рез.), реле давления, гидробак 100-300 л
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    Жилые 5-9 эт. до 40 кв., малые офисные (Q = 3-10 м³/ч)
                  </td>
                  <td className="border border-slate-800 px-4 py-3 text-cyan-200">
                    800 000 — 1 500 000
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-800 px-4 py-3 font-semibold text-cyan-200">
                    3. ГНС N+1 с ЧРП
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    2-3 раб. + 1 рез. с частотными преобразователями, шкаф управления
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    Жилые 9-25 эт., бизнес-центры (Q = 10-40 м³/ч)
                  </td>
                  <td className="border border-slate-800 px-4 py-3 text-cyan-200">
                    1 800 000 — 4 000 000
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-800 px-4 py-3 font-semibold text-cyan-200">
                    4. Противопожарная ГНС
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    Grundfos CR/CRE или Wilo HELIX, 2 жокей-насос + 1 основной
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    ВПВ (внутр. пож. водопровод), спринклеры (Q ≥ 5 л/с)
                  </td>
                  <td className="border border-slate-800 px-4 py-3 text-cyan-200">
                    2 500 000 — 5 000 000
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-800 px-4 py-3 font-semibold text-cyan-200">
                    5. Шкафная Hydro MPC
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    Готовая установка Grundfos Hydro MPC-E (2-6 насосов CR, ЧРП на каждом, ПЛК)
                  </td>
                  <td className="border border-slate-800 px-4 py-3">
                    Премиум жильё, ЖК, ТРЦ, гостиницы (Q = 5-100 м³/ч)
                  </td>
                  <td className="border border-slate-800 px-4 py-3 text-cyan-200">
                    3 000 000 — 12 000 000
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">
            2. Расчёт мощности насоса
          </h2>
          <div className="bg-slate-900 border border-cyan-900/50 rounded-lg p-6">
            <p className="text-slate-300 mb-4">Гидравлическая мощность насоса:</p>
            <div className="bg-slate-800 rounded p-4 font-mono text-cyan-200 text-center text-lg mb-4">
              P = (Q × H × ρ × g) / (η × 3600 × 1000) [кВт]
            </div>
            <p className="text-slate-300 mb-2">Где:</p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li><span className="text-cyan-300">Q</span> — расход воды, м³/ч</li>
              <li><span className="text-cyan-300">H</span> — напор (геометрический + потери), м</li>
              <li><span className="text-cyan-300">ρ</span> — плотность воды = 1000 кг/м³</li>
              <li><span className="text-cyan-300">g</span> — ускорение свободного падения = 9.81 м/с²</li>
              <li><span className="text-cyan-300">η</span> — КПД насоса (0.6 - 0.8)</li>
              <li>Делим на 3600 — перевод м³/ч → м³/с; на 1000 — Вт → кВт</li>
            </ul>

            <p className="text-slate-300 mb-3 mt-6 font-semibold text-cyan-200">
              Типовые конфигурации ГНС (РК):
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-cyan-950/40 text-cyan-200">
                    <th className="border border-slate-700 px-3 py-2">Этажность</th>
                    <th className="border border-slate-700 px-3 py-2">Напор H, м</th>
                    <th className="border border-slate-700 px-3 py-2">Расход Q, м³/ч</th>
                    <th className="border border-slate-700 px-3 py-2">Мощность 1 насоса</th>
                    <th className="border border-slate-700 px-3 py-2">Конфиг.</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr>
                    <td className="border border-slate-700 px-3 py-2">5 эт. (40 кв.)</td>
                    <td className="border border-slate-700 px-3 py-2">25</td>
                    <td className="border border-slate-700 px-3 py-2">5</td>
                    <td className="border border-slate-700 px-3 py-2">≈ 0.7 кВт</td>
                    <td className="border border-slate-700 px-3 py-2">1+1 рез.</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-700 px-3 py-2">9 эт. (80 кв.)</td>
                    <td className="border border-slate-700 px-3 py-2">40</td>
                    <td className="border border-slate-700 px-3 py-2">12</td>
                    <td className="border border-slate-700 px-3 py-2">≈ 2.0 кВт</td>
                    <td className="border border-slate-700 px-3 py-2">2+1 рез.</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-700 px-3 py-2">16 эт. (160 кв.)</td>
                    <td className="border border-slate-700 px-3 py-2">65</td>
                    <td className="border border-slate-700 px-3 py-2">22</td>
                    <td className="border border-slate-700 px-3 py-2">≈ 5.5 кВт</td>
                    <td className="border border-slate-700 px-3 py-2">2+1 рез. ЧРП</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-700 px-3 py-2">25 эт. (250 кв.)</td>
                    <td className="border border-slate-700 px-3 py-2">95</td>
                    <td className="border border-slate-700 px-3 py-2">35</td>
                    <td className="border border-slate-700 px-3 py-2">≈ 11.0 кВт</td>
                    <td className="border border-slate-700 px-3 py-2">3+1 рез. Hydro MPC</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 3: Exercises */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-6 text-cyan-300">
            3. Интерактивные упражнения
          </h2>

          {/* Exercise 1 */}
          <div className="bg-slate-900 border border-cyan-900/50 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-3 text-cyan-200">
              Упражнение 1. Подбор количества насосов
            </h3>
            <p className="text-slate-300 mb-4">
              Жилой 9-этажный дом, 80 квартир. Расчётный хозяйственно-питьевой расход{" "}
              <strong>Q = 12 м³/ч</strong>, противопожарный расход <strong>5 л/с</strong> (1 струя).
              Сколько насосов и какой схемы заложить в смету по СП РК 4.01-101?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { v: "a", t: "1 насос + гидробак (минимальная конфигурация)" },
                { v: "b", t: "2 одинаковых насоса (1 рабочий + 1 резерв)" },
                { v: "c", t: "3 насоса: 2 рабочих + 1 резервный с ЧРП (N+1)" },
                { v: "d", t: "4 насоса: 3 рабочих + 1 резервный без ЧРП" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-slate-800/50"
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={answer1 === opt.v}
                    onChange={(e) => setAnswer1(e.target.value)}
                    className="mt-1 accent-cyan-500"
                  />
                  <span className="text-slate-300">
                    <strong className="text-cyan-300">{opt.v})</strong> {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mb-3">
              <button
                onClick={check1}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setShowSol1(!showSol1)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                {showSol1 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {result1 && (
              <p className={`mb-3 ${result1.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                {result1}
              </p>
            )}
            {showSol1 && (
              <div className="bg-slate-800/60 border-l-4 border-cyan-500 p-4 rounded text-slate-300 text-sm">
                <p className="font-semibold text-cyan-200 mb-2">Решение:</p>
                <p>
                  По СП РК 4.01-101 для зданий выше 5 этажей с расходом Q &gt; 10 м³/ч обязательна
                  схема <strong>N+1</strong> (резервный насос на случай отказа рабочего).
                </p>
                <p className="mt-2">
                  При Q = 12 м³/ч один насос Grundfos CR15-3 (≈ 8 м³/ч) не справится — нужно 2 рабочих,
                  работающих параллельно через ЧРП (плавная регулировка по давлению/расходу), плюс 1 резерв.
                </p>
                <p className="mt-2">
                  <strong className="text-cyan-300">Ответ: c) 3 насоса (2 рабочих + 1 резервный с ЧРП).</strong>
                </p>
                <p className="mt-2 text-cyan-400">
                  Типовая установка: Grundfos Hydro MPC-E 3xCR15-3 или Wilo SiBoost Smart 3 HELIX.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="bg-slate-900 border border-cyan-900/50 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-3 text-cyan-200">
              Упражнение 2. Мощность насоса
            </h3>
            <p className="text-slate-300 mb-4">
              Рассчитайте потребляемую мощность насоса для подъёма воды на{" "}
              <strong>H = 30 м</strong>, расход <strong>Q = 8 м³/ч</strong>, КПД насоса{" "}
              <strong>η = 0.7</strong>. Ответ — в <strong>кВт</strong> (допуск ±15%).
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={answer2}
                onChange={(e) => setAnswer2(e.target.value)}
                placeholder="Например: 1.0"
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-cyan-500 outline-none"
              />
              <span className="px-3 py-2 text-slate-400">кВт</span>
            </div>
            <div className="flex gap-3 mb-3">
              <button
                onClick={check2}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setShowSol2(!showSol2)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                {showSol2 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {result2 && (
              <p className={`mb-3 ${result2.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                {result2}
              </p>
            )}
            {showSol2 && (
              <div className="bg-slate-800/60 border-l-4 border-cyan-500 p-4 rounded text-slate-300 text-sm">
                <p className="font-semibold text-cyan-200 mb-2">Решение:</p>
                <p>P = (Q × H × ρ × g) / (η × 3600 × 1000)</p>
                <p>P = (8 × 30 × 1000 × 9.81) / (0.7 × 3600 × 1000)</p>
                <p>P = 2 354 400 / 2 520 000</p>
                <p>P ≈ <strong className="text-cyan-300">0.93 кВт ≈ 1.0 кВт</strong></p>
                <p className="mt-2 text-cyan-400">
                  В смету закладываем ближайший типоразмер с запасом 15-20%: насос 1.1 кВт
                  (Grundfos CR3-7 / Wilo MVI 204).
                </p>
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="bg-slate-900 border border-cyan-900/50 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-3 text-cyan-200">
              Упражнение 3. Объём гидробака (мембранного)
            </h3>
            <p className="text-slate-300 mb-4">
              Жилой дом 16 этажей, ГНС с допустимым числом стартов насоса{" "}
              <strong>Z ≤ 6 в час</strong>, расход <strong>Q = 18 м³/ч</strong>. Подберите рабочий
              объём гидробака (формула Вр = 0.25 × Q × 1000 / Z, литры). Допуск ±20%.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={answer3}
                onChange={(e) => setAnswer3(e.target.value)}
                placeholder="Например: 750"
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-cyan-500 outline-none"
              />
              <span className="px-3 py-2 text-slate-400">литров</span>
            </div>
            <div className="flex gap-3 mb-3">
              <button
                onClick={check3}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setShowSol3(!showSol3)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                {showSol3 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {result3 && (
              <p className={`mb-3 ${result3.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                {result3}
              </p>
            )}
            {showSol3 && (
              <div className="bg-slate-800/60 border-l-4 border-cyan-500 p-4 rounded text-slate-300 text-sm">
                <p className="font-semibold text-cyan-200 mb-2">Решение:</p>
                <p>Вр = 0.25 × Q × 1000 / Z = 0.25 × 18 × 1000 / 6 = 750 л</p>
                <p className="mt-2">
                  С учётом коэффициента заполнения мембраны (≈ 0.4-0.5) полный объём гидробака
                  должен быть ≈ 1500-1800 л — обычно набирается секцией из 2×750 л
                  (Reflex/Wester/Zilmet).
                </p>
                <p className="mt-2">
                  <strong className="text-cyan-300">Ответ: ≈ 750 л (рабочий объём).</strong>
                </p>
                <p className="mt-2 text-cyan-400">
                  Гидробак сглаживает пульсации давления и уменьшает износ моторов / контактора.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="bg-slate-900 border border-cyan-900/50 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-3 text-cyan-200">
              Упражнение 4. Стоимость ГНС в смете
            </h3>
            <p className="text-slate-300 mb-4">
              Жилой дом 9 эт., 80 квартир. Подберите бюджет ГНС: установка{" "}
              <strong>Grundfos Hydro MPC-E 3×CR15-3</strong> + автоматика + монтаж + обвязка
              (Сб.18 + Сб.16 + Сб.61). Цены РК, 2026. Допуск ±15%.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={answer4}
                onChange={(e) => setAnswer4(e.target.value)}
                placeholder="Например: 2800000"
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-cyan-500 outline-none"
              />
              <span className="px-3 py-2 text-slate-400">тенге</span>
            </div>
            <div className="flex gap-3 mb-3">
              <button
                onClick={check4}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setShowSol4(!showSol4)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                {showSol4 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {result4 && (
              <p className={`mb-3 ${result4.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                {result4}
              </p>
            )}
            {showSol4 && (
              <div className="bg-slate-800/60 border-l-4 border-cyan-500 p-4 rounded text-slate-300 text-sm">
                <p className="font-semibold text-cyan-200 mb-2">Калькуляция (РК, 2026):</p>
                <ul className="space-y-1">
                  <li>• Установка Grundfos Hydro MPC-E 3xCR15-3 (готовая) — 1 950 000 тг</li>
                  <li>• Гидробак Reflex DE 500 л — 180 000 тг</li>
                  <li>• Обвязка нерж. трубопровод DN65 + арматура — 220 000 тг</li>
                  <li>• Монтаж Сб.18 (насосы) + Сб.16 (трубы) — 280 000 тг</li>
                  <li>• Электромонтаж Сб.61 (силовой щит, кабель ВВГнг 5×6) — 110 000 тг</li>
                  <li>• Пусконаладка + приёмка — 60 000 тг</li>
                </ul>
                <p className="mt-3 font-semibold">
                  ИТОГО ≈ <span className="text-cyan-300">2 800 000 тг</span>
                </p>
                <p className="mt-2 text-cyan-400">
                  Без противопожарной части. С ВПВ +1.2-1.8 млн тг (отдельные пожарные насосы CR45).
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ESN catalog */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">
            Применяемые расценки ЭСН РК
          </h2>
          <div className="bg-slate-900 border border-cyan-900/50 rounded-lg p-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cyan-950/40 text-cyan-200">
                  <th className="border border-slate-700 px-3 py-2">Сборник</th>
                  <th className="border border-slate-700 px-3 py-2">Раздел</th>
                  <th className="border border-slate-700 px-3 py-2">Применение</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr>
                  <td className="border border-slate-700 px-3 py-2 font-semibold text-cyan-200">
                    ЭСН Сб.18
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Насосные станции
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Установка центробежных, многоступенчатых насосов, монтаж готовых станций
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-700 px-3 py-2 font-semibold text-cyan-200">
                    ЭСН Сб.16
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Трубопроводы внутренние
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Обвязка нержавейкой / сталью, фитинги, фланцы, арматура DN50-150
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-700 px-3 py-2 font-semibold text-cyan-200">
                    ЭСН Сб.61
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Электромонтажные работы
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Силовой шкаф, кабель ВВГнг, заземление PE, подключение ЧРП
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-700 px-3 py-2 font-semibold text-cyan-200">
                    ЭСН Сб.20
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Вентиляция
                  </td>
                  <td className="border border-slate-700 px-3 py-2">
                    Вытяжка из помещения ГНС (ОНТП — обязательна)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Cyan factoid */}
        <div className="bg-cyan-950/40 border border-cyan-700 rounded-lg p-6 mb-10">
          <h3 className="text-xl font-semibold mb-3 text-cyan-200">
            💡 Важно: ГНС на ВПВ (внутренний пожарный водопровод)
          </h3>
          <p className="text-slate-200 leading-relaxed">
            Для противопожарных насосных станций <strong>обязательно полное дублирование</strong>:
            каждый рабочий насос должен иметь резерв (схема N+R, минимум 1+1) с{" "}
            <strong className="text-cyan-300">автоматическим переключением через АВР</strong> и
            запуском от двух независимых вводов электропитания. Время выхода насоса на режим — не более{" "}
            <strong>30 секунд</strong> (СП РК 2.02-15). Регламент: проверка работоспособности насосов
            и переключения на резерв проводится <strong className="text-cyan-300">не реже 1 раза в год</strong>{" "}
            с оформлением акта проверки и записью в журнал эксплуатации (ППБ РК). При сдаче объекта
            обязательны гидравлические испытания на расчётный расход и давление с участием инспектора ГПС.
          </p>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            ← К разделам
          </Link>
          <Link
            href="/smeta-trainer/drawings-practice/water-internal"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Внутренний водопровод →
          </Link>
        </div>
      </div>
    </div>
  );
}
