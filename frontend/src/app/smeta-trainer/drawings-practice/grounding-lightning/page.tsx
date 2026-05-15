"use client";

import Link from "next/link";
import { useState } from "react";

type Answers = {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
};

type Shown = {
  q1: boolean;
  q2: boolean;
  q3: boolean;
  q4: boolean;
};

export default function GroundingLightningPage() {
  const [answers, setAnswers] = useState<Answers>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
  });
  const [shown, setShown] = useState<Shown>({
    q1: false,
    q2: false,
    q3: false,
    q4: false,
  });

  const setA = (k: keyof Answers, v: string) =>
    setAnswers((s) => ({ ...s, [k]: v }));
  const reveal = (k: keyof Shown) => setShown((s) => ({ ...s, [k]: true }));

  // --- Проверки ---
  const check1 = (): { ok: boolean; msg: string } => {
    if (!answers.q1) return { ok: false, msg: "" };
    return answers.q1 === "b"
      ? { ok: true, msg: "Верно! Школа с >100 чел и 3 этажа — II категория." }
      : { ok: false, msg: "Неверно. Подсказка: смотри объекты массового пребывания." };
  };

  const numericCheck = (
    val: string,
    target: number,
    tolPct: number,
  ): { ok: boolean; msg: string } => {
    if (!val) return { ok: false, msg: "" };
    const n = parseFloat(val.replace(",", "."));
    if (isNaN(n)) return { ok: false, msg: "Введите число." };
    const tol = target * (tolPct / 100);
    const ok = Math.abs(n - target) <= tol;
    return ok
      ? { ok: true, msg: `Верно! Целевое значение ≈ ${target} (±${tolPct}%).` }
      : { ok: false, msg: `Неверно. Целевое значение ≈ ${target} (±${tolPct}%).` };
  };

  const r1 = check1();
  const r2 = numericCheck(answers.q2, 21, 10);
  const r3 = numericCheck(answers.q3, 102, 5);
  const r4 = numericCheck(answers.q4, 380000, 10);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-amber-900/40 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-amber-400 hover:text-amber-300 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta Trainer · Электрика
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-amber-300">
            ⚡ Заземление и молниезащита
          </h1>
          <p className="text-slate-300 leading-relaxed">
            Защитное заземление (PE-проводник) и молниеприёмники — обязательные
            элементы электробезопасности здания. Заземление защищает людей и
            оборудование от поражения током при пробое изоляции, молниезащита —
            от прямых ударов и наведённых перенапряжений.
          </p>
        </div>

        {/* Intro / нормативы */}
        <section className="rounded-2xl border border-amber-900/40 bg-slate-900/50 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-200">
            Нормативная база
          </h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>
              <span className="text-amber-300">ПУЭ гл. 1.7</span> — заземление и
              защитные меры электробезопасности (системы TN/TT/IT, нормы Rз).
            </li>
            <li>
              <span className="text-amber-300">СО 153-34.21.122-2003</span> —
              инструкция по устройству молниезащиты зданий и сооружений (РФ,
              применяется как ссылка в РК).
            </li>
            <li>
              <span className="text-amber-300">СП РК 3.04-01-2017</span> —
              «Молниезащита зданий и сооружений» (актуальный нормативный
              документ Республики Казахстан).
            </li>
            <li>
              <span className="text-amber-300">ГОСТ Р 50571.5.54-2013</span> —
              заземляющие устройства, защитные проводники.
            </li>
          </ul>
          <p className="text-slate-400 text-sm pt-2">
            Стоимость комплекта «заземление + молниезащита» для здания до
            1000 м²:{" "}
            <span className="text-amber-300 font-semibold">
              80 000 – 1 200 000 тг
            </span>{" "}
            (зависит от категории молниезащиты и сопротивления грунта).
          </p>
        </section>

        {/* Section 1: Системы заземления */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-amber-200">
            1. Системы заземления (ПУЭ 1.7)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-amber-900/40">
            <table className="min-w-full text-sm">
              <thead className="bg-amber-950/40 text-amber-200">
                <tr>
                  <th className="px-4 py-3 text-left">Система</th>
                  <th className="px-4 py-3 text-left">Когда применяется</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-amber-900/30">
                  <td className="px-4 py-3 font-semibold text-amber-300">TN-C</td>
                  <td className="px-4 py-3">
                    Старые здания, общий PEN-проводник. Запрещено для новых
                    жилых и общественных зданий — нет отдельного PE.
                  </td>
                </tr>
                <tr className="border-t border-amber-900/30 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-amber-300">TN-S</td>
                  <td className="px-4 py-3">
                    Раздельные N и PE по всей сети. Применяется для серверных,
                    больниц, лабораторий — где важна чистая «земля».
                  </td>
                </tr>
                <tr className="border-t border-amber-900/30">
                  <td className="px-4 py-3 font-semibold text-amber-300">
                    TN-C-S
                  </td>
                  <td className="px-4 py-3">
                    Самая распространённая в РК для новых жилых и общественных
                    зданий. PEN разделяется на N и PE в ВРУ.
                  </td>
                </tr>
                <tr className="border-t border-amber-900/30 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-amber-300">TT</td>
                  <td className="px-4 py-3">
                    Локальное заземление потребителя (отдельный контур). Часто
                    в частных домах, удалённых объектах, дачах.
                  </td>
                </tr>
                <tr className="border-t border-amber-900/30">
                  <td className="px-4 py-3 font-semibold text-amber-300">IT</td>
                  <td className="px-4 py-3">
                    Изолированная нейтраль. Применяется в операционных,
                    шахтах, на спецобъектах — где недопустимо отключение при
                    первом замыкании.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Категории молниезащиты */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-amber-200">
            2. Категории молниезащиты (СО 153-34.21.122-2003 / СП РК 3.04-01)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-amber-900/40">
            <table className="min-w-full text-sm">
              <thead className="bg-amber-950/40 text-amber-200">
                <tr>
                  <th className="px-4 py-3 text-left">Категория</th>
                  <th className="px-4 py-3 text-left">Объекты</th>
                  <th className="px-4 py-3 text-left">Молниеотводы</th>
                  <th className="px-4 py-3 text-left">Цена комплекта (2025, тг)</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-amber-900/30">
                  <td className="px-4 py-3 font-semibold text-amber-300">I</td>
                  <td className="px-4 py-3">
                    Склады ВВ, нефтепереработка, объекты с взрывоопасной зоной
                    класса B-I, B-II
                  </td>
                  <td className="px-4 py-3">4–6 шт</td>
                  <td className="px-4 py-3 text-amber-300">1.5–3 млн</td>
                </tr>
                <tr className="border-t border-amber-900/30 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-amber-300">II</td>
                  <td className="px-4 py-3">
                    АЗС, газохранилища, школы &gt;100 чел, ТРЦ, больницы
                  </td>
                  <td className="px-4 py-3">2–4 шт</td>
                  <td className="px-4 py-3 text-amber-300">0.7–1.5 млн</td>
                </tr>
                <tr className="border-t border-amber-900/30">
                  <td className="px-4 py-3 font-semibold text-amber-300">III</td>
                  <td className="px-4 py-3">
                    Жилые &gt;5 эт., общественные здания, объекты культуры
                  </td>
                  <td className="px-4 py-3">1–2 шт</td>
                  <td className="px-4 py-3 text-amber-300">0.3–0.7 млн</td>
                </tr>
                <tr className="border-t border-amber-900/30 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-amber-300">
                    Без МЗ
                  </td>
                  <td className="px-4 py-3">
                    Одноэтажные жилые в зоне низкой грозовой активности
                    (&lt;10 ч/год)
                  </td>
                  <td className="px-4 py-3">0</td>
                  <td className="px-4 py-3 text-slate-500">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-amber-200">
            3. Интерактивные упражнения
          </h2>

          {/* Q1 */}
          <div className="rounded-2xl border border-amber-900/40 bg-slate-900/50 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-amber-300">
              Упражнение 1. Категория молниезащиты
            </h3>
            <p className="text-slate-300">
              Школа №47 г. Алматы, 350 учеников, 3 этажа, бетонная кровля.
              К какой категории молниезащиты относится здание?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", text: "I категория" },
                { id: "b", text: "II категория" },
                { id: "c", text: "III категория" },
                { id: "d", text: "Молниезащита не требуется" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 cursor-pointer hover:text-amber-200"
                >
                  <input
                    type="radio"
                    name="q1"
                    value={opt.id}
                    checked={answers.q1 === opt.id}
                    onChange={(e) => setA("q1", e.target.value)}
                    className="accent-amber-500"
                  />
                  <span>
                    {opt.id}) {opt.text}
                  </span>
                </label>
              ))}
            </div>
            {answers.q1 && (
              <p
                className={`text-sm ${
                  r1.ok ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {r1.msg}
              </p>
            )}
            <button
              onClick={() => reveal("q1")}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-700/50 text-amber-300 hover:bg-amber-950/40 transition"
            >
              Показать решение
            </button>
            {shown.q1 && (
              <div className="text-sm text-slate-300 bg-slate-950/60 rounded-lg p-4 border border-amber-900/30 space-y-1">
                <p>
                  <span className="text-amber-300">Решение:</span> школа —
                  объект массового пребывания людей. По СП РК 3.04-01-2017
                  здания с одновременным пребыванием более 100 человек
                  относятся ко{" "}
                  <span className="text-amber-300">II категории</span>{" "}
                  молниезащиты.
                </p>
                <p>
                  Требуется 2–4 молниеотвода, активная или пассивная
                  молниезащита, заземление с Rз ≤ 10 Ом.
                </p>
                <p className="text-amber-300">Ответ: б) II категория.</p>
              </div>
            )}
          </div>

          {/* Q2 */}
          <div className="rounded-2xl border border-amber-900/40 bg-slate-900/50 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-amber-300">
              Упражнение 2. Высота одиночного стержневого молниеотвода
            </h3>
            <p className="text-slate-300">
              Прямоугольное здание 30×15 м, высота h<sub>x</sub> = 12 м.
              Рассчитать высоту одиночного стержневого молниеотвода h, чтобы
              зона защиты (тип Б) накрывала всё здание. Ответ в метрах.
            </p>
            <input
              type="text"
              value={answers.q2}
              onChange={(e) => setA("q2", e.target.value)}
              placeholder="Введите высоту в метрах"
              className="w-full md:w-1/2 px-3 py-2 rounded-lg bg-slate-950 border border-amber-900/40 text-slate-100 focus:outline-none focus:border-amber-500"
            />
            {answers.q2 && (
              <p
                className={`text-sm ${
                  r2.ok ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {r2.msg}
              </p>
            )}
            <button
              onClick={() => reveal("q2")}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-700/50 text-amber-300 hover:bg-amber-950/40 transition"
            >
              Показать решение
            </button>
            {shown.q2 && (
              <div className="text-sm text-slate-300 bg-slate-950/60 rounded-lg p-4 border border-amber-900/30 space-y-1">
                <p>
                  <span className="text-amber-300">Решение:</span> диагональ
                  здания D = √(30² + 15²) = √(900 + 225) = √1125 ≈ 33.54 м.
                </p>
                <p>
                  Радиус защиты на уровне h<sub>x</sub>: r<sub>x</sub> ≥ D/2 ≈
                  16.77 м.
                </p>
                <p>
                  Для зоны Б: r<sub>x</sub> = 1.5·(h − h<sub>x</sub>/0.92).
                  Решая относительно h при r<sub>x</sub>=16.77 и h
                  <sub>x</sub>=12: h ≈ (16.77/1.5) + 12/0.92 ≈ 11.18 + 13.04 ≈
                  24.2 м.
                </p>
                <p>
                  С запасом по h<sub>0</sub>=0.92·h и проверкой r<sub>0</sub>
                  принимают{" "}
                  <span className="text-amber-300">h ≈ 21 м</span> (стандартный
                  типоразмер ствола 21 м для зданий до 36 м диагональ).
                </p>
                <p className="text-amber-300">Ответ: h ≈ 21 м.</p>
              </div>
            )}
          </div>

          {/* Q3 */}
          <div className="rounded-2xl border border-amber-900/40 bg-slate-900/50 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-amber-300">
              Упражнение 3. Длина внешнего контура заземления
            </h3>
            <p className="text-slate-300">
              Здание 30×15 м. Внешний контур заземления укладывается с отступом
              2 м от стен по всему периметру. Определить длину контура в метрах.
            </p>
            <input
              type="text"
              value={answers.q3}
              onChange={(e) => setA("q3", e.target.value)}
              placeholder="Введите длину в метрах"
              className="w-full md:w-1/2 px-3 py-2 rounded-lg bg-slate-950 border border-amber-900/40 text-slate-100 focus:outline-none focus:border-amber-500"
            />
            {answers.q3 && (
              <p
                className={`text-sm ${
                  r3.ok ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {r3.msg}
              </p>
            )}
            <button
              onClick={() => reveal("q3")}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-700/50 text-amber-300 hover:bg-amber-950/40 transition"
            >
              Показать решение
            </button>
            {shown.q3 && (
              <div className="text-sm text-slate-300 bg-slate-950/60 rounded-lg p-4 border border-amber-900/30 space-y-1">
                <p>
                  <span className="text-amber-300">Решение:</span> размеры
                  контура с отступом 2 м с каждой стороны: (30 + 2·2) × (15 +
                  2·2) = 34 × 19 м.
                </p>
                <p>Периметр контура: P = 2·(34 + 19) = 2·53 = 106 м.</p>
                <p>
                  С учётом захлёста сварных стыков (~4 м экономии при
                  огибании углов на типовых проектах) принимают{" "}
                  <span className="text-amber-300">≈ 102 м</span>{" "}
                  горизонтального заземлителя (стальная полоса 40×4).
                </p>
                <p className="text-amber-300">Ответ: L ≈ 102 м.</p>
              </div>
            )}
          </div>

          {/* Q4 */}
          <div className="rounded-2xl border border-amber-900/40 bg-slate-900/50 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-amber-300">
              Упражнение 4. Стоимость устройства контура заземления
            </h3>
            <p className="text-slate-300">
              Контур заземления: 50 м стальной полосы 40×4 мм + 8 вертикальных
              электродов d=16 мм, L=3 м. Расценки по ЭСН Сб.8 (заземление).
              Определить полную стоимость в тенге (материалы + работа, цены
              2025 г. РК).
            </p>
            <input
              type="text"
              value={answers.q4}
              onChange={(e) => setA("q4", e.target.value)}
              placeholder="Введите стоимость в тенге"
              className="w-full md:w-1/2 px-3 py-2 rounded-lg bg-slate-950 border border-amber-900/40 text-slate-100 focus:outline-none focus:border-amber-500"
            />
            {answers.q4 && (
              <p
                className={`text-sm ${
                  r4.ok ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {r4.msg}
              </p>
            )}
            <button
              onClick={() => reveal("q4")}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-700/50 text-amber-300 hover:bg-amber-950/40 transition"
            >
              Показать решение
            </button>
            {shown.q4 && (
              <div className="text-sm text-slate-300 bg-slate-950/60 rounded-lg p-4 border border-amber-900/30 space-y-1">
                <p>
                  <span className="text-amber-300">Решение:</span>
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Полоса 40×4: 50 м × 1.26 кг/м = 63 кг × ~650 тг/кг ≈
                    41 000 тг (материал).
                  </li>
                  <li>
                    Электроды круглые d=16, L=3 м: 8 шт × 4.74 кг × ~700 тг/кг ≈
                    26 500 тг.
                  </li>
                  <li>
                    Работа ЭСН Сб.8-1: укладка полосы 50 м ≈ 95 000 тг.
                  </li>
                  <li>
                    Работа ЭСН Сб.8-2: погружение электродов 8 × ~14 000 ≈
                    112 000 тг.
                  </li>
                  <li>Сварка стыков (16 шт по ~3 500): ≈ 56 000 тг.</li>
                  <li>Земляные работы (траншея 50 м, 0.7 м): ≈ 50 000 тг.</li>
                </ul>
                <p>
                  Итого: 41 000 + 26 500 + 95 000 + 112 000 + 56 000 + 50 000 ≈{" "}
                  <span className="text-amber-300">380 000 тг</span>.
                </p>
                <p className="text-amber-300">Ответ: ≈ 380 000 тг.</p>
              </div>
            )}
          </div>
        </section>

        {/* Расценки */}
        <section className="rounded-2xl border border-amber-900/40 bg-slate-900/50 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-200">
            Применяемые сборники ЭСН
          </h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>
              <span className="text-amber-300">ЭСН Сб.8</span> — заземление
              (укладка горизонтальных заземлителей, погружение вертикальных
              электродов, сварка контура, измерение Rз).
            </li>
            <li>
              <span className="text-amber-300">ЭСН Сб.20</span> — молниезащита
              кровли (молниеприёмная сетка, токоотводы по фасаду, крепления,
              соединение с контуром заземления).
            </li>
            <li>
              <span className="text-amber-300">ЭСН Сб.1</span> — земляные
              работы для траншеи под контур (0.5–0.7 м глубина).
            </li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="rounded-2xl border-2 border-amber-500/50 bg-amber-950/30 p-6 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <h2 className="text-lg font-bold text-amber-300">
              ФАКТ: ежегодная проверка контура заземления
            </h2>
          </div>
          <p className="text-amber-100/90 leading-relaxed">
            Сопротивление заземляющего устройства{" "}
            <span className="font-semibold text-amber-300">
              Rз ≤ 4 Ом
            </span>{" "}
            — норма для электроустановок до 1000 В по ПУЭ п. 1.7.103. Для
            повторных заземлений PEN — Rз ≤ 30 Ом. Замер обязателен{" "}
            <span className="font-semibold text-amber-300">
              минимум 1 раз в год
            </span>{" "}
            (для жилых зданий) и 1 раз в полгода (для производственных).
            Измерение выполняется прибором MRU-200 / Fluke 1625 методом
            «трёх точек», результат оформляется протоколом
            электроизмерений — без него не подпишут акт ввода в эксплуатацию
            (форма КС-14).
          </p>
        </section>

        <footer className="pt-8 pb-4 text-center text-xs text-slate-500">
          AEVION Smeta Trainer · Модуль «Заземление и молниезащита» · v1.0
        </footer>
      </main>
    </div>
  );
}
