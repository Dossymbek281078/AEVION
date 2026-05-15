"use client";

import Link from "next/link";
import { useState } from "react";

type Result = { ok: boolean; msg: string } | null;

export default function PrisonCorrectionsPage() {
  const [a1, setA1] = useState<string>("");
  const [r1, setR1] = useState<Result>(null);
  const [s1, setS1] = useState(false);

  const [a2, setA2] = useState<string>("");
  const [r2, setR2] = useState<Result>(null);
  const [s2, setS2] = useState(false);

  const [a3, setA3] = useState<string>("");
  const [r3, setR3] = useState<Result>(null);
  const [s3, setS3] = useState(false);

  const [a4, setA4] = useState<string>("");
  const [r4, setR4] = useState<Result>(null);
  const [s4, setS4] = useState(false);

  const checkChoice = (
    val: string,
    correct: string,
    okMsg: string,
    failMsg: string
  ): Result => {
    if (!val) return { ok: false, msg: "Выберите вариант ответа." };
    return val === correct
      ? { ok: true, msg: okMsg }
      : { ok: false, msg: failMsg };
  };

  const checkNumeric = (
    val: string,
    target: number,
    tol: number,
    unit: string
  ): Result => {
    const n = parseFloat(val.replace(",", "."));
    if (isNaN(n)) return { ok: false, msg: "Введите число." };
    if (Math.abs(n - target) <= tol) {
      return { ok: true, msg: `Верно (±${tol} ${unit}): эталон ${target} ${unit}.` };
    }
    return { ok: false, msg: `Неверно. Эталон ${target} ${unit} (допуск ±${tol} ${unit}).` };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-slate-300 hover:text-amber-300 transition-colors text-sm"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            AEVION Smeta Trainer · Спецобъекты
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-200 mb-3">
            🔒 Исправительные учреждения и СИЗО
          </h1>
          <p className="text-slate-300 leading-relaxed">
            Строительство и реконструкция объектов уголовно-исполнительной системы (УИС)
            Казахстана — специализированная сфера, требующая глубокого понимания
            нормативов КУИС МВД РК, инженерных систем безопасности и особенностей
            режимного строительства.
          </p>
        </section>

        {/* Section 1 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-300 mb-4">
            1. Типы исправительных учреждений по РК
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-3">Тип ИУ</th>
                  <th className="text-left py-2 px-3">Категория осуждённых</th>
                  <th className="text-left py-2 px-3">Норма площади (м²/чел)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2 px-3 text-slate-200">СИЗО (следственный изолятор)</td>
                  <td className="py-2 px-3 text-slate-400">Подследственные, подсудимые</td>
                  <td className="py-2 px-3 text-amber-300">4–6 м²/чел</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">ИК общего режима</td>
                  <td className="py-2 px-3 text-slate-400">Впервые осуждённые за нетяжкие преступления</td>
                  <td className="py-2 px-3 text-amber-300">2,5–3,5 м²/чел</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">ИК строгого режима</td>
                  <td className="py-2 px-3 text-slate-400">Осуждённые за тяжкие и особо тяжкие</td>
                  <td className="py-2 px-3 text-amber-300">2,5 м²/чел</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">ИК особого режима</td>
                  <td className="py-2 px-3 text-slate-400">Пожизненно лишённые свободы</td>
                  <td className="py-2 px-3 text-amber-300">Одиночные камеры 8–12 м²</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Воспитательные колонии</td>
                  <td className="py-2 px-3 text-slate-400">Несовершеннолетние осуждённые</td>
                  <td className="py-2 px-3 text-amber-300">3,5 м²/чел + учебные классы</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-300 mb-4">
            2. Инженерные системы безопасности
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-950/60 border border-slate-600 p-4">
              <p className="text-amber-300 font-semibold mb-2">Периметровая охрана (ДТКС)</p>
              <p className="text-slate-300 leading-relaxed">
                Двойное телеволоконное кольцо с сигнализацией при прикосновении — стандарт
                для ИК строгого и особого режима. Внешнее кольцо — заграждение с датчиками,
                внутреннее — сигнализирующее. Между кольцами — запретная зона с освещением 50 лк.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/60 border border-slate-600 p-4">
              <p className="text-amber-300 font-semibold mb-2">Видеонаблюдение</p>
              <p className="text-slate-300 leading-relaxed">
                100%-е покрытие всех зон: камер периметра, коридоров, камер-одиночек, прогулочных
                дворов, мастерских и КПП. Хранение архива — не менее 30 суток.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/60 border border-slate-600 p-4">
              <p className="text-amber-300 font-semibold mb-2">Антиударное остекление</p>
              <p className="text-slate-300 leading-relaxed">
                Поликарбонат (PC) многослойный или армированное стекло триплекс.
                Поликарбонат выдерживает удар молотком и не даёт осколков при разрушении.
                Стандарт — PC 12–20 мм.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/60 border border-slate-600 p-4">
              <p className="text-amber-300 font-semibold mb-2">Бронированные двери</p>
              <p className="text-slate-300 leading-relaxed">
                Двери камер — класс защиты не ниже RC4 (ГОСТ Р 51072), с гидравлическими
                блокировками центрального пульта управления. Запоры — несимметричные,
                открываются только снаружи.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-300 mb-4">
            3. Строительные нормы ИУ
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-3">Параметр</th>
                  <th className="text-left py-2 px-3">Норматив</th>
                  <th className="text-left py-2 px-3">Документ-основание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2 px-3 text-slate-200">Площадь камеры СИЗО</td>
                  <td className="py-2 px-3 text-amber-300">не менее 4 м²/чел</td>
                  <td className="py-2 px-3 text-slate-400">УИК РК ст. 73</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Прогулочный двор</td>
                  <td className="py-2 px-3 text-amber-300">не менее 1,5 м²/чел</td>
                  <td className="py-2 px-3 text-slate-400">Правила КУИС МВД РК</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Освещение камеры</td>
                  <td className="py-2 px-3 text-amber-300">150 лк (непрерывно)</td>
                  <td className="py-2 px-3 text-slate-400">СанПиН РК для ИУ</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Освещение мастерских</td>
                  <td className="py-2 px-3 text-amber-300">400 лк</td>
                  <td className="py-2 px-3 text-slate-400">СП РК 2.04-01 (ОЕ для пром.)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Производственные мастерские</td>
                  <td className="py-2 px-3 text-amber-300">4 м²/рабочее место</td>
                  <td className="py-2 px-3 text-slate-400">Нормы КУИС МВД РК</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-300 mb-4">
            4. Специфика сметирования объектов УИС
          </h2>
          <ul className="text-sm text-slate-300 space-y-3 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-slate-200 font-semibold">Нормативы КУИС:</span>{" "}
                Комитет уголовно-исполнительной системы МВД РК ведёт отдельный перечень
                типовых проектов и нормативов для объектов УИС. Базовые ЭСН применяются
                с коэффициентами режимного строительства.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-slate-200 font-semibold">Закрытые тендеры:</span>{" "}
                аналогично военным объектам, госзакупки на строительство ИУ проводятся
                в закрытом режиме. Подрядчик должен получить допуск МВД РК.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-slate-200 font-semibold">Допуск подрядчика от МВД:</span>{" "}
                ключевой персонал (ИТР и прорабы) проходят проверку КНБ, заключается
                соглашение о неразглашении планировок режимных корпусов.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-slate-200 font-semibold">Удорожающие факторы:</span>{" "}
                ДТКС-периметр, антиударное остекление, бронированные двери и гидравлические
                запоры существенно увеличивают стоимость объекта по сравнению с жилым
                или промышленным строительством аналогичной площади.
              </span>
            </li>
          </ul>
        </section>

        {/* Exercises */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-300 mb-6">
            Интерактивные упражнения
          </h2>

          {/* Exercise 1 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-200 mb-2">
              Упражнение 1. Норма площади СИЗО
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Проектируется новый корпус СИЗО в Казахстане. Какова минимально допустимая
              норма площади на одного подследственного в камере?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Не менее 2 м² — как в советских нормах 1960-х годов",
                },
                {
                  v: "b",
                  t: "Не менее 4 м² (на практике — 4–6 м²) по Уголовно-исполнительному кодексу РК ст. 73",
                },
                {
                  v: "c",
                  t: "Не менее 9 м² — как в стандартах Европейского суда по правам человека",
                },
                {
                  v: "d",
                  t: "Норма не установлена — определяется заказчиком (КУИС) в каждом проекте",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    a1 === opt.v
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-slate-700/40 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={a1 === opt.v}
                    onChange={(e) => setA1(e.target.value)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="text-slate-300">
                    <span className="text-amber-300 font-mono mr-2">{opt.v})</span>
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() =>
                  setR1(
                    checkChoice(
                      a1,
                      "b",
                      "Верно: не менее 4 м² по УИК РК ст. 73, на практике — 4–6 м².",
                      "Неверно. УИК РК ст. 73 устанавливает минимум 4 м²/чел для СИЗО."
                    )
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS1((v) => !v)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
              >
                {s1 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r1 && (
              <p className={`mt-3 text-sm ${r1.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r1.msg}
              </p>
            )}
            {s1 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-slate-700/60 text-sm text-slate-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <p>
                  Уголовно-исполнительный кодекс РК, статья 73 «Условия содержания под стражей»:
                  норма жилой площади в камере СИЗО — не менее 4 м² на одного человека.
                  В новых проектах принимается 4–6 м², так как это нижний порог. Сметчик
                  при расчёте вместимости СИЗО должен закладывать именно эту норму как
                  базовую для определения площади режимных корпусов.
                </p>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">b</span>.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-200 mb-2">
              Упражнение 2. Периметровая охрана ДТКС
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              В смету ИК строгого режима включена система «ДТКС». Что это за система?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Дистанционная телекамерная система — видеонаблюдение по всему периметру",
                },
                {
                  v: "b",
                  t: "Двухтактная токовая кольцевая система — охранная сигнализация на основе тока",
                },
                {
                  v: "c",
                  t: "Двойное телеволоконное кольцо с сигнализацией при прикосновении — стандарт для ИК строгого/особого режима",
                },
                {
                  v: "d",
                  t: "Детекторная точечная контактная система — датчики на воротах и дверях",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    a2 === opt.v
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-slate-700/40 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={a2 === opt.v}
                    onChange={(e) => setA2(e.target.value)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="text-slate-300">
                    <span className="text-amber-300 font-mono mr-2">{opt.v})</span>
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() =>
                  setR2(
                    checkChoice(
                      a2,
                      "c",
                      "Верно: ДТКС — двойное телеволоконное кольцо с сигнализацией при прикосновении, стандарт для ИК строгого режима.",
                      "Неверно. ДТКС — двойное телеволоконное кольцо: датчик срабатывает при любом физическом контакте с заграждением."
                    )
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS2((v) => !v)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
              >
                {s2 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r2 && (
              <p className={`mt-3 text-sm ${r2.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r2.msg}
              </p>
            )}
            {s2 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-slate-700/60 text-sm text-slate-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <p>
                  ДТКС — двойное телеволоконное кольцо. Принцип работы: оптоволоконный кабель
                  встроен в заграждение (сетку или спираль). При прикосновении — изменение
                  параметров светового сигнала → немедленная тревога с указанием сектора.
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                  <li>Внешнее кольцо — первый уровень обнаружения</li>
                  <li>Внутреннее кольцо — подтверждение тревоги и дублирование</li>
                  <li>Между кольцами — запретная зона, освещение ≥ 50 лк, видеонаблюдение</li>
                  <li>Устойчив к помехам (ветер, осадки) при правильной настройке чувствительности</li>
                </ul>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">c</span>.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-200 mb-2">
              Упражнение 3. Расчёт площади ИК
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Проектируется исправительная колония на{" "}
              <span className="text-slate-200 font-semibold">500 заключённых</span>.
              Норма производственных мастерских — 4 м²/чел рабочего места.
              Норма жилой части — 6 м²/чел. Рассчитайте суммарную площадь
              жилой части и производственных мастерских (м²).
            </p>
            <p className="text-slate-500 text-xs mb-3">
              Жилая: 500 × 6 = 3 000 м² | Мастерские: 500 × 4 = 2 000 м² | Итого: ?
            </p>
            <input
              type="text"
              value={a3}
              onChange={(e) => setA3(e.target.value)}
              placeholder="Площадь, м²"
              className="w-full md:w-72 px-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-600 focus:border-amber-400 focus:outline-none text-sm"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setR3(checkNumeric(a3, 5000, 200, "м²"))}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS3((v) => !v)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
              >
                {s3 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r3 && (
              <p className={`mt-3 text-sm ${r3.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r3.msg}
              </p>
            )}
            {s3 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-slate-700/60 text-sm text-slate-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Жилая часть: 500 чел × 6 м²/чел = 3 000 м²</li>
                  <li>Производственные мастерские: 500 раб. мест × 4 м²/место = 2 000 м²</li>
                  <li>
                    Итого (жилая + мастерские):{" "}
                    <span className="text-amber-300 font-semibold">5 000 м²</span>
                  </li>
                </ul>
                <p className="mt-2 text-slate-400">
                  Кроме того, в общую площадь ИК входят: столовая (~2 м²/чел), медчасть,
                  ДККС-периметр, административный корпус, прогулочные дворики, охранные вышки —
                  итоговая площадь застройки обычно в 3–4 раза больше жилой + мастерских.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-200 mb-2">
              Упражнение 4. Остекление камер СИЗО
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Почему стеклянные окна в камерах СИЗО и ИК строгого режима заменяются
              на поликарбонат (PC) или армированное стекло?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Поликарбонат дешевле обычного стекла — это экономия по смете",
                },
                {
                  v: "b",
                  t: "Стекло плохо пропускает ультрафиолет, поликарбонат — лучше для здоровья",
                },
                {
                  v: "c",
                  t: "Поликарбонат лучше сохраняет тепло — снижает расходы на отопление",
                },
                {
                  v: "d",
                  t: "Высокая ударопрочность — предотвращение самоповреждений и побегов (поликарбонат выдерживает удар молотком)",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    a4 === opt.v
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-slate-700/40 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={a4 === opt.v}
                    onChange={(e) => setA4(e.target.value)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="text-slate-300">
                    <span className="text-amber-300 font-mono mr-2">{opt.v})</span>
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() =>
                  setR4(
                    checkChoice(
                      a4,
                      "d",
                      "Верно: поликарбонат выдерживает удар молотком — предотвращает самоповреждения и попытки побега.",
                      "Неверно. Главная причина — безопасность: поликарбонат не бьётся и не даёт острых осколков."
                    )
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS4((v) => !v)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
              >
                {s4 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r4 && (
              <p className={`mt-3 text-sm ${r4.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r4.msg}
              </p>
            )}
            {s4 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-slate-700/60 text-sm text-slate-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>
                    Поликарбонат (PC) толщиной 12–20 мм выдерживает удары молотком, кулаком,
                    металлическими предметами без разрушения.
                  </li>
                  <li>
                    При разрушении PC не образует острых осколков (в отличие от обычного стекла).
                  </li>
                  <li>
                    Цель — предотвращение самоповреждений (острыми осколками) и организации
                    отверстий для передачи запрещённых предметов или побега.
                  </li>
                  <li>
                    В смете PC-остекление обходится дороже обычного стекла примерно в 4–6 раз,
                    но это обязательное нормативное требование КУИС МВД РК.
                  </li>
                </ul>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">d</span>.
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-slate-800/60 pt-6 text-xs text-slate-500 text-center">
          Модуль AEVION Smeta Trainer · drawings-practice / prison-corrections · 2026
        </footer>
      </main>
    </div>
  );
}
