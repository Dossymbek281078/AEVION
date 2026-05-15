"use client";
import Link from "next/link";
import { useState } from "react";

// ── Утилита проверки числового ответа с допуском ──────────────────────────────
function checkRange(input: string, min: number, max: number): boolean {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  return v >= min && v <= max;
}

// ── ДАННЫЕ: Типы лифтов ──────────────────────────────────────────────────────
const ELEVATOR_TYPES: { type: string; cap: string; use: string; price: string }[] = [
  { type: "Пассажирский ПЛ-320 (4 чел.)", cap: "320 кг", use: "Жилые до 5 эт., малоэтажные офисы", price: "4.2 – 6.5" },
  { type: "Пассажирский ПЛ-400 (5 чел.)", cap: "400 кг", use: "Стандарт жилые 5–9 эт.", price: "5.5 – 8.5" },
  { type: "Пассажирский ПЛ-630 (8 чел.)", cap: "630 кг", use: "Жилые 9–25 эт., бизнес-центры", price: "8.5 – 14.5" },
  { type: "Пассажирский ПЛ-1000 (13 чел.)", cap: "1000 кг", use: "ТРЦ, аэропорты, гостиницы", price: "12 – 22" },
  { type: "Грузовой ГЛ-1000", cap: "1000 кг", use: "Складские помещения", price: "6.5 – 9.5" },
  { type: "Грузовой ГЛ-1600", cap: "1600 кг", use: "Промышленные объекты", price: "9.5 – 14.5" },
  { type: "Грузовой ГЛ-3200", cap: "3200 кг", use: "Тяжёлая промышленность", price: "18 – 28" },
  { type: "Больничный ЛБ-1200 (с каталкой)", cap: "1200 кг", use: "Больницы, клиники", price: "12 – 18" },
  { type: "Лифт МГН", cap: "320–630 кг", use: "+ речевое оповещение, увеличенная кабина", price: "+15 % к базовой цене" },
  { type: "Эскалатор", cap: "—", use: "ТРЦ, метро, переходы", price: "18 – 35 за 1 этаж" },
  { type: "Травалатор горизонтальный", cap: "—", use: "Аэропорты, ТРЦ", price: "12 – 25 за 50 м" },
  { type: "Подъёмник для МГН на лестничный марш", cap: "до 250 кг", use: "Школы, поликлиники (быстрый монтаж)", price: "1.8 – 3.5" },
  { type: "Гидравлический подъёмник для авто", cap: "2 – 3.5 т", use: "Парковки, СТО", price: "3.5 – 6.5" },
];

// ── ДАННЫЕ: Состав работ по монтажу лифта ────────────────────────────────────
const INSTALL_STEPS: { step: string; what: string; term: string }[] = [
  { step: "1. Шахта (строительная часть)", what: "Кладка/монолит стен шахты, машинное помещение", term: "Параллельно с возведением каркаса" },
  { step: "2. Доставка лифтового оборудования", what: "Спецтранспорт, страховка", term: "2–4 недели от заказа" },
  { step: "3. Монтаж направляющих", what: "Анкеровка к стенам шахты", term: "5–7 дней" },
  { step: "4. Установка машины (лебёдка)", what: "На верхнем этаже или машинном помещении", term: "3–5 дней" },
  { step: "5. Установка кабины", what: "По направляющим", term: "2–3 дня" },
  { step: "6. Электромонтаж шахты", what: "Освещение, силовое, аварийное", term: "5–7 дней" },
  { step: "7. Установка дверей", what: "На каждом этаже", term: "1 день/этаж" },
  { step: "8. Пусконаладка", what: "Регулировка скорости, тормозов, дверей", term: "5–7 дней" },
  { step: "9. Техническое освидетельствование", what: "Регистрация в ИСИ", term: "1–2 недели на оформление" },
  { step: "10. Сертификация Ростехнадзор-аналог РК (КГГП ЧС)", what: "Допуск к эксплуатации", term: "30–60 дней" },
  { step: "11. Обучение лифтёра/диспетчера", what: "Курсы по безопасности", term: "1 неделя" },
];

// ── ДАННЫЕ: Эксплуатация ─────────────────────────────────────────────────────
const OPEX: { item: string; cost: string }[] = [
  { item: "Договор сервисного обслуживания (ТО ежемесячно)", cost: "480 000 – 720 000 тг" },
  { item: "Замена тросов (через 7–10 лет)", cost: "850 000 – 1 200 000 тг" },
  { item: "Капремонт (через 25 лет — обязательно по ТР ТС 011)", cost: "4 – 7 млн тг" },
  { item: "Электроэнергия (для жилого 9-эт.)", cost: "250 000 – 400 000 тг/год" },
  { item: "Страхование (от поломок и травм)", cost: "80 000 – 150 000 тг/год" },
];

// ── ДАННЫЕ: Упражнения ───────────────────────────────────────────────────────
type Exercise = {
  id: string;
  title: string;
  q: string;
  unit: string;
  min: number;
  max: number;
  display: string;
  explain: string;
  vor: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Стоимость пассажирского лифта ПЛ-630 (жилой 9-эт.)",
    q: "Рассчитайте полную стоимость пассажирского лифта ПЛ-630 для жилого 9-этажного дома: базовая цена ≈ 11.5 млн тг + монтаж 15–20 % + шахта (бетон М300, ≈35 м² × 8 500 тг) + электромонтаж 800 000 тг.",
    unit: "млн тг (введите число от 14 до 15.5)",
    min: 14.0,
    max: 15.5,
    display: "14.0 – 15.5 млн тг",
    explain:
      "11.5 млн (база) + 1.7–2.3 млн (монтаж 15–20 %) + 0.297 млн (шахта 35 м² × 8 500) + 0.8 млн (электромонтаж) ≈ 14.5 – 15.0 млн тг. Допуск ±5 %.",
    vor: "Лифт ПЛ-630 в сборе с монтажом и шахтой, Ф-3 гл. 3, поставка KONE/Otis/ЛифтМаш РК",
  },
  {
    id: "ex2",
    title: "Объём бетона на монолитную шахту лифта",
    q: "Шахта 2.0 × 2.0 м (внутренний размер), толщина стен 0.20 м. Высота: 9 этажей × 3.0 м = 27 м + машинное 2.5 м = 29.5 м. Внешний периметр стен: 2·(2.4 + 2.4) = 9.6 м. Рассчитайте объём бетона стен шахты, м³.",
    unit: "м³ (введите число от 53.8 до 59.4)",
    min: 53.8,
    max: 59.4,
    display: "≈ 56.6 м³ (допуск ±5 %)",
    explain:
      "V = 9.6 (периметр) × 0.20 (толщина) × 29.5 (высота) = 56.64 м³. Монолитная шахта — отдельная смета по Сб.6 «Бетонные и железобетонные конструкции».",
    vor: "Бетон М300 монолитной шахты лифта 56.6 м³ (ЭСН Сб.6 §6-04-x)",
  },
  {
    id: "ex3",
    title: "Время на монтаж лифта (без сертификации)",
    q: "Сложите сроки этапов 3–8 + установка дверей (9 этажей × 1 день) + ТО + сертификация. Введите общее число дней монтажного цикла (без шахты).",
    unit: "дней (введите число от 64 до 96)",
    min: 64,
    max: 96,
    display: "≈ 80 дней (допуск ±20 %)",
    explain:
      "5+5+3+5+5+9·1+5+10+30+5 ≈ 80 дней монтаж и техн. оформление. С шахтой — общий цикл 4–6 месяцев.",
    vor: "Монтаж лифта в комплекте с пусконаладкой и сертификацией ≈ 80 дней (ЭСН Сб.34)",
  },
  {
    id: "ex4",
    title: "Стоимость электроэнергии лифта в год",
    q: "Расход 12 000 кВт·ч/год при тарифе 28 тг/кВт·ч. Рассчитайте стоимость электроэнергии за год для лифта ПЛ-630 в жилом 9-эт. доме.",
    unit: "тг/год (введите число от 285 600 до 386 400)",
    min: 285600,
    max: 386400,
    display: "≈ 336 000 тг/год (допуск ±15 %)",
    explain:
      "12 000 кВт·ч × 28 тг = 336 000 тг/год. Включается в эксплуатационные расходы для смет реконструкции и кап. ремонта.",
    vor: "Электроэнергия лифта ≈ 336 000 тг/год (статья эксплуатационных расходов)",
  },
];

// ── ОСНОВНОЙ КОМПОНЕНТ ───────────────────────────────────────────────────────
export default function ElevatorsPage() {
  const [search, setSearch] = useState("");
  const [exIdx, setExIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const filteredTypes = ELEVATOR_TYPES.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.type.toLowerCase().includes(q) ||
      t.cap.toLowerCase().includes(q) ||
      t.use.toLowerCase().includes(q)
    );
  });

  const ex = EXERCISES[exIdx];
  const k = ex.id;
  const userOk = revealed[k] && checkRange(inputs[k] ?? "", ex.min, ex.max);
  const userErr = revealed[k] && !userOk;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [k]: true }));
    if (checkRange(inputs[k] ?? "", ex.min, ex.max)) {
      setDone((d) => new Set([...d, ex.id]));
    }
  }
  function handleRetry() {
    setInputs((p) => ({ ...p, [k]: "" }));
    setRevealed((r) => ({ ...r, [k]: false }));
  }
  function nextEx() {
    if (exIdx + 1 < EXERCISES.length) setExIdx(exIdx + 1);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="bg-slate-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-slate-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🛗 Лифты и подъёмники — типы, монтаж, стоимость
            </h1>
            <p className="text-[10px] text-slate-300">
              Ф-3 · Глава 3 «Объекты подсобного и обслуживающего назначения» ·{" "}
              {done.size}/{EXERCISES.length} упражнений
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* ── ВВЕДЕНИЕ ──────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-slate-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
            📌 Лифты в смете — отдельная позиция в главе 3 Ф-3
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            Стоимость зависит от:
          </p>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
            <li>
              <b>Тип</b> (пассажирский / грузовой / больничный / лифт МГН)
            </li>
            <li>
              <b>Грузоподъёмность</b> (320 / 400 / 630 / 1000 / 1600 / 3200 кг)
            </li>
            <li>
              <b>Этажность</b> (выше — дороже из-за длины направляющих)
            </li>
            <li>
              <b>Скорость</b> (0.63 / 1.0 / 1.6 / 2.5 м/с)
            </li>
            <li>
              <b>Производитель</b> (KONE / Otis / Schindler — премиум; ЛифтМаш
              РК — бюджет)
            </li>
            <li>
              <b>Комплектация</b> (зеркало, дисплей, эко-режим,
              видеонаблюдение)
            </li>
          </ul>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-3">
            <b>Полная стоимость</b> = оборудование + монтаж + шахта + лифтовая
            подъёмная техника + пусконаладка.
          </p>
        </section>

        {/* ── НОРМАТИВНЫЙ БЛОК ──────────────────────────────────────────── */}
        <section className="bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <li>
              <b>СН РК 1.04-12-2002</b> «Лифты и подъёмники»
            </li>
            <li>
              <b>ТР ТС 011/2011</b> «Безопасность лифтов» (Технический регламент
              Таможенного союза)
            </li>
            <li>
              <b>ГОСТ Р 53780-2010</b> Лифты пассажирские, лифты грузовые
            </li>
            <li>
              <b>ПУБЭЛ-2018</b> Правила устройства и безопасной эксплуатации
              лифтов
            </li>
          </ul>
        </section>

        {/* ── РАЗДЕЛ 1: ТИПЫ ЛИФТОВ ─────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Раздел 1. Типы лифтов и подъёмников
            </h2>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по типу / применению..."
              className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 w-64 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-left">
                    Тип
                  </th>
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-left">
                    Грузоподъёмность
                  </th>
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-left">
                    Применение
                  </th>
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-right">
                    Цена в РК (2025), млн тг
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTypes.map((t, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="border border-slate-300 dark:border-slate-600 p-2 font-semibold text-slate-800 dark:text-slate-200">
                      {t.type}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300">
                      {t.cap}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300">
                      {t.use}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono text-slate-800 dark:text-slate-200">
                      {t.price}
                    </td>
                  </tr>
                ))}
                {filteredTypes.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-slate-300 dark:border-slate-600 p-3 text-center text-slate-500 italic"
                    >
                      Ничего не найдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── РАЗДЕЛ 2: СОСТАВ РАБОТ ────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            Раздел 2. Состав работ по монтажу лифта
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-left w-1/3">
                    Этап
                  </th>
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-left">
                    Что входит
                  </th>
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-left w-1/4">
                    Срок
                  </th>
                </tr>
              </thead>
              <tbody>
                {INSTALL_STEPS.map((s, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="border border-slate-300 dark:border-slate-600 p-2 font-semibold text-slate-800 dark:text-slate-200">
                      {s.step}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300">
                      {s.what}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300 italic">
                      {s.term}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── РАЗДЕЛ 3: ЭКСПЛУАТАЦИЯ ────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            Раздел 3. Расходы на эксплуатацию (для смет реконструкции)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-left">
                    Статья
                  </th>
                  <th className="border border-slate-300 dark:border-slate-600 p-2 text-right">
                    Стоимость в год
                  </th>
                </tr>
              </thead>
              <tbody>
                {OPEX.map((o, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="border border-slate-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300">
                      {o.item}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono text-slate-800 dark:text-slate-200">
                      {o.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── РАЗДЕЛ 4: УПРАЖНЕНИЯ ──────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            Раздел 4. Интерактивные упражнения ({done.size}/{EXERCISES.length})
          </h2>

          {/* Табы */}
          <div className="flex gap-1 flex-wrap mb-3">
            {EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setExIdx(i)}
                className={`text-[10px] px-2 py-1 rounded font-semibold transition ${
                  i === exIdx
                    ? "bg-slate-700 text-white"
                    : done.has(e.id)
                    ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {done.has(e.id) ? "✓ " : ""}Упр. {i + 1}
              </button>
            ))}
          </div>

          {/* Активное упражнение */}
          <div
            className={`border-2 rounded-lg p-3 ${
              userOk
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                : userErr
                ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40"
            }`}
          >
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              Упражнение {exIdx + 1}: {ex.title}
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              {ex.q}
            </p>

            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Ответ ({ex.unit}):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputs[k] ?? ""}
                onChange={(e) =>
                  setInputs((p) => ({ ...p, [k]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !revealed[k]) handleCheck();
                }}
                disabled={!!revealed[k] && userOk}
                placeholder="Введите число..."
                className="flex-1 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-200"
              />
              {!revealed[k] && (
                <button
                  onClick={handleCheck}
                  disabled={!inputs[k]?.trim()}
                  className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded hover:bg-slate-800 disabled:opacity-40"
                >
                  Проверить
                </button>
              )}
              {userErr && (
                <button
                  onClick={handleRetry}
                  className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded hover:bg-amber-600"
                >
                  Снова
                </button>
              )}
            </div>

            {revealed[k] && (
              <div
                className={`mt-3 text-xs leading-relaxed ${
                  userOk
                    ? "text-emerald-800 dark:text-emerald-300"
                    : "text-red-800 dark:text-red-300"
                }`}
              >
                <div className="font-bold mb-1">
                  {userOk
                    ? "✓ Верно!"
                    : `✗ Неверно. Правильный диапазон: ${ex.display}`}
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  {ex.explain}
                </div>
                {userOk && (
                  <div className="mt-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      ВОР:{" "}
                    </span>
                    <code className="text-[11px] font-mono text-slate-800 dark:text-slate-200">
                      {ex.vor}
                    </code>
                  </div>
                )}
              </div>
            )}

            {userOk && exIdx + 1 < EXERCISES.length && (
              <button
                onClick={nextEx}
                className="mt-3 w-full py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
              >
                Следующее упражнение →
              </button>
            )}
            {userOk && exIdx + 1 === EXERCISES.length && (
              <div className="mt-3 text-center py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm font-bold rounded-lg">
                🎉 Все упражнения пройдены!
              </div>
            )}
          </div>
        </section>

        {/* ── РАСЦЕНКИ ЭСН ──────────────────────────────────────────────── */}
        <section className="bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
            📐 Расценки ЭСН для лифтового монтажа
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <li>
              <b>Шахта (бетон):</b>{" "}
              <code className="font-mono text-slate-900 dark:text-slate-100">
                ЭСН Сб.6 §6-04-x
              </code>
            </li>
            <li>
              <b>Электромонтаж шахты:</b>{" "}
              <code className="font-mono text-slate-900 dark:text-slate-100">
                ЭСН Сб.8 §8-x
              </code>{" "}
              (электротехническая часть)
            </li>
            <li>
              <b>Сборка лифтового оборудования:</b>{" "}
              <code className="font-mono text-slate-900 dark:text-slate-100">
                ЭСН Сб.34
              </code>{" "}
              (Электромонтажные работы)
            </li>
            <li>
              <b>Пусконаладка:</b>{" "}
              <code className="font-mono text-slate-900 dark:text-slate-100">
                ЭСН Сб.34 §34-12-x
              </code>
            </li>
          </ul>
        </section>

        {/* ── ФАКТОИД ───────────────────────────────────────────────────── */}
        <section className="bg-slate-200 dark:bg-slate-800 border border-slate-400 dark:border-slate-600 rounded-lg p-4">
          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
            <b>💡 ВНИМАНИЕ:</b> Стоимость лифта в Ф-3 идёт{" "}
            <b>отдельной строкой</b> главы 3 «Объекты подсобного и
            обслуживающего назначения». Не путать с разделом «Электромонтажные
            работы». Для тендеров — отдельный поставщик-партнёр (KONE / Otis в
            РК через дистрибьюторов).
          </p>
        </section>
      </main>
    </div>
  );
}
