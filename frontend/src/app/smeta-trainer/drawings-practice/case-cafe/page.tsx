"use client";

import Link from "next/link";
import { useState } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────

function checkNumeric(input: string, expected: number, tolerance = 0.15): boolean {
  const v = parseFloat(input.trim().replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tolerance;
}

// ── Сводный сметный расчёт ────────────────────────────────────────────────────

interface Section {
  num: number;
  name: string;
  cost: number;
}

const SECTIONS: Section[] = [
  { num: 1, name: "Демонтаж существующих перегородок и отделки", cost: 480_000 },
  { num: 2, name: "Перепланировка + стены ГКЛ + перегородки", cost: 1_850_000 },
  { num: 3, name: "Полы: керамогранит 95 м² (зал) + плитка 45 м² (кухня/санузлы)", cost: 1_200_000 },
  { num: 4, name: "Потолок подвесной + декоративный свет", cost: 1_600_000 },
  { num: 5, name: "Сантехника + 2 санузла (унитазы, раковины, трапы, разводка)", cost: 950_000 },
  { num: 6, name: "Кухня: монтаж технологии + жироуловитель + разводка газа", cost: 2_400_000 },
  { num: 7, name: "ОВК + кондиционирование (мульти-сплит + общеобменная вентиляция)", cost: 3_200_000 },
  { num: 8, name: "АПС/СОУЭ + СКУД + видеонаблюдение", cost: 1_100_000 },
];

const SMR_TOTAL = SECTIONS.reduce((s, x) => s + x.cost, 0);
const EQUIPMENT_FURNITURE = 8_500_000;
const GRAND_TOTAL = SMR_TOTAL + EQUIPMENT_FURNITURE;

// ── Спецсистемы ───────────────────────────────────────────────────────────────

interface SpecItem {
  name: string;
  spec: string;
  cost: number;
}

const SPEC_SYSTEMS: SpecItem[] = [
  {
    name: "Кухонная вытяжка с зонтом",
    spec: "6000 м³/ч + жирофильтры лабиринт + огнезадерживающий клапан EI60",
    cost: 1_350_000,
  },
  {
    name: "Жироуловитель проточный",
    spec: "Производительность 4 л/с, 2-х секционный, нерж. сталь",
    cost: 380_000,
  },
  {
    name: "Кондиционер мульти-сплит",
    spec: "Схема 5:1, общая мощность охлаждения 14 кВт",
    cost: 1_850_000,
  },
  {
    name: "АПС адресная Болид",
    spec: "С2000-КДЛ + 28 шт ИП-212-141А + 4 шт ИПР-513",
    cost: 750_000,
  },
  {
    name: "СОУЭ тип 2",
    spec: "Световые табло «ВЫХОД» + звуковые оповещатели Маяк-12-3М",
    cost: 350_000,
  },
  {
    name: "СКУД на вход + видеонаблюдение",
    spec: "Электромагнитный замок + считыватель + 4 IP-камеры FullHD",
    cost: 750_000,
  },
];

// ── Чек-лист согласований ─────────────────────────────────────────────────────

const APPROVALS = [
  {
    title: "СЭС РК (санитарно-эпидемиологическое заключение)",
    detail: "Обязательно ДО открытия. Проверка зонирования (грязная/чистая зона), вентиляции, водоснабжения, утилизации отходов.",
  },
  {
    title: "Пожарная инспекция (ДЧС)",
    detail: "Проверка АПС, СОУЭ, путей эвакуации (мин. 2 выхода для зала &gt; 50 чел.), огнестойкости конструкций.",
  },
  {
    title: "Согласование вентиляции с ЖКХ (если БЦ или МКД)",
    detail: "Кухонная вытяжка должна выводиться выше конька крыши на 1 м, с шумоглушителем. Обязательное согласование с управляющей компанией.",
  },
  {
    title: "Лицензия на алкоголь (если планируется)",
    detail: "Комитет госдоходов МФ РК. Лицензионный сбор + расстояние до школ/больниц мин. 100 м.",
  },
  {
    title: "Декларация соответствия на кухонное оборудование",
    detail: "Все плиты, печи, духовки, посудомоечные машины — должны иметь сертификат ЕАЭС или РК.",
  },
];

// ── ESN catalog ──────────────────────────────────────────────────────────────

const ESN_RATES = [
  { code: "Сб.10-01-002", name: "Демонтаж перегородок ГКЛ", unit: "100 м²", price: "~32 000 тг" },
  { code: "Сб.10-04-007", name: "Устройство перегородок ГКЛ С111", unit: "100 м²", price: "~185 000 тг" },
  { code: "Сб.11-01-027", name: "Облицовка пола керамогранитом", unit: "100 м²", price: "~95 000 тг" },
  { code: "Сб.15-04-005", name: "Подвесной потолок Армстронг", unit: "100 м²", price: "~78 000 тг" },
  { code: "Сб.16-04-001", name: "Прокладка воздуховодов из оцинковки", unit: "100 м²", price: "~125 000 тг" },
  { code: "Сб.16-08-002", name: "Монтаж зонта вытяжного над плитой", unit: "1 шт", price: "~58 000 тг" },
  { code: "Сб.17-03-014", name: "Установка жироуловителя проточного", unit: "1 шт", price: "~24 000 тг" },
  { code: "Сб.20-03-008", name: "Монтаж АПС адресной (на 1 шлейф)", unit: "100 м", price: "~45 000 тг" },
];

// ──────────────────────────────────────────────────────────────────────────────

export default function CaseCafePage() {
  // Упражнение 1: расход кухонной вытяжки
  const [ex1, setEx1] = useState("");
  const [ex1Show, setEx1Show] = useState(false);
  const ex1Result = ex1 ? checkNumeric(ex1, 5800, 0.15) : null;

  // Упражнение 2: жироуловитель (multiple choice)
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Show, setEx2Show] = useState(false);

  // Упражнение 3: тип СОУЭ (multiple choice)
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Show, setEx3Show] = useState(false);

  // Упражнение 4: площадь дымоудаления
  const [ex4, setEx4] = useState("");
  const [ex4Show, setEx4Show] = useState(false);
  const ex4Result = ex4 ? checkNumeric(ex4, 0.16, 0.15) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-rose-900/40 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-rose-300 hover:text-rose-200 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs uppercase tracking-widest text-rose-400/70">
            Capstone-кейс № 4 · общественное питание
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {/* ── Заголовок ─────────────────────────────────────────────────────── */}
        <section>
          <h1 className="text-4xl md:text-5xl font-bold text-rose-200">
            ☕ КЕЙС: Кафе 50 мест 140 м² — полная смета
          </h1>
          <p className="mt-3 text-lg text-slate-400">
            г. Астана · аренда 1-го этажа в БЦ · ремонт под общепит «под ключ»
          </p>
        </section>

        {/* ── Intro ─────────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-rose-900/40 bg-gradient-to-br from-rose-950/40 via-slate-900/60 to-pink-950/30 p-8">
          <h2 className="text-2xl font-semibold text-rose-200 mb-4">📋 Исходные данные</h2>
          <div className="grid md:grid-cols-2 gap-6 text-slate-300">
            <ul className="space-y-2 list-disc list-inside">
              <li>Аренда 1-го этажа в БЦ, г. Астана</li>
              <li>Общая площадь: <b className="text-rose-200">140 м²</b></li>
              <li>Зал на <b className="text-rose-200">50 посадочных мест</b> — 80 м²</li>
              <li>Кухня (горячий + холодный цех) — 35 м²</li>
              <li>Подсобные помещения (склад, раздевалка) — 20 м²</li>
              <li>Санузлы (М/Ж + персонал) — 5 м²</li>
            </ul>
            <ul className="space-y-2 list-disc list-inside">
              <li>Системы: ОВК + спец. кухонная вентиляция</li>
              <li>Жироуловитель проточный (обязательно!)</li>
              <li>АПС/СОУЭ + СКУД на вход</li>
              <li>Кондиционирование мульти-сплит</li>
              <li>Бюджет: <b className="text-rose-200">18-32 млн тг</b></li>
              <li>Срок реализации: 8-10 недель</li>
            </ul>
          </div>
        </section>

        {/* ── Section 1: Сводный расчёт ─────────────────────────────────────── */}
        <section>
          <h2 className="text-3xl font-bold text-rose-200 mb-6">
            1️⃣ Сводный сметный расчёт по разделам
          </h2>
          <div className="overflow-x-auto rounded-xl border border-rose-900/40">
            <table className="w-full text-sm">
              <thead className="bg-rose-950/40 text-rose-200">
                <tr>
                  <th className="px-4 py-3 text-left">№</th>
                  <th className="px-4 py-3 text-left">Раздел</th>
                  <th className="px-4 py-3 text-right">Стоимость, тг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-900/30">
                {SECTIONS.map((s) => (
                  <tr key={s.num} className="hover:bg-rose-950/20 transition">
                    <td className="px-4 py-3 text-slate-400">{s.num}</td>
                    <td className="px-4 py-3 text-slate-200">{s.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-200">
                      {s.cost.toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
                <tr className="bg-rose-950/30 font-semibold">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-rose-200">ИТОГО СМР по разделам</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-100">
                    {SMR_TOTAL.toLocaleString("ru-RU")}
                  </td>
                </tr>
                <tr className="bg-pink-950/30">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-pink-200">+ Оборудование и мебель (отдельной поставкой)</td>
                  <td className="px-4 py-3 text-right font-mono text-pink-100">
                    {EQUIPMENT_FURNITURE.toLocaleString("ru-RU")}
                  </td>
                </tr>
                <tr className="bg-gradient-to-r from-rose-900/50 to-pink-900/50 text-lg font-bold">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-rose-100">ВСЕГО ПОД КЛЮЧ</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-50">
                    {GRAND_TOTAL.toLocaleString("ru-RU")} тг
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Стоимость на 1 м²: <b className="text-rose-200">~{Math.round(GRAND_TOTAL / 140).toLocaleString("ru-RU")} тг/м²</b>{" "}
            · стоимость на 1 посадочное место: <b className="text-rose-200">~{Math.round(GRAND_TOTAL / 50).toLocaleString("ru-RU")} тг/место</b>
          </p>
        </section>

        {/* ── Section 2: Спецсистемы ─────────────────────────────────────── */}
        <section>
          <h2 className="text-3xl font-bold text-rose-200 mb-6">
            2️⃣ Детализация спецсистем кафе
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {SPEC_SYSTEMS.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-rose-900/40 bg-slate-900/60 p-5 hover:border-rose-700/60 transition"
              >
                <div className="flex justify-between items-start gap-4">
                  <h3 className="font-semibold text-rose-200">{item.name}</h3>
                  <span className="font-mono text-pink-300 text-sm whitespace-nowrap">
                    {item.cost.toLocaleString("ru-RU")} тг
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{item.spec}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Упражнения ────────────────────────────────────────── */}
        <section>
          <h2 className="text-3xl font-bold text-rose-200 mb-6">
            3️⃣ Интерактивные упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="rounded-xl border border-rose-900/40 bg-slate-900/60 p-6 mb-6">
            <h3 className="text-xl font-semibold text-rose-200 mb-3">
              Упражнение 1. Расход общеобменной вытяжки (зал + кухня)
            </h3>
            <p className="text-slate-300 mb-4">
              Рассчитайте суммарный расход воздуха для кафе по нормам СП РК:
              {" "}
              <b className="text-rose-300">60 м³/ч на 1 посадочное место</b> для зала
              {" "}
              <b>+ 80 м³/ч на 1 м²</b> для кухни. У нас 50 мест и кухня 35 м².
            </p>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                value={ex1}
                onChange={(e) => setEx1(e.target.value)}
                placeholder="Введите расход в м³/ч"
                className="px-4 py-2 rounded-lg bg-slate-800 border border-rose-900/50 text-slate-100 focus:outline-none focus:border-rose-500 w-64"
              />
              <span className="text-slate-400">м³/ч</span>
              {ex1Result === true && <span className="text-emerald-400">✓ Верно!</span>}
              {ex1Result === false && <span className="text-rose-400">✗ Не сходится</span>}
              <button
                onClick={() => setEx1Show(!ex1Show)}
                className="ml-auto px-4 py-2 rounded-lg bg-rose-900/40 hover:bg-rose-800/50 text-rose-200 text-sm transition"
              >
                {ex1Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex1Show && (
              <div className="mt-4 p-4 rounded-lg bg-rose-950/30 border border-rose-800/30 text-slate-300">
                <p className="font-mono text-rose-200">
                  Q = 50 мест × 60 м³/ч + 35 м² × 80 м³/ч = 3000 + 2800 = <b>5800 м³/ч</b>
                </p>
                <p className="mt-2 text-sm">
                  Допуск ±15%. По факту берётся вентилятор с запасом 10-20%, т.е. от 6000 до 7000 м³/ч.
                  Норма: СП РК 4.02-101 «Отопление, вентиляция и кондиционирование».
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="rounded-xl border border-rose-900/40 bg-slate-900/60 p-6 mb-6">
            <h3 className="text-xl font-semibold text-rose-200 mb-3">
              Упражнение 2. Подбор жироуловителя по посадочным местам
            </h3>
            <p className="text-slate-300 mb-4">
              Норма пропускной способности жироуловителя: <b className="text-rose-300">0.06 л/с на 1 посадочное место</b>.
              Для кафе на 50 мест нужно минимум 3.0 л/с. Какой жироуловитель ставим из стандартного ряда?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "a", label: "2 л/с" },
                { id: "b", label: "4 л/с" },
                { id: "c", label: "8 л/с" },
                { id: "d", label: "12 л/с" },
              ].map((opt) => {
                const isSelected = ex2 === opt.id;
                const isCorrect = ex2Show && opt.id === "b";
                const isWrong = ex2Show && isSelected && opt.id !== "b";
                return (
                  <button
                    key={opt.id}
                    onClick={() => setEx2(opt.id)}
                    className={`px-4 py-3 rounded-lg border text-left transition ${
                      isCorrect
                        ? "bg-emerald-900/40 border-emerald-600 text-emerald-200"
                        : isWrong
                        ? "bg-rose-900/40 border-rose-600 text-rose-200"
                        : isSelected
                        ? "bg-rose-950/40 border-rose-600 text-rose-100"
                        : "bg-slate-800/50 border-rose-900/40 text-slate-200 hover:border-rose-700"
                    }`}
                  >
                    <span className="font-mono text-xs text-slate-400 mr-2">{opt.id})</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setEx2Show(!ex2Show)}
              className="mt-4 px-4 py-2 rounded-lg bg-rose-900/40 hover:bg-rose-800/50 text-rose-200 text-sm transition"
            >
              {ex2Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex2Show && (
              <div className="mt-4 p-4 rounded-lg bg-rose-950/30 border border-rose-800/30 text-slate-300">
                <p>
                  <b className="text-emerald-300">Правильный ответ: б) 4 л/с.</b> Расчёт: 50 мест × 0.06 л/с = 3.0 л/с минимум.
                  Из стандартного ряда (2 / 4 / 8 / 12 л/с) ближайшее ВВЕРХ — 4 л/с. Это даёт запас ~33%, что необходимо для пиковых нагрузок (обед).
                </p>
                <p className="mt-2 text-sm">
                  Норма: СНиП РК 4.01-41-2006 «Внутренний водопровод и канализация», СН РК 4.01-03-2011.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="rounded-xl border border-rose-900/40 bg-slate-900/60 p-6 mb-6">
            <h3 className="text-xl font-semibold text-rose-200 mb-3">
              Упражнение 3. Тип системы оповещения СОУЭ для кафе
            </h3>
            <p className="text-slate-300 mb-4">
              По СП РК 2.02-101-2014 для общественных зданий до 200 человек норматив — <b>тип 1 (звуковой)</b>.
              Однако для <b>предприятий общепита с реализацией алкоголя</b> норма ПОВЫШАЕТСЯ. Какой тип нужен для нашего кафе на 50 мест?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "a", label: "Тип 1 (только звуковой)" },
                { id: "b", label: "Тип 2 (звук + световые табло «ВЫХОД»)" },
                { id: "c", label: "Тип 3 (речевое оповещение по зонам)" },
                { id: "d", label: "Тип 4 (речевое + двусторонняя связь)" },
              ].map((opt) => {
                const isSelected = ex3 === opt.id;
                const isCorrect = ex3Show && opt.id === "b";
                const isWrong = ex3Show && isSelected && opt.id !== "b";
                return (
                  <button
                    key={opt.id}
                    onClick={() => setEx3(opt.id)}
                    className={`px-4 py-3 rounded-lg border text-left transition ${
                      isCorrect
                        ? "bg-emerald-900/40 border-emerald-600 text-emerald-200"
                        : isWrong
                        ? "bg-rose-900/40 border-rose-600 text-rose-200"
                        : isSelected
                        ? "bg-rose-950/40 border-rose-600 text-rose-100"
                        : "bg-slate-800/50 border-rose-900/40 text-slate-200 hover:border-rose-700"
                    }`}
                  >
                    <span className="font-mono text-xs text-slate-400 mr-2">{opt.id})</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setEx3Show(!ex3Show)}
              className="mt-4 px-4 py-2 rounded-lg bg-rose-900/40 hover:bg-rose-800/50 text-rose-200 text-sm transition"
            >
              {ex3Show ? "Скрыть решение" : "Показать решение"}
            </button>
            {ex3Show && (
              <div className="mt-4 p-4 rounded-lg bg-rose-950/30 border border-rose-800/30 text-slate-300">
                <p>
                  <b className="text-emerald-300">Правильный ответ: б) Тип 2.</b> Базовый норматив — тип 1, но для общепита
                  с алкоголем (даже пиво/вино) и при количестве посетителей более 50 человек обязательны световые табло «ВЫХОД»
                  с автономным питанием. Это поднимает требование до типа 2.
                </p>
                <p className="mt-2 text-sm">
                  Норма: СП РК 2.02-101-2014 табл. 2, СНиП РК 2.02-05-2009.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="rounded-xl border border-rose-900/40 bg-slate-900/60 p-6 mb-6">
            <h3 className="text-xl font-semibold text-rose-200 mb-3">
              Упражнение 4. Площадь решёток дымоудаления для зала
            </h3>
            <p className="text-slate-300 mb-4">
              Норма по СП РК 4.02-101: суммарная площадь решёток дымоудаления должна составлять
              {" "}
              <b className="text-rose-300">0.2% от площади помещения</b>.
              {" "}Зал кафе — 80 м². Рассчитайте требуемую площадь решёток.
            </p>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                value={ex4}
                onChange={(e) => setEx4(e.target.value)}
                placeholder="Введите площадь в м²"
                className="px-4 py-2 rounded-lg bg-slate-800 border border-rose-900/50 text-slate-100 focus:outline-none focus:border-rose-500 w-64"
              />
              <span className="text-slate-400">м²</span>
              {ex4Result === true && <span className="text-emerald-400">✓ Верно!</span>}
              {ex4Result === false && <span className="text-rose-400">✗ Не сходится</span>}
              <button
                onClick={() => setEx4Show(!ex4Show)}
                className="ml-auto px-4 py-2 rounded-lg bg-rose-900/40 hover:bg-rose-800/50 text-rose-200 text-sm transition"
              >
                {ex4Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex4Show && (
              <div className="mt-4 p-4 rounded-lg bg-rose-950/30 border border-rose-800/30 text-slate-300">
                <p className="font-mono text-rose-200">
                  S_решёток = 80 м² × 0.002 = <b>0.16 м²</b>
                </p>
                <p className="mt-2 text-sm">
                  Допуск ±15%. На практике это ~2 решётки 400×200 мм или 1 решётка 600×300 мм. Решётки должны быть с
                  огнезадерживающими клапанами EI60 и подключены к АПС.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 4: Чек-лист согласований ──────────────────────────── */}
        <section>
          <h2 className="text-3xl font-bold text-rose-200 mb-6">
            4️⃣ Чек-лист обязательных согласований для кафе в РК
          </h2>
          <div className="space-y-3">
            {APPROVALS.map((a, i) => (
              <div
                key={i}
                className="rounded-xl border border-rose-900/40 bg-slate-900/60 p-5 hover:border-rose-700/60 transition"
              >
                <h3 className="font-semibold text-rose-200 flex items-center gap-2">
                  <span className="text-rose-400">☐</span> {a.title}
                </h3>
                <p className="mt-2 text-sm text-slate-400" dangerouslySetInnerHTML={{ __html: a.detail }} />
              </div>
            ))}
          </div>
        </section>

        {/* ── ESN catalog ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-3xl font-bold text-rose-200 mb-6">
            📚 Применяемые расценки ЭСН РК
          </h2>
          <div className="overflow-x-auto rounded-xl border border-rose-900/40">
            <table className="w-full text-sm">
              <thead className="bg-rose-950/40 text-rose-200">
                <tr>
                  <th className="px-4 py-3 text-left">Шифр</th>
                  <th className="px-4 py-3 text-left">Наименование работы</th>
                  <th className="px-4 py-3 text-left">Ед. изм.</th>
                  <th className="px-4 py-3 text-right">Цена</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-900/30">
                {ESN_RATES.map((r) => (
                  <tr key={r.code} className="hover:bg-rose-950/20 transition">
                    <td className="px-4 py-3 font-mono text-rose-300">{r.code}</td>
                    <td className="px-4 py-3 text-slate-200">{r.name}</td>
                    <td className="px-4 py-3 text-slate-400">{r.unit}</td>
                    <td className="px-4 py-3 text-right font-mono text-pink-300">{r.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Factoid ──────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-rose-700/50 bg-gradient-to-br from-rose-950/60 via-pink-950/40 to-rose-900/40 p-8">
          <div className="flex items-start gap-4">
            <span className="text-4xl">⚠️</span>
            <div>
              <h2 className="text-2xl font-bold text-rose-100 mb-3">
                ВАЖНЫЙ ФАКТ: Жироуловитель — обязателен!
              </h2>
              <p className="text-slate-200 leading-relaxed">
                Для любого предприятия общепита в Казахстане отдельный <b className="text-rose-200">жироуловитель</b>
                {" "}— ОБЯЗАТЕЛЕН. Без него:
              </p>
              <ul className="mt-3 space-y-2 text-slate-200 list-disc list-inside">
                <li>
                  <b className="text-rose-200">Отказ в подключении канализации</b> от ГКП «Астана Су Арнасы» (или местный водоканал)
                </li>
                <li>
                  <b className="text-rose-200">Штраф 100-300 МРП</b> при выявлении сброса жирных стоков (ст. 363 КоАП РК)
                </li>
                <li>
                  <b className="text-rose-200">Отзыв санитарного заключения</b> СЭС с принудительным закрытием объекта
                </li>
                <li>
                  Засорение городской канализации → возможные иски от водоканала на устранение
                </li>
              </ul>
              <p className="mt-4 text-sm text-rose-300/80">
                Норматив: СП РК 4.01-101-2012 п. 17.27, «Правила пользования системами водоснабжения и водоотведения городов и нп РК» п. 84.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer nav ──────────────────────────────────────────────────── */}
        <section className="flex justify-between items-center pt-6 border-t border-rose-900/30">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-rose-300 hover:text-rose-200 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta Trainer · Capstone Module · Cafe 50pax · v1.0
          </span>
        </section>
      </main>
    </div>
  );
}
