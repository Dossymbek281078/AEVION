"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tol = 0.15): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v) || isNaN(expected) || expected === 0) return false;
  return Math.abs((v - expected) / expected) <= tol;
}

interface Detector {
  mark: string;
  type: string;
  area: string;
  use: string;
  price: string;
}

interface SoueRow {
  type: string;
  desc: string;
  cap: string;
  use: string;
  price: string;
}

const DETECTORS: Detector[] = [
  {
    mark: "ИП-212-141",
    type: "Дымовой оптико-электронный",
    area: "1 шт / 70-110 м² (по СП РК — 85 м²)",
    use: "Офисы, школы, торговые залы, коридоры",
    price: "1 800 - 3 200 тг/шт",
  },
  {
    mark: "ИП-101-1А",
    type: "Тепловой максимально-дифференциальный",
    area: "1 шт / 25-30 м²",
    use: "Кухни, котельные, парковки, горячие цеха",
    price: "2 200 - 3 800 тг/шт",
  },
  {
    mark: "ИП-435-4 (RGD-CO)",
    type: "Газовый (CO, метан, пропан)",
    area: "1 шт / 30-50 м²",
    use: "Газовые котельные, парковки, сжиженный газ",
    price: "8 500 - 18 000 тг/шт",
  },
  {
    mark: "ИПР-3СУ (М)",
    type: "Ручной (кнопка-тревога)",
    area: "Каждые 50 м путей эвакуации",
    use: "Коридоры, лестничные клетки, выходы",
    price: "1 200 - 2 800 тг/шт",
  },
  {
    mark: "ИПДЛ-101-Д",
    type: "Линейный дымовой (ИК-луч)",
    area: "Контроль зоны до 100 м (один передатчик)",
    use: "Атриумы, склады, спортзалы с потолком h&gt;6м",
    price: "85 000 - 180 000 тг/комплект",
  },
  {
    mark: "VESDA VLP / Stratos HSSD",
    type: "Аспирационный (всасывает воздух пробами)",
    area: "До 800 м² с разводкой капилляров",
    use: "Серверные, ЦОД, музеи, чистые комнаты",
    price: "650 000 - 1 800 000 тг/комплект",
  },
];

const SOUE_TYPES: SoueRow[] = [
  {
    type: "Тип 1",
    desc: "Звуковой (сирена, тонированный сигнал)",
    cap: "до 200 чел.",
    use: "Малые офисы, СТО, магазины до 500 м²",
    price: "от 250 тг/м²",
  },
  {
    type: "Тип 2",
    desc: "Свето-звуковой (сирена + табло «Выход»)",
    cap: "до 800 чел.",
    use: "Школы, поликлиники, средние офисы",
    price: "450 - 750 тг/м²",
  },
  {
    type: "Тип 3",
    desc: "Речевое оповещение (записанные фразы)",
    cap: "до 1500 чел.",
    use: "Многоэтажные общественные здания, кафе",
    price: "750 - 1 200 тг/м²",
  },
  {
    type: "Тип 4",
    desc: "Направленное речевое + световое (зональное)",
    cap: "до 2500 чел.",
    use: "ТРЦ, гипермаркеты, аэровокзалы, кинотеатры",
    price: "1 200 - 1 800 тг/м²",
  },
  {
    type: "Тип 5",
    desc: "Управляемое (с обратной связью, центр. диспетчер)",
    cap: "более 2500 чел.",
    use: "Высотки 50+ этажей, стадионы, метро",
    price: "1 800 - 3 500 тг/м²",
  },
];

interface ExerciseState {
  answer: string;
  shown: boolean;
  correct: boolean | null;
}

export default function FireAlarmPage() {
  // Упражнение 1 — multiple-choice СОУЭ
  const [ex1Choice, setEx1Choice] = useState<string>("");
  const [ex1Show, setEx1Show] = useState(false);
  const ex1Correct = ex1Choice === "d";

  // Упражнение 2 — числовое
  const [ex2, setEx2] = useState<ExerciseState>({
    answer: "",
    shown: false,
    correct: null,
  });
  // Упражнение 3 — числовое
  const [ex3, setEx3] = useState<ExerciseState>({
    answer: "",
    shown: false,
    correct: null,
  });
  // Упражнение 4 — числовое
  const [ex4, setEx4] = useState<ExerciseState>({
    answer: "",
    shown: false,
    correct: null,
  });

  function checkEx2() {
    setEx2((s) => ({
      ...s,
      correct: checkNum(s.answer, 4, 0.25),
    }));
  }
  function checkEx3() {
    setEx3((s) => ({
      ...s,
      correct: checkNum(s.answer, 320, 0.15),
    }));
  }
  function checkEx4() {
    setEx4((s) => ({
      ...s,
      correct: checkNum(s.answer, 850000, 0.15),
    }));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-900 via-red-800 to-orange-800 border-b border-red-700 sticky top-0 z-10 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-red-200 hover:text-white transition-colors"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">
              🚨 АПС и СОУЭ — пожарная сигнализация и оповещение
            </h1>
            <p className="text-[11px] text-orange-200">
              СНиП РК 2.02-15-2003 · СП РК 5.01-101-2014 · ТР ТС 043/2017 · СН РК 2.02-11
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Введение */}
        <section className="bg-slate-900 border-l-4 border-red-500 rounded-lg p-4 shadow-md">
          <h2 className="text-sm font-bold text-red-300 mb-2">
            📌 Что это и зачем закладывать в смету
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-2">
            <b className="text-orange-300">АПС</b> (автоматическая пожарная сигнализация)
            и <b className="text-orange-300">СОУЭ</b> (система оповещения и управления
            эвакуацией) — обязательные подсистемы пожарной автоматики для всех
            общественных и многоквартирных зданий РК. Без рабочего проекта АПС/СОУЭ и
            акта пуско-наладки <b>КГГП ЧС не подписывает приёмку</b>.
          </p>
          <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside mb-2">
            <li>
              <b className="text-red-300">СНиП РК 2.02-15-2003</b> — Системы оповещения
              о пожаре и управления эвакуацией
            </li>
            <li>
              <b className="text-red-300">СП РК 5.01-101-2014</b> — Установки пожарной
              сигнализации и пожаротушения
            </li>
            <li>
              <b className="text-red-300">ТР ТС 043/2017</b> — Технический регламент
              о требованиях к средствам обеспечения пожарной безопасности
            </li>
            <li>
              <b className="text-red-300">СН РК 2.02-11</b> — Требования по защите
              объектов системами пожарной автоматики
            </li>
          </ul>
          <p className="text-xs text-slate-300">
            <b>Стоимость комплекта АПС+СОУЭ для офиса:</b>{" "}
            <span className="font-mono text-orange-300">2 000 - 8 000 тг/м²</span>{" "}
            (зависит от типа СОУЭ, количества зон, бренда — Болид, Рубеж, Сиам, Honeywell).
          </p>
        </section>

        {/* Раздел 1: Извещатели */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-md">
          <h2 className="text-base font-bold text-red-300 mb-3">
            Раздел 1. Типы пожарных извещателей
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-red-900/40">
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-red-200">
                    Маркировка
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-red-200">
                    Тип / принцип
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-red-200">
                    Норма установки
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-red-200">
                    Где применять
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-red-200">
                    Цена ССЦ
                  </th>
                </tr>
              </thead>
              <tbody>
                {DETECTORS.map((d) => (
                  <tr
                    key={d.mark}
                    className="hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="border border-slate-700 px-2 py-1 font-mono font-semibold text-orange-300 whitespace-nowrap">
                      {d.mark}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-slate-200">
                      {d.type}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-slate-300">
                      {d.area}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-slate-400">
                      {d.use}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-slate-300 whitespace-nowrap">
                      {d.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Типы СОУЭ */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-md">
          <h2 className="text-base font-bold text-orange-300 mb-3">
            Раздел 2. Типы СОУЭ по СП РК 5.01-101-2014
          </h2>
          <p className="text-xs text-slate-400 italic mb-3">
            Тип СОУЭ выбирается по вместимости здания и его функциональному назначению.
            Чем выше тип — тем дороже, но без него объект не сдаётся.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-orange-900/40">
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-orange-200">
                    Тип
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-orange-200">
                    Описание
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-orange-200">
                    Вместимость
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-orange-200">
                    Где применять
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-left text-orange-200">
                    Стоимость в смете
                  </th>
                </tr>
              </thead>
              <tbody>
                {SOUE_TYPES.map((s) => (
                  <tr
                    key={s.type}
                    className="hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="border border-slate-700 px-2 py-1 font-bold text-orange-300 whitespace-nowrap">
                      {s.type}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-slate-200">
                      {s.desc}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-slate-300 whitespace-nowrap">
                      {s.cap}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-slate-400">
                      {s.use}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-orange-300 whitespace-nowrap">
                      {s.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3: Упражнения */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-md">
          <h2 className="text-base font-bold text-red-300 mb-4">
            Раздел 3. Интерактивные упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-bold text-orange-300 mb-2">
              🧪 Упражнение 1. Подбор типа СОУЭ для гипермаркета
            </h3>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Проектируется гипермаркет в Алматы. Расчётная вместимость по проекту —{" "}
              <b className="text-orange-300">1 800 человек</b>. Нужно выбрать тип СОУЭ
              согласно СП РК 5.01-101-2014.
            </p>
            <div className="space-y-1.5 mb-3">
              {[
                { v: "a", t: "a) Тип 1 — звуковая сирена" },
                { v: "b", t: "b) Тип 2 — свето-звуковой" },
                { v: "c", t: "c) Тип 3 — речевое оповещение" },
                { v: "d", t: "d) Тип 4 — направленное речевое + зональное световое" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-xs border transition-colors ${
                    ex1Choice === opt.v
                      ? "bg-orange-900/40 border-orange-500 text-orange-100"
                      : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1Choice === opt.v}
                    onChange={(e) => setEx1Choice(e.target.value)}
                    className="accent-orange-500"
                  />
                  {opt.t}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setEx1Show(true)}
                disabled={!ex1Choice}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Show(true)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
              >
                Показать решение
              </button>
            </div>
            {ex1Show && (
              <div
                className={`mt-2 p-3 rounded text-xs leading-relaxed ${
                  ex1Correct
                    ? "bg-green-900/30 border border-green-700 text-green-200"
                    : "bg-red-900/30 border border-red-700 text-red-200"
                }`}
              >
                <p className="font-bold mb-1">
                  {ex1Correct ? "✅ Верно!" : "❌ Неверно. "}Правильный ответ — d) Тип 4.
                </p>
                <p>
                  По СП РК 5.01-101-2014 для зданий вместимостью свыше 1500 и до 2500
                  человек применяется СОУЭ <b>4 типа</b> — направленное речевое
                  оповещение с разделением на зоны и световыми указателями. Для ТРЦ и
                  гипермаркетов это обязательный минимум, поскольку нужно управлять
                  эвакуацией нескольких тысяч человек по разным выходам.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-bold text-orange-300 mb-2">
              🧪 Упражнение 2. Количество дымовых извещателей
            </h3>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Офисное помещение площадью <b className="text-orange-300">200 м²</b>,
              высота потолка <b>2.7 м</b>. Норма по СП РК для офисов —{" "}
              <b>1 ИП-212 на 85 м²</b>. Сколько дымовых извещателей минимум потребуется
              (с учётом перекрытия зон контроля и округления вверх)?
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={ex2.answer}
                onChange={(e) => setEx2((s) => ({ ...s, answer: e.target.value }))}
                placeholder="шт"
                className="w-32 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-orange-200 text-xs font-mono focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs text-slate-400">шт</span>
              <button
                onClick={checkEx2}
                disabled={!ex2.answer}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2((s) => ({ ...s, shown: true }))}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
              >
                Показать решение
              </button>
            </div>
            {ex2.correct !== null && (
              <div
                className={`mb-2 p-2 rounded text-xs ${
                  ex2.correct
                    ? "bg-green-900/30 border border-green-700 text-green-200"
                    : "bg-red-900/30 border border-red-700 text-red-200"
                }`}
              >
                {ex2.correct
                  ? "✅ Верно! 4 шт — корректный ответ с учётом перекрытия."
                  : "❌ Не совсем. Подсказка: формула 200/85, потом округление и перекрытие."}
              </div>
            )}
            {ex2.shown && (
              <div className="bg-slate-900 border-l-4 border-orange-500 p-3 rounded text-xs text-slate-200 leading-relaxed">
                <p className="font-bold text-orange-300 mb-1">Решение:</p>
                <p className="mb-1">
                  Расчёт по формуле: N = S / s_норма ={" "}
                  <span className="font-mono">200 / 85 = 2.35</span> → округление
                  вверх = <b>3 шт</b>.
                </p>
                <p className="mb-1">
                  Однако СП РК требует, чтобы каждая точка помещения попадала в зону
                  контроля минимум двух извещателей (для повышения надёжности и
                  устранения ложных срабатываний). Поэтому на практике закладывают на
                  один больше, особенно при сложной геометрии и колоннах.
                </p>
                <p>
                  <b className="text-green-300">Ответ: 4 шт</b> (3 минимум + 1 для
                  перекрытия зон). Расценка — <b>ЭСН РК Сб.10</b>, расход — по ССЦ
                  ИП-212-141 ≈ 2 200 тг/шт.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-bold text-orange-300 mb-2">
              🧪 Упражнение 3. Длина шлейфа АПС
            </h3>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Офис площадью <b className="text-orange-300">600 м²</b>, периметр около
              100 м. Нужно проложить шлейф АПС с{" "}
              <b className="text-orange-300">35 извещателями</b> по схеме «петля по
              периметру + ответвления к каждому ИП». Учтите запас на ответвления
              (примерно 1.7×периметра) и нормативный запас 20% на изгибы и подключения.
              Сколько метров кабеля ВВГнг-FRLS заложить в смету?
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={ex3.answer}
                onChange={(e) => setEx3((s) => ({ ...s, answer: e.target.value }))}
                placeholder="м"
                className="w-32 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-orange-200 text-xs font-mono focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs text-slate-400">м</span>
              <button
                onClick={checkEx3}
                disabled={!ex3.answer}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3((s) => ({ ...s, shown: true }))}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
              >
                Показать решение
              </button>
            </div>
            {ex3.correct !== null && (
              <div
                className={`mb-2 p-2 rounded text-xs ${
                  ex3.correct
                    ? "bg-green-900/30 border border-green-700 text-green-200"
                    : "bg-red-900/30 border border-red-700 text-red-200"
                }`}
              >
                {ex3.correct
                  ? "✅ Верно! Около 320 м кабеля — корректная заявка для сметы."
                  : "❌ Неточно. Учли запас 20% и ответвления к каждому ИП?"}
              </div>
            )}
            {ex3.shown && (
              <div className="bg-slate-900 border-l-4 border-orange-500 p-3 rounded text-xs text-slate-200 leading-relaxed">
                <p className="font-bold text-orange-300 mb-1">Решение:</p>
                <p className="mb-1">
                  1. Базовая петля по периметру: <span className="font-mono">≈ 100 м</span>.
                </p>
                <p className="mb-1">
                  2. Ответвления к 35 извещателям (в среднем 4 м на каждый ИП до
                  ближайшей точки шлейфа):{" "}
                  <span className="font-mono">35 × 4 = 140 м</span>.
                </p>
                <p className="mb-1">
                  3. Суммарно «чистого» кабеля:{" "}
                  <span className="font-mono">100 + 140 = 240 м</span>.
                </p>
                <p className="mb-1">
                  4. Норматив-запас на изгибы, штробы, подключения и подъёмы 20%:{" "}
                  <span className="font-mono">240 × 1.20 ≈ 290 м</span>; на практике для
                  офисов с колоннами и подвесными потолками закладывают около 30%
                  запаса для перекрытия.
                </p>
                <p>
                  <b className="text-green-300">Ответ: ≈ 320 м</b> (допустимо 290-360 м,
                  ±15%). Расценка кабеля ВВГнг-FRLS 2×1.5 — по ССЦ ≈ 380 тг/м.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-orange-300 mb-2">
              🧪 Упражнение 4. Стоимость комплекта АПС + СОУЭ 2 для офиса
            </h3>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Офис <b className="text-orange-300">600 м²</b>, СОУЭ типа 2. В состав
              входят:
            </p>
            <ul className="text-xs text-slate-400 list-disc list-inside mb-3 space-y-0.5">
              <li>Приёмно-контрольный прибор (Болид С2000-АСПТ или Рубеж-2ОП) — 95 000 тг</li>
              <li>35 дымовых извещателей ИП-212-141 × 2 200 тг = 77 000 тг</li>
              <li>12 свето-звуковых оповещателей «Маяк-12-КП» × 4 500 тг = 54 000 тг</li>
              <li>240 м огнестойкого кабеля ВВГнг-FRLS × 380 тг = 91 200 тг</li>
              <li>Монтаж + пуско-наладка + проектная документация ≈ 530 000 тг</li>
            </ul>
            <p className="text-xs text-slate-300 mb-3">
              Сложите все позиции и укажите итоговую стоимость комплекта в тенге.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={ex4.answer}
                onChange={(e) => setEx4((s) => ({ ...s, answer: e.target.value }))}
                placeholder="тг"
                className="w-40 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-orange-200 text-xs font-mono focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs text-slate-400">тг</span>
              <button
                onClick={checkEx4}
                disabled={!ex4.answer}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4((s) => ({ ...s, shown: true }))}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
              >
                Показать решение
              </button>
            </div>
            {ex4.correct !== null && (
              <div
                className={`mb-2 p-2 rounded text-xs ${
                  ex4.correct
                    ? "bg-green-900/30 border border-green-700 text-green-200"
                    : "bg-red-900/30 border border-red-700 text-red-200"
                }`}
              >
                {ex4.correct
                  ? "✅ Верно! Около 850 000 тг — реалистичная сметная стоимость."
                  : "❌ Не сошлось. Сложите все 5 строк ещё раз."}
              </div>
            )}
            {ex4.shown && (
              <div className="bg-slate-900 border-l-4 border-orange-500 p-3 rounded text-xs text-slate-200 leading-relaxed">
                <p className="font-bold text-orange-300 mb-1">Решение:</p>
                <table className="w-full text-xs font-mono mb-2">
                  <tbody>
                    <tr>
                      <td className="py-0.5">ППК Болид/Рубеж</td>
                      <td className="py-0.5 text-right">95 000</td>
                    </tr>
                    <tr>
                      <td className="py-0.5">35 × ИП-212-141</td>
                      <td className="py-0.5 text-right">77 000</td>
                    </tr>
                    <tr>
                      <td className="py-0.5">12 × оповещатель «Маяк»</td>
                      <td className="py-0.5 text-right">54 000</td>
                    </tr>
                    <tr>
                      <td className="py-0.5">240 м ВВГнг-FRLS</td>
                      <td className="py-0.5 text-right">91 200</td>
                    </tr>
                    <tr>
                      <td className="py-0.5">Монтаж + ПНР + ПД</td>
                      <td className="py-0.5 text-right">530 000</td>
                    </tr>
                    <tr className="border-t border-orange-500">
                      <td className="py-1 font-bold text-orange-300">ИТОГО</td>
                      <td className="py-1 text-right font-bold text-orange-300">
                        847 200 ≈ 850 000
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  <b className="text-green-300">Ответ: ≈ 850 000 тг</b> (допуск ±15%, то
                  есть 720 000 - 980 000). Это около{" "}
                  <span className="font-mono">1 415 тг/м²</span> — попадает в рыночный
                  диапазон 2 000-8 000 тг/м² для СОУЭ типа 2 (нижняя граница, т.к. без
                  АУПТ и без речевого оповещения).
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-md">
          <h2 className="text-base font-bold text-red-300 mb-3">
            📚 Расценки ЭСН РК для АПС/СОУЭ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-950 border border-slate-700 rounded p-3">
              <h3 className="text-sm font-bold text-orange-300 mb-1.5">
                Сборник 62 — пожарная сигнализация
              </h3>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>§62-1 — монтаж приёмно-контрольных приборов</li>
                <li>§62-2 — установка извещателей дымовых, тепловых, ручных</li>
                <li>§62-3 — оповещатели звуковые, светозвуковые, речевые</li>
                <li>§62-4 — пуско-наладка АПС/СОУЭ с протоколом 72 ч</li>
                <li>§62-5 — программирование адресной системы</li>
              </ul>
            </div>
            <div className="bg-slate-950 border border-slate-700 rounded p-3">
              <h3 className="text-sm font-bold text-orange-300 mb-1.5">
                Сборник 10 — слаботочные системы
              </h3>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>§10-1 — прокладка кабеля ВВГнг-FRLS в гофре/коробах</li>
                <li>§10-2 — установка коробок ответвительных, клемм</li>
                <li>§10-3 — заземление металлических корпусов АПС</li>
                <li>§10-4 — испытания изоляции, замер сопротивления шлейфа</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Red factoid */}
        <section className="bg-gradient-to-br from-red-950 via-red-900 to-orange-900 border-2 border-red-600 rounded-lg p-4 shadow-lg">
          <h2 className="text-base font-bold text-red-200 mb-2 flex items-center gap-2">
            ⚠️ ВАЖНО: декларация по ТР ТС 043/2017
          </h2>
          <p className="text-xs text-red-100 leading-relaxed mb-2">
            После вступления в силу <b>ТР ТС 043/2017</b> (Технический регламент
            Таможенного союза «О требованиях к средствам обеспечения пожарной
            безопасности и пожаротушения») на всё пожарное оборудование, ввозимое или
            производимое на территории ЕАЭС, обязательна{" "}
            <b className="text-orange-200">декларация о соответствии</b> или{" "}
            <b className="text-orange-200">сертификат ТР ТС</b>.
          </p>
          <p className="text-xs text-red-100 leading-relaxed mb-2">
            Без подтверждающего документа на каждое наименование (ИП-212, ППК, кабель
            FRLS, оповещатели):
          </p>
          <ul className="text-xs text-red-100 space-y-0.5 list-disc list-inside mb-2">
            <li>
              КГГП ЧС <b>не подписывает акт</b> ввода объекта в эксплуатацию;
            </li>
            <li>
              генподрядчику штраф{" "}
              <b className="text-orange-200">200-500 МРП</b> по ст. 410 КоАП РК
              (~770 000 - 1 925 000 тг при МРП 2026 г.);
            </li>
            <li>
              в случае пожара со смертельным исходом — уголовная ответственность по
              ст. 304 УК РК (до 7 лет лишения свободы для проектировщика и подрядчика).
            </li>
          </ul>
          <p className="text-xs text-orange-100 font-semibold">
            👉 Поэтому в смете ВСЕГДА закладывайте позицию «Сертификация и декларации
            ТР ТС» — обычно 1.5-3% от стоимости комплекта АПС/СОУЭ.
          </p>
        </section>
      </div>
    </div>
  );
}
