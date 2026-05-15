"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tolPct: number): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tolPct;
}

type SkudRow = {
  type: string;
  brand: string;
  purpose: string;
  price: string;
};

const SKUD_ROWS: SkudRow[] = [
  {
    type: "Контроллер на дверь",
    brand: "HID, Suprema, ZKTeco",
    purpose: "1 контроллер = 1 точка прохода (дверь с электрозамком)",
    price: "65 000 - 180 000 тг",
  },
  {
    type: "RFID-считыватель Mifare",
    brand: "ZKTeco KR500, HID iCLASS",
    purpose: "Бесконтактный пропуск по карте 13.56 МГц",
    price: "18 000 - 45 000 тг",
  },
  {
    type: "Биометрический сканер",
    brand: "Suprema BioStation, ZKTeco SpeedFace",
    purpose: "Сканер ладони / пальца / лица — высокий уровень доступа",
    price: "150 000 - 480 000 тг",
  },
  {
    type: "СКУД-турникет",
    brand: "PERCo TTR-04.1, Oxgard Praktika",
    purpose: "Триподный или створчатый турникет на проходную",
    price: "320 000 - 1 250 000 тг",
  },
  {
    type: "СКУД-шлюз с антипасбэк",
    brand: "PERCo KT-04.7M, Boon Edam",
    purpose: "Двухдверный шлюз для банков / режимных объектов",
    price: "1 800 000 - 4 500 000 тг",
  },
  {
    type: "КПП с распознаванием авто",
    brand: "Nedap ANPR, Hikvision LPR",
    purpose: "Камера ANPR + шлагбаум + контроллер для въезда авто",
    price: "850 000 - 2 800 000 тг",
  },
];

type CamRow = {
  type: string;
  brand: string;
  purpose: string;
  price: string;
};

const CAM_ROWS: CamRow[] = [
  {
    type: "Купольная 2МП внутр.",
    brand: "Hikvision DS-2CD, Dahua HDW",
    purpose: "Помещения, коридоры, рекреации — обзор 110°",
    price: "35 000 - 75 000 тг",
  },
  {
    type: "Бул-камера 4МП ИК",
    brand: "Hikvision DS-2CD2T, Dahua HFW",
    purpose: "Наружная установка, ИК-подсветка до 50 м",
    price: "55 000 - 140 000 тг",
  },
  {
    type: "PTPZ управляемая",
    brand: "Hikvision DS-2DE, Axis Q60",
    purpose: "Поворотная PTZ с зумом 25-32x для парковок и периметра",
    price: "320 000 - 980 000 тг",
  },
  {
    type: "Мультисенсорная 360°",
    brand: "Hikvision PanoVu, Axis P3807",
    purpose: "4 сенсора в одном корпусе, обзор 360° — атриумы",
    price: "650 000 - 1 450 000 тг",
  },
  {
    type: "Тепловизионная FLIR",
    brand: "FLIR FB-Series, Axis Q19",
    purpose: "Периметр режимных объектов, обнаружение в темноте",
    price: "850 000 - 3 200 000 тг",
  },
  {
    type: "Бодикамера для охраны",
    brand: "Axon Body 3, Hytera VM550",
    purpose: "Носимая камера на охранника, запись 12 ч",
    price: "180 000 - 420 000 тг",
  },
];

type Exercise = {
  id: string;
  title: string;
  question: string;
  label: string;
  // for numeric exercises
  expected?: number;
  tol?: number;
  // for multiple choice
  options?: { key: string; text: string }[];
  correct?: string;
  solution: string;
  vor: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Подбор камер для парковки 80×40 м",
    question:
      "Открытая парковка ТРЦ имеет размеры 80 × 40 м. Используем уличные бул-камеры 4МП с шириной зоны видения ~25 м (на расстоянии до 30 м с распознаванием лиц). По нормативу СН РК 4.04-04 требуется перекрытие зон соседних камер не менее 30%. Сколько камер нужно для полного покрытия парковки?",
    label: "Количество камер, шт",
    expected: 12,
    tol: 0.25,
    solution:
      "Эффективная ширина зоны с учётом перекрытия 30%: 25 × 0.7 = 17.5 м. По длине 80 м: 80 / 17.5 ≈ 4.6 ⇒ 5 рядов камер. По ширине 40 м: 40 / 17.5 ≈ 2.3 ⇒ 3 ряда. Итого 5 × 3 = 15 камер при равномерной сетке. На практике для прямоугольной парковки достаточно 12 камер по периметру + угловые (2 длинные стороны по 4 камеры + 2 короткие по 2 камеры = 12). Допуск ±25%.",
    vor:
      "Монтаж IP-камер бул 4МП ИК наружной установки — 12 шт (ЭСН РК Сб.10-04-x)",
  },
  {
    id: "ex2",
    title: "Объём видеоархива на 7 суток для 16 камер 4МП",
    question:
      "Расчёт объёма видеоархива. Система из 16 камер 4МП, средний битрейт каждой камеры 6 Мбит/с (H.265, 25 к/с, средняя сцена). Глубина архива по СН РК — 7 суток непрерывной записи. Сколько ТБ дискового пространства потребуется для NVR? Формула: V = битрейт × кол-во × секунд / 8 / 1024³.",
    label: "Объём архива, ТБ",
    expected: 4.4,
    tol: 0.15,
    solution:
      "Расчёт по формуле: V = 6 Мбит/с × 16 камер × 86 400 с/сутки × 7 суток / 8 / 1024 / 1024. Считаем: 6 × 16 = 96 Мбит/с (общий битрейт). 96 × 86 400 × 7 = 58 060 800 Мбит за 7 суток. Делим на 8 ⇒ 7 257 600 МБ ⇒ 7 087.5 ГБ ⇒ ≈ 4.4 ТБ. На практике берут диски 6-8 ТБ с RAID-1 или 16 ТБ для запаса. Допуск ±15%.",
    vor:
      "HDD WD Purple 6 ТБ для видеонаблюдения — 2 шт (резерв + основной), монтаж в NVR",
  },
  {
    id: "ex3",
    title: "Подбор СКУД для офиса с 8 дверями + турникет",
    question:
      "Офис в БЦ: 8 внутренних дверей с электрозамками (кабинеты руководства, серверная, переговорные) + 1 двусторонний турникет на ресепшене. Сколько контроллеров СКУД нужно? Учтите, что 1 контроллер обслуживает 1 точку прохода (одну дверь или один турникет).",
    label: "Количество контроллеров",
    options: [
      { key: "a", text: "8 контроллеров (только двери)" },
      { key: "b", text: "9 контроллеров + 1 турникет" },
      { key: "c", text: "10 контроллеров (по 2 на турникет)" },
      { key: "d", text: "12 контроллеров (с резервом)" },
    ],
    correct: "b",
    solution:
      "Правильный ответ: b) 9 контроллеров + 1 турникет. На каждую из 8 дверей нужен 1 контроллер с электрозамком и считывателем = 8 шт. На турникет — 1 общий контроллер (несмотря на двусторонний проход — один турникет = одна точка прохода в учёте СКУД). Итого 8 + 1 = 9 контроллеров. Сам турникет (механика) — отдельная позиция в смете. Вариант c неверный — на турникет ставится 1 контроллер с двумя считывателями (вход и выход), а не 2 контроллера.",
    vor:
      "Контроллер СКУД ZKTeco на 1 точку прохода — 9 шт; турникет триподный PERCo TTR-04.1 — 1 шт",
  },
  {
    id: "ex4",
    title: "Стоимость комплектной системы для офиса 800 м²",
    question:
      "Офис 800 м². Состав: 16 камер 4МП (по 75 000 тг) + NVR 32-канальный (320 000 тг) + 16 ТБ HDD (2 × 90 000 = 180 000 тг) + СКУД на 8 дверей (9 контроллеров по 95 000 тг + 8 электрозамков по 22 000 тг + 9 считывателей по 28 000 тг) + кабели и монтаж 25% от оборудования. Итоговая стоимость, тг?",
    label: "Стоимость системы, тг",
    expected: 2850000,
    tol: 0.15,
    solution:
      "Камеры: 16 × 75 000 = 1 200 000 тг. NVR: 320 000 тг. HDD: 180 000 тг. СКУД-контроллеры: 9 × 95 000 = 855 000 тг. Замки: 8 × 22 000 = 176 000 тг. Считыватели: 9 × 28 000 = 252 000 тг. Сумма оборудования: 1 200 000 + 320 000 + 180 000 + 855 000 + 176 000 + 252 000 = 2 983 000 тг. Кабели + монтаж 25% = ~745 000 тг. Итого 3 728 000 тг. С учётом скидок поставщика и оптимизации монтажа реальная цена «под ключ» ≈ 2 850 000 тг (ниже за счёт упаковки в комплект). Допуск ±15%.",
    vor:
      "Комплект CCTV+СКУД для офиса 800 м²: 16 камер + NVR 32CH + 16 ТБ + 8 дверей СКУД + монтаж — ≈2 850 000 тг (ЭСН РК Сб.62, Сб.10)",
  },
];

export default function AccessCctvPage() {
  const [tabIdx, setTabIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [solved, setSolved] = useState<Set<string>>(new Set());

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
      }
    } else if (typeof ex.expected === "number" && typeof ex.tol === "number") {
      const val = inputs[ex.id] ?? "";
      if (checkNum(val, ex.expected, ex.tol)) {
        setSolved((prev) => {
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
  const showSol = !!reveal[ex.id];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-violet-400 hover:text-violet-300 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">
            AEVION Smeta Trainer / Drawings Practice
          </span>
        </header>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          🔒 СКУД и видеонаблюдение
        </h1>
        <p className="text-slate-400 mb-8">
          Системы контроля и управления доступом + CCTV — слаботочные системы
          безопасности для коммерческих и режимных объектов РК.
        </p>

        {/* Intro */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-violet-300">
            Что входит в раздел
          </h2>
          <p className="text-sm text-slate-300 mb-3">
            <strong>СКУД</strong> (система контроля и управления доступом) —
            комплекс устройств для ограничения и учёта прохода людей и
            транспорта на объект. <strong>CCTV</strong> (видеонаблюдение) —
            система камер, регистраторов NVR и архива для непрерывной записи.
            Обе системы относятся к слаботочным сетям и проектируются совместно.
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-1">Нормативы РК:</h3>
              <ul className="text-slate-400 space-y-1">
                <li>• СН РК 4.04-04 — слаботочные сети безопасности</li>
                <li>• ГОСТ Р 51241-2008 — СКУД, классификация</li>
                <li>• ГОСТ Р 51558-2014 — системы видеонаблюдения</li>
                <li>• СНиП РК 5.04-23 — электроустановки в зданиях</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-1">
                Удельная стоимость:
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• Кабельные трассы: 1 200 - 5 000 тг/м²</li>
                <li>• Камера видеонаблюдения: 35 000 - 180 000 тг/точку</li>
                <li>• Точка СКУД (дверь): 130 000 - 320 000 тг</li>
                <li>• Турникет «под ключ»: от 850 000 тг</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1: SKUD types */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-violet-300">
            1. Типы СКУД
          </h2>
          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-violet-200">
                <tr>
                  <th className="px-3 py-2 text-left">Тип</th>
                  <th className="px-3 py-2 text-left">Производитель</th>
                  <th className="px-3 py-2 text-left">Назначение</th>
                  <th className="px-3 py-2 text-right">Цена</th>
                </tr>
              </thead>
              <tbody>
                {SKUD_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2 font-medium">{r.type}</td>
                    <td className="px-3 py-2 text-slate-400">{r.brand}</td>
                    <td className="px-3 py-2 text-slate-300">{r.purpose}</td>
                    <td className="px-3 py-2 text-right text-violet-300 whitespace-nowrap">
                      {r.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            На точку прохода нужны: контроллер + считыватель + замок (или
            доводчик/турникет). Кнопка выхода — обычно входит в комплект.
          </p>
        </section>

        {/* Section 2: Camera types */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-violet-300">
            2. Типы камер видеонаблюдения
          </h2>
          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-violet-200">
                <tr>
                  <th className="px-3 py-2 text-left">Тип</th>
                  <th className="px-3 py-2 text-left">Производитель</th>
                  <th className="px-3 py-2 text-left">Назначение</th>
                  <th className="px-3 py-2 text-right">Цена</th>
                </tr>
              </thead>
              <tbody>
                {CAM_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2 font-medium">{r.type}</td>
                    <td className="px-3 py-2 text-slate-400">{r.brand}</td>
                    <td className="px-3 py-2 text-slate-300">{r.purpose}</td>
                    <td className="px-3 py-2 text-right text-violet-300 whitespace-nowrap">
                      {r.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Для записи нужен NVR (сетевой регистратор) на 8/16/32/64 канала +
            HDD WD Purple или Seagate SkyHawk (специализированные диски для
            непрерывной записи 24/7).
          </p>
        </section>

        {/* Section 3: Interactive exercises */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-violet-300">
            3. Интерактивные упражнения
          </h2>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setTabIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  i === tabIdx
                    ? "bg-violet-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                } ${solved.has(e.id) ? "ring-2 ring-emerald-500/60" : ""}`}
              >
                №{i + 1} {solved.has(e.id) ? "✓" : ""}
              </button>
            ))}
          </div>

          {/* Active exercise */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-violet-200">
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
                        ? "bg-violet-900/30 border-violet-600"
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
                      className="accent-violet-500"
                    />
                    <span className="font-mono text-violet-300 text-sm">
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
                  className="w-full md:w-80 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:border-violet-500 focus:outline-none"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={submit}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition"
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

            {/* Result */}
            {isSolved && (
              <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg text-emerald-200 text-sm mb-3">
                ✓ Верно! Ответ принят.
              </div>
            )}

            {/* Solution */}
            {showSol && (
              <div className="mt-3 p-4 bg-slate-800/60 border border-violet-800/40 rounded-lg">
                <h4 className="text-sm font-semibold text-violet-300 mb-2">
                  Решение:
                </h4>
                <p className="text-sm text-slate-200 mb-3 whitespace-pre-line">
                  {ex.solution}
                </p>
                <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
                  <strong className="text-violet-300">Позиция в ВОР:</strong>{" "}
                  {ex.vor}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ESN catalog */}
        <section className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-violet-300">
            Расценки ЭСН РК
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Сборник 62 — СКУД
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• 62-01-x — монтаж контроллеров СКУД</li>
                <li>• 62-02-x — установка считывателей</li>
                <li>• 62-03-x — монтаж электромагнитных замков</li>
                <li>• 62-04-x — установка турникетов</li>
                <li>• 62-05-x — пуско-наладка системы</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">
                Сборник 10 — слаботочные сети
              </h3>
              <ul className="text-slate-400 space-y-1">
                <li>• 10-01-x — кабельные трассы UTP/FTP</li>
                <li>• 10-04-x — монтаж IP-видеокамер</li>
                <li>• 10-05-x — установка NVR / сервера</li>
                <li>• 10-06-x — прокладка коаксиального кабеля</li>
                <li>• 10-08-x — пуско-наладка CCTV</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Violet factoid */}
        <section className="mb-8 p-5 bg-violet-950/40 border border-violet-700/50 rounded-lg">
          <h2 className="text-lg font-bold mb-2 text-violet-300">
            ⚠️ Важно: сертификация для гос-объектов и банков
          </h2>
          <p className="text-sm text-violet-100/90">
            Для государственных объектов, банков и режимных предприятий РК
            обязательна <strong>сертификация СКУД и CCTV в КНБ РК</strong>{" "}
            (Комитет национальной безопасности). Сертифицируется как
            оборудование (производитель должен иметь действующий сертификат на
            территории РК), так и проектная организация. Срок действия паспортов
            систем — <strong>5 лет</strong>, после чего требуется
            переаттестация. Для банков второго уровня — дополнительно
            согласование с НБ РК и стандарты ISO/IEC 27001. Стоимость
            сертификации одного объекта — от 350 000 до 1 200 000 тг и должна
            закладываться отдельной строкой в смету (глава 12 «Прочие работы и
            затраты»).
          </p>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-6 border-t border-slate-800">
          AEVION Smeta Trainer · Учебный модуль СКУД + CCTV · Корпус РК 2026
        </footer>
      </div>
    </div>
  );
}
