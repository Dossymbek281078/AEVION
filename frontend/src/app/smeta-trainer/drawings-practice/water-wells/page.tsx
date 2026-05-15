"use client";
import Link from "next/link";
import { useState } from "react";

type Choice = { k: string; t: string };
type Ex =
  | {
      id: string;
      kind: "mc";
      title: string;
      q: string;
      choices: Choice[];
      correct: string;
      solution: string;
      vor: string;
    }
  | {
      id: string;
      kind: "num";
      title: string;
      q: string;
      answer: number;
      tol: number;
      unit: string;
      solution: string;
      vor: string;
    };

const TYPES: { name: string; depth: string; flow: string; price: string; use: string }[] = [
  {
    name: "На песок (фильтровая)",
    depth: "до 30 м",
    flow: "0.5–1.5 м³/ч",
    price: "350 000–700 000 тг",
    use: "Дача, полив, низкое потребление",
  },
  {
    name: "На известняк (артезианская мелкая)",
    depth: "30–100 м",
    flow: "1.5–4 м³/ч",
    price: "1 500 000–3 500 000 тг",
    use: "Коттедж, ИЖС, гарантия 50+ лет",
  },
  {
    name: "Артезианская глубокая",
    depth: "100–250 м",
    flow: "4–10 м³/ч",
    price: "4 000 000–9 000 000 тг",
    use: "Посёлок, малый бизнес, кафе",
  },
  {
    name: "Разведочно-эксплуатационная",
    depth: "250–400 м",
    flow: "10–25 м³/ч",
    price: "9 000 000–18 000 000 тг",
    use: "Промышленность, водозабор посёлка",
  },
  {
    name: "Шахтный водозаборный колодец",
    depth: "5–20 м",
    flow: "0.3–1 м³/ч",
    price: "180 000–450 000 тг",
    use: "Дача, верховодка, резерв",
  },
];

const EQUIPMENT: { name: string; spec: string; price: string }[] = [
  {
    name: "Глубинный насос Grundfos SQ 2-55",
    spec: "1.5 м³/ч, напор 55 м, 4\"",
    price: "180 000 тг",
  },
  {
    name: "Глубинный насос Grundfos SP 3A-15",
    spec: "3 м³/ч, напор 90 м, 4\"",
    price: "320 000 тг",
  },
  {
    name: "Насос Wilo TWU 4-0405",
    spec: "4 м³/ч, напор 50 м",
    price: "220 000 тг",
  },
  {
    name: "Насос ESPA Acuaria 07",
    spec: "2 м³/ч, напор 40 м (бюджет)",
    price: "95 000 тг",
  },
  {
    name: "Обсадная труба ПНД ∅125 мм",
    spec: "PN10, питьевая",
    price: "3 800 тг/м",
  },
  {
    name: "Обсадная труба сталь ∅133 мм",
    spec: "толщ. 5 мм",
    price: "8 500 тг/м",
  },
  {
    name: "Оголовок скважины ∅125",
    spec: "герметичный, под трос",
    price: "18 000 тг",
  },
  {
    name: "Кессон пластиковый ∅1м, h=2м",
    spec: "морозостойкий",
    price: "95 000 тг",
  },
  {
    name: "Гидробак (мембранный) 100 л",
    spec: "горизонтальный, 10 бар",
    price: "32 000 тг",
  },
  {
    name: "Гидробак 500 л",
    spec: "вертикальный, EPDM",
    price: "115 000 тг",
  },
  {
    name: "Реле давления РДМ-5",
    spec: "1.4–2.8 бар",
    price: "8 500 тг",
  },
  {
    name: "Манометр глицериновый 0–10 бар",
    spec: "∅63 мм, 1/4\"",
    price: "3 200 тг",
  },
];

const NORMS: string[] = [
  "СНиП РК 4.01-02-2009 «Водоснабжение. Наружные сети и сооружения»",
  "СН РК 4.01-02 «Внутренний водопровод и канализация зданий»",
  "СН РК 2.04-01 «Строительная климатология»",
  "СанПиН РК «Санитарно-защитные зоны источников водоснабжения» (1-й, 2-й, 3-й пояс)",
  "Закон РК «О недрах и недропользовании» (лицензирование скважин)",
];

const ESN: string[] = [
  "ЭСН Сб.16-1 «Бурение скважин на воду»",
  "ЭСН Сб.16-2 «Оборудование скважин (обсадка, фильтры, оголовки)»",
  "ЭСН Сб.18 «Насосные станции и водозаборные узлы»",
  "+ материалы и оборудование по ССЦ РК 2024",
];

const EXERCISES: Ex[] = [
  {
    id: "pump",
    kind: "mc",
    title: "Подбор глубинного насоса для коттеджа на 6 человек",
    q:
      "Коттедж на 6 человек: расход воды 3 м³/сутки + полив газона 2 м³/сутки = 5 м³/сутки. " +
      "Требуемая пиковая производительность с учётом коэф. часовой неравномерности — 1.5 м³/час, напор ~50 м " +
      "(глубина установки насоса 35 м + 15 м на разводку). Какой насос подобрать?",
    choices: [
      { k: "a", t: "ESPA Acuaria 07 (2 м³/ч, напор 40 м) — 95 000 тг" },
      { k: "b", t: "Grundfos SQ 2-55 (1.5 м³/ч, напор 55 м) — 180 000 тг" },
      { k: "c", t: "Grundfos SP 3A-15 (3 м³/ч, напор 90 м) — 320 000 тг" },
      { k: "d", t: "Wilo TWU 4-0405 (4 м³/ч, напор 50 м) — 220 000 тг" },
    ],
    correct: "b",
    solution:
      "Требуется Q ≈ 1.5 м³/ч и H ≈ 50 м. Grundfos SQ 2-55 даёт ровно эти параметры (1.5 м³/ч, 55 м), 4-дюймовый, тихий, с защитой от сухого хода. " +
      "ESPA по напору не дотягивает (40 < 50). SP 3A-15 и TWU 4-0405 — переразмерены (избыточная мощность, цикличность пуска, износ).",
    vor: "Насос Grundfos SQ 2-55 — 1 шт; обвязка с обратным клапаном и тросом нерж. — компл.",
  },
  {
    id: "casing",
    kind: "num",
    title: "Длина обсадной трубы для скважины на известняк 65 м",
    q:
      "Скважина на известняк глубиной 65 м. Над устьем требуется выпуск обсадной трубы 0.5 м, " +
      "плюс гидрозатвор (затрубная цементация) выше водоносного горизонта 3 м. " +
      "Рассчитайте полную длину обсадной трубы (м), которую нужно заказать.",
    answer: 68,
    tol: 0.05,
    unit: "м",
    solution:
      "L = глубина + выпуск над устьем + запас на гидрозатвор = 65 + 0.5 + 3 ≈ 68 м. " +
      "Заказывают с округлением вверх до целых хлыстов (обычно по 3–6 м), фактически — 69 м (23 хлыста по 3 м).",
    vor: "Труба обсадная ПНД ∅125 мм PN10 — 68 м; муфты — 22 шт; центраторы — 8 шт",
  },
  {
    id: "tank",
    kind: "num",
    title: "Объём гидробака для дома с 4 точками водоразбора",
    q:
      "Дом: 4 точки водоразбора (2 санузла, кухня, бойлерная). Насос Grundfos SQ 2-55 производительностью 2.4 м³/час. " +
      "По упрощённой формуле V = Qн × 16.5 / (4 × n), где n = 12 циклов/ч (рекомендация Grundfos). " +
      "Какой объём гидробака (литры) подобрать?",
    answer: 100,
    tol: 0.2,
    unit: "л",
    solution:
      "V (литры) = (2400 × 16.5) / (4 × 12) × Δp/(P+1), упрощённо для давления 1.4–2.8 бар: " +
      "V ≈ 0.275 × Qн = 0.275 × 2400 ≈ 82.5 л → ближайший типоразмер 100 л (с запасом на пиковые расходы).",
    vor: "Гидробак мембранный 100 л горизонтальный — 1 шт; реле давления РДМ-5 — 1 шт; манометр 0–10 бар — 1 шт",
  },
  {
    id: "cost",
    kind: "num",
    title: "Полная стоимость скважины 65 м на известняк",
    q:
      "Бурение 65 м × 25 000 тг/м + обсадка 65 м × 12 000 тг/м + насос 180 000 тг + " +
      "кессон 95 000 тг + автоматика (гидробак + реле + манометр + щит) 60 000 тг. " +
      "Найдите полную стоимость в тенге.",
    answer: 2740000,
    tol: 0.1,
    unit: "тг",
    solution:
      "Бурение: 65 × 25 000 = 1 625 000\n" +
      "Обсадка: 65 × 12 000 = 780 000\n" +
      "Насос: 180 000\n" +
      "Кессон: 95 000\n" +
      "Автоматика: 60 000\n" +
      "ИТОГО: 1 625 000 + 780 000 + 180 000 + 95 000 + 60 000 = 2 740 000 тг.\n" +
      "Это укладывается в типовой диапазон 1.5–3.5 млн для скважины на известняк.",
    vor:
      "Бурение скважины на известняк ∅150 мм H=65 м (ЭСН Сб.16-1); обсадка ПНД ∅125 — 65 м (ЭСН Сб.16-2); " +
      "монтаж насоса и оголовка (ЭСН Сб.18); кессон пластиковый — 1 шт; автоматика — компл.",
  },
];

function checkNum(input: string, ans: number, tol: number) {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - ans) / ans) < tol;
}

export default function WaterWellsPage() {
  const [tab, setTab] = useState<"intro" | "types" | "equip" | "ex" | "esn">("intro");
  const [xi, sxi] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = EXERCISES[xi];
  const inp = inputs[ex.id] ?? "";
  const rev = revealed[ex.id] ?? false;

  let correct = false;
  if (rev) {
    if (ex.kind === "mc") correct = inp === ex.correct;
    else correct = checkNum(inp, ex.answer, ex.tol);
  }

  function submit() {
    setRevealed((r) => ({ ...r, [ex.id]: true }));
    let ok = false;
    if (ex.kind === "mc") ok = inp === ex.correct;
    else ok = checkNum(inp, ex.answer, ex.tol);
    if (ok) setDone((d) => new Set([...d, ex.id]));
  }

  function reset() {
    setInputs((i) => ({ ...i, [ex.id]: "" }));
    setRevealed((r) => ({ ...r, [ex.id]: false }));
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-blue-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🚰 Скважины и водозаборные сооружения
            </h1>
            <p className="text-[10px] text-blue-200">
              СНиП РК 4.01-02-2009 · ЭСН Сб.16, Сб.18 · {done.size}/{EXERCISES.length} упражнений
            </p>
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/normatives#water-wells"
            className="text-[10px] bg-blue-900 text-blue-200 px-2 py-1 rounded hover:bg-blue-800"
          >
            📋 Нормативы
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-3">
        <div className="flex gap-1 flex-wrap text-[11px]">
          {[
            { k: "intro", t: "💧 Введение" },
            { k: "types", t: "📋 Типы скважин (5)" },
            { k: "equip", t: "⚙️ Оборудование" },
            { k: "ex", t: `🎯 Упражнения (${done.size}/${EXERCISES.length})` },
            { k: "esn", t: "💰 Расценки ЭСН" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 py-1.5 rounded font-semibold ${
                tab === t.k
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700"
              }`}
            >
              {t.t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {tab === "intro" && (
          <>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                🚰 Скважина — автономный источник воды
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                Скважина проектируется, когда нет центрального водопровода или его подключение дороже бурения.
                В смете — это комплекс: бурение, обсадка, насосное оборудование, кессон, автоматика, разводка.
                Ошибки на этапе подбора (диаметр обсадки, мощность насоса, объём гидробака) выходят дорого:
                переделать насос — это поднять трос длиной 30–100 м из обсаженной трубы.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-2.5 text-xs text-blue-900 dark:text-blue-200">
                <b>💵 Стоимость:</b> 1.5–12 млн тг для бытовой скважины (на известняк 30–100 м).
                Промышленные/глубокие — до 18 млн.
              </div>
            </div>

            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded-xl p-3 text-xs text-sky-900 dark:text-sky-200">
              <div className="font-bold mb-1.5 text-sm">📘 Нормативная база</div>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                {NORMS.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200">
              <div className="font-bold mb-1">💡 Важно</div>
              <p className="leading-relaxed">
                На скважину глубиной {">"}50 м обязателен <b>паспорт скважины</b> и <b>лицензия Минэкологии РК</b> на пользование недрами.
                Штраф за бурение без лицензии — <b>200 МРП</b> (на 2026 год — около 786 000 тг).
                В смете это закладывается отдельной строкой «Согласования и лицензирование».
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="font-bold mb-1.5 text-sm text-slate-900 dark:text-slate-100">
                🛡️ Зоны санитарной охраны (СанПиН РК)
              </div>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                <li><b>1-й пояс</b> (строгого режима) — радиус 30–50 м, ограждение, охрана</li>
                <li><b>2-й пояс</b> — расчётный, 100–500 м, запрет загрязняющей деятельности</li>
                <li><b>3-й пояс</b> — расчётный, до 3 км, контроль качества</li>
              </ul>
            </div>
          </>
        )}

        {tab === "types" && (
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              📋 Типы скважин и водозаборов (цены 2025, без СМР разводки)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200">
                    <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-left">Тип</th>
                    <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-left">Глубина</th>
                    <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-left">Дебит</th>
                    <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-right">Цена 2025</th>
                    <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-left">Применение</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPES.map((t) => (
                    <tr
                      key={t.name}
                      className="text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-medium">
                        {t.name}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-blue-700 dark:text-blue-400 font-mono">
                        {t.depth}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sky-700 dark:text-sky-400 font-mono">
                        {t.flow}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">
                        {t.price}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-slate-600 dark:text-slate-400">
                        {t.use}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded p-2.5 text-xs text-sky-900 dark:text-sky-200">
              <b>📍 Гидрогеология РК:</b> в Алматы артезианские горизонты на 80–200 м, в Астане — 50–120 м,
              в ЗКО (Атырау, Актау) — солёная вода до 300 м (нужны фильтры обратного осмоса).
            </div>
          </div>
        )}

        {tab === "equip" && (
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              ⚙️ Оборудование скважины (типовой комплект)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-sky-100 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200">
                    <th className="border border-sky-300 dark:border-sky-700 px-2 py-1.5 text-left">Позиция</th>
                    <th className="border border-sky-300 dark:border-sky-700 px-2 py-1.5 text-left">Характеристики</th>
                    <th className="border border-sky-300 dark:border-sky-700 px-2 py-1.5 text-right">Цена 2025</th>
                  </tr>
                </thead>
                <tbody>
                  {EQUIPMENT.map((e) => (
                    <tr
                      key={e.name}
                      className="text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-medium">
                        {e.name}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-slate-600 dark:text-slate-400">
                        {e.spec}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">
                        {e.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-2.5 text-blue-900 dark:text-blue-200">
                <b>🔧 Насос:</b> подбирается по Q (м³/ч) и H (м напора). Запас по напору +10 м на потери.
                Бренды: Grundfos (премиум, 5 лет гарантии), Wilo (средний), ESPA (бюджет, 2 года).
              </div>
              <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded p-2.5 text-sky-900 dark:text-sky-200">
                <b>🛢️ Кессон:</b> утеплённая «бочка» над оголовком, защита от промерзания.
                Глубина установки: ниже точки промерзания (для РК это 1.5–2.2 м).
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-2.5 text-blue-900 dark:text-blue-200">
                <b>🫧 Гидробак:</b> сглаживает пуски насоса. Объём 100 л — для 1–2 точек, 500 л — на коттедж 5+ точек.
                Меньше = чаще циклы = быстрее износ насоса.
              </div>
              <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded p-2.5 text-sky-900 dark:text-sky-200">
                <b>📊 Реле давления:</b> уставки обычно 1.4 бар (вкл) / 2.8 бар (выкл).
                Манометр обязателен — для контроля и регулировки.
              </div>
            </div>
          </div>
        )}

        {tab === "ex" && (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap text-[11px]">
              {EXERCISES.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => sxi(i)}
                  className={`px-2.5 py-1 rounded font-mono ${
                    xi === i
                      ? "bg-blue-600 text-white"
                      : done.has(e.id)
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {done.has(e.id) ? "✓ " : ""}#{i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-bold">
                  Упражнение #{xi + 1} из {EXERCISES.length}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {ex.title}
                </h3>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{ex.q}</p>

              {ex.kind === "mc" && (
                <div className="space-y-1.5">
                  {ex.choices.map((c) => {
                    const isSel = inp === c.k;
                    const isCorrect = rev && c.k === ex.correct;
                    const isWrong = rev && isSel && c.k !== ex.correct;
                    return (
                      <button
                        key={c.k}
                        onClick={() => !rev && setInputs((s) => ({ ...s, [ex.id]: c.k }))}
                        disabled={rev}
                        className={`w-full text-left px-3 py-2 rounded text-xs border transition-colors ${
                          isCorrect
                            ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200"
                            : isWrong
                            ? "bg-rose-50 dark:bg-rose-900/30 border-rose-400 dark:border-rose-600 text-rose-900 dark:text-rose-200"
                            : isSel
                            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500"
                        }`}
                      >
                        <span className="font-mono font-bold mr-2">{c.k})</span>
                        {c.t}
                      </button>
                    );
                  })}
                </div>
              )}

              {ex.kind === "num" && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inp}
                    onChange={(e) => setInputs((s) => ({ ...s, [ex.id]: e.target.value }))}
                    disabled={rev}
                    placeholder="Введите число"
                    className="flex-1 px-3 py-2 text-sm rounded border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{ex.unit}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    (допуск ±{Math.round(ex.tol * 100)}%)
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                {!rev ? (
                  <button
                    onClick={submit}
                    disabled={!inp}
                    className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded"
                  >
                    Проверить
                  </button>
                ) : (
                  <>
                    <button
                      onClick={reset}
                      className="px-4 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded"
                    >
                      ↻ Попробовать снова
                    </button>
                    {xi + 1 < EXERCISES.length && (
                      <button
                        onClick={() => sxi(xi + 1)}
                        className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded"
                      >
                        Следующее →
                      </button>
                    )}
                  </>
                )}
              </div>

              {rev && (
                <>
                  <div
                    className={`rounded p-3 text-xs ${
                      correct
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
                        : "bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200"
                    }`}
                  >
                    <b>{correct ? "✓ Верно!" : "✗ Неверно."}</b>{" "}
                    {ex.kind === "num" && (
                      <>
                        Правильный ответ: <span className="font-mono font-bold">{ex.answer.toLocaleString("ru-RU")} {ex.unit}</span>
                      </>
                    )}
                    {ex.kind === "mc" && (
                      <>
                        Правильный вариант: <span className="font-mono font-bold">{ex.correct})</span>
                      </>
                    )}
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-3 text-xs text-blue-900 dark:text-blue-200">
                    <div className="font-bold mb-1">📐 Решение</div>
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{ex.solution}</pre>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-3 text-xs text-slate-800 dark:text-slate-200">
                    <div className="font-bold mb-1 text-slate-600 dark:text-slate-400">📋 Запись в ВОР</div>
                    <p className="leading-relaxed font-mono text-[11px]">{ex.vor}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "esn" && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                💰 Расценки ЭСН РК для скважин
              </h2>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                {ESN.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
                💵 Типовой расчёт стоимости (ориентир 2025)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200">
                      <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-left">Работа</th>
                      <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-right">Ед.</th>
                      <th className="border border-blue-300 dark:border-blue-700 px-2 py-1.5 text-right">Цена 2025</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800 dark:text-slate-200">
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Бурение скважины ∅150 мм (на песок)</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">м</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">14 000 тг</td></tr>
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Бурение скважины ∅150 мм (на известняк)</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">м</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">25 000 тг</td></tr>
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Обсадка трубой ПНД ∅125</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">м</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">12 000 тг</td></tr>
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Прокачка скважины (раскачка)</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">сут</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">45 000 тг</td></tr>
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Монтаж глубинного насоса</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">шт</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">35 000 тг</td></tr>
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Монтаж кессона</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">шт</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">55 000 тг</td></tr>
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Паспорт скважины + лаб. анализ воды</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">компл</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">85 000 тг</td></tr>
                    <tr><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">Лицензия Минэкологии (для H{">"}50 м)</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono">компл</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-mono font-semibold">от 250 000 тг</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200">
              <div className="font-bold mb-1">⚠️ Подводный камень сметы</div>
              <p className="leading-relaxed">
                Сметчики часто забывают: <b>разводка от скважины до дома</b> (траншея, ПНД-труба, утеплитель, греющий кабель)
                — это ещё 80 000–150 000 тг за 10 м. На 50 м от скважины до коттеджа набегает почти миллион.
                Проверяй раздел «Наружные сети В1» отдельно от раздела «Скважина».
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
