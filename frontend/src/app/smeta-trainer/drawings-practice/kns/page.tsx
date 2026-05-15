"use client";

import Link from "next/link";
import { useState } from "react";

type Ex1State = { value: string; checked: boolean; correct: boolean };
type Ex4Choice = "a" | "b" | "c" | "d" | null;

export default function KnsPage() {
  const [ex1, setEx1] = useState<Ex1State>({ value: "", checked: false, correct: false });
  const [ex2, setEx2] = useState<Ex1State>({ value: "", checked: false, correct: false });
  const [ex3, setEx3] = useState<Ex1State>({ value: "", checked: false, correct: false });
  const [ex4, setEx4] = useState<{ choice: Ex4Choice; checked: boolean; correct: boolean }>({
    choice: null,
    checked: false,
    correct: false,
  });

  const checkEx1 = () => {
    const n = parseFloat(ex1.value.replace(",", "."));
    const ok = !isNaN(n) && n >= 1 && n <= 7.5; // 2-5 ±50%
    setEx1({ ...ex1, checked: true, correct: ok });
  };

  const checkEx2 = () => {
    const n = parseFloat(ex2.value.replace(",", "."));
    // 6 млн тг ±15% → 5.1-6.9 млн
    const ok = !isNaN(n) && n >= 5.1 && n <= 6.9;
    setEx2({ ...ex2, checked: true, correct: ok });
  };

  const checkEx3 = () => {
    const n = parseFloat(ex3.value.replace(",", "."));
    // 2.5 ±20% → 2.0-3.0
    const ok = !isNaN(n) && n >= 2.0 && n <= 3.0;
    setEx3({ ...ex3, checked: true, correct: ok });
  };

  const checkEx4 = () => {
    const ok = ex4.choice === "d";
    setEx4({ ...ex4, checked: true, correct: ok });
  };

  const inputCls =
    "w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";
  const btnCls =
    "px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium transition-colors";
  const okCls = "mt-3 px-3 py-2 rounded-md bg-emerald-900/40 border border-emerald-700 text-emerald-200 text-sm";
  const badCls = "mt-3 px-3 py-2 rounded-md bg-rose-900/40 border border-rose-700 text-rose-200 text-sm";

  const types = [
    { type: "Малая КНС-1 (Grundfos)", perf: "до 5 м³/час", use: "Дача, гостиничный домик", price: "850 000 тг" },
    { type: "Средняя КНС-2 (Wilo)", perf: "5-50 м³/час", use: "Жилой 9-эт, гостиница", price: "3 800 000 тг" },
    { type: "Большая КНС-3 (Pedrollo)", perf: "50-500 м³/час", use: "Микрорайон, промзона", price: "8 500 000 тг" },
    { type: "Канализационный модуль (готовая)", perf: "100 м³/час", use: "Бизнес-парк", price: "6 800 000 тг" },
    { type: "Резервуарная КНС (бетон. подземная)", perf: "1000+ м³/час", use: "Городские коллекторы", price: "18-35 млн тг" },
  ];

  const composition = [
    "Резервуар-приёмник (стеклопластик/бетон/нерж.)",
    "Насосы погружные (2 шт обычно — 1 рабочий + 1 резервный)",
    "Решётка-измельчитель (для бытовых стоков)",
    "Поплавковые датчики уровня",
    "Трубопроводы напорные ПНД Ø50-200",
    "Электрический шкаф управления (АТС)",
    "Вентиляция (для отвода газов)",
    "Подогрев (для зимы)",
  ];

  const ex4Options: { key: Exclude<Ex4Choice, null>; label: string }[] = [
    { key: "a", label: "2 насоса (рабочий + резервный)" },
    { key: "b", label: "Резервуар-приёмник" },
    { key: "c", label: "Шкаф управления АТС" },
    { key: "d", label: "Все вышеперечисленное" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          href="/smeta-trainer/drawings-practice/hub"
          className="inline-block mb-6 text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← К разделам
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-slate-100">
          🔄 КНС — канализационные насосные станции
        </h1>

        {/* Intro */}
        <section className="mb-8 p-5 rounded-lg bg-slate-900 border border-slate-800">
          <p className="text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-100">КНС</span> — канализационная насосная станция.
            Применяется когда самотёчная канализация не работает (рельеф, низкое расположение объекта).
            Перекачивает стоки на вышестоящий участок сети.
          </p>
          <p className="mt-2 text-slate-400">
            Стоимость: <span className="font-semibold text-slate-200">1.5–12 млн тг</span>.
          </p>
        </section>

        {/* Norms */}
        <section className="mb-8 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
          <h2 className="text-lg font-semibold mb-3 text-slate-100">📚 Нормативы</h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>СП РК 4.01-43-2007 «Сооружения водоотведения»</li>
            <li>СНиП РК 4.01-41-2006</li>
            <li>СП РК 4.04-21</li>
          </ul>
        </section>

        {/* Section 1: Типы КНС */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-slate-100">1. Типы КНС</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Тип</th>
                  <th className="px-4 py-3 text-left font-semibold">Производительность</th>
                  <th className="px-4 py-3 text-left font-semibold">Применение</th>
                  <th className="px-4 py-3 text-left font-semibold">Цена 2025</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900 text-slate-300">
                {types.map((t, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-medium text-slate-200">{t.type}</td>
                    <td className="px-4 py-3">{t.perf}</td>
                    <td className="px-4 py-3">{t.use}</td>
                    <td className="px-4 py-3 text-slate-100">{t.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Состав */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-slate-100">2. Состав КНС</h2>
          <ul className="grid md:grid-cols-2 gap-2">
            {composition.map((item, i) => (
              <li
                key={i}
                className="px-4 py-3 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
              >
                <span className="text-slate-500 mr-2">•</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3: Упражнения */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-6 text-slate-100">3. Упражнения</h2>

          {/* Ex1 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800">
            <h3 className="text-lg font-semibold mb-2 text-slate-100">
              Упражнение 1. Производительность КНС для жилого 9-эт дома
            </h3>
            <div className="text-sm text-slate-400 space-y-1 mb-4">
              <p>• 36 квартир × 0.5 м³/сут = 18 м³/сут</p>
              <p>• Или ~0.75 м³/час с учётом неравномерности (часовая 2.5 от средней)</p>
              <p>• При коэффициенте часовой неравномерности 2.5: 0.75 × 2.5 = ~2 м³/час</p>
              <p className="text-slate-300">Введите производительность (м³/час). Допуск ±50%.</p>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={ex1.value}
                onChange={(e) => setEx1({ ...ex1, value: e.target.value })}
                placeholder="например, 3"
                className={inputCls}
              />
              <button onClick={checkEx1} className={btnCls}>Проверить</button>
            </div>
            {ex1.checked && (
              <div className={ex1.correct ? okCls : badCls}>
                {ex1.correct
                  ? "✓ Верно! Принимаемая производительность 2–5 м³/час."
                  : "✗ Неверно. Ожидается 2–5 м³/час (допуск ±50%)."}
              </div>
            )}
          </div>

          {/* Ex2 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800">
            <h3 className="text-lg font-semibold mb-2 text-slate-100">
              Упражнение 2. Стоимость КНС для жилого 9-эт
            </h3>
            <div className="text-sm text-slate-400 space-y-1 mb-4">
              <p>• Производительность 5 м³/час → КНС-2 (Wilo) ~3.8 млн тг</p>
              <p>• + Монтаж 25%: 950 000 тг</p>
              <p>• + Электромонтаж: 380 000 тг</p>
              <p>• + Резервуар бетонный или стеклопластик: 850 000 тг</p>
              <p className="text-slate-300">Введите ИТОГО в млн тг. Допуск ±15%.</p>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={ex2.value}
                onChange={(e) => setEx2({ ...ex2, value: e.target.value })}
                placeholder="например, 6"
                className={inputCls}
              />
              <button onClick={checkEx2} className={btnCls}>Проверить</button>
            </div>
            {ex2.checked && (
              <div className={ex2.correct ? okCls : badCls}>
                {ex2.correct
                  ? "✓ Верно! ИТОГО ~6 млн тг."
                  : "✗ Неверно. Ожидается ~6 млн тг (допуск ±15%, диапазон 5.1–6.9)."}
              </div>
            )}
          </div>

          {/* Ex3 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800">
            <h3 className="text-lg font-semibold mb-2 text-slate-100">
              Упражнение 3. Глубина приёмного резервуара
            </h3>
            <div className="text-sm text-slate-400 space-y-1 mb-4">
              <p>• 1.5–2.5 м (для бытовых стоков)</p>
              <p>• + 0.5 м рабочая глубина для насосов</p>
              <p>• ИТОГО глубина шахты: 2.0–3.0 м</p>
              <p className="text-slate-300">Введите среднюю глубину (м). Допуск ±20%.</p>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={ex3.value}
                onChange={(e) => setEx3({ ...ex3, value: e.target.value })}
                placeholder="например, 2.5"
                className={inputCls}
              />
              <button onClick={checkEx3} className={btnCls}>Проверить</button>
            </div>
            {ex3.checked && (
              <div className={ex3.correct ? okCls : badCls}>
                {ex3.correct
                  ? "✓ Верно! Глубина шахты 2.0–3.0 м."
                  : "✗ Неверно. Ожидается ~2.5 м (допуск ±20%, диапазон 2.0–3.0)."}
              </div>
            )}
          </div>

          {/* Ex4 */}
          <div className="mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800">
            <h3 className="text-lg font-semibold mb-3 text-slate-100">
              Упражнение 4. Что включает КНС из таблицы (выбрать ВСЕ верные)
            </h3>
            <div className="space-y-2 mb-4">
              {ex4Options.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 p-3 rounded-md bg-slate-950 border border-slate-800 hover:border-slate-600 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.key}
                    checked={ex4.choice === opt.key}
                    onChange={() => setEx4({ ...ex4, choice: opt.key })}
                    className="accent-slate-500"
                  />
                  <span className="text-slate-200">
                    <span className="font-mono text-slate-400 mr-2">{opt.key})</span>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <button onClick={checkEx4} className={btnCls} disabled={!ex4.choice}>
              Проверить
            </button>
            {ex4.checked && (
              <div className={ex4.correct ? okCls : badCls}>
                {ex4.correct
                  ? "✓ Верно! Правильный ответ — d) Все вышеперечисленное."
                  : "✗ Неверно. Правильный ответ — d) Все вышеперечисленное."}
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="mb-8 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
          <h2 className="text-lg font-semibold mb-3 text-slate-100">💰 Расценки ЭСН</h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>Сб.23 «Сооружения водоотведения»</li>
            <li>Сб.16-04 «Установка задвижек»</li>
            <li>Сб.39 «Электротех.»</li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="mb-12 p-5 rounded-lg bg-slate-800 border border-slate-700">
          <h2 className="text-lg font-semibold mb-2 text-slate-100">🧠 Фактоид</h2>
          <p className="text-slate-300 leading-relaxed">
            КНС обязательна для всех объектов в низменностях (Алматы Восток, северные мегарайоны).
            Без неё — затопления нижних этажей при ливнях.
          </p>
        </section>
      </div>
    </div>
  );
}
