"use client";
import Link from "next/link";
import { useState } from "react";

// ── Допуск ±2% ───────────────────────────────────────────────────────────────
function check(input: string, accepts: string[]): boolean {
  const v = parseFloat(input.trim().replace(",", "."));
  return accepts.some((a) => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.025;
  });
}
function checkExact(input: string, accepts: string[]): boolean {
  const v = parseFloat(input.trim().replace(",", "."));
  return accepts.some((a) => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && v === e;
  });
}

// ── Типы свай (для таблицы) ──────────────────────────────────────────────────
const PILE_TYPES = [
  { type: "Забивная ж/б С100.30-Св", use: "Жилые до 9 эт., общественные", len: "10 м, сечение 0.3×0.3 м", price: "28 000 тг/шт + 8 500 тг/м.п." },
  { type: "Забивная С150.30-Св", use: "Высотные 9-25 эт.", len: "15 м", price: "42 000 тг/шт + 9 500 тг/м.п." },
  { type: "Буронабивная Ø500", use: "Сложные грунты, центр городов", len: "10-25 м", price: "18 500 тг/м.п." },
  { type: "Буронабивная Ø800", use: "Высотные, нагруженные", len: "15-30 м", price: "28 500 тг/м.п." },
  { type: "Буронабивная Ø1000 (баретты)", use: "Особо сложные объекты", len: "20-40 м", price: "42 000 тг/м.п." },
  { type: "Винтовая С108×3.0", use: "Лёгкие здания, временные", len: "1.5-4 м", price: "12 500 тг/шт" },
  { type: "Винтовая С159×4.5", use: "Малоэтажные жилые", len: "2.5-6 м", price: "18 500 тг/шт" },
  { type: "Шпунтовая Ларсен Л5", use: "Ограждение котлованов", len: "по проекту", price: "8 500 тг/м.п." },
];

// ── Технологии (4 карточки) ──────────────────────────────────────────────────
const TECHNOLOGIES = [
  { icon: "🔨", title: "Забивные", desc: "Дизель-молот / гидромолот", speed: "30-50 свай/смена", color: "indigo" },
  { icon: "🌀", title: "Буронабивные", desc: "Бурение → армокаркас → бетонирование", speed: "5-15 свай/смена", color: "emerald" },
  { icon: "🔩", title: "Винтовые", desc: "Вкручивание МК-100/КС-200", speed: "10-30 свай/смена", color: "amber" },
  { icon: "📐", title: "Шпунтовые", desc: "Вибропогружение или вдавливание", speed: "по проекту", color: "rose" },
];

// ── Контроль качества ────────────────────────────────────────────────────────
const QC_ITEMS = [
  { method: "Динамические испытания", scope: "Для забивных свай", norm: "Каждая 10-я свая (10%)" },
  { method: "Статические испытания", scope: "Контрольная нагрузка", norm: "1% свай, минимум 2 шт" },
  { method: "Геометрический контроль", scope: "Положение в плане / по вертикали", norm: "≤ 0.2D в плане, ≤ 100 мм по вертикали" },
  { method: "УЗК сварных стыков", scope: "Составные сваи", norm: "100% стыков" },
];

// ── ЭСН расценки ─────────────────────────────────────────────────────────────
const RATES = [
  { code: "Сб.5-1-001", title: "Забивка ж/б свай" },
  { code: "Сб.5-2-001", title: "Бурение скважин под буронабивные сваи" },
  { code: "Сб.5-2-005", title: "Армирование и бетонирование буронабивных свай" },
  { code: "Сб.5-3-001", title: "Завинчивание винтовых свай" },
  { code: "Сб.5-4-001", title: "Шпунтовые ограждения" },
];

// ── Упражнения ───────────────────────────────────────────────────────────────
type Exercise = {
  id: string;
  title: string;
  question: string;
  hint: string;
  unit: string;
  accepts: string[];
  altAccepts?: string[];
  exact?: boolean;
  explanation: string;
  vor: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1-pile-field",
    title: "Стоимость свайного поля",
    question: "Здание опирается на 24 сваи С100.30-Св длиной 10 м каждая. Стоимость сваи 28 000 тг/шт, погружение 8 500 тг/м.п. Рассчитайте полную стоимость свайного поля.",
    hint: "Полная стоимость = (кол-во × цена сваи) + (кол-во × длина × цена погружения)",
    unit: "тг",
    accepts: ["2712000"],
    explanation: "24 × 28 000 = 672 000 тг (сваи) + 24 × 10 × 8 500 = 2 040 000 тг (погружение). Итого: 672 000 + 2 040 000 = 2 712 000 тг.",
    vor: "Свайное поле С100.30-Св: 24 шт × 10 м = 2 712 000 тг (Сб.5-1-001)",
  },
  {
    id: "ex2-concrete-volume",
    title: "Объём бетона на буронабивную сваю",
    question: "Буронабивная свая Ø800 мм длиной 20 м. Рассчитайте объём бетона на одну сваю (формула цилиндра: V = π·R²·H).",
    hint: "R = D/2 = 0.8/2 = 0.4 м. V = π · R² · H = 3.1416 · 0.16 · 20",
    unit: "м³",
    accepts: ["10.05", "10,05", "10.053", "10.06"],
    explanation: "V = π · R² · H = 3.1416 · (0.4)² · 20 = 3.1416 · 0.16 · 20 = 10.05 м³",
    vor: "Бетон на сваю Ø800 L=20м: π·0.4²·20 = 10.05 м³ (Сб.5-2-005)",
  },
  {
    id: "ex3-team-productivity",
    title: "Производительность бригады забивных свай",
    question: "Один копёр забивает в среднем 40 свай за смену. Сколько смен требуется бригаде на 24 сваи? (округление вверх до целой смены)",
    hint: "Смены = ceil(кол-во свай / производительность копра)",
    unit: "смен",
    accepts: ["1"],
    exact: true,
    explanation: "24 / 40 = 0.6 смены → округление вверх до 1 смены. На практике резерв на подготовку и наладку всегда учитывается.",
    vor: "Бригада копра: 24 сваи / 40 = 1 смена (Сб.5-1-001)",
  },
  {
    id: "ex4-quality-control",
    title: "Контроль качества свайного поля",
    question: "Свайное поле 240 свай. Сколько свай нужно подвергнуть СТАТИЧЕСКИМ испытаниям нагрузкой по нормативу (1%, минимум 2 шт)? ИЛИ — сколько свай динамическим контролем (10%)?",
    hint: "Статика: 1% × 240 = 2.4 → минимум 2 шт. Динамика: 10% × 240 = 24 шт.",
    unit: "шт",
    accepts: ["2"],
    altAccepts: ["24"],
    exact: true,
    explanation: "Статические: 1% × 240 = 2.4 → минимум 2 шт (по нормативу не менее 2). Динамические: 10% × 240 = 24 шт. Принимаются оба ответа.",
    vor: "Контроль свай: 2 шт статика + 24 шт динамика (СП РК 5.04-101-2003)",
  },
];

// ── Цвета для технологий ─────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  indigo: "border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700",
  emerald: "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700",
  amber: "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700",
  rose: "border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-700",
};

// ── Компонент страницы ───────────────────────────────────────────────────────
export default function PileFoundationsPage() {
  const [exIdx, setExIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});

  const ex = EXERCISES[exIdx];
  const key = ex.id;
  const allAccepts = [...ex.accepts, ...(ex.altAccepts ?? [])];
  const verify = ex.exact ? checkExact : check;
  const isCorrect = revealed[key] && verify(inputs[key] ?? "", allAccepts);
  const isWrong = revealed[key] && !isCorrect;
  const allDone = done.size === EXERCISES.length;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
    if (verify(inputs[key] ?? "", allAccepts)) {
      setTimeout(() => {
        setDone((d) => new Set([...d, ex.id]));
      }, 600);
    }
  }

  function reset() {
    setInputs((p) => ({ ...p, [key]: "" }));
    setRevealed((r) => ({ ...r, [key]: false }));
    setShowHint((s) => ({ ...s, [key]: false }));
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm md:text-base font-bold">
              🔩 Свайные фундаменты — забивные, буронабивные, винтовые
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              СП РК 5.04-101-2003 · ЭСН РК Сб.5 · {done.size}/{EXERCISES.length} упражнений пройдено
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* 1. Intro card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-bold mb-2">Когда применяются свайные фундаменты?</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            Свайные фундаменты применяются, когда обычные ленточные или плитные конструкции
            не способны обеспечить нужную несущую способность или устойчивость здания.
            Сваи передают нагрузку от здания на более плотные слои грунта, расположенные ниже.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <li className="flex gap-2 items-start">
              <span className="text-indigo-500 shrink-0">▸</span>
              <span><b>Слабые грунты</b> — насыпные, торф, ил, рыхлые пески, текучие глины</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-indigo-500 shrink-0">▸</span>
              <span><b>Высокий уровень грунтовых вод</b> — котлован затопляет, нужна свайная разгрузка</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-indigo-500 shrink-0">▸</span>
              <span><b>Сейсмически активные зоны</b> — Алматы, Талдыкорган, Тараз (≥7 баллов)</span>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-indigo-500 shrink-0">▸</span>
              <span><b>Тяжёлые и высотные здания</b> — нагрузка на 1 пог.м &gt; 50 т</span>
            </li>
          </ul>
        </section>

        {/* 2. Normative block */}
        <section className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">
            📋 Нормативная база
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <code className="text-[11px] font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded shrink-0">СП РК 5.04-101-2003</code>
              <span className="text-slate-700 dark:text-slate-300">«Свайные фундаменты» — основной свод правил</span>
            </li>
            <li className="flex gap-2">
              <code className="text-[11px] font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded shrink-0">ЭСН РК Сб.5</code>
              <span className="text-slate-700 dark:text-slate-300">«Свайные работы» — единичные расценки</span>
            </li>
            <li className="flex gap-2">
              <code className="text-[11px] font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded shrink-0">ГОСТ 19804-2012</code>
              <span className="text-slate-700 dark:text-slate-300">Сваи железобетонные — типы, размеры, маркировка</span>
            </li>
            <li className="flex gap-2">
              <code className="text-[11px] font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded shrink-0">СНиП РК 5.01-03</code>
              <span className="text-slate-700 dark:text-slate-300">Геология для расчёта несущей способности</span>
            </li>
          </ul>
        </section>

        {/* 3. Section 1: Типы свай */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-bold mb-3">1. Типы свай и их применение</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="px-2 py-2 text-left font-semibold">Тип</th>
                  <th className="px-2 py-2 text-left font-semibold">Применение</th>
                  <th className="px-2 py-2 text-left font-semibold">Длина / сечение</th>
                  <th className="px-2 py-2 text-left font-semibold">Стоимость 2025</th>
                </tr>
              </thead>
              <tbody>
                {PILE_TYPES.map((p, i) => (
                  <tr
                    key={p.type}
                    className={`border-b border-slate-100 dark:border-slate-800 ${
                      i % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-800/30" : ""
                    }`}
                  >
                    <td className="px-2 py-2 font-medium text-slate-900 dark:text-slate-100">{p.type}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{p.use}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{p.len}</td>
                    <td className="px-2 py-2 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Section 2: Технологии устройства */}
        <section>
          <h2 className="text-base font-bold mb-3">2. Технологии устройства</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TECHNOLOGIES.map((t) => (
              <div
                key={t.title}
                className={`border-2 rounded-xl p-4 ${COLOR_MAP[t.color]}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{t.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm mb-1">{t.title}</h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">{t.desc}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      ⚙ {t.speed}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Section 3: Контроль качества */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-bold mb-3">3. Контроль качества свай</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="px-2 py-2 text-left font-semibold">Метод контроля</th>
                  <th className="px-2 py-2 text-left font-semibold">Объект</th>
                  <th className="px-2 py-2 text-left font-semibold">Объём контроля</th>
                </tr>
              </thead>
              <tbody>
                {QC_ITEMS.map((q, i) => (
                  <tr
                    key={q.method}
                    className={`border-b border-slate-100 dark:border-slate-800 ${
                      i % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-800/30" : ""
                    }`}
                  >
                    <td className="px-2 py-2 font-medium text-slate-900 dark:text-slate-100">{q.method}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{q.scope}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{q.norm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Section 4: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-bold mb-3">4. Интерактивные упражнения</h2>

          {/* Tabs */}
          <div className="flex gap-1 flex-wrap mb-4">
            {EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setExIdx(i)}
                className={`text-[11px] px-3 py-1.5 rounded font-semibold transition ${
                  i === exIdx
                    ? "bg-indigo-600 text-white"
                    : done.has(e.id)
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {done.has(e.id) ? "✓ " : ""}Упр. {i + 1}
              </button>
            ))}
          </div>

          {/* Active exercise */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-bold mb-2">{ex.title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              {ex.question}
            </p>

            {!done.has(ex.id) ? (
              <div
                className={`border-2 rounded-lg p-3 ${
                  isCorrect
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    : isWrong
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Ваш ответ ({ex.unit}):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputs[key] ?? ""}
                    onChange={(e) => setInputs((p) => ({ ...p, [key]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && !revealed[key] && handleCheck()}
                    disabled={!!revealed[key]}
                    placeholder="Число..."
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!revealed[key] && (
                    <button
                      onClick={handleCheck}
                      disabled={!inputs[key]?.trim()}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-40"
                    >
                      Проверить
                    </button>
                  )}
                </div>

                {revealed[key] && (
                  <div
                    className={`mt-2 text-xs leading-relaxed ${
                      isCorrect ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                    }`}
                  >
                    {isCorrect ? "✓ Верно. " : "✗ Не совсем. "}
                    {ex.explanation}
                  </div>
                )}

                {isWrong && !showHint[key] && (
                  <button
                    onClick={() => setShowHint((s) => ({ ...s, [key]: true }))}
                    className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 underline"
                  >
                    💡 Показать подсказку
                  </button>
                )}
                {isWrong && showHint[key] && (
                  <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-[11px] text-amber-800 dark:text-amber-300">
                    {ex.hint}
                    <button
                      onClick={reset}
                      className="block mt-1 text-amber-700 dark:text-amber-400 underline"
                    >
                      Попробовать снова
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700 rounded-lg p-3">
                <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">✓ Завершено</div>
                <code className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 block">
                  {ex.vor}
                </code>
                {exIdx + 1 < EXERCISES.length && (
                  <button
                    onClick={() => setExIdx(exIdx + 1)}
                    className="mt-2 text-xs text-indigo-700 dark:text-indigo-400 underline"
                  >
                    Следующее упражнение →
                  </button>
                )}
              </div>
            )}
          </div>

          {allDone && (
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">🎉</div>
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Все упражнения по свайным фундаментам пройдены!
              </p>
              <Link
                href="/smeta-trainer/drawings-practice/hub"
                className="inline-block mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
              >
                ← К разделам
              </Link>
            </div>
          )}
        </section>

        {/* 7. Расценки ЭСН */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-bold mb-3">📑 Расценки ЭСН РК (Сборник 5)</h2>
          <ul className="space-y-2">
            {RATES.map((r) => (
              <li
                key={r.code}
                className="flex items-start gap-3 text-sm border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0"
              >
                <code className="text-[11px] font-mono bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded shrink-0">
                  {r.code}
                </code>
                <span className="text-slate-700 dark:text-slate-300">«{r.title}»</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 8. Factoid */}
        <section className="bg-slate-800 dark:bg-slate-900 border-l-4 border-slate-400 dark:border-slate-600 rounded-r-xl p-5">
          <div className="flex items-start gap-3">
            <div className="text-2xl shrink-0">💡</div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">Региональный факт</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                В Алматинской зоне (8 баллов сейсмики) для зданий 5+ этажей применение свай
                <b className="text-slate-100"> обязательно</b>. Для меньшей этажности — на основании геологических изысканий.
              </p>
            </div>
          </div>
        </section>

        <div className="h-8" />
      </main>
    </div>
  );
}
