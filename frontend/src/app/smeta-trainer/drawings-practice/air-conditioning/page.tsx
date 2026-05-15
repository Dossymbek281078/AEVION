"use client";

import Link from "next/link";
import { useState } from "react";

export default function AirConditioningPage() {
  // Упражнение 1: подбор мощности сплита (multiple choice)
  const [ex1Choice, setEx1Choice] = useState<string>("");
  const [ex1Show, setEx1Show] = useState(false);

  // Упражнение 2: длина медной трассы
  const [ex2Input, setEx2Input] = useState("");
  const [ex2Show, setEx2Show] = useState(false);

  // Упражнение 3: стоимость монтажа 3 сплитов
  const [ex3Input, setEx3Input] = useState("");
  const [ex3Show, setEx3Show] = useState(false);

  // Упражнение 4: подбор VRF
  const [ex4Input, setEx4Input] = useState("");
  const [ex4Show, setEx4Show] = useState(false);

  const checkNumeric = (value: string, target: number, tol: number) => {
    const v = parseFloat(value.replace(",", "."));
    if (isNaN(v)) return null;
    const diff = Math.abs(v - target) / target;
    return diff <= tol;
  };

  const ex2Result = ex2Input ? checkNumeric(ex2Input, 12, 0.1) : null;
  const ex3Result = ex3Input ? checkNumeric(ex3Input, 525000, 0.1) : null;
  const ex4Result = ex4Input ? checkNumeric(ex4Input, 110, 0.15) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 border-b border-cyan-900/40 pb-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            ← К разделам
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-3 text-cyan-100">
            ❄️ Кондиционирование — сплит, мульти-сплит, VRF, чиллер
          </h1>
        </header>

        {/* Intro */}
        <section className="mb-10 bg-slate-900/60 border border-cyan-900/40 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            Что это и зачем
          </h2>
          <p className="text-slate-300 leading-relaxed mb-3">
            Системы кондиционирования воздуха обеспечивают охлаждение,
            фильтрацию и контроль влажности в помещениях. В сметной практике РК
            учитывается монтаж внутренних/наружных блоков, прокладка медных
            трасс с теплоизоляцией, дренажная система, электропитание и
            автоматика.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-950/60 rounded-lg p-4 border border-cyan-900/30">
              <h3 className="text-cyan-400 font-semibold text-sm mb-2">
                Нормативная база РК
              </h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• СНиП РК 4.02-42-2006 — отопление, вентиляция, кондиц.</li>
                <li>• СП РК 4.02-101 — проектирование систем</li>
                <li>• СН РК 4.02-01-2011 — нормы микроклимата</li>
                <li>• СТ РК ISO 5151 — испытания неканальных кондиционеров</li>
              </ul>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-4 border border-teal-900/30">
              <h3 className="text-teal-400 font-semibold text-sm mb-2">
                Стоимость 2025
              </h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Жильё: 8 000 – 35 000 тг/м²</li>
                <li>• Офис: 12 000 – 60 000 тг/м²</li>
                <li>• Цены включают оборудование + монтаж + ПНР</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1 — Типы систем */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            1. Типы систем кондиционирования
          </h2>
          <div className="overflow-x-auto bg-slate-900/60 border border-cyan-900/40 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-cyan-400 border-b border-cyan-900/40">
                <tr>
                  <th className="px-4 py-3 text-left">Тип системы</th>
                  <th className="px-4 py-3 text-left">Применение</th>
                  <th className="px-4 py-3 text-right">Цена 2025, тг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="px-4 py-3 text-slate-200">Одиночный сплит 9–24K BTU</td>
                  <td className="px-4 py-3 text-slate-400">Комната 15–60 м²</td>
                  <td className="px-4 py-3 text-right text-teal-300">120 000 – 380 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-200">Мульти-сплит 2:1</td>
                  <td className="px-4 py-3 text-slate-400">2 комнаты, 1 наружн. блок</td>
                  <td className="px-4 py-3 text-right text-teal-300">420 000 – 720 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-200">Мульти-сплит 5:1</td>
                  <td className="px-4 py-3 text-slate-400">Квартира 3–5 комнат</td>
                  <td className="px-4 py-3 text-right text-teal-300">1 100 000 – 2 200 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-200">VRF mini (до 30 кВт)</td>
                  <td className="px-4 py-3 text-slate-400">Малый офис, коттедж</td>
                  <td className="px-4 py-3 text-right text-teal-300">2 800 000 – 5 500 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-200">VRF полный (50–150 кВт)</td>
                  <td className="px-4 py-3 text-slate-400">БЦ, отель, торг. центр</td>
                  <td className="px-4 py-3 text-right text-teal-300">8 000 000 – 38 000 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-200">Чиллер + фанкойлы</td>
                  <td className="px-4 py-3 text-slate-400">Здания &gt; 200 кВт холода</td>
                  <td className="px-4 py-3 text-right text-teal-300">25 000 000 – 180 000 000</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Диапазоны указаны без учёта проектирования и пуско-наладки сложных
            систем. На VRF/чиллер ПНР занимает 8–15% стоимости оборудования.
          </p>
        </section>

        {/* Section 2 — Расчёт мощности */}
        <section className="mb-10 bg-slate-900/60 border border-teal-900/40 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-teal-300 mb-4">
            2. Расчёт мощности и трасс
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-cyan-400 font-semibold mb-2">Базовая формула</h3>
              <div className="bg-slate-950 rounded-lg p-4 font-mono text-cyan-200 text-center text-lg">
                Q = (V × 35) / 1000 [кВт]
              </div>
              <p className="text-sm text-slate-400 mt-2">
                где V — объём помещения, м³ (площадь × высота). Коэффициент 35
                Вт/м³ — для жилых помещений с 1 окном и 1 жильцом.
              </p>
              <h3 className="text-cyan-400 font-semibold mt-5 mb-2">
                Коэффициенты по сторонам света
              </h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Север (С): <span className="text-teal-300">×0.9</span></li>
                <li>• Юг (Ю): <span className="text-teal-300">×1.3</span></li>
                <li>• Запад / Восток (З/В): <span className="text-teal-300">×1.1</span></li>
              </ul>
            </div>
            <div>
              <h3 className="text-cyan-400 font-semibold mb-2">
                Материалы наружного блока
              </h3>
              <ul className="text-sm text-slate-300 space-y-2">
                <li>• Медная труба <b className="text-teal-300">1/4"</b> — жидкостная линия</li>
                <li>• Медная труба <b className="text-teal-300">3/8"</b> — газовая средняя</li>
                <li>• Медная труба <b className="text-teal-300">5/8"</b> — газовая мощная (от 18K BTU)</li>
                <li>• Теплоизоляция K-Flex / Energoflex 9 мм</li>
                <li>• Дренаж ПВХ Ø16 мм с уклоном 1–3%</li>
                <li>• Кабель ПВС 4×1.5 мм² (межблочный)</li>
              </ul>
              <p className="text-xs text-slate-500 mt-3">
                Запас по длине трассы при расчёте: <b>+15…20%</b> от прямой
                геометрической длины — на повороты, петли и компенсацию.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 — Упражнения */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-cyan-300 mb-6">
            3. Интерактивные упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="bg-slate-900/60 border border-cyan-900/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              Упражнение 1. Подбор мощности сплита
            </h3>
            <p className="text-slate-300 mb-4">
              Гостиная 28 м² с h = 2.7 м, окна выходят на юг. Какую мощность
              сплита подобрать?
            </p>
            <div className="grid md:grid-cols-2 gap-2 mb-4">
              {[
                { id: "a", label: "a) 7K BTU/час (~2.0 кВт)" },
                { id: "b", label: "b) 9K BTU/час (~2.6 кВт)" },
                { id: "c", label: "c) 12K BTU/час (~3.5 кВт)" },
                { id: "d", label: "d) 18K BTU/час (~5.3 кВт)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setEx1Choice(opt.id)}
                  className={`text-left px-4 py-2 rounded-lg border transition ${
                    ex1Choice === opt.id
                      ? opt.id === "c"
                        ? "bg-teal-900/50 border-teal-500 text-teal-100"
                        : "bg-rose-900/40 border-rose-600 text-rose-100"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:border-cyan-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {ex1Choice && (
              <div
                className={`text-sm mb-3 ${
                  ex1Choice === "c" ? "text-teal-300" : "text-rose-300"
                }`}
              >
                {ex1Choice === "c"
                  ? "✓ Верно! 12K BTU/час полностью покрывает нагрузку."
                  : "✗ Неверно. Попробуйте пересчитать с коэффициентом юга."}
              </div>
            )}
            <button
              onClick={() => setEx1Show(!ex1Show)}
              className="text-cyan-400 hover:text-cyan-300 text-sm underline"
            >
              {ex1Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex1Show && (
              <div className="mt-3 bg-slate-950/70 border border-cyan-900/40 rounded-lg p-4 text-sm text-slate-300 space-y-1">
                <div>1. Объём: V = 28 × 2.7 = <b>75.6 м³</b></div>
                <div>2. Базовая мощность: Q = 75.6 × 35 / 1000 = <b>2.65 кВт</b></div>
                <div>3. Юг: 2.65 × 1.3 = <b>3.4 кВт</b></div>
                <div>4. 1 кВт ≈ 3.41 K BTU/час → 3.4 × 3.41 ≈ <b>11.6 K BTU</b></div>
                <div className="text-teal-300 pt-2">
                  ⇒ Ближайшая стандартная модель: <b>12K BTU/час</b> (вариант c).
                </div>
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="bg-slate-900/60 border border-cyan-900/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              Упражнение 2. Длина медной трассы (мульти-сплит 2:1)
            </h3>
            <p className="text-slate-300 mb-4">
              Внутренние блоки расположены на 4 м и 6 м от наружного.
              Рассчитайте суммарную длину трассы с запасом +20%. Ответ в метрах.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex2Input}
                onChange={(e) => setEx2Input(e.target.value)}
                placeholder="м"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
              />
              <button
                onClick={() => setEx2Show(true)}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-white text-sm"
              >
                Проверить
              </button>
            </div>
            {ex2Result !== null && (
              <div
                className={`text-sm mb-3 ${
                  ex2Result ? "text-teal-300" : "text-rose-300"
                }`}
              >
                {ex2Result
                  ? "✓ Верно! 12 м (±10%) — корректный заказ материала."
                  : "✗ Не сходится. Сложите длины блоков и добавьте 20%."}
              </div>
            )}
            <button
              onClick={() => setEx2Show(!ex2Show)}
              className="text-cyan-400 hover:text-cyan-300 text-sm underline"
            >
              {ex2Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex2Show && (
              <div className="mt-3 bg-slate-950/70 border border-cyan-900/40 rounded-lg p-4 text-sm text-slate-300 space-y-1">
                <div>1. Сумма прямых длин: 4 + 6 = <b>10 м</b></div>
                <div>2. Запас: 10 × 1.20 = <b>12 м</b></div>
                <div>3. Заказ меди: 12 м труб × 2 (две магистрали 1/4" + 3/8")</div>
                <div className="text-teal-300 pt-2">⇒ Ответ: <b>12 м</b> на каждую линию.</div>
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="bg-slate-900/60 border border-cyan-900/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              Упражнение 3. Стоимость монтажа 3 сплитов в офисе
            </h3>
            <p className="text-slate-300 mb-4">
              Установка 3 сплитов 12K BTU. Работа: 80 000 тг/блок. Трасса 5 м
              комплектом (медь + изоляция + дренаж + кабель): 95 000 тг/комплект
              × 3. Подсчитайте итоговую стоимость монтажа в тенге.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex3Input}
                onChange={(e) => setEx3Input(e.target.value)}
                placeholder="тенге"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
              />
              <button
                onClick={() => setEx3Show(true)}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-white text-sm"
              >
                Проверить
              </button>
            </div>
            {ex3Result !== null && (
              <div
                className={`text-sm mb-3 ${
                  ex3Result ? "text-teal-300" : "text-rose-300"
                }`}
              >
                {ex3Result
                  ? "✓ Верно! 525 000 тг (±10%) — стандартная смета."
                  : "✗ Перепроверьте: (работа × 3) + (трасса × 3)."}
              </div>
            )}
            <button
              onClick={() => setEx3Show(!ex3Show)}
              className="text-cyan-400 hover:text-cyan-300 text-sm underline"
            >
              {ex3Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex3Show && (
              <div className="mt-3 bg-slate-950/70 border border-cyan-900/40 rounded-lg p-4 text-sm text-slate-300 space-y-1">
                <div>1. Работа: 80 000 × 3 = <b>240 000 тг</b></div>
                <div>2. Трассы: 95 000 × 3 = <b>285 000 тг</b></div>
                <div>3. Итого: 240 000 + 285 000 = <b>525 000 тг</b></div>
                <div className="text-teal-300 pt-2">
                  ⇒ Ответ: <b>525 000 тг</b> (без учёта оборудования).
                </div>
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="bg-slate-900/60 border border-cyan-900/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              Упражнение 4. Подбор VRF для офиса
            </h3>
            <p className="text-slate-300 mb-4">
              Офис 600 м² с 12 кабинетами и шумоизоляцией. Удельная нагрузка по
              СН РК = 0.18 кВт/м². Подберите ближайшую стандартную мощность VRF
              (кВт).
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ex4Input}
                onChange={(e) => setEx4Input(e.target.value)}
                placeholder="кВт"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:border-cyan-500 outline-none"
              />
              <button
                onClick={() => setEx4Show(true)}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-white text-sm"
              >
                Проверить
              </button>
            </div>
            {ex4Result !== null && (
              <div
                className={`text-sm mb-3 ${
                  ex4Result ? "text-teal-300" : "text-rose-300"
                }`}
              >
                {ex4Result
                  ? "✓ Верно! Ближайший стандартный VRF — 110 кВт."
                  : "✗ Перепроверьте: площадь × удельная нагрузка, округлить вверх."}
              </div>
            )}
            <button
              onClick={() => setEx4Show(!ex4Show)}
              className="text-cyan-400 hover:text-cyan-300 text-sm underline"
            >
              {ex4Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex4Show && (
              <div className="mt-3 bg-slate-950/70 border border-cyan-900/40 rounded-lg p-4 text-sm text-slate-300 space-y-1">
                <div>1. Расчётная нагрузка: Q = 600 × 0.18 = <b>108 кВт</b></div>
                <div>2. Стандартный модельный ряд VRF: 90 / 100 / <b>110</b> / 125 кВт</div>
                <div>3. Округляем вверх до ближайшей стандартной мощности</div>
                <div className="text-teal-300 pt-2">
                  ⇒ Ответ: <b>110 кВт</b> (12 внутр. блоков + 1 наружный модуль).
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="mb-10 bg-slate-900/60 border border-cyan-900/40 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            Расценки ЭСН для смет
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 rounded-lg p-4 border border-teal-900/30">
              <h3 className="text-teal-300 font-semibold mb-2">
                Сб. 20-3 — Вентиляция и кондиционирование
              </h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Установка наружного блока сплит-системы</li>
                <li>• Монтаж внутреннего блока (настенный/кассетный/канальный)</li>
                <li>• Прокладка медных трасс с теплоизоляцией</li>
                <li>• Монтаж VRF-системы и магистральных рефнетов</li>
                <li>• Пуско-наладка, вакуумирование, заправка фреоном</li>
              </ul>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-4 border border-cyan-900/30">
              <h3 className="text-cyan-300 font-semibold mb-2">
                Сб. 61 — Электромонтаж дренажей и питания
              </h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Прокладка кабеля питания 3×2.5 / 5×4 мм²</li>
                <li>• Монтаж автомата защиты, УЗО</li>
                <li>• Дренажный насос (для канальных и кассетных)</li>
                <li>• Подключение к щиту управления</li>
                <li>• Заземление наружного блока</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Cyan factoid */}
        <section className="mb-10">
          <div className="bg-gradient-to-r from-cyan-900/40 via-teal-900/40 to-cyan-900/40 border border-cyan-500/40 rounded-xl p-6">
            <h3 className="text-cyan-200 font-bold text-lg mb-2">
              Факт 2025: фреон R-32 → новый стандарт
            </h3>
            <p className="text-slate-200 text-sm leading-relaxed">
              С 2025 года хладагент <b className="text-teal-300">R-32</b>
              {" "}постепенно заменяет <b>R-410A</b> по всему миру: GWP в 3 раза
              ниже (675 против 2088), эффективность выше на 12%, а заправка —
              меньше на 20%. В Республике Казахстан переход на R-32 будет{" "}
              <b className="text-cyan-300">обязательным с 1 января 2027 г.</b>{" "}
              для всех новых установок мощностью до 30 кВт. При составлении смет
              в 2025–2026 закладывайте оборудование на R-32 — это страхует
              объект от санкций и удорожания обслуживания через 1–2 года.
            </p>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-6 border-t border-slate-800">
          AEVION Smeta Trainer • Модуль «Кондиционирование» • Нормативы РК 2025
        </footer>
      </div>
    </div>
  );
}
