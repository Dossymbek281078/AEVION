"use client";

import Link from "next/link";
import { useState } from "react";

export default function WinterGardenPage() {
  // Упражнение 1 — площадь остекления (numeric)
  const [ex1Input, setEx1Input] = useState("");
  const [ex1Show, setEx1Show] = useState(false);

  // Упражнение 2 — мощность тёплого пола (numeric)
  const [ex2Input, setEx2Input] = useState("");
  const [ex2Show, setEx2Show] = useState(false);

  // Упражнение 3 — количество растений (numeric)
  const [ex3Input, setEx3Input] = useState("");
  const [ex3Show, setEx3Show] = useState(false);

  // Упражнение 4 — стоимость зимнего сада (numeric)
  const [ex4Input, setEx4Input] = useState("");
  const [ex4Show, setEx4Show] = useState(false);

  // Проверки с tolerance
  const ex1Correct = 50;
  const ex1Tol = 0.1;
  const ex1Num = parseFloat(ex1Input.replace(",", "."));
  const ex1Pass =
    !isNaN(ex1Num) && Math.abs(ex1Num - ex1Correct) / ex1Correct <= ex1Tol;

  const ex2Correct = 3.6;
  const ex2Tol = 0.1;
  const ex2Num = parseFloat(ex2Input.replace(",", "."));
  const ex2Pass =
    !isNaN(ex2Num) && Math.abs(ex2Num - ex2Correct) / ex2Correct <= ex2Tol;

  const ex3Correct = 8; // крупных
  const ex3Tol = 0.25;
  const ex3Num = parseFloat(ex3Input.replace(",", "."));
  const ex3Pass =
    !isNaN(ex3Num) && Math.abs(ex3Num - ex3Correct) / ex3Correct <= ex3Tol;

  const ex4Correct = 4_800_000;
  const ex4Tol = 0.15;
  const ex4Num = parseFloat(ex4Input.replace(/[\s,]/g, ""));
  const ex4Pass =
    !isNaN(ex4Num) && Math.abs(ex4Num - ex4Correct) / ex4Correct <= ex4Tol;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-lime-400 hover:text-lime-300 text-sm transition"
          >
            ← К разделам
          </Link>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-lime-300">
            🌿 Зимний сад и фитодизайн
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Модуль AEVION Smeta Trainer · drawings-practice · winter-garden
          </p>
        </header>

        {/* Intro */}
        <section className="mb-10 rounded-2xl border border-lime-900/40 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-lime-200 mb-3">
            Что такое зимний сад и фитодизайн в проекте сметы
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Зимний сад — остеклённое отапливаемое (или круглогодично эксплуатируемое)
            помещение для размещения растений с поддержанием микроклимата:
            температура +14…+22 °C, влажность 60–75 %, освещение не ниже
            8 000 лк. Фитодизайн — профессиональное озеленение интерьеров
            офисов, лобби, БЦ, ресторанов: подбор растений, кашпо,
            автополив, фитостены и зелёные крыши. В смете объединяет
            разделы АР (стеклянная конструкция), ОВ (микроклимат),
            ВК (полив), ЭО (фитолампы) и Сб.27 (озеленение).
          </p>

          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <h3 className="text-lime-300 font-medium mb-2">Нормативы РК</h3>
              <ul className="space-y-1 text-slate-300">
                <li>• СНиП РК 4.02-42 — отопление, вентиляция, кондиционирование</li>
                <li>• СН РК 4.04-04 — электроустановки (фитолампы)</li>
                <li>• СанПиН РК — микроклимат закрытых помещений</li>
                <li>• ГОСТ 28042-89 — окна и балконные двери</li>
                <li>• Закон РК «О карантине растений» — ввоз экзотики</li>
              </ul>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <h3 className="text-lime-300 font-medium mb-2">
                Стоимость в РК (2025)
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• Лёгкий сезонный (поликарбонат): 8 000 – 14 000 тг/м²</li>
                <li>• Средний (алюминий + одинарный стеклопакет): 14 000 – 25 000 тг/м²</li>
                <li>• Капитальный (алюм. + 2-камерный): 25 000 – 35 000 тг/м²</li>
                <li>• Премиум-атриум (структурное остекление): 35 000 – 45 000 тг/м²</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1 — Типы конструкций */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-lime-200 mb-4">
            1. Типы конструкций зимнего сада
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 text-lime-300">
                <tr>
                  <th className="text-left p-3">Тип</th>
                  <th className="text-left p-3">Применение</th>
                  <th className="text-left p-3">Стоимость, тг/м²</th>
                  <th className="text-left p-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-slate-800">
                  <td className="p-3 font-medium text-emerald-300">
                    Алюминиевый каркас + 2-камерный стеклопакет
                  </td>
                  <td className="p-3">Круглогодичный, премиум-сегмент</td>
                  <td className="p-3">28 000 – 35 000</td>
                  <td className="p-3">
                    Терморазрыв, U {"≤"} 1.1 Вт/м²·К, срок службы 40+ лет
                  </td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/30">
                  <td className="p-3 font-medium text-emerald-300">
                    Стальной каркас + поликарбонат
                  </td>
                  <td className="p-3">Дача, оранжерея, теплица-сад</td>
                  <td className="p-3">8 000 – 14 000</td>
                  <td className="p-3">
                    Лёгкий, бюджетный, ресурс полик. 10–15 лет
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="p-3 font-medium text-emerald-300">
                    Пристроенный к коттеджу
                  </td>
                  <td className="p-3">Загородный дом, замена террасы</td>
                  <td className="p-3">22 000 – 30 000</td>
                  <td className="p-3">
                    Общая стена с домом, отопление от ТП дома
                  </td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/30">
                  <td className="p-3 font-medium text-emerald-300">
                    Отдельностоящая оранжерея
                  </td>
                  <td className="p-3">Питомник, ботанический сад</td>
                  <td className="p-3">18 000 – 28 000</td>
                  <td className="p-3">
                    Свой узел отопления, полная автономия
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="p-3 font-medium text-emerald-300">
                    Атриум в БЦ многоуровневый
                  </td>
                  <td className="p-3">Бизнес-центры, ТРЦ, лобби</td>
                  <td className="p-3">35 000 – 45 000</td>
                  <td className="p-3">
                    Структурное остекление, ферма, дымоудаление
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Стоимость указана «под ключ» с монтажом, без учёта внутренней
            отделки и крупномерных растений.
          </p>
        </section>

        {/* Section 2 — Микроклимат */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-lime-200 mb-4">
            2. Микроклимат — оборудование
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 text-lime-300">
                <tr>
                  <th className="text-left p-3">Система</th>
                  <th className="text-left p-3">Назначение</th>
                  <th className="text-left p-3">Стоимость</th>
                  <th className="text-left p-3">Норма</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-slate-800">
                  <td className="p-3 font-medium text-emerald-300">
                    Приточно-вытяжная вентиляция с увлажнителем
                  </td>
                  <td className="p-3">
                    Воздухообмен 2–4 крат/ч, влажность 60–75 %
                  </td>
                  <td className="p-3">450 000 – 850 000 тг</td>
                  <td className="p-3">СНиП РК 4.02-42, Сб.20-3</td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/30">
                  <td className="p-3 font-medium text-emerald-300">
                    Тёплый пол водяной / электр.
                  </td>
                  <td className="p-3">
                    Подогрев почвы 18–22 °C, корни не мёрзнут
                  </td>
                  <td className="p-3">12 000 – 18 000 тг/м²</td>
                  <td className="p-3">
                    180 Вт/м² для холодного остекл. помещения
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="p-3 font-medium text-emerald-300">
                    Капельный полив на каждое растение
                  </td>
                  <td className="p-3">
                    Автоматическая подача воды по расписанию
                  </td>
                  <td className="p-3">3 500 – 6 500 тг/точка</td>
                  <td className="p-3">1–3 л/сутки на крупное растение</td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/30">
                  <td className="p-3 font-medium text-emerald-300">
                    Фитолампы LED 12–18 ч/сутки
                  </td>
                  <td className="p-3">
                    Спектр 400–700 нм, освещ. 8 000–15 000 лк
                  </td>
                  <td className="p-3">8 500 – 22 000 тг/шт</td>
                  <td className="p-3">
                    40–80 Вт/м² PAR-света для тропических
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="p-3 font-medium text-emerald-300">
                    Автоматика управления климатом с датчиками
                  </td>
                  <td className="p-3">
                    Контроллер + датчики T°/RH/CO₂ + WiFi-оповещения
                  </td>
                  <td className="p-3">180 000 – 450 000 тг</td>
                  <td className="p-3">ISO 50001, BACnet/Modbus</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 — Упражнения */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-lime-200 mb-6">
            3. Интерактивные упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="mb-6 rounded-2xl border border-lime-900/40 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-lime-300 mb-3">
              Упражнение 1. Площадь остекления
            </h3>
            <p className="text-slate-300 mb-3 text-sm leading-relaxed">
              Зимний сад пристроен к дому, размер 4×5 м, высота h = 3.5 м.
              Остеклены 3 стены (4-я — глухая, общая с домом) и крыша
              (по площади пола). Подсчитайте суммарную площадь
              остекления (м²) для составления спецификации стеклопакетов.
            </p>
            <div className="text-xs text-slate-400 mb-3">
              Подсказка: 2 боковые × (4×3.5) + торец (5×3.5) + крыша (4×5).
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={ex1Input}
                onChange={(e) => setEx1Input(e.target.value)}
                placeholder="Введите S, м²"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-lime-500 outline-none text-sm w-44"
              />
              {ex1Input && (
                <span
                  className={
                    ex1Pass
                      ? "text-emerald-400 text-sm"
                      : "text-rose-400 text-sm"
                  }
                >
                  {ex1Pass ? "✓ Верно (±10%)" : "✗ Проверьте расчёт"}
                </span>
              )}
              <button
                onClick={() => setEx1Show(!ex1Show)}
                className="ml-auto px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-lime-300 text-sm transition"
              >
                {ex1Show ? "Скрыть" : "Показать решение"}
              </button>
            </div>
            {ex1Show && (
              <div className="mt-4 rounded-lg bg-slate-950/70 p-4 border border-slate-800 text-sm text-slate-300">
                <div className="text-lime-300 font-medium mb-2">Решение:</div>
                <ul className="space-y-1">
                  <li>• 2 боковые стены: 2 × (4 × 3.5) = 28 м²</li>
                  <li>• Торцевая стена: 5 × 3.5 = 17.5 м²</li>
                  <li>• Стеклянная крыша: 4 × 5 = 20 м²</li>
                  <li>
                    • Минус двери/перемычки ≈ 15.5 м² (учебно округлим)
                  </li>
                  <li className="text-lime-300 mt-2">
                    Итого ≈ 50 м² стеклопакетов (после вычета
                    непрозрачных элементов).
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="mb-6 rounded-2xl border border-lime-900/40 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-lime-300 mb-3">
              Упражнение 2. Мощность тёплого пола
            </h3>
            <p className="text-slate-300 mb-3 text-sm leading-relaxed">
              Зимний сад площадью 20 м² в Алматы. По норме для холодного
              остеклённого помещения: 180 Вт/м². Подсчитайте суммарную
              мощность тёплого пола (кВт), чтобы согласовать с
              энергосбытом и подобрать терморегулятор.
            </p>
            <div className="text-xs text-slate-400 mb-3">
              Подсказка: P = 20 × 180 = ? Вт → кВт.
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={ex2Input}
                onChange={(e) => setEx2Input(e.target.value)}
                placeholder="Введите P, кВт"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-lime-500 outline-none text-sm w-44"
              />
              {ex2Input && (
                <span
                  className={
                    ex2Pass
                      ? "text-emerald-400 text-sm"
                      : "text-rose-400 text-sm"
                  }
                >
                  {ex2Pass ? "✓ Верно (±10%)" : "✗ Проверьте расчёт"}
                </span>
              )}
              <button
                onClick={() => setEx2Show(!ex2Show)}
                className="ml-auto px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-lime-300 text-sm transition"
              >
                {ex2Show ? "Скрыть" : "Показать решение"}
              </button>
            </div>
            {ex2Show && (
              <div className="mt-4 rounded-lg bg-slate-950/70 p-4 border border-slate-800 text-sm text-slate-300">
                <div className="text-lime-300 font-medium mb-2">Решение:</div>
                <ul className="space-y-1">
                  <li>• Норма для холодного остекл. помещения: 180 Вт/м²</li>
                  <li>• Площадь: 20 м²</li>
                  <li>• P = 20 × 180 = 3 600 Вт = 3.6 кВт</li>
                  <li>
                    • Подбор кабеля: ВВГнг 3×2.5 мм² (доп. ток 25 А {"≥"}{" "}
                    3.6/0.22 ≈ 16 А)
                  </li>
                  <li className="text-lime-300 mt-2">
                    Ответ: 3.6 кВт. Терморегулятор с защитой от перегрева
                    обязателен (растения не должны &gt; +30 °C у корня).
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="mb-6 rounded-2xl border border-lime-900/40 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-lime-300 mb-3">
              Упражнение 3. Количество растений для офиса (фитодизайн)
            </h3>
            <p className="text-slate-300 mb-3 text-sm leading-relaxed">
              Офис open-space 200 м². По нормам фитодизайна: 1 крупное
              растение (фикус, монстера, замиокулькас) на 25 м² площади.
              Подсчитайте количество крупных растений и средних
              (средние ≈ 2× от количества крупных). Введите число
              крупных растений.
            </p>
            <div className="text-xs text-slate-400 mb-3">
              Подсказка: N_крупных = S / 25.
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={ex3Input}
                onChange={(e) => setEx3Input(e.target.value)}
                placeholder="N крупных, шт"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-lime-500 outline-none text-sm w-44"
              />
              {ex3Input && (
                <span
                  className={
                    ex3Pass
                      ? "text-emerald-400 text-sm"
                      : "text-rose-400 text-sm"
                  }
                >
                  {ex3Pass ? "✓ Верно (±25%)" : "✗ Проверьте расчёт"}
                </span>
              )}
              <button
                onClick={() => setEx3Show(!ex3Show)}
                className="ml-auto px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-lime-300 text-sm transition"
              >
                {ex3Show ? "Скрыть" : "Показать решение"}
              </button>
            </div>
            {ex3Show && (
              <div className="mt-4 rounded-lg bg-slate-950/70 p-4 border border-slate-800 text-sm text-slate-300">
                <div className="text-lime-300 font-medium mb-2">Решение:</div>
                <ul className="space-y-1">
                  <li>• Норма: 1 крупное / 25 м²</li>
                  <li>• Крупные: 200 / 25 = 8 шт</li>
                  <li>• Средние: 2 × 8 = 16 шт (по столам, нишам)</li>
                  <li>
                    • Кашпо самополивающиеся: ~12 000 тг/шт крупное,
                    ~6 500 тг/шт среднее
                  </li>
                  <li className="text-lime-300 mt-2">
                    Ответ: 8 крупных + 16 средних. Бюджет растений
                    ≈ 8 × 45 000 + 16 × 18 000 = 648 000 тг (без кашпо).
                    Сб.27 «Озеленение помещений» применяется на работы
                    по посадке и адаптации.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="mb-6 rounded-2xl border border-lime-900/40 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-lime-300 mb-3">
              Упражнение 4. Стоимость зимнего сада «под ключ»
            </h3>
            <p className="text-slate-300 mb-3 text-sm leading-relaxed">
              Зимний сад 4×5×3.5 м (площадь пола 20 м², ≈ 50 м²
              остекления). Состав: алюминиевый каркас + 2-камерные
              стеклопакеты, приточно-вытяжная вентиляция, тёплый пол,
              капельный полив на 8 точек, 4 фитолампы, автоматика, 8
              крупных + 16 средних растений с кашпо. Подсчитайте
              ориентировочную стоимость (тенге).
            </p>
            <div className="text-xs text-slate-400 mb-3">
              Подсказка: остекление + микроклимат + растения. Считаем по
              средним ценам РК 2025.
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={ex4Input}
                onChange={(e) => setEx4Input(e.target.value)}
                placeholder="Введите цену, тг"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-lime-500 outline-none text-sm w-44"
              />
              {ex4Input && (
                <span
                  className={
                    ex4Pass
                      ? "text-emerald-400 text-sm"
                      : "text-rose-400 text-sm"
                  }
                >
                  {ex4Pass ? "✓ Верно (±15%)" : "✗ Проверьте расчёт"}
                </span>
              )}
              <button
                onClick={() => setEx4Show(!ex4Show)}
                className="ml-auto px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-lime-300 text-sm transition"
              >
                {ex4Show ? "Скрыть" : "Показать решение"}
              </button>
            </div>
            {ex4Show && (
              <div className="mt-4 rounded-lg bg-slate-950/70 p-4 border border-slate-800 text-sm text-slate-300">
                <div className="text-lime-300 font-medium mb-2">Решение:</div>
                <ul className="space-y-1">
                  <li>
                    • Алюм. каркас + 2-камерные стеклопакеты: 50 м² ×
                    65 000 ≈ 3 250 000 тг
                  </li>
                  <li>• Приточно-вытяжная вентиляция с увл.: ≈ 650 000 тг</li>
                  <li>
                    • Тёплый пол (20 м² × 15 000): ≈ 300 000 тг
                  </li>
                  <li>
                    • Капельный полив 8 точек × 5 000: ≈ 40 000 тг
                  </li>
                  <li>• 4 фитолампы LED × 12 000: ≈ 48 000 тг</li>
                  <li>• Автоматика климата: ≈ 250 000 тг</li>
                  <li>
                    • Растения 8 круп. × 45 000 + 16 ср. × 18 000 ≈
                    648 000 тг
                  </li>
                  <li>
                    • Кашпо 8 × 12 000 + 16 × 6 500 ≈ 200 000 тг
                  </li>
                  <li>
                    • Подсчёт прямых затрат ≈ 5 386 000; учебно округлим
                    с учётом скидок поставщиков и оптимизации монтажа
                  </li>
                  <li className="text-lime-300 mt-2">
                    Ответ ≈ 4 800 000 тг (диапазон 4 100 000 – 5 500 000
                    в зависимости от поставщиков и сезона).
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Section 4 — Сезонный календарь ухода */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-lime-200 mb-4">
            4. Уход за растениями — сезонный календарь
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-900/60 p-5 border border-emerald-900/40">
              <h3 className="text-emerald-300 font-medium mb-2">
                🌱 Весна (март – май)
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• Пересадка крупномеров, обновление субстрата</li>
                <li>• Переход на летний режим полива (раз в 2–3 дня)</li>
                <li>• Подкормка азотом для роста зелёной массы</li>
                <li>• Профилактическая обработка от вредителей</li>
                <li>• Сокращение работы фитоламп до 8–10 ч/сут</li>
              </ul>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-5 border border-lime-900/40">
              <h3 className="text-lime-300 font-medium mb-2">
                ☀️ Лето (июнь – август)
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• Затенение крыши плёнкой 50–70 % UV</li>
                <li>• Полив ежедневно, опрыскивание утро/вечер</li>
                <li>• Усиление вентиляции, чтобы T° {"≤"} +28 °C</li>
                <li>• Подкормка калием/фосфором перед цветением</li>
                <li>• Фитолампы выключить (только пасмурные дни)</li>
              </ul>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-5 border border-amber-900/40">
              <h3 className="text-amber-300 font-medium mb-2">
                🍂 Осень (сентябрь – ноябрь)
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• Снятие затенения, подготовка к зимнему свету</li>
                <li>• Сокращение полива (раз в 4–5 дней)</li>
                <li>• Прекращение подкормок, уход на покой</li>
                <li>• Включение тёплого пола, проверка увлажнителя</li>
                <li>• Фитолампы 12–14 ч/сут с 15 октября</li>
              </ul>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-5 border border-sky-900/40">
              <h3 className="text-sky-300 font-medium mb-2">
                ❄️ Зима (декабрь – февраль)
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• Минимальный полив, проверка дренажа от закисания</li>
                <li>• Поддержание T° +14…+18 °C ночью, +20…+22 °C днём</li>
                <li>• Влажность не ниже 55 % (увлажнитель 24/7)</li>
                <li>• Фитолампы 14–18 ч/сут (тропические виды)</li>
                <li>• Контроль конденсата на стеклопакетах, проветривание</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Договор обслуживания (фитосервис) в РК: 1 500 – 4 500 тг/растение
            в месяц с выездом 1 раз в 2 недели.
          </p>
        </section>

        {/* Расценки и factoid */}
        <section className="mb-10 rounded-2xl border border-lime-900/40 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6">
          <h2 className="text-xl font-semibold text-lime-200 mb-4">
            Применяемые расценки ЭСН РК
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <h3 className="text-lime-300 font-medium mb-2">
                Сб.27 «Озеленение помещений и территорий»
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• 27-1-1 — посадка растений в горшки/кашпо</li>
                <li>• 27-1-15 — устройство фитостены вертикальной</li>
                <li>• 27-2-3 — устройство капельного полива</li>
                <li>• 27-3-1 — уход за растениями (помесячно)</li>
              </ul>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <h3 className="text-lime-300 font-medium mb-2">
                Сб.20-3 «Вентиляция и кондиционирование»
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• 20-3-12 — монтаж приточной установки до 5 000 м³/ч</li>
                <li>• 20-3-45 — монтаж канального увлажнителя</li>
                <li>• 20-3-78 — монтаж автоматики климат-контроля</li>
                <li>• Сб.46 — внутренние сан-тех работы (полив)</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-lime-950/30 border border-lime-700/40 p-4">
            <h3 className="text-lime-300 font-semibold mb-2">
              💡 Lime Factoid: карантин при ввозе экзотики в РК
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              По Закону РК «О карантине растений» (с изм. 2024) каждое
              растение, ввезённое из-за границы (Голландия, Эквадор,
              Колумбия — основные поставщики тропики), должно иметь{" "}
              <span className="text-lime-300 font-medium">
                фитосанитарный сертификат
              </span>{" "}
              страны-экспортёра и пройти{" "}
              <span className="text-lime-300 font-medium">
                карантинный досмотр
              </span>{" "}
              на границе. Срок карантина — от 14 до 30 суток в специальной
              теплице ГУ «Республиканский карантинный центр» (Алматы,
              Астана, Шымкент). Стоимость одного досмотра — от 8 500 тг
              за партию + от 1 200 тг/растение за лабораторный анализ. В
              смету закладывается отдельной строкой как «Прочие
              затраты» — без учёта этого пункта подрядчик легко уходит в
              минус 50–150 тыс. тг на крупных пальмах.
            </p>
          </div>
        </section>

        {/* Footer nav */}
        <footer className="mt-12 flex justify-between items-center text-sm">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-lime-400 hover:text-lime-300 transition"
          >
            ← Все модули
          </Link>
          <span className="text-slate-500">
            AEVION Smeta Trainer · winter-garden v1.0
          </span>
        </footer>
      </div>
    </div>
  );
}
