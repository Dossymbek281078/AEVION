"use client";

import Link from "next/link";
import { useState } from "react";

export default function SprinklersPage() {
  // Exercise 1: Группа помещений (multiple choice)
  const [ex1, setEx1] = useState("");
  const [ex1Result, setEx1Result] = useState<null | boolean>(null);
  const [ex1Show, setEx1Show] = useState(false);

  // Exercise 2: Количество спринклеров
  const [ex2, setEx2] = useState("");
  const [ex2Result, setEx2Result] = useState<null | boolean>(null);
  const [ex2Show, setEx2Show] = useState(false);

  // Exercise 3: Расход воды дренчерной завесы
  const [ex3, setEx3] = useState("");
  const [ex3Result, setEx3Result] = useState<null | boolean>(null);
  const [ex3Show, setEx3Show] = useState(false);

  // Exercise 4: Стоимость спринклерной системы
  const [ex4, setEx4] = useState("");
  const [ex4Result, setEx4Result] = useState<null | boolean>(null);
  const [ex4Show, setEx4Show] = useState(false);

  const checkNumeric = (
    value: string,
    target: number,
    tolerance: number,
    setResult: (r: boolean) => void
  ) => {
    const num = parseFloat(value.replace(/\s/g, "").replace(/,/g, "."));
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
          💦 Спринклерное и дренчерное пожаротушение
        </h1>

        {/* Intro */}
        <div className="bg-slate-900 border border-red-900/40 rounded-lg p-6 mb-8">
          <p className="text-slate-300 leading-relaxed mb-4">
            Автоматические установки пожаротушения (АУПТ) — обязательная
            подсистема для торговых, складских, общественных зданий категории
            пожарной опасности В1–В4. Включают спринклерные оросители (постоянно
            заряженная вода под давлением вскрывается при срабатывании
            теплозамка), дренчерные завесы (открытые оросители для проёмов и
            эвакуационных путей) и газовые/аэрозольные установки для
            электрических помещений. Проектирование требует допуска СРО ПБ,
            монтаж и приёмка — согласования с ДЧС РК.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950 rounded p-3 border border-slate-800">
              <span className="text-orange-400 font-semibold">Нормативы РК:</span>
              <ul className="mt-2 space-y-1 text-slate-300">
                <li>• СН РК 5.01-101-2014 — Системы пожаротушения</li>
                <li>• СНиП РК 2.02-15-2003 — Противопожарные требования</li>
                <li>• СП РК 5.01-101 — Проектирование АУПТ</li>
                <li>• ГОСТ Р 51043-2002 — Оросители спринклерные</li>
              </ul>
            </div>
            <div className="bg-slate-950 rounded p-3 border border-slate-800">
              <span className="text-orange-400 font-semibold">Стоимость:</span>
              <p className="mt-2 text-slate-300">
                Для торгового центра: <strong className="text-red-300">1 800 –
                6 500 тг/м²</strong> в зависимости от типа системы (водяная
                спринклерная — нижняя граница, газовая хладоновая — верхняя),
                группы помещений по НПБ и сложности трассировки.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Типы систем */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">
            1. Типы систем пожаротушения
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Тип системы</th>
                  <th className="px-3 py-2 text-left">Огнетушащее вещество</th>
                  <th className="px-3 py-2 text-left">Назначение</th>
                  <th className="px-3 py-2 text-left">Цена, тг/м²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="px-3 py-2 font-semibold text-red-300">
                    Спринклерная водонаполненная
                  </td>
                  <td className="px-3 py-2">Вода под давлением</td>
                  <td className="px-3 py-2">
                    Тёплые помещения t &gt; 5°C: торговые залы, офисы, гостиницы
                  </td>
                  <td className="px-3 py-2">1 800 – 2 800</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-red-300">
                    Спринклерная воздушная
                  </td>
                  <td className="px-3 py-2">Воздух → вода</td>
                  <td className="px-3 py-2">
                    Холодные помещения t &lt; 5°C: паркинги, склады без отопления
                  </td>
                  <td className="px-3 py-2">2 200 – 3 200</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-red-300">
                    Дренчерная
                  </td>
                  <td className="px-3 py-2">Вода (открытые сопла)</td>
                  <td className="px-3 py-2">
                    Завесы проёмов, локальное тушение, сцены, эвакуационные выходы
                  </td>
                  <td className="px-3 py-2">2 500 – 3 800</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-red-300">
                    Газовая (хладон / СО₂)
                  </td>
                  <td className="px-3 py-2">Хладон 227ea, СО₂, Novec 1230</td>
                  <td className="px-3 py-2">
                    Серверные, ЦОД, архивы, музеи — где вода недопустима
                  </td>
                  <td className="px-3 py-2">4 500 – 6 500</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-red-300">
                    Аэрозольная
                  </td>
                  <td className="px-3 py-2">Твёрдый аэрозоль (МАГ)</td>
                  <td className="px-3 py-2">
                    Электрощитовые, КТП, малые помещения с электрооборудованием
                  </td>
                  <td className="px-3 py-2">2 800 – 4 200</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Параметры расчёта */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">
            2. Параметры расчёта АУПТ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <h3 className="font-semibold text-red-300 mb-3">
                Интенсивность орошения
              </h3>
              <p className="text-sm text-slate-300 mb-3">
                По СП РК 5.01-101 интенсивность подачи воды зависит от группы
                помещений по НПБ (1–7):
              </p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Группа 1 (офисы): <strong>0.08 л/(с·м²)</strong></li>
                <li>• Группа 2 (торговля горючими товарами): <strong>0.12 л/(с·м²)</strong></li>
                <li>• Группа 3 (склады, магазины): <strong>0.16 л/(с·м²)</strong></li>
                <li>• Группа 4 (производство): <strong>0.24 л/(с·м²)</strong></li>
                <li>• Группа 5–7: <strong>0.30 л/(с·м²)</strong></li>
              </ul>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <h3 className="font-semibold text-red-300 mb-3">
                Расход воды и диаметры
              </h3>
              <ul className="text-sm text-slate-300 space-y-2">
                <li>
                  <strong className="text-orange-300">Расход воды:</strong> 5 –
                  110 л/с (зависит от площади и группы)
                </li>
                <li>
                  <strong className="text-orange-300">Диаметр стояков:</strong>{" "}
                  32 – 200 мм (от Ø32 для одиночных секций до Ø200 для магистрали)
                </li>
                <li>
                  <strong className="text-orange-300">Площадь орошения:</strong>{" "}
                  9 – 12 м² на 1 спринклер (для группы 1–3)
                </li>
                <li>
                  <strong className="text-orange-300">Время работы:</strong> 30 –
                  60 минут (по группе помещений)
                </li>
                <li>
                  <strong className="text-orange-300">Запас воды:</strong> 9 – 396
                  м³ в резервуаре
                </li>
              </ul>
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
            <h3 className="font-semibold text-red-300 mb-3">
              Упражнение 1. Группа помещений по НПБ
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Торговый зал 1 500 м² с горючими товарами (бытовая техника,
              текстиль, мебель). К какой группе помещений по НПБ его отнести
              для расчёта интенсивности орошения?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { v: "a", t: "Группа 1 — офисы и общественные здания" },
                { v: "b", t: "Группа 2 — торговля горючими товарами" },
                { v: "c", t: "Группа 3 — склады и базы хранения" },
                { v: "d", t: "Группа 4 — производственные цеха" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex items-start gap-2 cursor-pointer text-sm text-slate-300 hover:text-slate-100"
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={(e) => setEx1(e.target.value)}
                    className="mt-1"
                  />
                  <span>{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setEx1Result(ex1 === "b")}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Show(!ex1Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
              >
                {ex1Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex1Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex1Result
                    ? "bg-green-900/40 text-green-300 border border-green-800"
                    : "bg-red-900/40 text-red-300 border border-red-800"
                }`}
              >
                {ex1Result
                  ? "✓ Верно! Торговля горючими товарами — группа 2."
                  : "✗ Неверно. Подсказка: горючие товары → группа 2."}
              </div>
            )}
            {ex1Show && (
              <div className="mt-3 text-sm bg-slate-950 border border-slate-800 rounded p-4 text-slate-300">
                <p className="font-semibold text-orange-400 mb-2">Решение:</p>
                <p>
                  По СП РК 5.01-101 классификация помещений по группам опасности
                  пожара для расчёта АУПТ:
                </p>
                <ul className="mt-2 space-y-1">
                  <li>• Группа 1 — офисы, гостиницы (низкая горючая нагрузка)</li>
                  <li>
                    • <strong>Группа 2 — торговые залы с горючими товарами</strong>{" "}
                    (текстиль, мебель, бытовая техника, обувь) — наш случай
                  </li>
                  <li>• Группа 3 — склады, базы оптовой торговли</li>
                  <li>• Группа 4–7 — производственные помещения</li>
                </ul>
                <p className="mt-2 text-orange-300">
                  Для группы 2: интенсивность 0.12 л/(с·м²), площадь орошения 1
                  спринклера до 12 м², время работы 60 минут.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-red-300 mb-3">
              Упражнение 2. Количество спринклеров
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Торговый зал 1 500 м² (группа 2). По СП РК норма размещения — 1
              спринклер на 12 м² защищаемой площади. Сколько штук спринклерных
              оросителей нужно заложить в смету? (ответ ±15%)
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex2}
                onChange={(e) => setEx2(e.target.value)}
                placeholder="штук"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm w-32"
              />
              <button
                onClick={() => checkNumeric(ex2, 125, 0.15, setEx2Result)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Show(!ex2Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
              >
                {ex2Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex2Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex2Result
                    ? "bg-green-900/40 text-green-300 border border-green-800"
                    : "bg-red-900/40 text-red-300 border border-red-800"
                }`}
              >
                {ex2Result
                  ? "✓ Верно (в пределах ±15%)! Около 125 спринклеров."
                  : "✗ Неверно. Подсказка: 1 500 ÷ 12."}
              </div>
            )}
            {ex2Show && (
              <div className="mt-3 text-sm bg-slate-950 border border-slate-800 rounded p-4 text-slate-300">
                <p className="font-semibold text-orange-400 mb-2">Решение:</p>
                <p>Формула: N = S / Sор</p>
                <ul className="mt-2 space-y-1">
                  <li>• S = 1 500 м² (площадь торгового зала)</li>
                  <li>
                    • Sор = 12 м² (площадь орошения 1 спринклера для группы 2 по
                    СП РК)
                  </li>
                  <li>
                    • <strong>N = 1 500 / 12 = 125 шт</strong>
                  </li>
                </ul>
                <p className="mt-2 text-orange-300">
                  В смету закладываем 125 спринклеров СВН-12 (Ø1/2&quot;,
                  температура срабатывания 68°C, K = 80) + 5–10% запас на
                  труднодоступные зоны и колонны.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-red-300 mb-3">
              Упражнение 3. Расход воды дренчерной завесы
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Дренчерная водяная завеса для проёма шириной 12 м (между
              торговым залом и эвакуационным коридором). Нормативная
              интенсивность подачи воды — 0.5 л/(с·м) на длину завесы. Какой
              расход воды нужно обеспечить? (ответ ±15%)
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                placeholder="л/с"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm w-32"
              />
              <button
                onClick={() => checkNumeric(ex3, 6, 0.15, setEx3Result)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Show(!ex3Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
              >
                {ex3Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex3Result
                    ? "bg-green-900/40 text-green-300 border border-green-800"
                    : "bg-red-900/40 text-red-300 border border-red-800"
                }`}
              >
                {ex3Result
                  ? "✓ Верно! Расход 6 л/с."
                  : "✗ Неверно. Подсказка: 0.5 × 12."}
              </div>
            )}
            {ex3Show && (
              <div className="mt-3 text-sm bg-slate-950 border border-slate-800 rounded p-4 text-slate-300">
                <p className="font-semibold text-orange-400 mb-2">Решение:</p>
                <p>Формула: Q = i × L</p>
                <ul className="mt-2 space-y-1">
                  <li>• i = 0.5 л/(с·м) (нормативная интенсивность завесы)</li>
                  <li>• L = 12 м (ширина проёма)</li>
                  <li>
                    • <strong>Q = 0.5 × 12 = 6 л/с</strong>
                  </li>
                </ul>
                <p className="mt-2 text-orange-300">
                  При шаге дренчеров 0.5 м между соплами на 12 м потребуется
                  ~25 шт оросителей ДВВ-12. Диаметр стояка — Ø80 мм. Запас воды
                  на 1 час работы: 6 × 3600 = 21 600 л = 21.6 м³.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-red-300 mb-3">
              Упражнение 4. Стоимость спринклерной системы
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Рассчитать стоимость спринклерной АУПТ для торгового зала 1 500
              м²: 125 спринклеров (3 200 тг/шт), 800 м труб Ø50–100 (1 800
              тг/м), насосная станция (1 200 000 тг), узел управления (450 000
              тг), монтаж (35% от материалов). Ответ в тг ±15%.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex4}
                onChange={(e) => setEx4(e.target.value)}
                placeholder="тг"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm w-40"
              />
              <button
                onClick={() => checkNumeric(ex4, 5800000, 0.15, setEx4Result)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Show(!ex4Show)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
              >
                {ex4Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex4Result !== null && (
              <div
                className={`text-sm p-3 rounded ${
                  ex4Result
                    ? "bg-green-900/40 text-green-300 border border-green-800"
                    : "bg-red-900/40 text-red-300 border border-red-800"
                }`}
              >
                {ex4Result
                  ? "✓ Верно (в пределах ±15%)! Около 5 800 000 тг."
                  : "✗ Неверно. Подсказка: материалы + монтаж."}
              </div>
            )}
            {ex4Show && (
              <div className="mt-3 text-sm bg-slate-950 border border-slate-800 rounded p-4 text-slate-300">
                <p className="font-semibold text-orange-400 mb-2">Решение:</p>
                <ul className="space-y-1">
                  <li>• Спринклеры: 125 × 3 200 = 400 000 тг</li>
                  <li>• Трубы Ø50–100: 800 × 1 800 = 1 440 000 тг</li>
                  <li>• Насосная станция: 1 200 000 тг</li>
                  <li>• Узел управления (КСС): 450 000 тг</li>
                  <li>
                    • <strong>Материалы итого:</strong> 3 490 000 тг
                  </li>
                  <li>
                    • Монтаж 35%: 3 490 000 × 0.35 ≈ 1 220 000 тг
                  </li>
                  <li>
                    • <strong>ИТОГО ≈ 4 710 000 тг</strong> + ПИР, индексация
                    и НДС → итог ≈ <strong>5 800 000 тг</strong>
                  </li>
                </ul>
                <p className="mt-2 text-orange-300">
                  В пересчёте на м²: 5 800 000 / 1 500 = 3 870 тг/м² — попадает
                  в средний диапазон 1 800 – 6 500 тг/м² для спринклерной
                  системы торгового центра.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">
            4. Применяемые расценки ЭСН
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <ul className="text-sm text-slate-300 space-y-2">
              <li>
                <strong className="text-red-300">Сб. 20-7</strong> — Установки
                автоматического пожаротушения (спринклеры, дренчеры, узлы
                управления, монтаж)
              </li>
              <li>
                <strong className="text-red-300">Сб. 16</strong> — Трубопроводы
                внутренние (стальные/оцинкованные Ø32–200 мм для разводки АУПТ)
              </li>
              <li>
                <strong className="text-red-300">Сб. 18</strong> — Насосные
                станции и арматура (пожарные насосы, обратные клапаны,
                задвижки, КИПиА)
              </li>
              <li>
                <strong className="text-red-300">Сб. 8</strong> — Электромонтаж
                (питание насосов, соединение с пожарной сигнализацией, ППКОП)
              </li>
              <li>
                <strong className="text-red-300">Сб. 10</strong> —
                Пусконаладочные работы (гидравлические испытания, проливка
                трубопроводов, приёмо-сдаточные)
              </li>
            </ul>
          </div>
        </section>

        {/* Red factoid */}
        <div className="bg-red-950/40 border border-red-800 rounded-lg p-5 mb-8">
          <p className="text-sm text-red-200 leading-relaxed">
            <strong className="text-red-300">⚠ Важно для сметчика:</strong>{" "}
            После монтажа АУПТ принимается комиссией ДЧС РК с обязательной
            приёмкой ВПП (ведомость пусконаладочных проверок), гидравлическими
            испытаниями на пробное давление 1.25 × Pраб, контролем работы
            оросителей и проверкой времени срабатывания (не более 180 секунд
            от вскрытия теплозамка до подачи воды). После сдачи проводится
            <strong> регламентное ТО 1 раз в год</strong> с проверкой
            работоспособности насосов, замером давления, проверкой узлов
            управления — это отдельная статья эксплуатационного бюджета
            заказчика, не входит в смету СМР.
          </p>
        </div>
      </div>
    </div>
  );
}
