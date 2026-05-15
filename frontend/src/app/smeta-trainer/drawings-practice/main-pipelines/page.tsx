"use client";
import Link from "next/link";
import { useState } from "react";

export default function MainPipelinesPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState<boolean>(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex1Correct = ex1 === "c";
  const ex2Correct = ex2 === "b";
  const ex4Correct = ex4 === "d";

  const ex3Target = 200_000_000_000;
  const ex3Tolerance = 15_000_000_000;
  const ex3Value = Number(ex3.replace(/[\s_]/g, ""));
  const ex3Correct =
    ex3Checked && !Number.isNaN(ex3Value) && Math.abs(ex3Value - ex3Target) <= ex3Tolerance;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-blue-300 hover:text-blue-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">
            AEVION Smeta Trainer · Магистральные трубопроводы
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🛢️ Магистральные нефте- и газопроводы
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Магистральные трубопроводы — это линейные объекты I категории
            ответственности, протяжённостью сотни и тысячи километров, по которым
            транспортируется нефть, газ, нефтепродукты и широкая фракция лёгких
            углеводородов под высоким давлением. Сметная стоимость прокладки 1
            км магистрали Ø1020 мм в условиях РК составляет 350–450 млн тг (с
            учётом ЭХЗ, изоляции, переходов и НПС). В модуле — классификация
            СНиП РК 5.04-26, материалы, сварка, изоляция, ЭХЗ, НПС/КС и
            бенчмарки крупнейших магистралей Казахстана (КТК, Туркмения–Китай,
            Атасу–Алашанькоу, Бейнеу–Бозой–Шымкент).
          </p>
        </section>

        {/* Section 1 — Классификация */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            1. Классификация СНиП РК 5.04-26
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Категория В</span> — газопроводы
              СД (среднего давления), I–IV категории по СНиП РК 5.04-26.
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Диаметры</span>: 530 / 720 / 820
              / 1020 / 1220 / 1420 мм (DN500–DN1400).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Рабочее давление</span>: до 9,8
              МПа для нефтепроводов, до 7,4 МПа для газопроводов.
            </li>
            <li>
              <span className="text-slate-500">•</span> Минимальная толщина
              стенки рассчитывается из давления, диаметра и марки стали (обычно
              8–22 мм).
            </li>
          </ul>
        </section>

        {/* Section 2 — Трубы */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            2. Трубы и материалы
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Сталь</span>: 17Г1С-У, классы
              прочности K52–K60 (предел текучести 360–415 МПа).
            </li>
            <li>
              <span className="text-slate-500">•</span> Трубы{" "}
              <span className="text-slate-200">спирально-шовные</span> (ССШ) и{" "}
              <span className="text-slate-200">продольно-шовные</span> (ПШ,
              двухшовные ESW/SAWL).
            </li>
            <li>
              <span className="text-slate-500">•</span> Заводы РК: AKTAU PIPE
              PLANT (KSP Steel, Актау), Уральский трубный завод.
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Цена</span> тонны Ø1020×12 мм =
              380–560 тыс. тг/т (2026, FCA завод).
            </li>
          </ul>
        </section>

        {/* Section 3 — Земляные работы */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            3. Земляные работы
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Глубина заложения</span>: 0,8–2,0
              м от верха трубы до планировочной отметки (зависит от диаметра,
              грунта, района промерзания).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Ширина бермы</span> отвала: 8–10
              м с каждой стороны траншеи (для проезда техники).
            </li>
            <li>
              <span className="text-slate-500">•</span> Откосы по углу
              естественного откоса грунта (1:0,5 – 1:1).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Подсыпка</span> песком 200 мм под
              трубой + 200 мм над верхом трубы.
            </li>
          </ul>
        </section>

        {/* Section 4 — Сварка */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            4. Сварка стыков
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Автоматическая орбитальная</span>{" "}
              сварка: CRC-Evans, ESAB, Lincoln (полевые комплексы).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Контроль 100%</span>: визуальный,
              радиографический (RT), ультразвуковой (УЗК), капиллярный (ПВК) на
              ответственных участках.
            </li>
            <li>
              <span className="text-slate-500">•</span> Нормативы: СТО Газпром
              2-2.4-149, РД Транснефть, СНиП РК 5.04-26.
            </li>
            <li>
              <span className="text-slate-500">•</span> Бракованный стык
              переваривается или вырезается катушкой (300–500 мм).
            </li>
          </ul>
        </section>

        {/* Section 5 — Изоляция */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            5. Изоляция труб
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span> Заводская{" "}
              <span className="text-slate-200">
                трёхслойная полиэтиленовая
              </span>{" "}
              (3LPE / ППЭ) изоляция по ГОСТ Р 51164.
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Толщина</span> покрытия: 2,4–3,7
              мм (зависит от диаметра и класса нагрузки).
            </li>
            <li>
              <span className="text-slate-500">•</span> Слои: эпоксидный
              праймер + адгезив + полиэтилен.
            </li>
            <li>
              <span className="text-slate-500">•</span> Стыки после сварки
              изолируются{" "}
              <span className="text-slate-200">термоусадочными манжетами</span>{" "}
              (Raychem, Canusa, отечественные аналоги).
            </li>
          </ul>
        </section>

        {/* Section 6 — ЭХЗ */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            6. Электрохимическая защита (ЭХЗ)
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">СКЗ</span> — станции катодной
              защиты, шаг 5–25 км (зависит от удельного сопротивления грунта).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Анодные заземлители</span> —
              глубинные (60–100 м) или подповерхностные (Mg/Zn протекторы).
            </li>
            <li>
              <span className="text-slate-500">•</span> Защитный потенциал
              трубы: −0,85 ÷ −1,15 В относительно МСЭ (медносульфатного
              электрода сравнения).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Изолирующие фланцы</span> (ИФС)
              разделяют участки с разной катодной поляризацией.
            </li>
          </ul>
        </section>

        {/* Section 7 — НПС/КС */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            7. НПС / КС — перекачивающие станции
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Шаг</span> между станциями:
              100–200 км по магистрали.
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Нефтяные НПС</span>: насосные
              агрегаты НМ 2500–7000 м³/ч (Sulzer, Bornemann, ЭНА).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Газовые КС</span>: центробежные
              компрессоры с приводом от ГТУ 16–32 МВт (Siemens SGT-600/700,
              GE PGT25, ОДК).
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Резервуарный парк</span> на НПС:
              РВС-20 000…50 000 м³, понтонные, с плавающей крышей.
            </li>
          </ul>
        </section>

        {/* Section 8 — Пересечения */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            8. Пересечения с препятствиями
          </h2>
          <ul className="text-slate-300 text-sm space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">ГНБ</span>{" "}
              (горизонтально-направленное бурение) — через малые/средние реки,
              автодороги, ж/д. Длина переходов до 1500 м.
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">Дюкер</span> — через крупные реки
              (Иртыш, Урал, Сырдарья) — 2-х ниточный с резервированием.
            </li>
            <li>
              <span className="text-slate-500">•</span>{" "}
              <span className="text-slate-200">ПП</span> (подземная прокладка)
              через хребты с компенсаторами температурных деформаций.
            </li>
            <li>
              <span className="text-slate-500">•</span> Линейные краны
              шарового типа с электро/пневмоприводом — шаг 20–30 км для отсечки
              аварийных участков.
            </li>
          </ul>
        </section>

        {/* Section 9 — Бенчмарки РК */}
        <section className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            9. Бенчмарки магистралей РК
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-200">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="text-left py-2 pr-4">Магистраль</th>
                  <th className="text-left py-2 pr-4">Маршрут</th>
                  <th className="text-right py-2 pr-4">Длина по РК, км</th>
                  <th className="text-right py-2">Ø, мм</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2 pr-4">КТК (нефть)</td>
                  <td className="py-2 pr-4">Тенгиз — Новороссийск</td>
                  <td className="py-2 pr-4 text-right">1511</td>
                  <td className="py-2 text-right">1067</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Туркм. — Китай (газ)</td>
                  <td className="py-2 pr-4">Зап.+Центр. нитки A/B/C</td>
                  <td className="py-2 pr-4 text-right">1830</td>
                  <td className="py-2 text-right">1067/1219</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Атасу — Алашанькоу (нефть)</td>
                  <td className="py-2 pr-4">Атасу — граница с КНР</td>
                  <td className="py-2 pr-4 text-right">962</td>
                  <td className="py-2 text-right">813</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Бейнеу — Бозой — Шымкент (газ)</td>
                  <td className="py-2 pr-4">Бейнеу — Шымкент</td>
                  <td className="py-2 pr-4 text-right">1477</td>
                  <td className="py-2 text-right">1020–1220</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-amber-200/70">
            Себестоимость прокладки магистрали Ø1020 мм в условиях РК = 350–450
            млн тг/км (с учётом труб, сварки, изоляции, ЭХЗ, переходов; без
            НПС/КС и резервуарных парков).
          </p>
        </section>

        {/* Exercises */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-50">
            🎯 Практические задания
          </h2>

          {/* Exercise 1 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">
              Задание 1. Диаметр газопровода Бейнеу — Бозой — Шымкент?
            </h3>
            <div className="space-y-2 text-sm">
              {[
                ["a", "530 мм"],
                ["b", "820 мм"],
                ["c", "1020–1220 мм"],
                ["d", "2000 мм"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 cursor-pointer rounded px-3 py-2 transition ${
                    ex1 === key
                      ? key === "c"
                        ? "bg-emerald-900/40 border border-emerald-700"
                        : "bg-rose-900/40 border border-rose-700"
                      : "hover:bg-slate-800/40 border border-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={key}
                    checked={ex1 === key}
                    onChange={() => setEx1(key)}
                    className="accent-blue-500"
                  />
                  <span className="text-slate-500 mr-1">{key})</span> {label}
                </label>
              ))}
            </div>
            {ex1 && (
              <p
                className={`text-sm mt-2 ${
                  ex1Correct ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex1Correct
                  ? "✓ Верно. Магистраль Бейнеу–Бозой–Шымкент проложена трубами Ø1020–1220 мм."
                  : "✗ Неверно. Правильный ответ — c) 1020–1220 мм."}
              </p>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">
              Задание 2. Что такое СКЗ в магистральных трубопроводах?
            </h3>
            <div className="space-y-2 text-sm">
              {[
                ["a", "Система контроля задвижек"],
                [
                  "b",
                  "Станция катодной защиты — электрохимическая защита от коррозии путём наложения отрицательного потенциала на трубу",
                ],
                ["c", "Серверная контрольной зоны"],
                ["d", "Система кранов запорных"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-start gap-2 cursor-pointer rounded px-3 py-2 transition ${
                    ex2 === key
                      ? key === "b"
                        ? "bg-emerald-900/40 border border-emerald-700"
                        : "bg-rose-900/40 border border-rose-700"
                      : "hover:bg-slate-800/40 border border-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={key}
                    checked={ex2 === key}
                    onChange={() => setEx2(key)}
                    className="accent-blue-500 mt-1"
                  />
                  <span>
                    <span className="text-slate-500 mr-1">{key})</span>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            {ex2 && (
              <p
                className={`text-sm mt-2 ${
                  ex2Correct ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex2Correct
                  ? "✓ Верно. СКЗ накладывает катодный потенциал и сдвигает электрохимическое равновесие в сторону восстановления, защищая металл от коррозии."
                  : "✗ Неверно. Правильный ответ — b) станция катодной защиты."}
              </p>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">
              Задание 3. Расчёт стоимости магистрали
            </h3>
            <p className="text-sm text-slate-300">
              Магистраль длиной <span className="text-amber-300">500 км</span>,
              бенчмарк прокладки —{" "}
              <span className="text-amber-300">400 млн тг/км</span>. Рассчитайте
              ориентировочную стоимость прокладки (без НПС/КС), в тенге.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={ex3}
                onChange={(e) => {
                  setEx3(e.target.value);
                  setEx3Checked(false);
                }}
                placeholder="например 200000000000"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 text-sm">тг</span>
              <button
                onClick={() => setEx3Checked(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm rounded px-4 py-2 transition"
              >
                Проверить
              </button>
            </div>
            {ex3Checked && (
              <p
                className={`text-sm mt-2 ${
                  ex3Correct ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex3Correct
                  ? "✓ Верно. 500 км × 400 000 000 тг/км = 200 000 000 000 тг (200 млрд тг)."
                  : "✗ Неверно. Ожидаемо ≈ 200 млрд тг (500 × 400 млн)."}
              </p>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">
              Задание 4. Какой контроль сварных стыков на магистрали категории В?
            </h3>
            <div className="space-y-2 text-sm">
              {[
                ["a", "Только визуальный осмотр"],
                ["b", "Только УЗК (ультразвуковой)"],
                ["c", "Только радиографический контроль"],
                [
                  "d",
                  "100% радиограф + 100% УЗК + визуальный + капиллярный (ПВК) на ответственных участках",
                ],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-start gap-2 cursor-pointer rounded px-3 py-2 transition ${
                    ex4 === key
                      ? key === "d"
                        ? "bg-emerald-900/40 border border-emerald-700"
                        : "bg-rose-900/40 border border-rose-700"
                      : "hover:bg-slate-800/40 border border-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={key}
                    checked={ex4 === key}
                    onChange={() => setEx4(key)}
                    className="accent-blue-500 mt-1"
                  />
                  <span>
                    <span className="text-slate-500 mr-1">{key})</span>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            {ex4 && (
              <p
                className={`text-sm mt-2 ${
                  ex4Correct ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex4Correct
                  ? "✓ Верно. Для магистралей категории В требуется комплексный неразрушающий контроль 100% стыков по СТО Газпром 2-2.4-149 / РД Транснефть."
                  : "✗ Неверно. Правильный ответ — d) комплексный 100% контроль (RT + УЗК + ВИК + ПВК)."}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            📚 Нормативные документы
          </h2>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• СНиП РК 5.04-26 — Магистральные трубопроводы</li>
            <li>• ГОСТ Р 51164 — Трубопроводы стальные магистральные. Покрытия наружные защитные</li>
            <li>• СТО Газпром 2-2.4-149 — Сварка и контроль сварных соединений</li>
            <li>• РД Транснефть — Технология и контроль сварки магистральных нефтепроводов</li>
            <li>• ССЦ РК 81-02-08 — Магистральные трубопроводы (укрупнённые расценки)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
