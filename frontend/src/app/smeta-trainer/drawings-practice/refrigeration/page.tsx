"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, answers: string[], tol = 0.05) {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  return answers.some(a => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

type NumExercise = {
  id: string;
  kind: "num";
  title: string;
  question: string;
  answers: string[];
  tol?: number;
  formula: string;
  explanation: string;
};

type Exercise = NumExercise;

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    kind: "num",
    title: "Упражнение 1. Холодопроизводительность камеры +2°C",
    question:
      "Холодильная камера для овощей и молочки: 12 м² × 3 м (V = 36 м³). Удельные теплопотери ограждений 70 Вт/м³. Загрузка товара 100 кг/сутки (теплоёмкость c = 4.18 кДж/(кг·К), охлаждение с +20 до 0°C, ΔT = 20 К). Найдите минимальную холодопроизводительность агрегата, кВт.",
    answers: ["2.6", "2.62", "2.5", "2.7"],
    tol: 0.15,
    formula:
      "Q = V·q + (G·c·ΔT)/86400 = 36·70 + (100·4180·20)/86400 = 2520 + 97 = 2617 Вт ≈ 2.6 кВт",
    explanation:
      "Сначала тепловые потери через ограждения: Q₁ = 36 м³ · 70 Вт/м³ = 2520 Вт. Затем тепло от загружаемого товара за сутки переводим в Вт: Q₂ = (100 · 4180 · 20) / 86400 ≈ 97 Вт. Сумма ≈ 2617 Вт ≈ 2.6 кВт. По СН РК 4.02-13 принимаем агрегат с запасом 15-20% — реально берём 3 кВт. Допуск ±15% для предпроектной стадии.",
  },
  {
    id: "ex2",
    kind: "num",
    title: "Упражнение 2. Прецизионное охлаждение серверной",
    question:
      "Серверная 50 м²: 12 серверов по 700 Вт + 4 коммутатора по 150 Вт. Принцип «1 кВт IT = 1 кВт холода» + резерв 30% (на освещение, людей, теплопритоки). Найдите расчётную холодопроизводительность, кВт.",
    answers: ["12", "12.2", "11.8", "12.5"],
    tol: 0.15,
    formula:
      "P_IT = 12·700 + 4·150 = 8400 + 600 = 9000 Вт = 9 кВт; Q = 9 · 1.30 = 11.7 кВт ≈ 12 кВт",
    explanation:
      "IT-нагрузка: 12 · 0.7 + 4 · 0.15 = 8.4 + 0.6 = 9 кВт. Для прецизионного кондиционирования принцип 1:1 (вся электрика серверов уходит в тепло). Резерв 30% на ограждения, освещение, людей и пиковые нагрузки: 9 · 1.30 = 11.7 кВт ≈ 12 кВт. По схеме N+1 ставим 2 блока по 12 кВт (один резервный). Допуск ±15%.",
  },
  {
    id: "ex3",
    kind: "num",
    title: "Упражнение 3. Длина медной фреоновой трассы",
    question:
      "Холодильная витрина в торговом зале на 1 этаже, конденсаторный агрегат на крыше 4-этажного здания (этажи по 3.2 м). Горизонтальная разводка на крыше 8 м. Запас 15% на изгибы и резерв. Найдите длину медной трассы, м.",
    answers: ["23", "23.4", "22", "24"],
    tol: 0.10,
    formula:
      "L = (4 · 3.2 + 8) · 1.15 = (12.8 + 8) · 1.15 = 20.8 · 1.15 = 23.92 ≈ 23 м",
    explanation:
      "Вертикаль через 4 этажа по 3.2 м = 12.8 м (агрегат на крыше, витрина внизу). Горизонталь по крыше 8 м. Сумма «по геометрии» 20.8 м. Запас 15% на изгибы, отступы, технологический резерв даёт ≈ 23.9 м, округляем до 24 м (медь продают катушками по 15/25/50 м). Заказываем катушку 25 м. Допуск ±10%.",
  },
  {
    id: "ex4",
    kind: "num",
    title: "Упражнение 4. Стоимость монтажа холодильной камеры 12 м²",
    question:
      "Холодильная камера 12 м² (+2°C): сэндвич-панели 80 мм (35 м² × 18 000 тг) + моноблок-агрегат 3 кВт (850 000 тг) + дверь холодильная (320 000 тг) + автоматика и щит (180 000 тг) + монтаж/пусконаладка (420 000 тг). Найдите ИТОГО, тг.",
    answers: ["2400000", "2400 000", "2.4", "2400"],
    tol: 0.15,
    formula:
      "C = 35·18000 + 850000 + 320000 + 180000 + 420000 = 630000 + 850000 + 320000 + 180000 + 420000 = 2 400 000 тг",
    explanation:
      "Сэндвич-панели на 12 м² пола формируют ~35 м² ограждений (стены + потолок + пол): 35 · 18 000 = 630 тыс. тг. Моноблок-агрегат на 3 кВт под камеру +2°C — 850 тыс. тг. Холодильная дверь с обогревом периметра — 320 тыс. тг. Электрика и автоматика — 180 тыс. тг. Монтаж и ПНР — 420 тыс. тг. ИТОГО 2.4 млн тг. Для среднего магазина это типовой бюджет. Допуск ±15%.",
  },
];

const ESN_ITEMS = [
  { code: "ЭСН РК Сб.20-5", title: "Холодильное оборудование — монтаж камер, агрегатов, витрин", unit: "компл./ед." },
  { code: "ЭСН РК Сб.61", title: "Электромонтажные работы — щиты, кабели, автоматика", unit: "м/шт" },
  { code: "ЭСН РК Сб.16", title: "Трубопроводы — медные фреоновые трассы, дренаж", unit: "м.п." },
  { code: "ЭСН РК Сб.26", title: "Тепловая изоляция трубопроводов и оборудования", unit: "м²/м³" },
  { code: "ЭСН РК Сб.10", title: "Сэндвич-панели — стены, потолок, пол холодильных камер", unit: "м²" },
];

const TYPES_TABLE = [
  {
    type: "Камера холодильная +2°C / -18°C",
    use: "Магазины, склады, производство — хранение продуктов",
    notes: "Сэндвич 80-120 мм, моноблок или сплит-агрегат",
    cost: "1.8-4.5 млн тг (12-20 м²)",
  },
  {
    type: "Витрина холодильная (мясо/молочка)",
    use: "Торговые залы — выкладка товара с охлаждением",
    notes: "Встроенный или выносной агрегат, подсветка LED",
    cost: "350-900 тыс. тг/п.м.",
  },
  {
    type: "Сплит prec. cooling серверная 7-15 кВт",
    use: "Серверные, ЦОД, узлы связи — точное охлаждение",
    notes: "Контроль T ±0.5°C и H ±5%, резерв N+1",
    cost: "2.2-5.5 млн тг/блок",
  },
  {
    type: "Чиллер промышленный 20-200 кВт",
    use: "ТРЦ, гипермаркеты, промышленность",
    notes: "Воздушное или водяное охлаждение, фанкойлы",
    cost: "8-45 млн тг + обвязка",
  },
  {
    type: "Морозильная камера -25°C",
    use: "Склады глубокой заморозки, рыба, мясо",
    notes: "Сэндвич 150-200 мм, низкотемп. агрегат",
    cost: "3.5-7 млн тг (12-20 м²)",
  },
  {
    type: "Шок-фростер -35°C",
    use: "Производство мороженого, заморозка готовых блюд",
    notes: "Высокая мощность, циклы 30-90 мин",
    cost: "4.5-12 млн тг (3-8 м³)",
  },
];

const EQUIPMENT_CAMERA = [
  { name: "Сэндвич-панели 80 мм с пенополиуретаном (35 м²)", price: "630 000" },
  { name: "Моноблок-агрегат 3 кВт (среднетемпературный)", price: "850 000" },
  { name: "Дверь холодильная распашная с обогревом периметра", price: "320 000" },
  { name: "Автоматика, щит управления, датчики T", price: "180 000" },
  { name: "Освещение LED взрывозащищённое", price: "65 000" },
  { name: "Дренаж, сифон с обогревом", price: "85 000" },
  { name: "Монтаж панелей, агрегата, пусконаладка", price: "420 000" },
];

export default function RefrigerationPage() {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  function setInp(id: string, v: string) {
    setInputs(p => ({ ...p, [id]: v }));
  }
  function reveal(id: string) {
    setRevealed(r => ({ ...r, [id]: true }));
  }
  function reset(id: string) {
    setInputs(p => ({ ...p, [id]: "" }));
    setRevealed(r => ({ ...r, [id]: false }));
  }

  const doneCount = EXERCISES.filter(ex => {
    if (!revealed[ex.id]) return false;
    return checkNum(inputs[ex.id] ?? "", ex.answers, ex.tol ?? 0.05);
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-sky-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-sky-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🧊 Холодильные системы — торговля, склад, серверная
            </h1>
            <p className="text-[10px] text-sky-200">
              {doneCount}/{EXERCISES.length} упражнений решено
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Левая колонка: контент */}
        <div className="lg:col-span-2 space-y-4">
          {/* Intro */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Холодильные и серверные системы охлаждения
            </h2>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Холодильные установки нужны для двух принципиально разных задач:{" "}
              <b>хранение продуктов</b> в торговле и на складах, и{" "}
              <b>прецизионное охлаждение</b> серверных и ЦОДов. У них общая физика
              (фреоновый цикл), но разные требования по точности, резервированию и
              эксплуатации. Бюджет среднего магазина по холодильной части —{" "}
              <b>1.2-8 млн тг</b>; небольшой серверной — <b>2.5-12 млн тг</b> с
              резервом N+1.
            </p>
          </div>

          {/* Норматив */}
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📖</span>
              <h2 className="text-sm font-bold text-sky-900 dark:text-sky-200">
                Нормативная база
              </h2>
            </div>
            <ul className="text-xs text-sky-900 dark:text-sky-200 space-y-1.5 leading-relaxed list-disc pl-5">
              <li>
                <b>СН РК 4.02-13</b> «Холодильное снабжение» — основной норматив
                по проектированию холодильных установок и камер РК.
              </li>
              <li>
                <b>СП РК 4.02-103</b> «Отопление, вентиляция и кондиционирование» —
                разделы по охлаждению помещений, в т.ч. серверных.
              </li>
              <li>
                <b>СТ РК ISO 22712</b> «Безопасность холодильных систем» —
                требования к компетенциям персонала и обращению с хладагентом.
              </li>
              <li>
                <b>ТР ТС 010/2011</b> «О безопасности машин и оборудования» —
                сертификация компрессорно-конденсаторных агрегатов.
              </li>
            </ul>
          </div>

          {/* Раздел 1: Типы холодильного оборудования */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              📐 Раздел 1. Типы холодильного оборудования
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-sky-100 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200">
                    <th className="border border-sky-200 dark:border-sky-800 px-2 py-1.5 text-left font-semibold">
                      Тип
                    </th>
                    <th className="border border-sky-200 dark:border-sky-800 px-2 py-1.5 text-left font-semibold">
                      Применение
                    </th>
                    <th className="border border-sky-200 dark:border-sky-800 px-2 py-1.5 text-left font-semibold">
                      Особенности
                    </th>
                    <th className="border border-sky-200 dark:border-sky-800 px-2 py-1.5 text-left font-semibold">
                      Стоимость 2025
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TYPES_TABLE.map((row, i) => (
                    <tr
                      key={i}
                      className="text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/10"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-semibold">
                        {row.type}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.use}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.notes}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-mono text-cyan-700 dark:text-cyan-300">
                        {row.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Раздел 2: Расчёт холодопроизводительности */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              ❄️ Раздел 2. Расчёт холодопроизводительности
            </h2>
            <div className="space-y-3">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-cyan-900 dark:text-cyan-200 mb-1">
                  Базовая формула охлаждения товара:
                </p>
                <code className="block text-xs font-mono text-cyan-800 dark:text-cyan-100 my-1">
                  Q = G · c · ΔT / τ &nbsp;[Вт]
                </code>
                <p className="text-[11px] text-cyan-900 dark:text-cyan-200 leading-relaxed">
                  где <b>G</b> — масса товара (кг), <b>c</b> — теплоёмкость (Дж/(кг·К)),{" "}
                  <b>ΔT</b> — разница температур (К), <b>τ</b> — время охлаждения (с).
                  Для воды и большинства продуктов c ≈ 4180 Дж/(кг·К), для замороженных —
                  ~2100 Дж/(кг·К).
                </p>
              </div>
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-cyan-900 dark:text-cyan-200 mb-1">
                  Полные теплопритоки в камеру:
                </p>
                <code className="block text-xs font-mono text-cyan-800 dark:text-cyan-100 my-1">
                  Q_total = Q_огр + Q_товар + Q_воздух + Q_люди + Q_свет
                </code>
                <p className="text-[11px] text-cyan-900 dark:text-cyan-200 leading-relaxed">
                  В предпроектных расчётах используют <b>удельные теплопотери</b>:
                  60-90 Вт/м³ для +2°C, 100-130 Вт/м³ для -18°C, 140-180 Вт/м³ для -25°C.
                </p>
              </div>
              <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-sky-900 dark:text-sky-200 mb-1">
                  Серверная — принцип 1:1:
                </p>
                <code className="block text-xs font-mono text-sky-800 dark:text-sky-100 my-1">
                  Q_хол = P_IT · 1.0 + резерв 25-30%
                </code>
                <p className="text-[11px] text-sky-900 dark:text-sky-200 leading-relaxed">
                  Вся потребляемая электроэнергия серверов превращается в тепло — значит{" "}
                  <b>1 кВт IT-нагрузки = 1 кВт холода</b>. Сверху резерв на ограждения,
                  людей, свет (25-30%). И обязательно <b>N+1</b>: при выходе одного
                  блока остальные держат всю нагрузку.
                </p>
              </div>
            </div>
          </div>

          {/* Раздел 2b: Оборудование для камеры 12 м² */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              ⚙️ Оборудование для камеры 12 м² (+2°C)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
              Типовая камера хранения молочки/овощей в среднем магазине
            </p>
            <ul className="space-y-1.5">
              {EQUIPMENT_CAMERA.map((it, i) => (
                <li
                  key={i}
                  className="flex justify-between items-baseline text-[11px] border-b border-dashed border-slate-200 dark:border-slate-700 pb-1"
                >
                  <span className="text-slate-700 dark:text-slate-300">{it.name}</span>
                  <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold whitespace-nowrap pl-2">
                    {it.price} тг
                  </span>
                </li>
              ))}
              <li className="flex justify-between items-baseline text-xs pt-2 mt-2 border-t-2 border-cyan-300 dark:border-cyan-700">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ИТОГО (под ключ)
                </span>
                <span className="font-mono text-cyan-800 dark:text-cyan-200 font-bold">
                  ~2 550 000 тг (~2.55 млн)
                </span>
              </li>
            </ul>
          </div>

          {/* Factoid */}
          <div className="bg-sky-100 dark:bg-sky-900/30 border-l-4 border-sky-600 dark:border-sky-500 rounded-r-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none">💡</span>
              <div>
                <h3 className="text-xs font-bold text-sky-900 dark:text-sky-100 mb-1">
                  Факт-якорь: серверная — обязательное N+1
                </h3>
                <p className="text-[11px] text-sky-900 dark:text-sky-100 leading-relaxed">
                  Для серверных и ЦОД <b>обязательное резервирование N+1</b>: если
                  расчётная нагрузка покрывается N кондиционерами, ставим N+1. При
                  выходе из строя одного блока остальные должны держать полную
                  нагрузку без простоя серверов. Для критичных ЦОД применяют N+2 или
                  2N. Сэкономить на этом нельзя — отказ охлаждения за 5-10 минут
                  выводит серверы из строя по перегреву.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка: упражнения + ЭСН */}
        <div className="space-y-3">
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded-xl p-3">
            <h2 className="text-xs font-bold text-sky-900 dark:text-sky-200">
              🧮 Раздел 3. Упражнения
            </h2>
            <p className="text-[10px] text-sky-800 dark:text-sky-300 mt-0.5">
              Закрепление: считай в уме, проверяй ответ
            </p>
          </div>

          {EXERCISES.map((ex, idx) => {
            const id = ex.id;
            const r = !!revealed[id];
            const ok = r && checkNum(inputs[id] ?? "", ex.answers, ex.tol ?? 0.05);
            const err = r && !ok;

            return (
              <div
                key={id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-3 ${
                  ok
                    ? "border-emerald-300 dark:border-emerald-700"
                    : err
                    ? "border-red-400 dark:border-red-600"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ex.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    #{idx + 1}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                  {ex.question}
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputs[id] ?? ""}
                    onChange={e => setInp(id, e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !r && reveal(id)}
                    disabled={r && ok}
                    placeholder="Ответ (число)..."
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!r && (
                    <button
                      onClick={() => reveal(id)}
                      disabled={!(inputs[id] ?? "").trim()}
                      className="px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded hover:bg-sky-700 disabled:opacity-40"
                    >
                      Проверить
                    </button>
                  )}
                  {err && (
                    <button
                      onClick={() => reset(id)}
                      className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded text-slate-700 dark:text-slate-200"
                    >
                      ↻
                    </button>
                  )}
                </div>

                {r && !ok && (
                  <button
                    onClick={() => reveal(id)}
                    className="mt-2 w-full px-2 py-1 text-[10px] font-semibold rounded bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 hover:bg-sky-200"
                  >
                    Показать решение
                  </button>
                )}

                {r && (
                  <div
                    className={`mt-2 text-[11px] leading-relaxed rounded p-2 ${
                      ok
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                        : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700"
                    }`}
                  >
                    <div className="font-semibold mb-1">
                      {ok ? "✓ Верно" : `✗ Правильный ответ: ${ex.answers[0]}`}
                    </div>
                    <code className="block text-[10px] font-mono mb-1 opacity-90">
                      {ex.formula}
                    </code>
                    <div>{ex.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Расценки ЭСН */}
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">📋</span>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Расценки ЭСН для холодильных систем
              </h2>
            </div>
            <ul className="space-y-1.5">
              {ESN_ITEMS.map(it => (
                <li
                  key={it.code}
                  className="text-[10px] leading-snug border-l-2 border-sky-500 dark:border-sky-600 pl-2"
                >
                  <code className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                    {it.code}
                  </code>
                  <div className="text-slate-600 dark:text-slate-400">
                    {it.title}{" "}
                    <span className="text-slate-400 dark:text-slate-500">[{it.unit}]</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Подсказка по эксплуатации */}
          <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-3">
            <h3 className="text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-1.5">
              🔧 Эксплуатация
            </h3>
            <ul className="text-[10px] text-cyan-900 dark:text-cyan-200 space-y-1 list-disc pl-4 leading-relaxed">
              <li>
                Чистка конденсатора и испарителя — <b>2 раза в год</b>.
              </li>
              <li>
                Контроль давления хладагента (R404a/R448a/R32) —{" "}
                <b>ежемесячно</b>.
              </li>
              <li>
                Проверка дренажа от наледи — еженедельно зимой.
              </li>
              <li>
                Серверная: круглосуточный мониторинг T и H с SMS-оповещением.
              </li>
              <li>
                Замена фильтров-осушителей — при каждом ремонте контура.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
