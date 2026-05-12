"use client";

import Link from "next/link";
import { useState } from "react";

export default function SmokeRemovalPage() {
  // Exercise 1: Расход дымоудаления
  const [ex1, setEx1] = useState("");
  const [ex1Result, setEx1Result] = useState<null | boolean>(null);
  const [ex1Show, setEx1Show] = useState(false);

  // Exercise 2: Предел огнестойкости (multiple choice)
  const [ex2, setEx2] = useState("");
  const [ex2Result, setEx2Result] = useState<null | boolean>(null);
  const [ex2Show, setEx2Show] = useState(false);

  // Exercise 3: Количество клапанов
  const [ex3, setEx3] = useState("");
  const [ex3Result, setEx3Result] = useState<null | boolean>(null);
  const [ex3Show, setEx3Show] = useState(false);

  // Exercise 4: Стоимость комплекта
  const [ex4, setEx4] = useState("");
  const [ex4Result, setEx4Result] = useState<null | boolean>(null);
  const [ex4Show, setEx4Show] = useState(false);

  const checkNumeric = (
    value: string,
    target: number,
    tolerance: number,
    setResult: (r: boolean) => void
  ) => {
    const num = parseFloat(value.replace(/\s|,/g, "."));
    if (isNaN(num)) {
      setResult(false);
      return;
    }
    const diff = Math.abs(num - target) / target;
    setResult(diff <= tolerance);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-red-400 hover:text-red-300 text-sm"
          >
            ← К разделам
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-4 text-red-400">
          🚒 Дымоудаление и противопожарная вентиляция
        </h1>

        {/* Intro */}
        <div className="bg-slate-900 border border-red-900/40 rounded-lg p-6 mb-8">
          <p className="text-slate-300 leading-relaxed mb-4">
            Системы противодымной защиты (СПДЗ) предназначены для удаления
            продуктов горения из путей эвакуации и создания подпора воздуха
            в незадымляемых лестничных клетках, лифтовых шахтах и тамбур-шлюзах.
            Расчёт и монтаж выполняется на стадии РД (рабочая документация),
            проектирование требует допуска СРО и согласования с ДЧС РК.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950 rounded p-3 border border-slate-800">
              <span className="text-orange-400 font-semibold">Нормативы РК:</span>
              <ul className="mt-2 space-y-1 text-slate-300">
                <li>• СНиП РК 2.02-15-2003 — Противодымная защита</li>
                <li>• СН РК 4.02-04 — Отопление, вентиляция, кондиционирование</li>
                <li>• СП РК 4.02-103-2014 — Проектирование СПДЗ</li>
                <li>• ТР ТС 043/2017 — Пожарная безопасность оборудования</li>
              </ul>
            </div>
            <div className="bg-slate-950 rounded p-3 border border-slate-800">
              <span className="text-orange-400 font-semibold">Стоимость:</span>
              <p className="mt-2 text-slate-300">
                <span className="text-2xl font-bold text-red-400">
                  4 500 – 12 000
                </span>{" "}
                <span className="text-slate-400">тг/м²</span>
                <br />
                <span className="text-xs text-slate-500">
                  для общественных и административных зданий (включая монтаж,
                  пуско-наладку и автоматику АПС/СОУЭ)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Типы систем */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">
            1. Типы систем противодымной защиты
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-orange-300">
                <tr>
                  <th className="px-4 py-3 text-left">Обозначение</th>
                  <th className="px-4 py-3 text-left">Назначение</th>
                  <th className="px-4 py-3 text-left">Применение</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950">
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-red-400">ВД</td>
                  <td className="px-4 py-3">
                    Вытяжная дымоудаления коридоров
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    Этажи &gt;5, коридоры &gt;15 м без естеств. освещения
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-red-400">ПД</td>
                  <td className="px-4 py-3">
                    Приточная — подпор лестничных клеток
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    Незадымляемые ЛК типа Н2, ΔP ≥ 20 Па
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-red-400">
                    ПД лифт
                  </td>
                  <td className="px-4 py-3">Подпор лифтовой шахты</td>
                  <td className="px-4 py-3 text-slate-400">
                    Лифты для МГН, пожарные лифты — ΔP ≥ 20 Па
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-red-400">ОЗК</td>
                  <td className="px-4 py-3">Огнезадерживающие клапаны</td>
                  <td className="px-4 py-3 text-slate-400">
                    На пересечениях противопожарных преград, EI 60/90
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-red-400">
                    ОВ EI 60/120
                  </td>
                  <td className="px-4 py-3">Огнестойкие воздуховоды</td>
                  <td className="px-4 py-3 text-slate-400">
                    Транзит через помещения, базальтовая огнезащита
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-red-400">ТШ</td>
                  <td className="px-4 py-3">Тамбур-шлюзы</td>
                  <td className="px-4 py-3 text-slate-400">
                    Подпор перед ЛК и лифтами в подвалах/паркингах
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Расчёт расхода */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">
            2. Расчёт расхода и огнестойкости
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-4">
            <h3 className="text-lg font-semibold mb-3 text-red-300">
              Формула расхода для системы дымоудаления
            </h3>
            <div className="bg-slate-950 rounded p-4 font-mono text-center text-xl text-orange-300 border border-orange-900/30">
              L = 3600 · k · F · v &nbsp;[м³/ч]
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>
                <span className="text-orange-400 font-semibold">L</span> —
                расход дымовых газов, м³/ч
              </li>
              <li>
                <span className="text-orange-400 font-semibold">k = 0.7</span>{" "}
                — коэффициент, учитывающий относительную продолжительность
                открытия дверей
              </li>
              <li>
                <span className="text-orange-400 font-semibold">F</span> —
                площадь сечения проёма (двери), м²
              </li>
              <li>
                <span className="text-orange-400 font-semibold">v = 3 м/с</span>{" "}
                — скорость воздуха в проёме двери для коридора (СП РК
                4.02-103-2014)
              </li>
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3 text-red-300">
              Пределы огнестойкости EI (минут)
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Маркировка{" "}
              <span className="font-mono text-orange-300">EI 60</span> означает:
              целостность (E) и теплоизолирующая способность (I) сохраняются 60
              минут при стандартном пожаре.
            </p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[60, 90, 120, 150, 180].map((m) => (
                <div
                  key={m}
                  className="bg-slate-950 border border-red-900/30 rounded p-3"
                >
                  <div className="text-2xl font-bold text-red-400">EI {m}</div>
                  <div className="text-xs text-slate-400 mt-1">{m} мин</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Упражнения */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-6 text-orange-400">
            3. Интерактивные упражнения
          </h2>

          {/* Exercise 1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-300 mb-3">
              Упражнение 1. Расход вытяжной дымоудаления коридора
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Рассчитайте расход системы вытяжной дымоудаления для коридора
              длиной 50 м с проёмом двери на лестничную клетку 0.6 × 1.6 м.
              Скорость воздуха v = 3 м/с, k = 0.7. Ответ в м³/ч.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex1}
                onChange={(e) => setEx1(e.target.value)}
                placeholder="Введите расход в м³/ч"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-red-500 focus:outline-none"
              />
              <button
                onClick={() => checkNumeric(ex1, 7257, 0.1, setEx1Result)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-semibold"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Show(!ex1Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
              >
                {ex1Show ? "Скрыть" : "Решение"}
              </button>
            </div>
            {ex1Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex1Result
                    ? "bg-green-900/30 text-green-300 border border-green-700/40"
                    : "bg-red-900/30 text-red-300 border border-red-700/40"
                }`}
              >
                {ex1Result
                  ? "✓ Верно! Допуск ±10%."
                  : "✗ Неверно. Проверьте формулу или попробуйте снова."}
              </div>
            )}
            {ex1Show && (
              <div className="mt-3 bg-slate-950 border border-orange-900/40 rounded p-4 text-sm text-slate-300">
                <p className="font-semibold text-orange-300 mb-2">Решение:</p>
                <p>1. Площадь проёма: F = 0.6 × 1.6 = 0.96 м²</p>
                <p>2. По формуле: L = 3600 · k · F · v</p>
                <p>3. L = 3600 · 0.7 · 0.96 · 3 = 7257.6 м³/ч</p>
                <p className="mt-2 text-orange-400 font-semibold">
                  Ответ: ≈ 7 257 м³/ч
                </p>
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-300 mb-3">
              Упражнение 2. Предел огнестойкости воздуховодов лифтовой шахты
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Подберите предел огнестойкости воздуховодов системы подпора
              воздуха в шахте лифта 12-этажного жилого дома согласно СНиП РК
              2.02-15-2003.
            </p>
            <div className="space-y-2 mb-3">
              {[
                { v: "a", t: "EI 30" },
                { v: "b", t: "EI 60" },
                { v: "c", t: "EI 120" },
                { v: "d", t: "EI 180" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-red-500 bg-red-900/20"
                      : "border-slate-700 bg-slate-950 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={(e) => setEx2(e.target.value)}
                    className="accent-red-500"
                  />
                  <span className="text-slate-200">
                    {opt.v}) {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setEx2Result(ex2 === "b")}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-semibold"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Show(!ex2Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
              >
                {ex2Show ? "Скрыть" : "Решение"}
              </button>
            </div>
            {ex2Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex2Result
                    ? "bg-green-900/30 text-green-300 border border-green-700/40"
                    : "bg-red-900/30 text-red-300 border border-red-700/40"
                }`}
              >
                {ex2Result
                  ? "✓ Верно! Правильный ответ — EI 60."
                  : "✗ Неверно. Проверьте требования СНиП РК для жилых зданий."}
              </div>
            )}
            {ex2Show && (
              <div className="mt-3 bg-slate-950 border border-orange-900/40 rounded p-4 text-sm text-slate-300">
                <p className="font-semibold text-orange-300 mb-2">Решение:</p>
                <p>
                  Согласно СНиП РК 2.02-15-2003 (п. 7.11), для воздуховодов
                  систем подпора в шахтах лифтов жилых зданий до 28 м (≈12
                  этажей) предел огнестойкости должен быть не менее{" "}
                  <span className="text-orange-400 font-semibold">EI 60</span>.
                  Для зданий повышенной этажности (&gt;28 м) уже требуется EI 90 –
                  EI 120.
                </p>
                <p className="mt-2 text-orange-400 font-semibold">
                  Ответ: b) EI 60
                </p>
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-300 mb-3">
              Упражнение 3. Количество огнезадерживающих клапанов
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Офисный этаж 800 м²: 12 кабинетов и 2 коридора. Сколько
              огнезадерживающих клапанов потребуется для приточно-вытяжной
              вентиляции? Принцип: 1 клапан на каждом ответвлении воздуховода
              от магистрали + 1 на пересечении противопожарной стены.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                placeholder="Количество клапанов, шт"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-red-500 focus:outline-none"
              />
              <button
                onClick={() => checkNumeric(ex3, 14, 0.2, setEx3Result)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-semibold"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Show(!ex3Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
              >
                {ex3Show ? "Скрыть" : "Решение"}
              </button>
            </div>
            {ex3Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex3Result
                    ? "bg-green-900/30 text-green-300 border border-green-700/40"
                    : "bg-red-900/30 text-red-300 border border-red-700/40"
                }`}
              >
                {ex3Result
                  ? "✓ Верно! Допуск ±20% (планировки бывают разные)."
                  : "✗ Не совсем. Учтите кабинеты + коридоры + противопожарную стену."}
              </div>
            )}
            {ex3Show && (
              <div className="mt-3 bg-slate-950 border border-orange-900/40 rounded p-4 text-sm text-slate-300">
                <p className="font-semibold text-orange-300 mb-2">Решение:</p>
                <p>1. На каждое из 12 кабинетов — 1 клапан = 12 шт</p>
                <p>2. На каждый из 2 коридоров — 1 клапан = 2 шт</p>
                <p>
                  3. На пересечении противопожарной стены (между секциями) —
                  обычно учтено в магистрали кабинетов
                </p>
                <p className="mt-2">Итого: 12 + 2 = 14 шт</p>
                <p className="mt-2 text-orange-400 font-semibold">
                  Ответ: ≈ 14 клапанов
                </p>
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-300 mb-3">
              Упражнение 4. Стоимость комплекта дымоудаления для паркинга
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Подземная парковка 600 м². Состав: крышный вентилятор 18 000 м³/ч
              (~1 200 000 тг), 80 м огнестойких воздуховодов EI 90 (~22 000
              тг/м), 6 огнезадерживающих клапанов (~70 000 тг/шт), автоматика и
              шкаф управления (~700 000 тг). Рассчитайте бюджет.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex4}
                onChange={(e) => setEx4(e.target.value)}
                placeholder="Стоимость в тенге"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-red-500 focus:outline-none"
              />
              <button
                onClick={() => checkNumeric(ex4, 4200000, 0.15, setEx4Result)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-semibold"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Show(!ex4Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
              >
                {ex4Show ? "Скрыть" : "Решение"}
              </button>
            </div>
            {ex4Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex4Result
                    ? "bg-green-900/30 text-green-300 border border-green-700/40"
                    : "bg-red-900/30 text-red-300 border border-red-700/40"
                }`}
              >
                {ex4Result
                  ? "✓ Верно! Допуск ±15%."
                  : "✗ Пересчитайте позиции по приведённым ценам."}
              </div>
            )}
            {ex4Show && (
              <div className="mt-3 bg-slate-950 border border-orange-900/40 rounded p-4 text-sm text-slate-300">
                <p className="font-semibold text-orange-300 mb-2">Решение:</p>
                <p>1. Вентилятор крышный: 1 200 000 тг</p>
                <p>2. Воздуховоды EI 90: 80 м × 22 000 = 1 760 000 тг</p>
                <p>3. Клапаны ОЗК: 6 × 70 000 = 420 000 тг</p>
                <p>4. Автоматика + шкаф управления: 700 000 тг</p>
                <p className="mt-2">
                  Итого: 1 200 000 + 1 760 000 + 420 000 + 700 000 = 4 080 000
                  тг
                </p>
                <p className="mt-1 text-slate-400">
                  С учётом монтажа и ПНР (~3%) ≈ 4 200 000 тг
                </p>
                <p className="mt-2 text-orange-400 font-semibold">
                  Ответ: ≈ 4 200 000 тг
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">
            4. Применяемые расценки ЭСН РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="text-red-400 font-mono text-lg font-bold">
                Сб. 20
              </div>
              <div className="text-slate-200 mt-1">Вентиляция</div>
              <p className="text-xs text-slate-400 mt-2">
                Монтаж воздуховодов, вентиляторов, клапанов, диффузоров,
                регулирующих устройств.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="text-red-400 font-mono text-lg font-bold">
                Сб. 20-4
              </div>
              <div className="text-slate-200 mt-1">
                Огнезащита воздуховодов
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Базальтовая обмотка, огнезащитные плиты, мастики до EI 180.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="text-red-400 font-mono text-lg font-bold">
                Сб. 62
              </div>
              <div className="text-slate-200 mt-1">АПС / СОУЭ</div>
              <p className="text-xs text-slate-400 mt-2">
                Автоматическая пожарная сигнализация, оповещение и управление
                эвакуацией, интерфейс СПДЗ.
              </p>
            </div>
          </div>
        </section>

        {/* Red factoid block */}
        <section className="mb-10">
          <div className="bg-red-950/40 border-2 border-red-700/60 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🔥</span>
              <div>
                <h3 className="text-lg font-bold text-red-300 mb-2">
                  Важно: ТР ТС 043/2017
                </h3>
                <p className="text-slate-200 text-sm leading-relaxed">
                  После введения{" "}
                  <span className="text-red-300 font-semibold">
                    Технического регламента Таможенного союза 043/2017
                  </span>{" "}
                  «О требованиях к средствам обеспечения пожарной безопасности и
                  пожаротушения» декларация соответствия на пожарное
                  оборудование (вентиляторы дымоудаления, ОЗК, огнестойкие
                  воздуховоды) стала{" "}
                  <span className="text-red-300 font-semibold">
                    обязательной
                  </span>
                  . Без декларации применение оборудования запрещено, а штраф
                  для юр. лиц составляет{" "}
                  <span className="text-red-300 font-semibold">
                    200 – 500 МРП
                  </span>{" "}
                  (ст. 410 КоАП РК) + предписание о демонтаже за свой счёт.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-slate-500 text-xs pt-6 border-t border-slate-800">
          AEVION Smeta Trainer · модуль «Дымоудаление» · НТД РК 2024
        </div>
      </div>
    </div>
  );
}
