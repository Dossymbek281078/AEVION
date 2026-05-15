"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tolAbs: number): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs(v - expected) <= tolAbs;
}

type PlasterRow = {
  type: string;
  rate: string;
  consumption: string;
  application: string;
};

const PLASTER_ROWS: PlasterRow[] = [
  {
    type: "Гипсовая машинная (Knauf Rotband / MP75)",
    rate: "350–600 тг/м²",
    consumption: "8–12 кг/м² (при δ=10 мм)",
    application:
      "Внутренние стены и потолки. Быстрое нанесение машиной. Не для влажных помещений.",
  },
  {
    type: "Цементно-песчаная (ЦПС М150)",
    rate: "400–700 тг/м²",
    consumption: "15–18 кг/м² (при δ=10 мм)",
    application:
      "Фасады, цоколи, мокрые помещения (ванные, подвалы). Высокая влагостойкость.",
  },
  {
    type: "Декоративная штукатурка (Короед / Барашек)",
    rate: "600–1 500 тг/м²",
    consumption: "3–5 кг/м²",
    application:
      "Фасадная и интерьерная отделка. Фактурная поверхность без окраски.",
  },
  {
    type: "Наружная фасадная (силиконово-силикатная)",
    rate: "800–1 800 тг/м²",
    consumption: "4–7 кг/м²",
    application:
      "Наружные фасады по СФТК (утеплённые фасадные системы). Паропроницаемая.",
  },
];

type PaintRow = {
  type: string;
  rate: string;
  layers: string;
  consumption: string;
  application: string;
};

const PAINT_ROWS: PaintRow[] = [
  {
    type: "Интерьерная латексная (водоэмульсионная)",
    rate: "200–450 тг/м²",
    layers: "2 слоя",
    consumption: "0.20–0.30 л/м² / слой",
    application: "Потолки, стены в помещениях. Легко перекрашивается.",
  },
  {
    type: "Фасадная силиконовая / акриловая",
    rate: "400–900 тг/м²",
    layers: "2–3 слоя",
    consumption: "0.25–0.35 л/м² / слой",
    application:
      "Наружные стены. Паропроницаемость, атмосферостойкость, УФ-защита.",
  },
  {
    type: "Краска по металлу (алкидная / ПФ)",
    rate: "350–700 тг/м²",
    layers: "2 слоя (грунт + финиш)",
    consumption: "0.12–0.18 кг/м² / слой",
    application: "Металлоконструкции, ограждения, ворота. Антикоррозионная.",
  },
  {
    type: "Краска по дереву (алкидная / акриловая)",
    rate: "300–600 тг/м²",
    layers: "2–3 слоя",
    consumption: "0.10–0.15 л/м² / слой",
    application:
      "Оконные рамы, двери, деревянные фасады. Морозостойкая вариация.",
  },
  {
    type: "Венецианская штукатурка / декоративная роспись",
    rate: "3 000–8 000 тг/м²",
    layers: "3–7 слоёв",
    consumption: "0.5–1.0 кг/м²",
    application:
      "Лобби, рестораны, VIP-зоны. Класс работ L5. Ручной труд мастера.",
  },
];

type PuttingRow = {
  type: string;
  rate: string;
  consumption: string;
  note: string;
};

const PUTTING_ROWS: PuttingRow[] = [
  {
    type: "Шпаклёвка стартовая (Knauf Fugen / Vetonit Pro)",
    rate: "150–300 тг/м²",
    consumption: "1.0–1.5 кг/м² / мм толщины",
    note: "Заделка неровностей 3–10 мм, трещины, углы. ЭСН Сб.15-04.",
  },
  {
    type: "Шпаклёвка финишная (Knauf Finish / Semin CE 78)",
    rate: "200–400 тг/м²",
    consumption: "0.8–1.2 кг/м² / мм",
    note: "Финальное выравнивание под краску. Толщина 1–3 мм. ЭСН Сб.15-04.",
  },
];

type WallpaperRow = {
  type: string;
  rate: string;
  glue: string;
  note: string;
};

const WALLPAPER_ROWS: WallpaperRow[] = [
  {
    type: "Бумажные обои (дуплекс)",
    rate: "300–600 тг/м²",
    glue: "80–120 г/м²",
    note: "Спальни, дешёвый сегмент. Нельзя мыть. Срок 3–5 лет.",
  },
  {
    type: "Флизелиновые (Grandeco, Dekens)",
    rate: "500–900 тг/м²",
    glue: "150–200 г/м²",
    note: "Клей наносится на стену. Под покраску. Срок 10–15 лет.",
  },
  {
    type: "Виниловые на флизелиновой основе",
    rate: "600–1 200 тг/м²",
    glue: "180–250 г/м²",
    note: "Влажные помещения (кухня). Моющиеся. Срок 10–15 лет.",
  },
];

type Exercise = {
  id: string;
  title: string;
  question: string;
  label: string;
  expected?: number;
  tolAbs?: number;
  options?: { key: string; text: string }[];
  correct?: string;
  solution: string;
  vor: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Расход гипсовой штукатурки",
    question:
      "Стены в здании школы: суммарная площадь стен под оштукатуривание — 200 м². Применяется гипсовая машинная штукатурка Knauf MP75, толщина слоя 10 мм. Норма расхода: 9 кг/м² (при δ = 10 мм). Рассчитайте общий расход материала в кг.",
    label: "Расход штукатурки, кг",
    expected: 1800,
    tolAbs: 50,
    solution:
      "Расход = Площадь × Норма = 200 × 9 = 1 800 кг. В мешках по 30 кг: 1 800 / 30 = 60 мешков. В сметной позиции расход указывается в т: 1 800 кг = 1.8 т. Стоимость материала ≈ 1 800 × 45 = 81 000 тг (при цене 45 тг/кг). Стоимость работы по ЭСН: 200 × 450 = 90 000 тг. Итого по позиции ≈ 171 000 тг. ЭСН Сб.14-02-003.",
    vor: "Штукатурка стен гипсовая машинная δ=10 мм — 200 м² (ЭСН Сб.14-02-003)",
  },
  {
    id: "ex2",
    title: "Выбор краски для наружных фасадов",
    question:
      "Фасад жилого дома (наружная поверхность, открытая атмосферному воздействию) требует окраски. Проектировщик отделочных работ должен выбрать тип краски. Какой вариант соответствует требованиям к наружным фасадам?",
    label: "Выберите ответ",
    options: [
      {
        key: "a",
        text: "Водоэмульсионная интерьерная — самая экономичная и быстросохнущая",
      },
      {
        key: "b",
        text: "Силиконовая / акриловая фасадная — паропроницаемая и атмосферостойкая",
      },
      {
        key: "c",
        text: "Алкидная масляная (ПФ-115) — привычная, широко применяется внутри",
      },
      {
        key: "d",
        text: "Меловая побелка — дешёво и экологично для фасадов",
      },
    ],
    correct: "b",
    solution:
      "Правильный ответ: b). Для наружных фасадов применяются силиконовые или акриловые фасадные краски. Ключевые требования: паропроницаемость (пар из помещений должен выходить через стену, не образуя пузырей), атмосферостойкость (дождь, мороз, УФ-излучение), долгий срок службы 10–15 лет. Водоэмульсионная интерьерная краска смывается дождём. Алкидная (ПФ-115) — паронепроницаема, трескается при перепадах температур. Меловая побелка смывается дождём и не является лакокрасочным покрытием. ЭСН Сб.15-06-x — фасадные работы по окраске.",
    vor: "Окраска фасада силиконовой краской в 2 слоя — 1 м² (ЭСН Сб.15-06-012)",
  },
  {
    id: "ex3",
    title: "Класс работ венецианской штукатурки",
    question:
      "Дизайнер проекта предусмотрел венецианскую штукатурку в лобби гостиницы 5*. Мастер-сметчик задаёт вопрос: к какому классу сложности отделочных работ относится эта технология и как это влияет на расценку?",
    label: "Выберите ответ",
    options: [
      {
        key: "a",
        text: "L1 — простая отделка: штукатурка под окраску, допуск 5 мм",
      },
      {
        key: "b",
        text: "L3 — улучшенная: шпаклёвка + 2 слоя краски",
      },
      {
        key: "c",
        text: "L4 — высококачественная: финишная шпаклёвка, без видимых дефектов",
      },
      {
        key: "d",
        text: "L5 — высококвалифицированная ручная работа: венецианка 3–7 слоёв, цена 3 000–8 000 тг/м² только за работу",
      },
    ],
    correct: "d",
    solution:
      "Правильный ответ: d). Венецианская штукатурка относится к классу L5 — высшему уровню квалификации отделочных работ. Технология: 3–7 слоёв мраморной известковой массы (Marmorino, Stucco Veneziano), каждый слой полируется до зеркального блеска стальным шпателем. Работа выполняется только специалистами с подтверждённой квалификацией. Стоимость только работы: 3 000–8 000 тг/м², материал — ещё 1 500–3 000 тг/м². В ЭСН Сб.15 эта расценка входит в раздел «Декоративные штукатурки» с повышающим коэффициентом сложности 2.5–4.0 к базовой расценке.",
    vor: "Венецианская штукатурка (мраморная масса) 5 слоёв — 1 м² (ЭСН Сб.15-03-025 × К=3.0)",
  },
  {
    id: "ex4",
    title: "Расход клея для флизелиновых обоев",
    question:
      "Площадь стен под поклейку флизелиновыми обоями: 200 м². Норма расхода клея (Quelyd / Metylan): 200 г/м² (клей наносится на стену, не на обои). Рассчитайте общий расход клея в кг.",
    label: "Расход клея, кг",
    expected: 40,
    tolAbs: 2,
    solution:
      "Расход клея = Площадь × Норма = 200 м² × 0.200 кг/м² = 40 кг. В пакетах клея по 200 г (1 пакет) обычно разводится на 10–12 м². На 200 м² нужно 200 / 10 = 20 пакетов (при норме 10 м²/пакет), что составляет 20 × 200 г = 4 000 г = 4 кг. Но если клей готовый (не концентрат), расход выше — 200 г/м² × 200 м² = 40 000 г = 40 кг. В смете используется концентрированный клей (сухой), пересчёт выхода — по инструкции производителя. Для ответа: 200 × 0.2 = 40 кг.",
    vor: "Оклейка стен флизелиновыми обоями — 200 м² (ЭСН Сб.15-08-006)",
  },
];

export default function PaintingPlasteringPage() {
  const [tabIdx, setTabIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());

  const ex = EXERCISES[tabIdx];

  function submit(): void {
    if (ex.options && ex.correct) {
      const picked = choices[ex.id];
      if (picked === ex.correct) {
        setSolved((prev) => {
          const next = new Set(prev);
          next.add(ex.id);
          return next;
        });
        setWrong((prev) => {
          const next = new Set(prev);
          next.delete(ex.id);
          return next;
        });
      } else {
        setWrong((prev) => {
          const next = new Set(prev);
          next.add(ex.id);
          return next;
        });
      }
    } else if (
      typeof ex.expected === "number" &&
      typeof ex.tolAbs === "number"
    ) {
      const val = inputs[ex.id] ?? "";
      if (checkNum(val, ex.expected, ex.tolAbs)) {
        setSolved((prev) => {
          const next = new Set(prev);
          next.add(ex.id);
          return next;
        });
        setWrong((prev) => {
          const next = new Set(prev);
          next.delete(ex.id);
          return next;
        });
      } else {
        setWrong((prev) => {
          const next = new Set(prev);
          next.add(ex.id);
          return next;
        });
      }
    }
  }

  function toggleReveal(): void {
    setReveal((r) => ({ ...r, [ex.id]: !r[ex.id] }));
  }

  const isSolved = solved.has(ex.id);
  const isWrong = wrong.has(ex.id) && !isSolved;
  const showSol = !!reveal[ex.id];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-fuchsia-400 hover:text-fuchsia-300 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta Trainer / Drawings Practice
          </span>
        </header>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          🎨 Малярные и штукатурные работы
        </h1>
        <p className="text-slate-400 mb-8">
          ЭСН Сб.15 (малярные) и Сб.14 (штукатурные) — одни из самых массовых
          статей отделочных работ. Правильный подбор материала, нормы расхода
          и расценки напрямую влияют на точность ЛСР.
        </p>

        {/* Intro */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-fuchsia-300">
            Нормативная база
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">Нормативы РК:</h3>
              <ul className="text-slate-400 space-y-1">
                <li>• ЭСН РК Сб.14 — штукатурные работы</li>
                <li>• ЭСН РК Сб.15 — малярные работы</li>
                <li>• ГОСТ 28013-98 — строительные растворы</li>
                <li>• СН РК 1.04-23 — производство отделочных работ</li>
                <li>• EN 13300 — классификация красок (моющихся)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Классы отделки:
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• L1 — простая (подсобные, технические помещения)</li>
                <li>• L2 — улучшенная (типовое жильё)</li>
                <li>• L3 — высококачественная (офисы, отели 3*)</li>
                <li>• L4 — безупречная (отели 4–5*)</li>
                <li>• L5 — декоративная ручная (VIP, рестораны)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1: Plastering */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-fuchsia-300">
            1. Штукатурные работы (ЭСН Сб.14)
          </h2>
          <div className="space-y-3">
            {PLASTER_ROWS.map((r, i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-fuchsia-200 text-sm">
                    {r.type}
                  </h3>
                  <div className="flex gap-3 flex-wrap text-xs">
                    <span className="text-fuchsia-300 font-mono">{r.rate}</span>
                    <span className="text-slate-500 font-mono">
                      {r.consumption}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{r.application}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Painting */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-fuchsia-300">
            2. Малярные работы (ЭСН Сб.15)
          </h2>
          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-fuchsia-200">
                <tr>
                  <th className="px-3 py-2 text-left">Вид покраски</th>
                  <th className="px-3 py-2 text-right">Расценка, тг/м²</th>
                  <th className="px-3 py-2 text-center">Слоёв</th>
                  <th className="px-3 py-2 text-left">Применение</th>
                </tr>
              </thead>
              <tbody>
                {PAINT_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2 font-medium">{r.type}</td>
                    <td className="px-3 py-2 text-right text-fuchsia-300 font-mono whitespace-nowrap">
                      {r.rate}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-400">
                      {r.layers}
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs">
                      {r.application}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Расходы красок: интерьерные 0.15–0.30 л/м²/слой, фасадные
            0.25–0.40 л/м²/слой. В смете — расход в л на позицию.
          </p>
        </section>

        {/* Section 3: Putty */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-fuchsia-300">
            3. Шпаклёвание (ЭСН Сб.15-04)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {PUTTING_ROWS.map((r, i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4"
              >
                <h3 className="font-semibold text-fuchsia-200 text-sm mb-2">
                  {r.type}
                </h3>
                <div className="text-xs space-y-1">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-16 flex-shrink-0">
                      Расценка:
                    </span>
                    <span className="text-fuchsia-300 font-mono">{r.rate}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-16 flex-shrink-0">
                      Расход:
                    </span>
                    <span className="text-slate-400">{r.consumption}</span>
                  </div>
                  <p className="text-slate-400 mt-1">{r.note}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Шпаклёвка — обязательный этап перед покраской L3 и выше. Без
            шпаклёвки покраска даёт «рябь» и неравномерный тон.
          </p>
        </section>

        {/* Section 4: Wallpapers */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-fuchsia-300">
            4. Обои — виды и расценки (ЭСН Сб.15-08)
          </h2>
          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-fuchsia-200">
                <tr>
                  <th className="px-3 py-2 text-left">Вид обоев</th>
                  <th className="px-3 py-2 text-right">Работа, тг/м²</th>
                  <th className="px-3 py-2 text-right">Клей, г/м²</th>
                  <th className="px-3 py-2 text-left">Особенности</th>
                </tr>
              </thead>
              <tbody>
                {WALLPAPER_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2 font-medium">{r.type}</td>
                    <td className="px-3 py-2 text-right text-fuchsia-300 font-mono whitespace-nowrap">
                      {r.rate}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 font-mono whitespace-nowrap">
                      {r.glue}
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs">
                      {r.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Площадь под обои считается за вычетом проёмов (окна, двери).
            Добавляется 10–15% на подрезку при стыковке рисунка.
          </p>
        </section>

        {/* Section 5: Exercises */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-fuchsia-300">
            5. Интерактивные упражнения
          </h2>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setTabIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  i === tabIdx
                    ? "bg-fuchsia-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                } ${solved.has(e.id) ? "ring-2 ring-emerald-500/60" : ""}`}
              >
                №{i + 1} {solved.has(e.id) ? "✓" : ""}
              </button>
            ))}
          </div>

          {/* Active exercise */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-fuchsia-200">
              Упражнение №{tabIdx + 1}: {ex.title}
            </h3>
            <p className="text-sm text-slate-300 mb-4 whitespace-pre-line">
              {ex.question}
            </p>

            {/* Multiple choice */}
            {ex.options && (
              <div className="space-y-2 mb-4">
                {ex.options.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition border ${
                      choices[ex.id] === opt.key
                        ? "bg-fuchsia-900/30 border-fuchsia-600"
                        : "bg-slate-800/40 border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name={ex.id}
                      value={opt.key}
                      checked={choices[ex.id] === opt.key}
                      onChange={(e) =>
                        setChoices((prev) => ({
                          ...prev,
                          [ex.id]: e.target.value,
                        }))
                      }
                      className="accent-fuchsia-500"
                    />
                    <span className="font-mono text-fuchsia-300 text-sm">
                      {opt.key})
                    </span>
                    <span className="text-sm text-slate-200">{opt.text}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Numeric input */}
            {!ex.options && (
              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-1">
                  {ex.label}
                </label>
                <input
                  type="text"
                  value={inputs[ex.id] ?? ""}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [ex.id]: e.target.value }))
                  }
                  placeholder="Введите число..."
                  className="w-full md:w-80 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-fuchsia-500 focus:outline-none"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={submit}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-sm font-medium transition"
              >
                Проверить
              </button>
              <button
                onClick={toggleReveal}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition border border-slate-700"
              >
                {showSol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>

            {/* Result feedback */}
            {isSolved && (
              <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg text-emerald-200 text-sm mb-3">
                ✓ Верно! Ответ принят.
              </div>
            )}
            {isWrong && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm mb-3">
                Неверно. Проверьте ответ или нажмите «Показать решение».
              </div>
            )}

            {/* Solution */}
            {showSol && (
              <div className="mt-3 p-4 bg-slate-800/60 border border-fuchsia-800/40 rounded-lg">
                <h4 className="text-sm font-semibold text-fuchsia-300 mb-2">
                  Решение:
                </h4>
                <p className="text-sm text-slate-200 mb-3 whitespace-pre-line">
                  {ex.solution}
                </p>
                <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
                  <strong className="text-fuchsia-300">Позиция в ВОР:</strong>{" "}
                  {ex.vor}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ESN section */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-fuchsia-300">
            Расценки ЭСН РК — Сб.14 и Сб.15
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Сборник 14 — Штукатурные работы
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• 14-01-x — штукатурка простая (цементная)</li>
                <li>• 14-02-x — штукатурка гипсовая (машинная / ручная)</li>
                <li>• 14-03-x — декоративная штукатурка (фактурная)</li>
                <li>• 14-04-x — фасадная штукатурка по СФТК</li>
                <li>• 14-05-x — штукатурка по сетке (армированная)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Сборник 15 — Малярные работы
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• 15-01-x — окраска водоэмульсионная (интерьер)</li>
                <li>• 15-03-x — декоративная (венецианская) штукатурка</li>
                <li>• 15-04-x — шпаклёвка стартовая и финишная</li>
                <li>• 15-06-x — окраска фасадная (силиконовая / акрил.)</li>
                <li>• 15-07-x — окраска металлоконструкций</li>
                <li>• 15-08-x — поклейка обоев всех видов</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-6 border-t border-slate-800">
          AEVION Smeta Trainer · Малярные и штукатурные работы · ЭСН Сб.14–15 ·
          ГОСТ 28013-98 · СН РК 1.04-23 · Корпус РК 2026
        </footer>
      </div>
    </div>
  );
}
