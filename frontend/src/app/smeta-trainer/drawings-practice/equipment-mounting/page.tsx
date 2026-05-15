"use client";
import Link from "next/link";
import { useState } from "react";

// ── Утилита проверки числового ответа с допуском ──────────────────────────────
function checkRange(input: string, min: number, max: number): boolean {
  const v = parseFloat(input.replace(",", ".").replace(/\s/g, ""));
  if (isNaN(v)) return false;
  return v >= min && v <= max;
}

// ── ДАННЫЕ: Типы оборудования ────────────────────────────────────────────────
const EQUIPMENT: { name: string; price: string; mount: string; use: string }[] = [
  { name: "Котёл газовый напольный 50 кВт De Dietrich", price: "4 850 000", mount: "12 %", use: "Жилые до 5 эт." },
  { name: "Котёл напольный 250 кВт двухкомпонентный", price: "18 500 000", mount: "10 %", use: "Многоэтажные / общественные" },
  { name: "Котёл электрический 30 кВт", price: "850 000", mount: "15 %", use: "Резервные, дачи" },
  { name: "Бойлер косвенного нагрева 200 л", price: "285 000", mount: "12 %", use: "Квартиры, малые офисы" },
  { name: "Насос циркуляционный Grundfos UPS 25-60", price: "65 000", mount: "20 %", use: "Системы отопления" },
  { name: "Насос циркуляционный Wilo Stratos 80/1-12", price: "850 000", mount: "12 %", use: "Большие системы" },
  { name: "Приточная установка Systemair Geniox 14 (2400 м³/ч)", price: "6 850 000", mount: "15 %", use: "Школы, офисы" },
  { name: "Приточная установка Geniox 25 (4500 м³/ч)", price: "12 500 000", mount: "12 %", use: "ТРЦ, спортзалы" },
  { name: "Кондиционер сплит-система LG 12000 BTU", price: "285 000", mount: "15 %", use: "Квартиры, офисы малые" },
  { name: "Кондиционер VRF мультизональный 25 кВт", price: "8 500 000", mount: "18 %", use: "Этажные офисы" },
  { name: "Чиллер LG Multi V 70 кВт", price: "25 000 000", mount: "12 %", use: "Бизнес-центры" },
  { name: "Подъёмник лифтовый малый (не пасс.) 1000 кг", price: "4 200 000", mount: "12 %", use: "Складские, СТО" },
];

// ── ДАННЫЕ: Этапы монтажа котельной ──────────────────────────────────────────
const BOILER_STEPS: { step: string; what: string; cost: string }[] = [
  { step: "1. Подготовка фундамента", what: "Бетонная плита 200×200×100 мм для котла 250 кг. ЭСН Сб.6 + ССЦ материалы", cost: "25 000 – 45 000 тг" },
  { step: "2. Установка котла", what: "На фундамент с виброкомпенсаторами. ЭСН Сб.36-1-001", cost: "350 000 – 520 000 тг" },
  { step: "3. Установка дымохода", what: "Ø200 нерж. сталь, длина 12 м. Материал 12·18 000 + монтаж 12·8 500", cost: "318 000 тг" },
  { step: "4. Подключение газа", what: "От стояка: труба сталь Ø50 + регулятор давления. ЭСН Сб.24-04-x", cost: "280 000 – 450 000 тг" },
  { step: "5. Подключение к системе отопления", what: "Трубы Ø50, насос, обвязка. ЭСН Сб.16-01-x", cost: "850 000 – 1 200 000 тг" },
  { step: "6. Подключение электропитания + автоматика", what: "Силовые цепи, КИПиА, шкаф управления. ЭСН Сб.39-x", cost: "380 000 – 650 000 тг" },
  { step: "7. Пусконаладка котла", what: "Балансировка, испытания, акты. ЭСН Сб.36-3-x", cost: "350 000 – 580 000 тг" },
  { step: "8. Технадзор Газового хозяйства", what: "Платёж заказчика, не входит в смету подрядчика", cost: "250 000 – 450 000 тг" },
];

// ── ДАННЫЕ: ПНР ──────────────────────────────────────────────────────────────
const PNR_ITEMS: string[] = [
  "Проверка комплектности и правильности монтажа",
  "Гидравлические испытания (для отопительных систем)",
  "Балансировка системы (распределение потоков)",
  "Проверка работы автоматики и КИПиА",
  "Аттестационные испытания (для котлов под надзором)",
  "Обучение эксплуатационного персонала",
  "Оформление паспорта на оборудование",
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
    title: "Стоимость монтажа газового котла 250 кВт",
    q: "Цена котла 18 500 000 тг. Монтаж 10 % от стоимости + ПНР 8 % от стоимости. Рассчитайте суммарную стоимость монтажа и ПНР, тг.",
    unit: "тг (введите число от 3 163 500 до 3 496 500)",
    min: 3_163_500,
    max: 3_496_500,
    display: "≈ 3 330 000 тг (допуск ±5 %)",
    explain:
      "Монтаж: 18 500 000 · 10 % = 1 850 000 тг. ПНР: 18 500 000 · 8 % = 1 480 000 тг. Итого: 1 850 000 + 1 480 000 = 3 330 000 тг.",
    vor: "Монтаж + ПНР котла газового 250 кВт ≈ 3 330 000 тг (ЭСН Сб.36 + Сб.41)",
  },
  {
    id: "ex2",
    title: "Объём бетона на фундамент под котёл 250 кг",
    q: "Плита 200×200×100 мм (0.20 м × 0.20 м × 0.10 м) для напольного котла. Рассчитайте объём бетона, м³.",
    unit: "м³ (точное значение)",
    min: 0.004,
    max: 0.004,
    display: "0.004 м³ (точное значение)",
    explain:
      "V = 0.20 · 0.20 · 0.10 = 0.004 м³. Для тяжёлых котлов > 500 кг нужен бетон М200 на сваях с расчётом на нагрузку.",
    vor: "Бетон М200 на фундамент под котёл 0.004 м³ (ЭСН Сб.6 §6-01-x)",
  },
  {
    id: "ex3",
    title: "Длина дымохода для жилого 5-этажного дома",
    q: "Дымоход Ø200 нерж. сталь. Высота дома 5×3 м + чердак 2 м = 17 м. Над парапетом по СНиП — ещё 1.5 м. Рассчитайте необходимую длину дымохода, м.",
    unit: "м (введите число от 18.13 до 18.87)",
    min: 18.13,
    max: 18.87,
    display: "18.5 м (допуск ±2 %)",
    explain:
      "Высота: 5·3 + 2 = 17 м (дом + чердак). + 1.5 м над парапетом = 18.5 м. Стоимость материала: 18.5 · 18 000 = 333 000 тг. Монтаж: 18.5 · 8 500 = 157 250 тг. Итого: 490 250 тг.",
    vor: "Дымоход Ø200 нерж. 18.5 м с монтажом ≈ 490 250 тг (ЭСН Сб.36-2-x)",
  },
  {
    id: "ex4",
    title: "Срок поставки и монтажа приточной Geniox 14 для школы",
    q: "Поставка от заказа: 4 недели = 28 дней. Монтаж бригадой из 3 чел: 7–10 дней. ПНР: 5–7 дней. Введите общее число дней от заказа до сдачи в эксплуатацию.",
    unit: "дней (введите число от 36 до 54)",
    min: 36,
    max: 54,
    display: "≈ 45 дней (допуск ±20 %)",
    explain:
      "28 (поставка) + 8.5 (монтаж средн.) + 6 (ПНР средн.) ≈ 42–45 дней = 6–7 недель. Поставка — критический путь, заказывать заранее.",
    vor: "Приточная Geniox 14 в комплекте с монтажом и ПНР ≈ 45 дней (ЭСН Сб.37 + Сб.41)",
  },
];

// ── ОСНОВНОЙ КОМПОНЕНТ ───────────────────────────────────────────────────────
export default function EquipmentMountingPage() {
  const [search, setSearch] = useState("");
  const [exIdx, setExIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const filteredEq = EQUIPMENT.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.use.toLowerCase().includes(q) ||
      e.price.toLowerCase().includes(q)
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
    <div className="min-h-screen bg-orange-50 dark:bg-slate-950">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="bg-orange-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-orange-100 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🔧 Монтаж оборудования — котлы, насосы, вентиляторы, приточки
            </h1>
            <p className="text-[10px] text-orange-200">
              Ф-3 · Глава 2 «Оборудование» ОТДЕЛЬНО от Главы 6 «Наружные сети» ·{" "}
              {done.size}/{EXERCISES.length} упражнений
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* ── ВВЕДЕНИЕ ──────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-2">
            🔧 Монтаж технологического оборудования — отдельная статья сметы
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            Не путать со строительными работами (бетон, кладка) и сантехникой
            (внутренние сети водопровода).
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            <b>Оборудование</b> = «железо», которое привозится с завода готовое.
            Его нужно:
          </p>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
            <li>Подключить к фундаменту / анкерам</li>
            <li>
              Подключить к инженерным сетям (электро, ХВС, дымоход и т.д.)
            </li>
            <li>Запустить и сдать ПНР</li>
          </ul>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-3">
            <b>Стоимость монтажа:</b> 8–15 % от стоимости оборудования.
          </p>
        </section>

        {/* ── НОРМАТИВНЫЙ БЛОК ──────────────────────────────────────────── */}
        <section className="bg-orange-100 dark:bg-slate-800/50 border border-orange-300 dark:border-orange-900/40 rounded-lg p-4">
          <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <li>
              <b>ЭСН РК Сб.36</b> «Котельные и отопительные системы»
            </li>
            <li>
              <b>ЭСН РК Сб.37</b> «Вентиляция и кондиционирование оборудование»
            </li>
            <li>
              <b>ЭСН РК Сб.38</b> «Сантехническое оборудование»
            </li>
            <li>
              <b>ЭСН РК Сб.39</b> «Электротехническое оборудование»
            </li>
            <li>
              <b>СН РК 4.02-42-2006</b> «Тепловые сети» (для котельных)
            </li>
          </ul>
        </section>

        {/* ── РАЗДЕЛ 1: ТИПЫ ОБОРУДОВАНИЯ ───────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300">
              Раздел 1. Типы оборудования и стоимость
            </h2>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по типу / применению..."
              className="text-xs border border-orange-300 dark:border-slate-600 rounded px-2 py-1 w-64 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-orange-100 dark:bg-slate-800 text-orange-900 dark:text-orange-200">
                  <th className="border border-orange-300 dark:border-slate-600 p-2 text-left">
                    Оборудование
                  </th>
                  <th className="border border-orange-300 dark:border-slate-600 p-2 text-right">
                    Цена 2025, тг
                  </th>
                  <th className="border border-orange-300 dark:border-slate-600 p-2 text-right">
                    Монтаж %
                  </th>
                  <th className="border border-orange-300 dark:border-slate-600 p-2 text-left">
                    Применение
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEq.map((e, i) => (
                  <tr
                    key={i}
                    className="hover:bg-orange-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="border border-orange-300 dark:border-slate-600 p-2 font-semibold text-slate-800 dark:text-slate-200">
                      {e.name}
                    </td>
                    <td className="border border-orange-300 dark:border-slate-600 p-2 text-right font-mono text-slate-800 dark:text-slate-200">
                      {e.price}
                    </td>
                    <td className="border border-orange-300 dark:border-slate-600 p-2 text-right font-mono text-orange-700 dark:text-orange-300 font-semibold">
                      {e.mount}
                    </td>
                    <td className="border border-orange-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300">
                      {e.use}
                    </td>
                  </tr>
                ))}
                {filteredEq.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-orange-300 dark:border-slate-600 p-3 text-center text-slate-500 italic"
                    >
                      Ничего не найдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── РАЗДЕЛ 2: СОСТАВ РАБОТ ПО МОНТАЖУ КОТЕЛЬНОЙ ──────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-3">
            Раздел 2. Состав работ при монтаже котельной (котёл 250 кВт)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-orange-100 dark:bg-slate-800 text-orange-900 dark:text-orange-200">
                  <th className="border border-orange-300 dark:border-slate-600 p-2 text-left w-1/4">
                    Этап
                  </th>
                  <th className="border border-orange-300 dark:border-slate-600 p-2 text-left">
                    Описание + расценка ЭСН
                  </th>
                  <th className="border border-orange-300 dark:border-slate-600 p-2 text-right w-44">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody>
                {BOILER_STEPS.map((s, i) => (
                  <tr
                    key={i}
                    className="hover:bg-orange-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="border border-orange-300 dark:border-slate-600 p-2 font-semibold text-slate-800 dark:text-slate-200">
                      {s.step}
                    </td>
                    <td className="border border-orange-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300">
                      {s.what}
                    </td>
                    <td className="border border-orange-300 dark:border-slate-600 p-2 text-right font-mono text-slate-800 dark:text-slate-200">
                      {s.cost}
                    </td>
                  </tr>
                ))}
                <tr className="bg-orange-50 dark:bg-orange-900/20 font-bold">
                  <td
                    colSpan={2}
                    className="border border-orange-300 dark:border-slate-600 p-2 text-orange-900 dark:text-orange-200"
                  >
                    ИТОГО монтаж котельной 250 кВт
                  </td>
                  <td className="border border-orange-300 dark:border-slate-600 p-2 text-right font-mono text-orange-900 dark:text-orange-200">
                    ≈ 3.5 – 4.5 млн тг
                  </td>
                </tr>
                <tr className="bg-orange-50 dark:bg-orange-900/20">
                  <td
                    colSpan={2}
                    className="border border-orange-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-300 italic"
                  >
                    + Стоимость самого котла
                  </td>
                  <td className="border border-orange-300 dark:border-slate-600 p-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    18.5 млн тг
                  </td>
                </tr>
                <tr className="bg-orange-100 dark:bg-orange-900/40 font-bold">
                  <td
                    colSpan={2}
                    className="border border-orange-300 dark:border-slate-600 p-2 text-orange-900 dark:text-orange-100"
                  >
                    ОБЩАЯ стоимость котельной
                  </td>
                  <td className="border border-orange-300 dark:border-slate-600 p-2 text-right font-mono text-orange-900 dark:text-orange-100">
                    ≈ 22 – 23 млн тг
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── РАЗДЕЛ 3: ПУСКОНАЛАДОЧНЫЕ РАБОТЫ ──────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-orange-500 rounded-lg p-4">
          <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-2">
            Раздел 3. Пусконаладочные работы (ПНР)
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
            🔧 <b>ПНР</b> — Пусконаладочные работы. Завершают монтаж и доводят
            оборудование до проектных параметров.
          </p>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            Содержание ПНР:
          </p>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside leading-relaxed mb-3">
            {PNR_ITEMS.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-900/40 rounded p-2.5">
              <p className="text-[11px] text-orange-900 dark:text-orange-200 leading-relaxed">
                <b>Стоимость ПНР:</b> 5–15 % от стоимости оборудования.
                <br />
                <b>Расценки:</b>{" "}
                <code className="font-mono text-orange-900 dark:text-orange-100">
                  ЭСН Сб.41 «Пусконаладочные работы»
                </code>
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-900/40 rounded p-2.5">
              <p className="text-[11px] text-red-900 dark:text-red-200 leading-relaxed">
                <b>⚠ Без актов ПНР</b> — оборудование <b>НЕ ВВОДИТСЯ</b> в
                эксплуатацию.
                <br />
                <b>Контроль:</b> ИСИ (инспекция строительства и инспекция
                газового хозяйства).
              </p>
            </div>
          </div>
        </section>

        {/* ── РАЗДЕЛ 4: УПРАЖНЕНИЯ ──────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-3">
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
                    ? "bg-orange-600 text-white"
                    : done.has(e.id)
                    ? "bg-orange-200 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200"
                    : "bg-orange-50 dark:bg-slate-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100"
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
                : "border-orange-300 dark:border-orange-900/40 bg-orange-50 dark:bg-slate-800/40"
            }`}
          >
            <h3 className="text-sm font-bold text-orange-900 dark:text-orange-200 mb-1">
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
                className="flex-1 border border-orange-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-slate-800 dark:text-slate-200"
              />
              {!revealed[k] && (
                <button
                  onClick={handleCheck}
                  disabled={!inputs[k]?.trim()}
                  className="px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded hover:bg-orange-700 disabled:opacity-40"
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
                    : `✗ Неверно. Правильный ответ: ${ex.display}`}
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  {ex.explain}
                </div>
                {userOk && (
                  <div className="mt-2 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-900/40 rounded p-2">
                    <span className="font-bold text-orange-800 dark:text-orange-200">
                      ВОР:{" "}
                    </span>
                    <code className="text-[11px] font-mono text-orange-900 dark:text-orange-100">
                      {ex.vor}
                    </code>
                  </div>
                )}
              </div>
            )}

            {userOk && exIdx + 1 < EXERCISES.length && (
              <button
                onClick={nextEx}
                className="mt-3 w-full py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700"
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
        <section className="bg-orange-100 dark:bg-slate-800/50 border border-orange-300 dark:border-orange-900/40 rounded-lg p-4">
          <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-2">
            📐 Расценки ЭСН для монтажа оборудования
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <li>
              <b>Котельные:</b>{" "}
              <code className="font-mono text-orange-900 dark:text-orange-100">
                ЭСН Сб.36
              </code>
            </li>
            <li>
              <b>Вентиляция оборудование:</b>{" "}
              <code className="font-mono text-orange-900 dark:text-orange-100">
                ЭСН Сб.37
              </code>
            </li>
            <li>
              <b>Сантех оборудование:</b>{" "}
              <code className="font-mono text-orange-900 dark:text-orange-100">
                ЭСН Сб.38
              </code>
            </li>
            <li>
              <b>Электротех оборудование:</b>{" "}
              <code className="font-mono text-orange-900 dark:text-orange-100">
                ЭСН Сб.39
              </code>
            </li>
            <li>
              <b>Пусконаладочные работы:</b>{" "}
              <code className="font-mono text-orange-900 dark:text-orange-100">
                ЭСН Сб.41
              </code>
            </li>
          </ul>
        </section>

        {/* ── ФАКТОИД ───────────────────────────────────────────────────── */}
        <section className="bg-orange-200 dark:bg-orange-900/30 border-2 border-orange-500 dark:border-orange-700 rounded-lg p-4">
          <p className="text-xs text-orange-900 dark:text-orange-100 leading-relaxed">
            <b>💡 ВНИМАНИЕ:</b> Монтаж оборудования (<b>Ф-3 Глава 2 — оборудование</b>){" "}
            <b>ОТДЕЛЬНО</b> от монтажа сетей (<b>Ф-3 Глава 6 — наружные сети</b>).
            В смете легко перепутать — будь внимателен с привязкой расценок к
            главам Ф-3.
          </p>
        </section>
      </main>
    </div>
  );
}
