"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tolAbs: number): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs(v - expected) <= tolAbs;
}

type FloorRow = {
  name: string;
  workPrice: string;
  materialPrice: string;
  lifespan: string;
  note: string;
};

const FLOOR_ROWS: FloorRow[] = [
  {
    name: "Бетонная стяжка М200",
    workPrice: "1 500–2 500 тг/м²",
    materialPrice: "800–1 500 тг/м²",
    lifespan: "30–50 лет",
    note: "Основа под все финишные покрытия. Толщина 40–80 мм.",
  },
  {
    name: "Керамогранит 600×600",
    workPrice: "2 500–4 000 тг/м²",
    materialPrice: "3 500–8 000 тг/м²",
    lifespan: "30–50 лет",
    note: "Холлы, торговые залы, мокрые зоны. Высокая износостойкость.",
  },
  {
    name: "Плитка ПВХ / LVT (виниловая)",
    workPrice: "1 200–2 000 тг/м²",
    materialPrice: "2 500–5 500 тг/м²",
    lifespan: "15–20 лет",
    note: "Офисы, коридоры. Водостойкая, тёплая на ощупь. Без стяжки.",
  },
  {
    name: "Ламинат AC4/AC5",
    workPrice: "1 000–1 800 тг/м²",
    materialPrice: "1 800–4 500 тг/м²",
    lifespan: "10–20 лет",
    note: "Жилые помещения. Плавающая укладка на подложку. Влажность ≤ 2.5%.",
  },
  {
    name: "Паркет инженерный (дуб)",
    workPrice: "3 000–5 000 тг/м²",
    materialPrice: "6 000–15 000 тг/м²",
    lifespan: "25–40 лет",
    note: "Премиальное жильё, рестораны. Клеевая укладка на стяжку.",
  },
  {
    name: "Наливной полимерный пол",
    workPrice: "2 500–5 000 тг/м²",
    materialPrice: "3 000–7 000 тг/м²",
    lifespan: "15–25 лет",
    note: "Промышленные цеха, коммерческие помещения. Бесшовное покрытие.",
  },
  {
    name: "Линолеум ПВХ (коммерческий)",
    workPrice: "800–1 500 тг/м²",
    materialPrice: "1 500–3 500 тг/м²",
    lifespan: "10–15 лет",
    note: "Школы, больницы. Рулонная укладка на клей. Антибактериальный.",
  },
  {
    name: "Ковролин (петлевой)",
    workPrice: "700–1 200 тг/м²",
    materialPrice: "1 200–3 000 тг/м²",
    lifespan: "7–12 лет",
    note: "Гостиницы, конференц-залы. Тёплый, звукопоглощающий.",
  },
];

type LayerRow = {
  layer: string;
  thickness: string;
  price: string;
};

const FLOOR_LAYERS: LayerRow[] = [
  {
    layer: "Перекрытие / основание",
    thickness: "По проекту",
    price: "—",
  },
  {
    layer: "Гидроизоляция (в мокрых зонах)",
    thickness: "1–5 мм",
    price: "1 500–4 000 тг/м²",
  },
  {
    layer: "Утеплитель / звукоизоляционная подложка",
    thickness: "20–100 мм",
    price: "1 000–3 500 тг/м²",
  },
  {
    layer: "Цементно-песчаная стяжка",
    thickness: "40–80 мм",
    price: "2 000–4 000 тг/м²",
  },
  {
    layer: "Подложка / клей / выравнивающий слой",
    thickness: "2–5 мм",
    price: "300–800 тг/м²",
  },
  {
    layer: "Финишное покрытие",
    thickness: "5–25 мм",
    price: "По виду покрытия",
  },
];

type SpecialFloor = {
  type: string;
  description: string;
  price: string;
};

const SPECIAL_FLOORS: SpecialFloor[] = [
  {
    type: "Промышленный (упрочнённый бетон)",
    description:
      "Топпинг на свежую стяжку. Прочность 60–80 МПа. Склады, заводы.",
    price: "800–2 500 тг/м²",
  },
  {
    type: "Полимерный (эпоксидный / полиуретановый)",
    description:
      "Наливной бесшовный. Химически стойкий. Лаборатории, пищевые цеха.",
    price: "3 000–8 000 тг/м²",
  },
  {
    type: "Медицинский / антистатический",
    description:
      "Линолеум Tarkett / Forbo. R < 10⁶ Ом. Операционные, серверные.",
    price: "3 500–7 000 тг/м²",
  },
  {
    type: "Спортивный (Tarkett Omnisports / Gerflor)",
    description:
      "Буферный слой EVA 2–5 мм. Снижает нагрузку на суставы. Спортзалы.",
    price: "5 000–12 000 тг/м²",
  },
  {
    type: "Тёплый пол (электро / водяной)",
    description:
      "Греющий кабель или трубы PEX в стяжке. Доп. к покрытию любого типа.",
    price: "3 000–8 000 тг/м² (система)",
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
    title: "Бюджет на укладку керамогранита",
    question:
      "Площадь торгового зала: 80 м². Выбран керамогранит формат 600×600. Стоимость работы: 3 000 тг/м², стоимость материала (плитка + клей + затирка): 4 500 тг/м². Рассчитайте полный бюджет на устройство покрытия (работа + материал), тг.",
    label: "Бюджет, тг",
    expected: 600000,
    tolAbs: 20000,
    solution:
      "Бюджет = Площадь × (Работа + Материал) = 80 × (3 000 + 4 500) = 80 × 7 500 = 600 000 тг. На практике добавляют 10–15% на обрезку плитки, 5% запас материала и 3–5% непредвиденные. Итоговая смета = 600 000 × 1.15 ≈ 690 000 тг. Позиция ЛСР: ЭСН Сб.17-01-008.",
    vor: "Устройство покрытия из керамогранита 600×600 на клею — 80 м² (ЭСН Сб.17-01-008)",
  },
  {
    id: "ex2",
    title: "Применение наливного пола",
    question:
      "Заказчик спрашивает, где лучше всего применять полимерный наливной пол. Что является главным преимуществом этого покрытия и в каких помещениях оно наиболее оправдано?",
    label: "Выберите ответ",
    options: [
      {
        key: "a",
        text: "Жилые квартиры — самое дешёвое решение для комнат",
      },
      {
        key: "b",
        text: "Промышленные цеха и коммерческие помещения — прочность, бесшовность, химстойкость",
      },
      {
        key: "c",
        text: "Деревянные конструкции — хорошо сцепляется с деревом",
      },
      {
        key: "d",
        text: "Открытые террасы — морозостойкое покрытие",
      },
    ],
    correct: "b",
    solution:
      "Правильный ответ: b). Наливной полимерный пол (эпоксидный, полиуретановый, метилметакрилатный) применяется прежде всего в промышленных, коммерческих и специальных помещениях — цеха, склады, лаборатории, пищевые производства, торговые залы. Ключевые преимущества: бесшовная монолитная поверхность (нет щелей для грязи и бактерий), высокая прочность к истиранию (до 80 МПа), химическая стойкость, гигиеничность. В жилых помещениях используется редко из-за высокой цены. ЭСН Сб.17-06 — полимерные наливные полы.",
    vor: "Устройство полимерного наливного пола эпоксидного δ=3 мм — 1 м² (ЭСН Сб.17-06-001)",
  },
  {
    id: "ex3",
    title: "Требования перед укладкой ламината",
    question:
      "Прораб собирается уложить ламинат AC4 в жилых комнатах. Какие обязательные условия должны быть соблюдены перед началом укладки по нормам производителя и СП РК?",
    label: "Выберите ответ",
    options: [
      {
        key: "a",
        text: "Стяжка должна быть свежей (не старше 3 дней) — пока тёплая, лучше схватывается клей",
      },
      {
        key: "b",
        text: "Достаточно просто убрать мусор — ламинат не требователен к основанию",
      },
      {
        key: "c",
        text: "Стяжка сухая (влажность ≤ 2.5%), ровная (перепад ≤ 2 мм на 2 м), температура +18…+25°C",
      },
      {
        key: "d",
        text: "Обязательно нанести грунтовку и клей ПВА на всю площадь стяжки",
      },
    ],
    correct: "c",
    solution:
      "Правильный ответ: c). Укладка ламината требует строгого соблюдения условий: 1) Влажность стяжки ≤ 2.5% (проверяется влагомером или плёночным тестом — кусок плёнки 50×50 см приклеивается на 72 ч, конденсат недопустим). Превышение влажности → вздутие ламината. 2) Ровность: перепад не более 2 мм на отрезке 2 м (измеряется рейкой). Большие перепады → скрип и щелчки при ходьбе. 3) Температура 18–25°C и влажность воздуха 40–65%. Ламинат должен акклиматизироваться в помещении 48 ч в упаковках. Грунт и клей под плавающий ламинат не нужны — он крепится замковым соединением.",
    vor: "Устройство покрытия из ламината AC4 на подложке 3 мм — 1 м² (ЭСН Сб.17-04-002)",
  },
  {
    id: "ex4",
    title: "Стоимость устройства стяжки",
    question:
      "Площадь помещения: 80 м². Бетонная стяжка толщиной 60 мм. Стоимость работы по ЭСН: 2 500 тг/м². Рассчитайте стоимость только работ по устройству стяжки, тг.",
    label: "Стоимость стяжки (работа), тг",
    expected: 200000,
    tolAbs: 5000,
    solution:
      "Стоимость работ = Площадь × Цена работы = 80 × 2 500 = 200 000 тг. К этому добавляются материалы: цемент М400 (норма ~18 кг/м² при толщине 60 мм × плотность ~1.7 т/м³ × 60 мм / 1000 = 102 кг/м² смеси, из которых цемент ~18 кг/м²), песок, вода. Стоимость материалов примерно 1 200–1 500 тг/м² = 96 000–120 000 тг. Итого стяжка «под ключ» ≈ 296 000–320 000 тг. В смете работы и материалы указываются отдельными строками.",
    vor: "Устройство стяжки цементно-песчаной δ=60 мм — 80 м² (ЭСН Сб.17-01-001)",
  },
];

export default function FloorTypesPage() {
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
            className="text-amber-400 hover:text-amber-300 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta Trainer / Drawings Practice
          </span>
        </header>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          🪟 Виды напольных покрытий и полов
        </h1>
        <p className="text-slate-400 mb-8">
          От бетонной стяжки до паркета — разные расценки по ЭСН Сб.17,
          технологии укладки, сроки службы и области применения. Правильный
          выбор покрытия экономит бюджет и повышает долговечность объекта.
        </p>

        {/* Intro */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-amber-300">
            Нормативная база и ЭСН Сб.17
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">Нормативы РК:</h3>
              <ul className="text-slate-400 space-y-1">
                <li>• ЭСН РК Сб.17 — полы (все виды покрытий)</li>
                <li>• СП РК 2.02-10 — нагрузки и воздействия на перекрытия</li>
                <li>• ГОСТ 13079-93 — линолеум поливинилхлоридный</li>
                <li>• EN 13329 — ламинат (классы AC1–AC6)</li>
                <li>• СН РК 1.04-23 — правила производства отделочных работ</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Ориентировочная стоимость «под ключ»:
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• Эконом: стяжка + линолеум → 3 000–5 000 тг/м²</li>
                <li>• Средний: стяжка + керамогранит → 7 000–12 000 тг/м²</li>
                <li>• Бизнес: стяжка + инж. паркет → 15 000–25 000 тг/м²</li>
                <li>• Промышленный: наливной пол → 6 000–15 000 тг/м²</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1: Floor types table */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-amber-300">
            1. Виды напольных покрытий
          </h2>
          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-amber-200">
                <tr>
                  <th className="px-3 py-2 text-left">Покрытие</th>
                  <th className="px-3 py-2 text-right">Работа, тг/м²</th>
                  <th className="px-3 py-2 text-right">Материал, тг/м²</th>
                  <th className="px-3 py-2 text-right">Срок службы</th>
                  <th className="px-3 py-2 text-left">Применение</th>
                </tr>
              </thead>
              <tbody>
                {FLOOR_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-right text-amber-300 font-mono whitespace-nowrap">
                      {r.workPrice}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-200 font-mono whitespace-nowrap">
                      {r.materialPrice}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">
                      {r.lifespan}
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs">
                      {r.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Floor construction layers */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-amber-300">
            2. Конструкция пола (снизу вверх)
          </h2>
          <div className="space-y-2">
            {FLOOR_LAYERS.map((layer, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg"
              >
                <span className="w-6 h-6 rounded-full bg-amber-800/50 text-amber-300 text-xs flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{layer.layer}</span>
                </div>
                <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                  {layer.thickness}
                </span>
                <span className="text-xs text-amber-300 font-mono whitespace-nowrap">
                  {layer.price}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Общая толщина «пирога» пола: 100–200 мм от отметки перекрытия.
            При проектировании учитывается в высоте помещения.
          </p>
        </section>

        {/* Section 3: Special floors */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-amber-300">
            3. Специальные полы
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {SPECIAL_FLOORS.map((sf, i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-amber-200 text-sm">
                    {sf.type}
                  </h3>
                  <span className="text-amber-300 text-xs font-mono whitespace-nowrap">
                    {sf.price}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{sf.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Exercises */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-amber-300">
            4. Интерактивные упражнения
          </h2>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setTabIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  i === tabIdx
                    ? "bg-amber-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                } ${solved.has(e.id) ? "ring-2 ring-emerald-500/60" : ""}`}
              >
                №{i + 1} {solved.has(e.id) ? "✓" : ""}
              </button>
            ))}
          </div>

          {/* Active exercise */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-amber-200">
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
                        ? "bg-amber-900/30 border-amber-600"
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
                      className="accent-amber-500"
                    />
                    <span className="font-mono text-amber-300 text-sm">
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
                  className="w-full md:w-80 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={submit}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition"
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
              <div className="mt-3 p-4 bg-slate-800/60 border border-amber-800/40 rounded-lg">
                <h4 className="text-sm font-semibold text-amber-300 mb-2">
                  Решение:
                </h4>
                <p className="text-sm text-slate-200 mb-3 whitespace-pre-line">
                  {ex.solution}
                </p>
                <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
                  <strong className="text-amber-300">Позиция в ВОР:</strong>{" "}
                  {ex.vor}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ESN section */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-amber-300">
            Расценки ЭСН РК — Сборник 17 «Полы»
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Основные разделы Сб.17
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• 17-01-x — стяжки (цементно-песчаные, ангидритные)</li>
                <li>• 17-02-x — покрытия из плитки керамической</li>
                <li>• 17-03-x — линолеум, ковролин, плитка ПВХ</li>
                <li>• 17-04-x — ламинат, паркет, пробка</li>
                <li>• 17-05-x — паркет из массива, инженерный паркет</li>
                <li>• 17-06-x — полимерные наливные полы</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Единицы измерения
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• Стяжка, покрытия — м² (площадь помещения в плане)</li>
                <li>• Плинтус — погонный метр (пм)</li>
                <li>• Пороги — шт</li>
                <li>
                  • Площадь считается за вычетом колонн, стен, фундаментов
                </li>
                <li>• Мозаика и художественный паркет — м² с коэф. 1.3</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-6 border-t border-slate-800">
          AEVION Smeta Trainer · Виды полов · ЭСН Сб.17 · EN 13329 ·
          СН РК 1.04-23 · Корпус РК 2026
        </footer>
      </div>
    </div>
  );
}
