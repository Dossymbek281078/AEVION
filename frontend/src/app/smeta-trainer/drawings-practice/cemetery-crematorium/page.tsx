"use client";

import Link from "next/link";
import { useState } from "react";

type Result = { ok: boolean; msg: string } | null;

export default function CrematoriumPage() {
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
            AEVION Smeta Trainer · Ритуальная инфраструктура
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-400 mb-3">
            ⚱️ Кладбища и ритуальные объекты
          </h1>
          <p className="text-slate-300 leading-relaxed">
            Проектирование и сметирование ритуальной инфраструктуры в Казахстане
            регулируется отдельным законодательством и строительными нормами.
            Уважение к религиозным традициям и санитарные требования определяют
            как планировочные решения, так и состав работ в смете.
          </p>
        </section>

        {/* Section 1 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-400 mb-4">
            1. Типы ритуальных объектов
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-3">Тип объекта</th>
                  <th className="text-left py-2 px-3">Описание</th>
                  <th className="text-left py-2 px-3">Особенности сметы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2 px-3 text-slate-200">Открытое кладбище</td>
                  <td className="py-2 px-3 text-slate-400">Традиционное погребение в земле, разных конфессий</td>
                  <td className="py-2 px-3 text-slate-300">Планировка аллей, дренаж, ограждение, освещение</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Мусульманское (зиярат)</td>
                  <td className="py-2 px-3 text-slate-400">Строго ориентированные на Мекку захоронения</td>
                  <td className="py-2 px-3 text-slate-300">Ориентация Qibla, купольные надгробия (кесене)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Православное кладбище</td>
                  <td className="py-2 px-3 text-slate-400">Погребение с крестами, ориентация В–З</td>
                  <td className="py-2 px-3 text-slate-300">Часовня/храм на территории, ограда</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Крематорий</td>
                  <td className="py-2 px-3 text-slate-400">Кремация останков в специальных печах</td>
                  <td className="py-2 px-3 text-slate-300">Печи, дымоочистка, зал прощания, колумбарий</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Колумбарий</td>
                  <td className="py-2 px-3 text-slate-400">Хранение урн с прахом в нишах</td>
                  <td className="py-2 px-3 text-slate-300">Стеллажи/стены урн, отделка, освещение</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Ритуальный зал прощания</td>
                  <td className="py-2 px-3 text-slate-400">Церемониальное прощание с усопшим</td>
                  <td className="py-2 px-3 text-slate-300">Зал, комнаты ожидания, вентиляция (дезодорация)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-400 mb-4">
            2. Нормы планировки кладбища
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-4">
              <p className="text-amber-300 font-semibold mb-2">Размер места захоронения</p>
              <ul className="text-slate-300 space-y-1 leading-relaxed">
                <li>
                  <span className="text-slate-200">Мусульманский обряд:</span>{" "}
                  2,5 м × 1,5 м = 3,75 м² (с проходом — 5–6 м²/место)
                </li>
                <li>
                  <span className="text-slate-200">Европейский обряд:</span>{" "}
                  2,0 м × 1,0 м = 2,0 м² (с проходом — 4–5 м²/место)
                </li>
                <li>
                  <span className="text-slate-200">Детское:</span>{" "}
                  1,4 м × 0,7 м = 0,98 м²
                </li>
              </ul>
            </div>
            <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-4">
              <p className="text-amber-300 font-semibold mb-2">Распределение территории</p>
              <ul className="text-slate-300 space-y-1 leading-relaxed">
                <li>
                  <span className="text-slate-200">Зелёные насаждения:</span>{" "}
                  не менее 40% площади (ГОСТ 33584-2015)
                </li>
                <li>
                  <span className="text-slate-200">Аллеи и дороги:</span> 15–20%
                </li>
                <li>
                  <span className="text-slate-200">Рабочая зона захоронений:</span>{" "}
                  40–45% (оставшаяся часть)
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-950/60 border border-slate-700/60 p-4 text-sm">
            <p className="text-amber-300 font-semibold mb-2">Инфраструктура по СН РК 3.06-04</p>
            <div className="grid md:grid-cols-3 gap-3 text-slate-300">
              <div>
                <p className="text-slate-200 font-medium">Въезд и парковка</p>
                <p className="text-slate-400 text-xs mt-1">Автомобильные въезды для катафалков, стоянка 10–20 машино-мест на 1 га</p>
              </div>
              <div>
                <p className="text-slate-200 font-medium">Водоснабжение</p>
                <p className="text-slate-400 text-xs mt-1">Краны полива вдоль аллей через 50–100 м, канализация ливневых вод</p>
              </div>
              <div>
                <p className="text-slate-200 font-medium">Освещение</p>
                <p className="text-slate-400 text-xs mt-1">Аллеи ≥ 10 лк, главные дороги ≥ 20 лк — светодиодные опоры</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-400 mb-4">
            3. Крематорий — технический состав и смета
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-3">Элемент</th>
                  <th className="text-left py-2 px-3">Параметры</th>
                  <th className="text-left py-2 px-3">Стоимость (ориент.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2 px-3 text-slate-200">Кремационная печь (ретортная)</td>
                  <td className="py-2 px-3 text-slate-400">870–980°C, цикл 1,5–2 ч, газовая/электрическая</td>
                  <td className="py-2 px-3 text-amber-300">60–120 млн тг/шт</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Система дымоочистки</td>
                  <td className="py-2 px-3 text-slate-400">Фильтры частиц HEPA + активированный уголь, дожигатель</td>
                  <td className="py-2 px-3 text-amber-300">20–45 млн тг/ед.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Зал прощания</td>
                  <td className="py-2 px-3 text-slate-400">50–150 м², акустика, приглушённое освещение, вентиляция</td>
                  <td className="py-2 px-3 text-amber-300">По площади, ≈ 450–800 тыс. тг/м²</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Колумбарий для урн</td>
                  <td className="py-2 px-3 text-slate-400">Ниши 30×30×30 см, 1 урна/нишу, мрамор/гранит/бетон</td>
                  <td className="py-2 px-3 text-amber-300">180–350 тыс. тг/ниша</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-200">Система вентиляции</td>
                  <td className="py-2 px-3 text-slate-400">Принудительная, дезодорация, 10-кратный воздухообмен/ч</td>
                  <td className="py-2 px-3 text-amber-300">По объёму здания</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4 */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-400 mb-4">
            4. Нормативная база
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
            <li>
              <span className="text-amber-300 font-mono">ЗРК «О погребении и похоронном деле»</span>{" "}
              (2001 г.) — основной закон, регулирующий все аспекты ритуальной деятельности в РК.
            </li>
            <li>
              <span className="text-amber-300 font-mono">СН РК 3.06-04</span>{" "}
              «Кладбища. Нормы проектирования» — планировочные нормы, требования к территории,
              санитарным разрывам, инфраструктуре.
            </li>
            <li>
              <span className="text-amber-300 font-mono">ГОСТ 33584-2015</span>{" "}
              «Услуги бытовые. Услуги ритуальные. Правила оказания услуг по погребению»
              — нормы по размерам мест захоронения, аллей, зелёных насаждений.
            </li>
            <li>
              <span className="text-amber-300 font-mono">СанПиН РК</span>{" "}
              — санитарно-защитная зона: минимум 500 м от жилой застройки до границы кладбища.
            </li>
            <li>
              <span className="text-amber-300 font-mono">Экологический кодекс РК</span>{" "}
              + директивы ЕС по крематориям — требования к дымоочистке:
              концентрация диоксинов/фуранов не более 0,1 нг ТЭ/м³ (норматив ЕС 2000/76/ЕС).
            </li>
          </ul>
        </section>

        {/* Exercises */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-400 mb-6">
            Интерактивные упражнения
          </h2>

          {/* Exercise 1 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-200 mb-2">
              Упражнение 1. Санитарный разрыв кладбища
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Застройщик планирует новое жилое микрорайон в 300 м от городского кладбища.
              Соответствует ли это нормам? Каково минимальное санитарное расстояние?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "100 м — достаточно при наличии лесополосы шириной 50 м",
                },
                {
                  v: "b",
                  t: "500 м по СанПиН РК и СН РК 3.06-04 — застройщик нарушает норму",
                },
                {
                  v: "c",
                  t: "200 м — при условии использования закрытых гробов и герметичных склепов",
                },
                {
                  v: "d",
                  t: "Санитарный разрыв законодательно не установлен — определяется местным ДСЭК",
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
                      "Верно: минимум 500 м по СанПиН РК и СН РК 3.06-04. 300 м — нарушение.",
                      "Неверно. Санитарный разрыв чётко установлен — 500 м от кладбища до жилой застройки."
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
                  СН РК 3.06-04 «Кладбища. Нормы проектирования» и СанПиН РК устанавливают
                  санитарно-защитную зону не менее <span className="text-amber-300 font-semibold">500 м</span>{" "}
                  от границы кладбища до жилой застройки, детских учреждений, объектов здравоохранения.
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                  <li>300 м — прямое нарушение. Строительство жилья будет заблокировано ДСЭК.</li>
                  <li>Исключение: закрытые кладбища без новых захоронений — норма 100 м.</li>
                  <li>
                    Для крематориев СЗЗ может быть иной — от 300 до 500 м в зависимости
                    от класса очистки дымовых газов.
                  </li>
                </ul>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">b</span>.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-200 mb-2">
              Упражнение 2. Особенности мусульманского захоронения
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Проектируется мусульманское кладбище (зиярат) в г. Алматы. Какие обязательные
              особенности планировки и обряда необходимо учесть?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Кремационный зал для традиционного обряда + колумбарий для хранения праха",
                },
                {
                  v: "b",
                  t: "Ориентация могил с С на Ю + деревянные гробы обязательны + надгробный крест",
                },
                {
                  v: "c",
                  t: "Строгая ориентация Qibla (на Мекку), без кремации — только погребение в землю, без гроба (или в деревянном)",
                },
                {
                  v: "d",
                  t: "Никаких специальных требований к ориентации — это личное дело семьи",
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
                      "Верно: ориентация Qibla (на Мекку), только погребение в землю, без кремации, как правило без гроба или в деревянном.",
                      "Неверно. Ключевое требование — ориентация на Мекку (Qibla) и только традиционное погребение без кремации."
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
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>
                    <span className="text-slate-300">Ориентация Qibla</span> — покойник должен
                    лежать на правом боку лицом к Мекке. Для Алматы это направление на юго-запад
                    (~235°). Все ряды могил планируются параллельно этому направлению.
                  </li>
                  <li>
                    <span className="text-slate-300">Кремация запрещена</span> — исламские
                    нормы предписывают погребение только в землю.
                  </li>
                  <li>
                    <span className="text-slate-300">Гроб</span> — по канону не нужен,
                    тело заворачивается в саван (кафан). Деревянный гроб допускается
                    как исключение при требованиях санитарных органов.
                  </li>
                  <li>
                    <span className="text-slate-300">Для сметчика</span> — планировочные
                    ряды размечаются с учётом азимута Qibla, что влияет на трассировку
                    аллей и дренажных канав.
                  </li>
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
              Упражнение 3. Количество мест захоронения
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Проектируется городское кладбище площадью{" "}
              <span className="text-slate-200 font-semibold">10 га (100 000 м²)</span>.
              Зелёные насаждения — 40% = 40 000 м². Аллеи и дороги — 0% уже учтены.
              Рабочая площадь под захоронения — 60% = 60 000 м².
              Площадь 1 места захоронения (с проходом) — 6 м².
              Сколько мест захоронения вмещает кладбище?
            </p>
            <p className="text-slate-500 text-xs mb-3">
              Рабочая зона 100 000 × 0,60 = 60 000 м² ÷ 6 м²/место = ?
            </p>
            <input
              type="text"
              value={a3}
              onChange={(e) => setA3(e.target.value)}
              placeholder="Количество мест"
              className="w-full md:w-72 px-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-600 focus:border-amber-400 focus:outline-none text-sm"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setR3(checkNumeric(a3, 10000, 500, "мест"))}
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
                  <li>Общая площадь кладбища: 10 га = 100 000 м²</li>
                  <li>Зелёные насаждения 40%: 100 000 × 0,40 = 40 000 м²</li>
                  <li>Рабочая зона 60%: 100 000 × 0,60 = 60 000 м²</li>
                  <li>
                    Количество мест: 60 000 ÷ 6 м²/место ={" "}
                    <span className="text-amber-300 font-semibold">10 000 мест</span>
                  </li>
                </ul>
                <p className="mt-2 text-slate-400">
                  При среднем числе смертей по РК ≈ 130 тыс./год и доле населения одного
                  города — кладбища 10 га рассчитываются на 15–25 лет эксплуатации.
                  Планировочный расчёт вместимости — обязательная часть ТЭО для нового кладбища.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-200 mb-2">
              Упражнение 4. Экологические требования к крематорию
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              В смету нового крематория включена система дымоочистки. Почему это обязательный
              пункт, а не опциональный? Что именно требуется?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Дымоочистка нужна только эстетически — чтобы не было видимого дыма из трубы",
                },
                {
                  v: "b",
                  t: "Фильтр нужен только для задержания крупных частиц золы — обычный циклон",
                },
                {
                  v: "c",
                  t: "Требуется только при размещении крематория в жилой зоне — в промышленной не нужно",
                },
                {
                  v: "d",
                  t: "Дымоочистные установки (фильтры HEPA + активированный уголь) для нейтрализации диоксинов/фуранов — требование Экологического кодекса РК и директив ЕС",
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
                      "Верно: HEPA + активированный уголь для нейтрализации диоксинов/фуранов — требование Экологического кодекса РК.",
                      "Неверно. Полная система дымоочистки обязательна — при кремации образуются диоксины и фураны, которые необходимо нейтрализовать."
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
                <p className="mb-2">
                  При кремации тела при температуре 870–980°C образуются опасные органические
                  соединения — диоксины и фураны (ПХДД/ПХДФ), которые являются канцерогенами
                  группы 1 по IARC. Выброс без очистки — прямое нарушение Экологического кодекса РК.
                </p>
                <p className="font-medium text-slate-200 mb-1">Обязательный состав системы дымоочистки:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>
                    <span className="text-slate-300">Дожигатель</span> — вторичная камера сгорания
                    при 1 100°C, разрушает диоксины до 99,9%
                  </li>
                  <li>
                    <span className="text-slate-300">Фильтр твёрдых частиц HEPA (или рукавный)</span> —
                    задерживает частицы ≥ 0,3 мкм, включая тяжёлые металлы
                  </li>
                  <li>
                    <span className="text-slate-300">Адсорбер на активированном угле</span> —
                    улавливает остаточные диоксины и ртуть (из зубных амальгам)
                  </li>
                  <li>
                    <span className="text-slate-300">Норматив выброса</span> — не более 0,1 нг ТЭ/м³
                    диоксинов (директива ЕС 2000/76/ЕС, адаптированная в РК)
                  </li>
                </ul>
                <p className="mt-2 text-slate-400">
                  Стоимость системы дымоочистки — 20–45 млн тг на 1 печь. Без неё
                  крематорий не получит разрешение на ввод в эксплуатацию от ДЭГР РК.
                </p>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">d</span>.
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-slate-800/60 pt-6 text-xs text-slate-500 text-center">
          Модуль AEVION Smeta Trainer · drawings-practice / cemetery-crematorium · 2026
        </footer>
      </main>
    </div>
  );
}
