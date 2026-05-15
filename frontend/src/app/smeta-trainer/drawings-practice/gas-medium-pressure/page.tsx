"use client";
import Link from "next/link";
import { useState } from "react";

// ── Утилиты проверки ────────────────────────────────────────────────────────
function checkNumeric(input: string, expected: number, tolerance: number = 0.15): boolean {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tolerance;
}

export default function GasMediumPressurePage() {
  // Состояния упражнений
  const [ex1Answer, setEx1Answer] = useState<string>("");
  const [ex1Show, setEx1Show] = useState(false);

  const [ex2Input, setEx2Input] = useState("");
  const [ex2Show, setEx2Show] = useState(false);

  const [ex3Answer, setEx3Answer] = useState<string>("");
  const [ex3Show, setEx3Show] = useState(false);

  const [ex4Input, setEx4Input] = useState("");
  const [ex4Show, setEx4Show] = useState(false);

  // Проверки
  const ex1Correct = ex1Answer === "c";
  const ex2Correct = checkNumeric(ex2Input, 41, 0.15);
  const ex3Correct = ex3Answer === "c";
  const ex4Correct = checkNumeric(ex4Input, 1800000, 0.15);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-yellow-400 hover:text-yellow-300 transition text-sm"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta · ГРП ВД/СД · СНиП РК 4.03-01-2011
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Заголовок */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-yellow-400 mb-3">
            🔥 ГРП — газораспределительные пункты ВД/СД
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Газорегуляторный пункт (ГРП) — комплексное технологическое сооружение,
            понижающее входное давление газа (среднее или высокое) до требуемого
            на выходе с автоматическим поддержанием параметров и защитой от
            аварийных режимов. Применяется на сетях газораспределения городов,
            микрорайонов, отдельных потребителей.
          </p>
        </section>

        {/* Intro: нормативы и стоимость */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-amber-300 mb-4">
            📚 Нормативная база и порядок цен
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Нормативы РК и ТР ТС
              </h3>
              <ul className="text-sm text-slate-400 space-y-1.5">
                <li>
                  <span className="text-yellow-400">СНиП РК 4.03-01-2011</span> —
                  Газораспределительные системы (базовый документ РК)
                </li>
                <li>
                  <span className="text-yellow-400">СП РК 4.03-01-2017</span> —
                  Свод правил по проектированию газоснабжения
                </li>
                <li>
                  <span className="text-yellow-400">ПБ 12-529-03</span> —
                  Правила безопасности систем газораспределения
                </li>
                <li>
                  <span className="text-yellow-400">ТР ТС 016/2011</span> —
                  Технический регламент о безопасности оборудования на газе
                </li>
                <li>
                  <span className="text-yellow-400">ГОСТ 5542-2014</span> —
                  Газы горючие природные
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Стоимость районного ГРП
              </h3>
              <ul className="text-sm text-slate-400 space-y-1.5">
                <li>
                  <span className="text-amber-300">ГРПШ-100</span> (бытовой,
                  один потребитель): <span className="text-yellow-400">1.5 — 2.5 млн тг</span>
                </li>
                <li>
                  <span className="text-amber-300">ГРПШ-200</span> (секция/подъезд):{" "}
                  <span className="text-yellow-400">1.8 — 3.5 млн тг</span>
                </li>
                <li>
                  <span className="text-amber-300">ГРПБ блочный</span> (микрорайон):{" "}
                  <span className="text-yellow-400">6 — 12 млн тг</span>
                </li>
                <li>
                  <span className="text-amber-300">ШРП-1</span> (один котёл):{" "}
                  <span className="text-yellow-400">1.5 — 2.2 млн тг</span>
                </li>
                <li>
                  <span className="text-amber-300">Крышное ГРП</span>:{" "}
                  <span className="text-yellow-400">2.8 — 5 млн тг</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1: Категории газопроводов */}
        <section>
          <h2 className="text-2xl font-semibold text-yellow-400 mb-4">
            1️⃣ Категории газопроводов по давлению
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Согласно СНиП РК 4.03-01-2011 газопроводы разделяются на 5 категорий
            по рабочему давлению. ГРП понижает давление между категориями.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-amber-300">
                <tr>
                  <th className="text-left px-4 py-3">Категория</th>
                  <th className="text-left px-4 py-3">Давление, МПа</th>
                  <th className="text-left px-4 py-3">Область применения</th>
                  <th className="text-left px-4 py-3">Тип ГРП</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="bg-slate-950 hover:bg-slate-900/60">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">ВД-1</td>
                  <td className="px-4 py-3">от 0.6 до 1.2</td>
                  <td className="px-4 py-3">Магистрали, ГРС → ГРП крупных потребителей</td>
                  <td className="px-4 py-3 text-slate-400">Станционные ГРП, ГРПБ</td>
                </tr>
                <tr className="bg-slate-900/30 hover:bg-slate-900/60">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">ВД-2</td>
                  <td className="px-4 py-3">от 0.3 до 0.6</td>
                  <td className="px-4 py-3">Промзоны, кольцевые сети крупных городов</td>
                  <td className="px-4 py-3 text-slate-400">ГРПБ, ГРПШ-200</td>
                </tr>
                <tr className="bg-slate-950 hover:bg-slate-900/60">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">СД</td>
                  <td className="px-4 py-3">от 0.005 до 0.3</td>
                  <td className="px-4 py-3">Распределение по городу, сети микрорайонов</td>
                  <td className="px-4 py-3 text-slate-400">ГРПШ-100/200, ШРП</td>
                </tr>
                <tr className="bg-slate-900/30 hover:bg-slate-900/60">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">НД</td>
                  <td className="px-4 py-3">до 0.005 (5 кПа)</td>
                  <td className="px-4 py-3">Подвод к жилым домам, общественным зданиям</td>
                  <td className="px-4 py-3 text-slate-400">ГРПШ домовое</td>
                </tr>
                <tr className="bg-slate-950 hover:bg-slate-900/60">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">Бытовое</td>
                  <td className="px-4 py-3">2 — 3 кПа (после регулятора)</td>
                  <td className="px-4 py-3">Газовая плита, котёл, колонка</td>
                  <td className="px-4 py-3 text-slate-400">Бытовой регулятор</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Типы ГРП */}
        <section>
          <h2 className="text-2xl font-semibold text-yellow-400 mb-4">
            2️⃣ Типы газорегуляторных пунктов
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-amber-300">
                <tr>
                  <th className="text-left px-4 py-3">Маркировка</th>
                  <th className="text-left px-4 py-3">Производительность</th>
                  <th className="text-left px-4 py-3">Pвх / Pвых</th>
                  <th className="text-left px-4 py-3">Назначение</th>
                  <th className="text-left px-4 py-3">Цена в комплекте</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="bg-slate-950">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">ГРПШ-100</td>
                  <td className="px-4 py-3">до 100 нм³/ч</td>
                  <td className="px-4 py-3">0.3 / 0.003 МПа</td>
                  <td className="px-4 py-3">Индивидуальный жилой дом</td>
                  <td className="px-4 py-3 text-slate-400">1.5 — 2.5 млн тг</td>
                </tr>
                <tr className="bg-slate-900/30">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">ГРПШ-200</td>
                  <td className="px-4 py-3">до 1500 нм³/ч</td>
                  <td className="px-4 py-3">0.6 / 0.003 МПа</td>
                  <td className="px-4 py-3">Секция/подъезд многоквартирного дома</td>
                  <td className="px-4 py-3 text-slate-400">1.8 — 3.5 млн тг</td>
                </tr>
                <tr className="bg-slate-950">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">ГРПБ блочный</td>
                  <td className="px-4 py-3">до 5000 нм³/ч</td>
                  <td className="px-4 py-3">1.2 / 0.005 МПа</td>
                  <td className="px-4 py-3">Микрорайон, квартал, ТЭЦ</td>
                  <td className="px-4 py-3 text-slate-400">6 — 12 млн тг</td>
                </tr>
                <tr className="bg-slate-900/30">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">ШРП-1</td>
                  <td className="px-4 py-3">до 50 нм³/ч</td>
                  <td className="px-4 py-3">0.3 / 0.003 МПа</td>
                  <td className="px-4 py-3">Один котёл (мини-котельная)</td>
                  <td className="px-4 py-3 text-slate-400">1.5 — 2.2 млн тг</td>
                </tr>
                <tr className="bg-slate-950">
                  <td className="px-4 py-3 text-yellow-300 font-semibold">ГРП крышное</td>
                  <td className="px-4 py-3">до 800 нм³/ч</td>
                  <td className="px-4 py-3">0.6 / 0.005 МПа</td>
                  <td className="px-4 py-3">Крышная котельная многоэтажки</td>
                  <td className="px-4 py-3 text-slate-400">2.8 — 5 млн тг</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Упражнения */}
        <section>
          <h2 className="text-2xl font-semibold text-yellow-400 mb-6">
            3️⃣ Интерактивные упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-amber-300 mb-3">
              Упражнение 1. Подбор ГРПШ для жилого 9-этажного дома
            </h3>
            <div className="text-sm text-slate-300 space-y-2 mb-4">
              <p>
                <span className="text-slate-400">Условие:</span> 9-этажный жилой
                дом, 80 квартир. Установлены газовые плиты + проточные водонагреватели.
                Расчётный максимальный расход газа — <span className="text-yellow-400">60 нм³/ч на квартиру</span>{" "}
                (среднее значение по СП РК 4.03-01-2017 для квартир с водонагревателем).
                Коэффициент одновременности <span className="text-yellow-400">k_одн = 0.45</span> (на 80 квартир).
              </p>
              <p>
                <span className="text-slate-400">Расчёт расхода:</span>
                <code className="ml-2 text-yellow-300 bg-slate-950 px-2 py-0.5 rounded">
                  Q = 60 × 80 × 0.45 = 2160 нм³/ч
                </code>
              </p>
              <p>
                <span className="text-slate-400">Вопрос:</span> Какой тип ГРП следует
                принять?
              </p>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { v: "a", t: "ГРПШ-100 (до 100 нм³/ч)" },
                { v: "b", t: "ГРПШ-200 (до 1500 нм³/ч)" },
                { v: "c", t: "ГРПБ блочный (до 5000 нм³/ч)" },
                { v: "d", t: "ШРП-1 (до 50 нм³/ч)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    ex1Answer === opt.v
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1Answer === opt.v}
                    onChange={(e) => setEx1Answer(e.target.value)}
                    className="accent-yellow-500"
                  />
                  <span className="text-sm">{opt.t}</span>
                </label>
              ))}
            </div>
            {ex1Answer && (
              <div
                className={`p-3 rounded-lg text-sm mb-3 ${
                  ex1Correct
                    ? "bg-green-900/40 border border-green-700 text-green-300"
                    : "bg-red-900/40 border border-red-700 text-red-300"
                }`}
              >
                {ex1Correct
                  ? "✓ Верно! Расход 2160 нм³/ч превышает предел ГРПШ-200 (1500), поэтому необходим ГРПБ."
                  : "✗ Не угадали. Подсказка: 2160 нм³/ч — это больше 1500."}
              </div>
            )}
            <button
              onClick={() => setEx1Show(!ex1Show)}
              className="text-xs text-yellow-400 hover:text-yellow-300 underline"
            >
              {ex1Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex1Show && (
              <div className="mt-3 p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-amber-300">Подробное решение:</p>
                <p>
                  1. Расчёт пикового расхода: Q = q × N × k_одн = 60 × 80 × 0.45 ={" "}
                  <span className="text-yellow-400">2160 нм³/ч</span>
                </p>
                <p>
                  2. Сопоставление с производительностями:
                </p>
                <ul className="ml-4 space-y-1 list-disc list-inside text-slate-400">
                  <li>ГРПШ-100 — до 100 нм³/ч → не подходит (×21.6 мало)</li>
                  <li>ШРП-1 — до 50 нм³/ч → не подходит (×43 мало)</li>
                  <li>ГРПШ-200 — до 1500 нм³/ч → не подходит (превышение на 44%)</li>
                  <li className="text-yellow-300">
                    ГРПБ блочный — до 5000 нм³/ч → подходит с резервом 56%
                  </li>
                </ul>
                <p>
                  3. По СП РК 4.03-01-2017 п.6.4 на блочный ГРП оставляют резерв
                  не менее 25% от пикового расхода. У ГРПБ резерв 56% — оптимально.
                </p>
                <p className="text-yellow-300 font-semibold">
                  Ответ: ГРПБ блочный.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-amber-300 mb-3">
              Упражнение 2. Расход газа для котельной 350 кВт
            </h3>
            <div className="text-sm text-slate-300 space-y-2 mb-4">
              <p>
                <span className="text-slate-400">Условие:</span> Крышная газовая
                котельная для 5-этажного жилого дома. Тепловая мощность{" "}
                <span className="text-yellow-400">N = 350 кВт</span>. КПД котла{" "}
                <span className="text-yellow-400">η = 0.92</span>. Низшая теплотворная
                способность природного газа{" "}
                <span className="text-yellow-400">Qн = 33.5 МДж/нм³</span>.
              </p>
              <p>
                <span className="text-slate-400">Формула:</span>
                <code className="ml-2 text-yellow-300 bg-slate-950 px-2 py-0.5 rounded">
                  B = (N × 3600) / (η × Qн × 1000)
                </code>
              </p>
              <p>
                <span className="text-slate-400">Вопрос:</span> Найти часовой
                расход газа B, нм³/ч.
              </p>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                value={ex2Input}
                onChange={(e) => setEx2Input(e.target.value)}
                placeholder="нм³/ч"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-yellow-500"
              />
              <span className="text-slate-400 text-sm">нм³/ч</span>
            </div>
            {ex2Input && (
              <div
                className={`p-3 rounded-lg text-sm mb-3 ${
                  ex2Correct
                    ? "bg-green-900/40 border border-green-700 text-green-300"
                    : "bg-red-900/40 border border-red-700 text-red-300"
                }`}
              >
                {ex2Correct
                  ? "✓ Верно! Допустимое отклонение ±15%."
                  : "✗ Проверьте расчёт. Эталонное значение около 41 нм³/ч ±15%."}
              </div>
            )}
            <button
              onClick={() => setEx2Show(!ex2Show)}
              className="text-xs text-yellow-400 hover:text-yellow-300 underline"
            >
              {ex2Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex2Show && (
              <div className="mt-3 p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-amber-300">Подробное решение:</p>
                <p>1. Тепловая мощность 350 кВт = 350 × 3600 = 1 260 000 кДж/ч = 1260 МДж/ч</p>
                <p>2. С учётом КПД нужно подвести: 1260 / 0.92 = 1369.6 МДж/ч</p>
                <p>
                  3. Расход газа: B = 1369.6 / 33.5 ={" "}
                  <span className="text-yellow-400">≈ 40.9 нм³/ч</span>
                </p>
                <p>
                  4. Округлённо принимаем <span className="text-yellow-300">B ≈ 41 нм³/ч</span>.
                  Для сметы умножаем на годовое число часов работы и тариф (в
                  отопительном периоде ~3000 ч/год, расход ~123 000 нм³/год).
                </p>
                <p className="text-yellow-300 font-semibold">Ответ: ≈ 41 нм³/ч.</p>
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-amber-300 mb-3">
              Упражнение 3. Охранная зона ГРПБ
            </h3>
            <div className="text-sm text-slate-300 space-y-2 mb-4">
              <p>
                <span className="text-slate-400">Условие:</span> Проектируется
                ГРПБ блочного типа Pвх = 1.2 МПа возле многоквартирного жилого
                дома. По СНиП РК 4.03-01-2011 (табл.5) определить минимальное
                расстояние от ГРПБ до здания.
              </p>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { v: "a", t: "5 м" },
                { v: "b", t: "10 м (это для ГРПШ малой производительности)" },
                { v: "c", t: "15 м" },
                { v: "d", t: "20 м" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    ex3Answer === opt.v
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex3"
                    value={opt.v}
                    checked={ex3Answer === opt.v}
                    onChange={(e) => setEx3Answer(e.target.value)}
                    className="accent-yellow-500"
                  />
                  <span className="text-sm">{opt.t}</span>
                </label>
              ))}
            </div>
            {ex3Answer && (
              <div
                className={`p-3 rounded-lg text-sm mb-3 ${
                  ex3Correct
                    ? "bg-green-900/40 border border-green-700 text-green-300"
                    : "bg-red-900/40 border border-red-700 text-red-300"
                }`}
              >
                {ex3Correct
                  ? "✓ Верно! Для ГРПБ при Pвх > 0.6 МПа расстояние не менее 15 м."
                  : "✗ Не точно. По СНиП для ГРПШ — 10 м, для ГРПБ — 15 м."}
              </div>
            )}
            <button
              onClick={() => setEx3Show(!ex3Show)}
              className="text-xs text-yellow-400 hover:text-yellow-300 underline"
            >
              {ex3Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex3Show && (
              <div className="mt-3 p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-amber-300">Подробное решение:</p>
                <p>
                  По СНиП РК 4.03-01-2011 (табл.5 «Минимальные расстояния от ГРП
                  до зданий и сооружений»):
                </p>
                <ul className="ml-4 space-y-1 list-disc list-inside text-slate-400">
                  <li>ГРПШ при Pвх ≤ 0.6 МПа — <span className="text-yellow-300">10 м</span> до жилых зданий</li>
                  <li>ГРПШ при Pвх &gt; 0.6 МПа — <span className="text-yellow-300">15 м</span></li>
                  <li>ГРПБ блочный (Pвх до 1.2 МПа) — <span className="text-yellow-300">15 м</span></li>
                  <li>Станционный ГРП высокого давления — <span className="text-yellow-300">не менее 20 м</span></li>
                </ul>
                <p>
                  Поскольку у нас ГРПБ с Pвх = 1.2 МПа, минимальное расстояние —{" "}
                  <span className="text-yellow-300">15 м</span>.
                </p>
                <p className="text-yellow-300 font-semibold">Ответ: 15 м.</p>
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-amber-300 mb-3">
              Упражнение 4. Стоимость ГРПШ-200 в комплекте
            </h3>
            <div className="text-sm text-slate-300 space-y-2 mb-4">
              <p>
                <span className="text-slate-400">Условие:</span> Составить смету
                на поставку и монтаж ГРПШ-200. Состав комплекта:
              </p>
              <ul className="ml-4 list-disc list-inside text-slate-400 text-sm space-y-1">
                <li>Шкаф металлический с обогревом — 380 000 тг</li>
                <li>Регулятор давления РДГ-50В — 250 000 тг</li>
                <li>ПЗК (предохранительный запорный клапан) — 180 000 тг</li>
                <li>ПСК (предохранительный сбросной клапан) — 95 000 тг</li>
                <li>Фильтр газовый ФГ-50 — 75 000 тг</li>
                <li>Узел учёта газа со счётчиком G65 — 320 000 тг</li>
                <li>Запорная арматура (краны шаровые) — 110 000 тг</li>
                <li>Монтажные работы (Сб.25 ЭСН) — 280 000 тг</li>
                <li>Пусконаладка с актом ввода (СБ-22) — 110 000 тг</li>
              </ul>
              <p>
                <span className="text-slate-400">Вопрос:</span> Найти полную стоимость
                ГРПШ-200 «под ключ», тг.
              </p>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                value={ex4Input}
                onChange={(e) => setEx4Input(e.target.value)}
                placeholder="тенге"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:border-yellow-500"
              />
              <span className="text-slate-400 text-sm">тг</span>
            </div>
            {ex4Input && (
              <div
                className={`p-3 rounded-lg text-sm mb-3 ${
                  ex4Correct
                    ? "bg-green-900/40 border border-green-700 text-green-300"
                    : "bg-red-900/40 border border-red-700 text-red-300"
                }`}
              >
                {ex4Correct
                  ? "✓ Верно! Полная стоимость ≈ 1 800 000 тг (±15%)."
                  : "✗ Перепроверьте сумму. Эталон около 1 800 000 тг ±15%."}
              </div>
            )}
            <button
              onClick={() => setEx4Show(!ex4Show)}
              className="text-xs text-yellow-400 hover:text-yellow-300 underline"
            >
              {ex4Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex4Show && (
              <div className="mt-3 p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-amber-300">Подробное решение:</p>
                <p>Сложение позиций:</p>
                <ul className="ml-4 space-y-0.5 list-disc list-inside text-slate-400 text-xs">
                  <li>Шкаф 380 000 + Регулятор 250 000 = 630 000</li>
                  <li>+ ПЗК 180 000 = 810 000</li>
                  <li>+ ПСК 95 000 = 905 000</li>
                  <li>+ Фильтр 75 000 = 980 000</li>
                  <li>+ Узел учёта 320 000 = 1 300 000</li>
                  <li>+ Арматура 110 000 = 1 410 000</li>
                  <li>+ Монтаж 280 000 = 1 690 000</li>
                  <li>+ ПНР 110 000 = <span className="text-yellow-300">1 800 000 тг</span></li>
                </ul>
                <p>
                  В сводной смете отдельно учитываются НР (104%), СП (61%) и НДС
                  (12%) от стоимости работ. Также добавляются расходы на проект
                  (~7-10%) и согласование с КазТрансГаз/QazaqGaz.
                </p>
                <p className="text-yellow-300 font-semibold">
                  Ответ: 1 800 000 тг (поставка + монтаж + ПНР).
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-amber-300 mb-4">
            📋 Применяемые расценки ЭСН РК
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <h3 className="text-yellow-400 font-semibold mb-2">
                Сборник 24 — Наружные газопроводы
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>24-01 Прокладка стальных газопроводов в траншее</li>
                <li>24-02 Прокладка ПЭ-газопроводов (ПЭ80/ПЭ100)</li>
                <li>24-04 Установка ГРПШ/ГРПБ на фундамент</li>
                <li>24-05 Электрохимзащита (ЭХЗ) газопроводов</li>
                <li>24-08 Балластировка и крепление переходов</li>
              </ul>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <h3 className="text-yellow-400 font-semibold mb-2">
                Сборник 25 — Внутренние газопроводы
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>25-01 Стальной газопровод по стене Ø15-50 мм</li>
                <li>25-02 Установка газового счётчика, регулятора</li>
                <li>25-03 Подключение газовой плиты, котла, колонки</li>
                <li>25-05 Прокладка медной разводки в квартире</li>
                <li>25-08 Испытания на прочность и герметичность</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Базовые цены 2001 г., для пересчёта применяется индекс СМР по РК
            (квартальный, публикуется КГД РК). Также применяются территориальные
            коэффициенты для регионов РК.
          </p>
        </section>

        {/* Yellow factoid block */}
        <section className="bg-yellow-950/40 border-2 border-yellow-700 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⚠️</div>
            <div>
              <h3 className="text-yellow-300 font-bold text-lg mb-2">
                Охранная зона ГРП — обязательное требование
              </h3>
              <p className="text-yellow-100 text-sm leading-relaxed mb-3">
                Согласно <span className="font-semibold">СНиП РК 4.03-01-2011</span>{" "}
                для каждого ГРП устанавливается охранная зона:
              </p>
              <ul className="text-yellow-200 text-sm space-y-1 ml-4 list-disc list-inside">
                <li>10 м для ГРПШ при Pвх ≤ 0.6 МПа</li>
                <li>15 м для ГРПБ и ГРПШ при Pвх &gt; 0.6 МПа</li>
                <li>20 м для станционных ГРП высокого давления</li>
                <li>Запрещено: парковка авто, посадка деревьев, складирование</li>
              </ul>
              <p className="text-yellow-100 text-sm leading-relaxed mt-3">
                <span className="font-semibold">Нарушение охранной зоны</span> →
                штраф <span className="text-yellow-300 font-bold">100-300 МРП</span>{" "}
                (КоАП РК ст.296) + <span className="text-yellow-300 font-bold">остановка пуска газа</span>{" "}
                до устранения нарушений. На стадии сметы охранная зона учитывается
                как изъятие земель и затраты на ограждение/предупредительные знаки.
              </p>
            </div>
          </div>
        </section>

        {/* Footer nav */}
        <section className="pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center text-sm">
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="text-yellow-400 hover:text-yellow-300"
            >
              ← К разделам
            </Link>
            <span className="text-slate-500 text-xs">
              СНиП РК 4.03-01-2011 · СП РК 4.03-01-2017 · ПБ 12-529-03
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
