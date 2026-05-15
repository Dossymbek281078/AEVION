"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tolAbs: number): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs(v - expected) <= tolAbs;
}

type ThermalRow = {
  material: string;
  lambda: string;
  thickness: string;
  price: string;
  note: string;
};

const THERMAL_ROWS: ThermalRow[] = [
  {
    material: "Минеральная вата (Knauf / Rockwool)",
    lambda: "0.035–0.045 Вт/м·К",
    thickness: "100–200 мм",
    price: "3 000–6 000 тг/м²",
    note: "Стены, кровли, перегородки. Негорюч (НГ).",
  },
  {
    material: "Пенополистирол (ППС / EPS)",
    lambda: "0.033–0.040 Вт/м·К",
    thickness: "50–150 мм",
    price: "2 500–4 500 тг/м²",
    note: "Фасады, полы по грунту. Горюч Г3.",
  },
  {
    material: "PIR-плита (полиизоцианурат)",
    lambda: "0.022–0.028 Вт/м·К",
    thickness: "50–120 мм",
    price: "6 000–10 000 тг/м²",
    note: "Плоские кровли, холодильники. Г1.",
  },
  {
    material: "ПЕНОПЛЕКС (экструдированный ПС / XPS)",
    lambda: "0.029–0.034 Вт/м·К",
    thickness: "50–150 мм",
    price: "4 000–7 500 тг/м²",
    note: "Фундаменты, полы, подземные конструкции. Водостойкий.",
  },
  {
    material: "Пеностекло (FOAMGLAS)",
    lambda: "0.036–0.050 Вт/м·К",
    thickness: "60–180 мм",
    price: "9 000–15 000 тг/м²",
    note: "Подземные конструкции, нагружаемые полы. НГ, паронепроницаем.",
  },
  {
    material: "Напыляемый ПУФ (пенополиуретан)",
    lambda: "0.022–0.030 Вт/м·К",
    thickness: "40–120 мм",
    price: "5 000–9 000 тг/м²",
    note: "Кровли, трубопроводы, сложные геометрии. Г2.",
  },
];

type HydroRow = {
  type: string;
  application: string;
  price: string;
};

const HYDRO_ROWS: HydroRow[] = [
  {
    type: "Обмазочная (битумная мастика)",
    application: "Фундаменты, подвалы — наносится кистью или валиком 2–3 слоя",
    price: "2 000–4 000 тг/м²",
  },
  {
    type: "Оклеечная (рулонная — Технониколь, Бикрост)",
    application: "Кровли, горизонтальные поверхности — наплавляется горелкой",
    price: "3 500–7 000 тг/м²",
  },
  {
    type: "Проникающая (Пенетрон / Кристаллизол)",
    application:
      "Бетонные конструкции изнутри — проникает в поры и кристаллизуется",
    price: "4 000–8 000 тг/м²",
  },
  {
    type: "ПВХ-мембрана (Sika / Firestone)",
    application: "Эксплуатируемые кровли, бассейны — механическое крепление",
    price: "6 000–12 000 тг/м²",
  },
  {
    type: "Инъекционная (полиуретановые смолы)",
    application: "Трещины и швы в бетоне — нагнетается под давлением",
    price: "8 000–15 000 тг/м²",
  },
];

type SoundRow = {
  material: string;
  rw: string;
  application: string;
};

const SOUND_ROWS: SoundRow[] = [
  {
    material: "Звукопоглощающая минплита (Rockwool Акустик Баттс)",
    rw: "+3–5 дБ в перегородке",
    application: "Каркасные перегородки между комнатами и офисами",
  },
  {
    material: "Виброшумоизол. подложка (Шуманет-100)",
    rw: "Lw ≤ 50 дБ для пола",
    application: "Плавающая стяжка — звукоизоляция ударного шума от пола",
  },
  {
    material: "Акустический гипсокартон (Knauf Silentboard)",
    rw: "до Rw 52 дБ",
    application: "Звукозащитные перегородки и облицовка стен",
  },
  {
    material: "Звукоизол. потолочная система (Зипс-Вектор)",
    rw: "до Rw 56 дБ",
    application: "Подвесные потолки в кинозалах, студиях, квартирах",
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
    title: "Выбор материала для подземных конструкций",
    question:
      "При устройстве теплоизоляции стен подвала ниже отметки -1.200 м необходимо выбрать материал, устойчивый к грунтовым водам, механическим нагрузкам от грунта и способный работать во влажной среде без потери свойств. Какой материал подходит лучше всего?",
    label: "Выберите ответ",
    options: [
      { key: "a", text: "Минеральная вата — мягкая, хорошая λ" },
      {
        key: "b",
        text: "Пеностекло — жёсткое, НГ, абсолютно водонепроницаемо, нагружается",
      },
      { key: "c", text: "ППС (EPS) — дешёвый и лёгкий" },
      { key: "d", text: "Напыляемый ПУФ — минимальная толщина" },
    ],
    correct: "b",
    solution:
      "Правильный ответ: b) Пеностекло (FOAMGLAS). Пеностекло — единственный материал с нулевым водопоглощением и абсолютной паронепроницаемостью, выдерживает значительные механические нагрузки от грунта. ПЕНОПЛЕКС (XPS) — также водостойкий вариант, но пеностекло превосходит по нагрузкам и долговечности. Минвата во влажной среде теряет до 60% теплоизоляционных свойств. ЭСН Сб.26 предусматривает расценки на тепло­изоляцию подземных конструкций плитами пеностекла.",
    vor: "Теплоизоляция стен подвала плитами пеностекла FOAMGLAS δ=120 мм — 1 м² (ЭСН Сб.26-01-034)",
  },
  {
    id: "ex2",
    title: "Расчёт термического сопротивления",
    question:
      "Теплоизоляция выполнена минеральной ватой толщиной δ = 200 мм (0.200 м), коэффициент теплопроводности λ = 0.045 Вт/(м·К). По СН РК 2.04-21 для стен жилых зданий требуется R ≥ 3.2 м²·К/Вт. Рассчитайте термическое сопротивление слоя изоляции R = δ / λ (в м²·К/Вт) и округлите до 2 знаков.",
    label: "Термическое сопротивление R, м²·К/Вт",
    expected: 4.44,
    tolAbs: 0.1,
    solution:
      "R = δ / λ = 0.200 / 0.045 = 4.444... ≈ 4.44 м²·К/Вт. Норма выполнена (4.44 > 3.2). При подборе толщины в смете указывается фактическое R, достигнутое конструкцией. Если норма R = 3.2, минимальная толщина мин.ваты λ=0.045: δ = R × λ = 3.2 × 0.045 = 0.144 м → принимаем 150 мм (стандартная поставка).",
    vor: "Теплоизоляция стен минеральной ватой δ=200 мм — 1 м² (ЭСН Сб.26-01-010)",
  },
  {
    id: "ex3",
    title: "Применение проникающей гидроизоляции",
    question:
      "Монолитный железобетонный резервуар (бассейн) имеет трещины волосяного типа и высокую капиллярную влажность стен. Технолог предлагает применить проникающую гидроизоляцию Пенетрон / Кристаллизол. В каком случае это применение обосновано и правильно?",
    label: "Выберите ответ",
    options: [
      { key: "a", text: "Для деревянных конструкций — проникает в поры древесины" },
      { key: "b", text: "Для кирпичной кладки — хорошо впитывается в швы" },
      {
        key: "c",
        text: "Для бетонных конструкций — кристаллизуется в порах и микротрещинах, самозалечивающий эффект",
      },
      { key: "d", text: "Только для горизонтальных поверхностей — растекается самостоятельно" },
    ],
    correct: "c",
    solution:
      "Правильный ответ: c). Проникающая гидроизоляция (Пенетрон, Кристаллизол, Penetron Admix) работает исключительно на цементосодержащих материалах — бетон, железобетон, цементная стяжка. Активные химические компоненты реагируют с продуктами гидратации цемента и образуют нерастворимые кристаллы в порах глубиной до 300 мм, создавая водонепроницаемый барьер. Самозалечивающий эффект — при последующем увлажнении рост кристаллов продолжается. ЭСН Сб.25-07: гидроизоляция бетонных конструкций проникающими составами.",
    vor: "Гидроизоляция стен ж/б резервуара проникающим составом Пенетрон в 2 слоя — 1 м² (ЭСН Сб.25-07-001)",
  },
  {
    id: "ex4",
    title: "Место изоляции в сметной документации",
    question:
      "Проект предусматривает теплоизоляцию кровли (ЭСН Сб.26) и гидроизоляцию фундаментов (ЭСН Сб.25). В какую часть сметной документации включаются эти работы при составлении ЛСР?",
    label: "Выберите ответ",
    options: [
      { key: "a", text: "В отдельный сводный сметный расчёт по изоляции — Глава 13" },
      { key: "b", text: "В общестроительные работы единой строкой без разбивки по сборникам" },
      { key: "c", text: "В ОГС (общие гарантийные статьи) — не требуют отдельного обоснования" },
      {
        key: "d",
        text: "В ЛСР по соответствующему виду работ отдельными позициями со ссылкой на ЭСН Сб.25 / Сб.26",
      },
    ],
    correct: "d",
    solution:
      "Правильный ответ: d). Изоляционные работы включаются непосредственно в локальный сметный расчёт (ЛСР) по соответствующему разделу конструктива (кровля, фундаменты, стены) как отдельные сметные позиции. Каждая позиция содержит: шифр расценки ЭСН Сб.25 или Сб.26, наименование работы, единицу измерения (м², м³, т), объём и цену единицы. Стоимость материалов-утеплителей и гидроизоляционных материалов включается в ту же позицию или указывается как дополнительный материал. Отдельной главы ССР для изоляции не существует — она распределена по главам 1–9 в зависимости от типа конструкции.",
    vor: "Теплоизоляция кровли PIR-плитами δ=120 мм — позиция в ЛСР, раздел «Кровля» (ЭСН Сб.26-01-060)",
  },
];

export default function InsulationWorksPage() {
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
            className="text-indigo-400 hover:text-indigo-300 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta Trainer / Drawings Practice
          </span>
        </header>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          🧱 Изоляционные работы — тепло, гидро, звук
        </h1>
        <p className="text-slate-400 mb-8">
          Три вида изоляции: теплоизоляция (ЭСН Сб.26), гидроизоляция (ЭСН
          Сб.25) и звукоизоляция (СН РК 4.04-03). Правильный выбор материала
          и технологии определяет срок службы конструкций на десятилетия.
        </p>

        {/* Intro */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-indigo-300">
            Нормативная база
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Теплоизоляция
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• ЭСН РК Сб.26 — расценки на теплоизоляцию</li>
                <li>• СН РК 2.04-21 — тепловая защита зданий</li>
                <li>• ГОСТ 16381 — материалы теплоизоляционные</li>
                <li>• Нормативное R для стен РК: 3.0–3.5 м²·К/Вт</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Гидроизоляция
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• ЭСН РК Сб.25 — расценки на гидроизоляцию</li>
                <li>• СП РК 2.04-101 — кровли зданий</li>
                <li>• ГОСТ 30547 — рулонные материалы</li>
                <li>• СН РК 3.02-02 — фундаменты и подвалы</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Звукоизоляция
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• СН РК 4.04-03 — защита от шума</li>
                <li>• Rw ≥ 50 дБ для стен квартир (жильё)</li>
                <li>• Lw ≤ 55 дБ ударного шума для перекрытий</li>
                <li>• ЭСН Сб.15 — отделка (для звукоизол. облицовок)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1: Thermal insulation */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-indigo-300">
            1. Теплоизоляция — виды и характеристики
          </h2>
          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-indigo-200">
                <tr>
                  <th className="px-3 py-2 text-left">Материал</th>
                  <th className="px-3 py-2 text-left">λ, Вт/(м·К)</th>
                  <th className="px-3 py-2 text-left">Толщина</th>
                  <th className="px-3 py-2 text-right">Цена, тг/м²</th>
                  <th className="px-3 py-2 text-left">Применение</th>
                </tr>
              </thead>
              <tbody>
                {THERMAL_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2 font-medium">{r.material}</td>
                    <td className="px-3 py-2 text-indigo-300 font-mono">
                      {r.lambda}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{r.thickness}</td>
                    <td className="px-3 py-2 text-right text-indigo-200 whitespace-nowrap">
                      {r.price}
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
            Чем ниже λ — тем эффективнее материал. Термическое сопротивление R
            = δ / λ, где δ — толщина в метрах.
          </p>
        </section>

        {/* Section 2: Waterproofing */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-indigo-300">
            2. Гидроизоляция — технологии и применение
          </h2>
          <div className="space-y-3">
            {HYDRO_ROWS.map((r, i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-indigo-200">{r.type}</h3>
                  <span className="text-indigo-300 font-mono text-sm whitespace-nowrap">
                    {r.price}
                  </span>
                </div>
                <p className="text-sm text-slate-400">{r.application}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Стоимость указана за 1 м² в ценах 2026 г. (материал + работа).
            Инъекционная гидроизоляция — за погонный метр шва.
          </p>
        </section>

        {/* Section 3: Sound insulation */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-indigo-300">
            3. Звукоизоляция — нормы СН РК 4.04-03
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4 text-sm">
            <h3 className="font-semibold text-slate-200 mb-2">
              Минимальные нормы (жилые здания):
            </h3>
            <div className="grid md:grid-cols-3 gap-3 text-slate-400">
              <div>
                <span className="text-indigo-300 font-semibold">Стены</span> между
                квартирами: Rw ≥ 50 дБ
              </div>
              <div>
                <span className="text-indigo-300 font-semibold">Перекрытия</span>{" "}
                (ударной шум): Lw ≤ 55 дБ
              </div>
              <div>
                <span className="text-indigo-300 font-semibold">Потолки</span>{" "}
                в гостиницах: Rw ≥ 47 дБ
              </div>
            </div>
          </div>
          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-indigo-200">
                <tr>
                  <th className="px-3 py-2 text-left">Материал</th>
                  <th className="px-3 py-2 text-left">Звукоизоляция Rw</th>
                  <th className="px-3 py-2 text-left">Применение</th>
                </tr>
              </thead>
              <tbody>
                {SOUND_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2 font-medium">{r.material}</td>
                    <td className="px-3 py-2 text-indigo-300 font-mono">
                      {r.rw}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{r.application}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Exercises */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-indigo-300">
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
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                } ${solved.has(e.id) ? "ring-2 ring-emerald-500/60" : ""}`}
              >
                №{i + 1} {solved.has(e.id) ? "✓" : ""}
              </button>
            ))}
          </div>

          {/* Active exercise */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-indigo-200">
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
                        ? "bg-indigo-900/30 border-indigo-600"
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
                      className="accent-indigo-500"
                    />
                    <span className="font-mono text-indigo-300 text-sm">
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
                  className="w-full md:w-80 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={submit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
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
              <div className="mt-3 p-4 bg-slate-800/60 border border-indigo-800/40 rounded-lg">
                <h4 className="text-sm font-semibold text-indigo-300 mb-2">
                  Решение:
                </h4>
                <p className="text-sm text-slate-200 mb-3 whitespace-pre-line">
                  {ex.solution}
                </p>
                <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
                  <strong className="text-indigo-300">Позиция в ВОР:</strong>{" "}
                  {ex.vor}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ESN section */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-indigo-300">
            Расценки ЭСН РК — Сб.25 и Сб.26
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Сборник 25 — Гидроизоляция
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• 25-01-x — обмазочная горячая битумная</li>
                <li>• 25-02-x — холодная мастичная гидроизоляция</li>
                <li>• 25-03-x — оклеечная рулонная (наплавляемая)</li>
                <li>• 25-05-x — ПВХ-мембрана механическое крепление</li>
                <li>• 25-07-x — проникающая (Пенетрон / аналоги)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Сборник 26 — Теплоизоляция
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• 26-01-x — утепление стен и кровель (плиты)</li>
                <li>• 26-02-x — напыление пенополиуретана</li>
                <li>• 26-03-x — теплоизоляция трубопроводов</li>
                <li>• 26-04-x — утепление полов (укладка плит)</li>
                <li>• 26-05-x — пеностекло для подземных конструкций</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-6 border-t border-slate-800">
          AEVION Smeta Trainer · Изоляционные работы · СН РК 4.04-03 ·
          ЭСН Сб.25–26 · ГОСТ нормы · Корпус РК 2026
        </footer>
      </div>
    </div>
  );
}
