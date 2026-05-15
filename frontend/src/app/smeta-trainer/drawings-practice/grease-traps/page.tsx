"use client";

import { useState } from "react";
import Link from "next/link";

type Feedback = { ok: boolean; msg: string } | null;

const tolerance = (value: number, target: number, pct: number) => {
  const delta = Math.abs(value - target) / target;
  return delta <= pct / 100;
};

export default function GreaseTrapsPage() {
  const [ex1, setEx1] = useState("");
  const [ex1Fb, setEx1Fb] = useState<Feedback>(null);

  const [ex2, setEx2] = useState("");
  const [ex2Fb, setEx2Fb] = useState<Feedback>(null);

  const [ex3, setEx3] = useState("");
  const [ex3Fb, setEx3Fb] = useState<Feedback>(null);

  const [ex4, setEx4] = useState<string>("");
  const [ex4Fb, setEx4Fb] = useState<Feedback>(null);

  const checkEx1 = () => {
    const v = parseFloat(ex1.replace(",", "."));
    if (isNaN(v)) {
      setEx1Fb({ ok: false, msg: "Введите число (л/с)." });
      return;
    }
    if (tolerance(v, 4, 25)) {
      setEx1Fb({ ok: true, msg: "Верно! 80 · 0.05 = 4 л/с (диапазон 3-5 л/с)." });
    } else {
      setEx1Fb({ ok: false, msg: "Неверно. Норма 0.05 л/с на место × 80 = 4 л/с." });
    }
  };

  const checkEx2 = () => {
    const v = parseFloat(ex2.replace(",", "."));
    if (isNaN(v)) {
      setEx2Fb({ ok: false, msg: "Введите сумму в тенге." });
      return;
    }
    if (tolerance(v, 3525000, 15)) {
      setEx2Fb({
        ok: true,
        msg: "Верно! 2.85 млн (оборудование) + 425 тыс (монтаж) + 250 тыс (подключение) ≈ 3.5 млн тг.",
      });
    } else {
      setEx2Fb({ ok: false, msg: "Неверно. Ожидается ≈ 3 525 000 тг (±15%)." });
    }
  };

  const checkEx3 = () => {
    const v = parseFloat(ex3.replace(",", "."));
    if (isNaN(v)) {
      setEx3Fb({ ok: false, msg: "Введите число (кг)." });
      return;
    }
    if (tolerance(v, 240, 20)) {
      setEx3Fb({
        ok: true,
        msg: "Верно! 80 чел × 30 дн × 2 приёма × 0.05 кг = 240 кг/мес (200-300 кг).",
      });
    } else {
      setEx3Fb({ ok: false, msg: "Неверно. Расчёт даёт ≈ 240 кг (диапазон 200-300 кг)." });
    }
  };

  const checkEx4 = () => {
    if (ex4 === "d") {
      setEx4Fb({
        ok: true,
        msg: "Верно! Стандартное оборудование чистится каждые 2-4 недели (1-2 раза в месяц).",
      });
    } else {
      setEx4Fb({
        ok: false,
        msg: "Неверно. Жироуловитель требует чистки каждые 2-4 недели — это 1-2 раза в месяц.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/20 to-stone-950 text-stone-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="inline-flex items-center gap-2 text-amber-400 transition hover:text-amber-300"
          >
            ← К разделам
          </Link>
        </div>

        <header className="mb-8 border-b border-amber-900/40 pb-6">
          <h1 className="text-3xl font-bold text-amber-200 sm:text-4xl">
            🍳 Жироуловители — для предприятий общепита
          </h1>
        </header>

        {/* Intro */}
        <section className="mb-8 rounded-xl border border-amber-900/40 bg-stone-900/50 p-6">
          <p className="leading-relaxed text-stone-300">
            <span className="font-semibold text-amber-300">Жироуловитель</span> — обязательное
            оборудование для всех предприятий общепита (рестораны, столовые, кухни в
            гостиницах). Удаляет жиры из кухонных стоков перед сбросом в городскую канализацию.
            Без него — штрафы от водоканала.
          </p>
        </section>

        {/* Norms */}
        <section className="mb-8 rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
          <h2 className="mb-3 text-xl font-semibold text-amber-300">📚 Нормативы</h2>
          <ul className="space-y-2 text-stone-300">
            <li>• <span className="font-mono text-amber-200">СНиП РК 4.01-02-2009</span> — внутренний водопровод и канализация</li>
            <li>• <span className="font-mono text-amber-200">ГОСТ Р 56897-2016</span> «Жироуловители»</li>
            <li>• <span className="font-mono text-amber-200">СН РК 4.04-21</span> — наружные сети канализации</li>
          </ul>
        </section>

        {/* Section 1: Принцип работы */}
        <section className="mb-8 rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
          <h2 className="mb-4 text-2xl font-semibold text-amber-300">
            ⚙️ Раздел 1. Принцип работы
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-amber-900/30 bg-stone-950/70 p-4 font-mono text-sm leading-relaxed text-stone-200">
{`Принцип жироуловителя — гравитационное разделение:
1. Сточные воды поступают в первичную камеру
2. Жиры легче воды → всплывают наверх
3. Тяжёлые частицы (мясо, кости) → оседают на дно
4. Очищенная вода (по середине) → перетекает в выход

Эффективность: 90-95% удаления жира.
Требует регулярной чистки: каждые 2-4 недели.`}
          </pre>
        </section>

        {/* Section 2: Типы жироуловителей */}
        <section className="mb-8 rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
          <h2 className="mb-4 text-2xl font-semibold text-amber-300">
            🗂️ Раздел 2. Типы жироуловителей
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-amber-700/60 bg-amber-950/40 text-amber-200">
                  <th className="px-3 py-2 text-left">Тип</th>
                  <th className="px-3 py-2 text-left">Производительность</th>
                  <th className="px-3 py-2 text-left">Применение</th>
                  <th className="px-3 py-2 text-left">Цена 2025</th>
                </tr>
              </thead>
              <tbody className="text-stone-300">
                <tr className="border-b border-stone-800/70">
                  <td className="px-3 py-2">Бытовой (для кафе на 20 мест)</td>
                  <td className="px-3 py-2 font-mono text-amber-200">1.5 л/с</td>
                  <td className="px-3 py-2">Малые кафе, столовые</td>
                  <td className="px-3 py-2 font-mono">285 000 тг</td>
                </tr>
                <tr className="border-b border-stone-800/70">
                  <td className="px-3 py-2">Стандартный 50 чел</td>
                  <td className="px-3 py-2 font-mono text-amber-200">3-5 л/с</td>
                  <td className="px-3 py-2">Рестораны до 50 посетителей</td>
                  <td className="px-3 py-2 font-mono">850 000 тг</td>
                </tr>
                <tr className="border-b border-stone-800/70">
                  <td className="px-3 py-2">Производительный 100-200 чел</td>
                  <td className="px-3 py-2 font-mono text-amber-200">7-10 л/с</td>
                  <td className="px-3 py-2">Большие рестораны, столовые промпредприятий</td>
                  <td className="px-3 py-2 font-mono">2 850 000 тг</td>
                </tr>
                <tr className="border-b border-stone-800/70">
                  <td className="px-3 py-2">Промышленный</td>
                  <td className="px-3 py-2 font-mono text-amber-200">20-50 л/с</td>
                  <td className="px-3 py-2">Цеха пищевой промышленности</td>
                  <td className="px-3 py-2 font-mono">8 500 000 тг +</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Биологический жироуловитель</td>
                  <td className="px-3 py-2 font-mono text-amber-200">5-10 л/с</td>
                  <td className="px-3 py-2">Рестораны премиум (биоразлагающий)</td>
                  <td className="px-3 py-2 font-mono">4 500 000 тг</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Упражнения */}
        <section className="mb-8 space-y-6">
          <h2 className="text-2xl font-semibold text-amber-300">
            🧮 Раздел 3. Упражнения
          </h2>

          {/* Ex1 */}
          <div className="rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
            <h3 className="mb-2 text-lg font-semibold text-amber-200">
              Упражнение 1. Производительность жироуловителя
            </h3>
            <p className="mb-3 text-stone-300">
              Ресторан на <span className="font-semibold text-amber-300">80 посетителей</span>.
              Норма — <span className="font-mono text-amber-200">0.05 л/с</span> на 1 посадочное
              место. Какая нужна производительность жироуловителя (л/с)?
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={ex1}
                onChange={(e) => setEx1(e.target.value)}
                placeholder="например 4"
                className="flex-1 rounded-lg border border-amber-900/50 bg-stone-950/70 px-3 py-2 text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                onClick={checkEx1}
                className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-stone-950 transition hover:bg-amber-500"
              >
                Проверить
              </button>
            </div>
            {ex1Fb && (
              <div
                className={`mt-3 rounded-lg border px-4 py-2 text-sm ${
                  ex1Fb.ok
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                    : "border-rose-700 bg-rose-950/40 text-rose-200"
                }`}
              >
                {ex1Fb.msg}
              </div>
            )}
          </div>

          {/* Ex2 */}
          <div className="rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
            <h3 className="mb-2 text-lg font-semibold text-amber-200">
              Упражнение 2. Стоимость жироуловителя
            </h3>
            <p className="mb-3 text-stone-300">
              Ресторан на 80 чел. Берём «Производительный 100 чел» (2 850 000 тг) +
              монтаж 15% + подключение к канализации 250 000 тг. Сколько составит итоговая
              стоимость (тг)?
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={ex2}
                onChange={(e) => setEx2(e.target.value)}
                placeholder="например 3525000"
                className="flex-1 rounded-lg border border-amber-900/50 bg-stone-950/70 px-3 py-2 text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                onClick={checkEx2}
                className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-stone-950 transition hover:bg-amber-500"
              >
                Проверить
              </button>
            </div>
            {ex2Fb && (
              <div
                className={`mt-3 rounded-lg border px-4 py-2 text-sm ${
                  ex2Fb.ok
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                    : "border-rose-700 bg-rose-950/40 text-rose-200"
                }`}
              >
                {ex2Fb.msg}
              </div>
            )}
          </div>

          {/* Ex3 */}
          <div className="rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
            <h3 className="mb-2 text-lg font-semibold text-amber-200">
              Упражнение 3. Объём жиров за месяц
            </h3>
            <p className="mb-3 text-stone-300">
              Ресторан на 80 посетителей, 2 приёма пищи в день, 30 дней. На 1 порцию —{" "}
              <span className="font-mono text-amber-200">0.05 кг</span> жира в среднем. Сколько
              кг жира соберёт жироуловитель за месяц?
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                placeholder="например 240"
                className="flex-1 rounded-lg border border-amber-900/50 bg-stone-950/70 px-3 py-2 text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                onClick={checkEx3}
                className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-stone-950 transition hover:bg-amber-500"
              >
                Проверить
              </button>
            </div>
            {ex3Fb && (
              <div
                className={`mt-3 rounded-lg border px-4 py-2 text-sm ${
                  ex3Fb.ok
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                    : "border-rose-700 bg-rose-950/40 text-rose-200"
                }`}
              >
                {ex3Fb.msg}
              </div>
            )}
          </div>

          {/* Ex4 */}
          <div className="rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
            <h3 className="mb-3 text-lg font-semibold text-amber-200">
              Упражнение 4. Кратность чистки жироуловителя
            </h3>
            <p className="mb-3 text-stone-300">
              Как часто нужно чистить стандартный жироуловитель в общепите?
            </p>
            <div className="space-y-2">
              {[
                { v: "a", t: "1 раз в год" },
                { v: "b", t: "1 раз в полгода" },
                { v: "c", t: "1 раз в месяц" },
                { v: "d", t: "1-2 раза в месяц" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-800 bg-stone-950/40 px-3 py-2 transition hover:border-amber-700/60"
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={(e) => setEx4(e.target.value)}
                    className="accent-amber-500"
                  />
                  <span className="text-stone-200">
                    <span className="font-mono text-amber-300">{opt.v})</span> {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <button
              onClick={checkEx4}
              className="mt-4 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-stone-950 transition hover:bg-amber-500"
            >
              Проверить
            </button>
            {ex4Fb && (
              <div
                className={`mt-3 rounded-lg border px-4 py-2 text-sm ${
                  ex4Fb.ok
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                    : "border-rose-700 bg-rose-950/40 text-rose-200"
                }`}
              >
                {ex4Fb.msg}
              </div>
            )}
          </div>
        </section>

        {/* Расценки */}
        <section className="mb-8 rounded-xl border border-amber-900/40 bg-stone-900/40 p-6">
          <h2 className="mb-3 text-xl font-semibold text-amber-300">📑 Расценки ЭСН</h2>
          <ul className="space-y-2 text-stone-300">
            <li>
              • <span className="font-mono text-amber-200">Сб.23-2</span> «Сооружения
              предварительной очистки»
            </li>
            <li>
              • <span className="font-mono text-amber-200">Сб.16-05</span> «Установка
              специального оборудования»
            </li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="mb-12 rounded-xl border-2 border-amber-600/70 bg-amber-950/30 p-6">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-amber-300">
            ⚠️ Факт-предупреждение
          </h3>
          <p className="leading-relaxed text-amber-100">
            Без жироуловителя в общепите —{" "}
            <span className="font-semibold">штрафы от водоканала до 200 МРП</span> за сброс.
            Плюс регулярные засоры городской канализации, ремонт за счёт виновного.{" "}
            <span className="font-semibold text-amber-300">
              Не экономь на жироуловителе.
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
