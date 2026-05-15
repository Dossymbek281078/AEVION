"use client";
import Link from "next/link";
import { useState } from "react";

// ── Хелпер числового ответа с допуском ────────────────────────────────────────
function checkNum(input: string, expected: number, tol = 0.05): boolean {
  const v = parseFloat(input.replace(",", ".").replace(/\s/g, ""));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tol;
}

// ── Раздел 1: Виды стекла ─────────────────────────────────────────────────────
type GlassRow = {
  type: string;
  thickness: string;
  use: string;
  price: string;
  esn: string;
};

const GLASS_TABLE: GlassRow[] = [
  { type: "Обычное флоат", thickness: "4–12 мм", use: "Жилые интерьеры, зеркала, мебельное стекло", price: "1–3", esn: "Сб.15-1" },
  { type: "Закалённое (тройная прочность)", thickness: "4–19 мм", use: "Панорамное остекление, душевые, детские учреждения, входные группы", price: "3–8", esn: "Сб.15-2" },
  { type: "Ламинированное триплекс", thickness: "6–24 мм", use: "Безопасное стекло: крыши, полы, ступени, зонирование", price: "5–12", esn: "Сб.15-3" },
  { type: "Армированное", thickness: "6–7 мм", use: "Кровельные фонари, промышленные объекты, пожаробезопасные перегородки", price: "2–5", esn: "Сб.15-4" },
  { type: "Тонированное", thickness: "4–10 мм", use: "Фасадное остекление, снижение солнечной нагрузки, офисы", price: "3–6", esn: "Сб.15-5" },
  { type: "Смарт-стекло (с переключением прозрачности)", thickness: "5–14 мм", use: "Переговорные комнаты, медицинские кабинеты, VIP-офисы — управление электрическим полем", price: "80–200", esn: "Сб.15-9" },
];

// ── Раздел 2: Витражные системы ───────────────────────────────────────────────
type VitrazRow = {
  type: string;
  frame: string;
  desc: string;
  price: string;
};

const VITRAZH_TABLE: VitrazRow[] = [
  { type: "Тёплое витражное остекление", frame: "Алюминий с тепловым разрывом / нержавеющая сталь", desc: "Жилые фасады, атриумы с нормируемой температурой, зимние сады. R ≥ 0,65 м²·°C/Вт", price: "18–35 тыс. тг/м²" },
  { type: "Холодное витражное остекление", frame: "Алюминий без теплового разрыва", desc: "Навесы, навесные фасады, холодные входные тамбуры, не отапливаемые галереи", price: "10–20 тыс. тг/м²" },
  { type: "Структурное остекление (SSG)", frame: "Алюминиевые скрытые стойки, силиконовый шов снаружи", desc: "Высотные здания, безрамный вид фасада, ветровые нагрузки. Монтаж только сертифицированными бригадами", price: "25–60 тыс. тг/м²" },
];

// ── Раздел 3: Стеклопакеты ────────────────────────────────────────────────────
type PacketRow = {
  type: string;
  formula: string;
  rValue: string;
  price: string;
  comment: string;
};

const PACKET_TABLE: PacketRow[] = [
  { type: "Однокамерный", formula: "4-12-4 мм", rValue: "0,32 м²·°C/Вт", price: "4–7 тыс. тг/м²", comment: "Годится только для тёплого климата / неотапл. помещений" },
  { type: "Двухкамерный", formula: "4-10-4-10-4 мм", rValue: "0,51 м²·°C/Вт", price: "7–12 тыс. тг/м²", comment: "Стандарт для жилых зданий Казахстана" },
  { type: "Трёхкамерный", formula: "4-8-4-8-4-8-4 мм", rValue: "0,70 м²·°C/Вт", price: "12–20 тыс. тг/м²", comment: "Северный Казахстан (Астана, Петропавловск) — суровый климат" },
  { type: "Вакуумный", formula: "4-0.1-4 мм (вакуум)", rValue: "1,1 м²·°C/Вт", price: "40–90 тыс. тг/м²", comment: "Пассивные дома, пассивная энергетика, уникальные объекты" },
];

// ── Упражнения ────────────────────────────────────────────────────────────────
export default function GlazingWorksPage() {
  // Упр. 1 — multiple choice: закалённое стекло обязательно
  const [a1, setA1] = useState<string | null>(null);
  const [r1, setR1] = useState<boolean | null>(null);
  const [s1, setS1] = useState(false);

  // Упр. 2 — числовое: витраж 20 × 25 000 = 500 000
  const [a2, setA2] = useState("");
  const [r2, setR2] = useState<boolean | null>(null);
  const [s2, setS2] = useState(false);

  // Упр. 3 — multiple choice: трёхкамерный стеклопакет
  const [a3, setA3] = useState<string | null>(null);
  const [r3, setR3] = useState<boolean | null>(null);
  const [s3, setS3] = useState(false);

  // Упр. 4 — multiple choice: смарт-стекло
  const [a4, setA4] = useState<string | null>(null);
  const [r4, setR4] = useState<boolean | null>(null);
  const [s4, setS4] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            &larr; К разделам
          </Link>
          <span className="text-xs text-slate-500">AEVION Smeta Trainer · Стекольные работы</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-10">
        {/* Title */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            🪟 Стекольные работы
          </h1>
          <p className="mt-3 text-slate-400 max-w-3xl">
            Подбор стекла, витражных систем и стеклопакетов. Нормы ЭСН Сб.15 (стекольные работы).
            Цены 2026 — ориентировочные, для учебных расчётов.
          </p>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Нормативы ЭСН</div>
              <div className="text-sm text-slate-200 mt-1">Сборник 15 — стекольные работы</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">СН РК</div>
              <div className="text-sm text-slate-200 mt-1">2.04-21 — тепловая защита зданий</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">ГОСТ</div>
              <div className="text-sm text-slate-200 mt-1">24404-80 — стекло строительное листовое</div>
            </div>
          </div>
        </section>

        {/* Раздел 1: Виды стекла */}
        <section>
          <h2 className="text-2xl font-bold text-sky-300 mb-4">
            Раздел 1. Виды строительного стекла
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Тип</th>
                  <th className="text-left px-3 py-2 font-semibold">Толщина</th>
                  <th className="text-left px-3 py-2 font-semibold">Применение</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Цена, тыс. тг/м²</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">ЭСН</th>
                </tr>
              </thead>
              <tbody>
                {GLASS_TABLE.map((row, i) => (
                  <tr
                    key={row.type}
                    className={`border-t border-slate-800 hover:bg-slate-900/40 ${
                      row.type.includes("Смарт") ? "bg-sky-950/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-100 font-medium">{row.type}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{row.thickness}</td>
                    <td className="px-3 py-2 text-slate-400">{row.use}</td>
                    <td className="px-3 py-2 text-sky-300 font-mono whitespace-nowrap">{row.price}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">{row.esn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 italic">
            * Смарт-стекло (electrochromic / PDLC) — меняет прозрачность под напряжением 50–120 В. Требует
            специализированного монтажа и электроснабжения к каждой панели.
          </p>
        </section>

        {/* Раздел 2: Витражные системы */}
        <section>
          <h2 className="text-2xl font-bold text-sky-300 mb-4">
            Раздел 2. Витражные системы
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {VITRAZH_TABLE.map((v) => (
              <div
                key={v.type}
                className="rounded-xl border border-sky-900/50 bg-gradient-to-br from-sky-950/30 to-cyan-950/20 p-4"
              >
                <h3 className="text-base font-bold text-sky-200 mb-1">{v.type}</h3>
                <div className="text-xs text-slate-400 italic mb-2">
                  Рама: {v.frame}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">{v.desc}</p>
                <div className="text-sm font-mono font-bold text-cyan-300">{v.price}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Выбор тёплая/холодная система определяется назначением помещения и климатическим поясом.
            Алюминиевый профиль — самый распространённый (90% рынка). Нержавеющая сталь — премиум, коррозионно-стойкий
            вариант для морского/агрессивного климата.
          </p>
        </section>

        {/* Раздел 3: Стеклопакеты */}
        <section>
          <h2 className="text-2xl font-bold text-sky-300 mb-4">
            Раздел 3. Стеклопакеты — тепловое сопротивление
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Тип пакета</th>
                  <th className="text-left px-3 py-2 font-semibold">Формула</th>
                  <th className="text-left px-3 py-2 font-semibold">R, м²·°C/Вт</th>
                  <th className="text-left px-3 py-2 font-semibold">Цена, тыс. тг/м²</th>
                  <th className="text-left px-3 py-2 font-semibold">Применение</th>
                </tr>
              </thead>
              <tbody>
                {PACKET_TABLE.map((p, i) => (
                  <tr
                    key={p.type}
                    className={`border-t border-slate-800 hover:bg-slate-900/40 ${
                      p.type === "Трёхкамерный" ? "bg-sky-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-100 font-medium">{p.type}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{p.formula}</td>
                    <td className="px-3 py-2 text-cyan-300 font-mono font-bold">{p.rValue}</td>
                    <td className="px-3 py-2 text-sky-300 font-mono">{p.price}</td>
                    <td className="px-3 py-2 text-slate-400">{p.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-sm text-amber-200">
            ⚠ По СН РК 2.04-21 в г. Астана требуемое R₀ для окон ≥ 0,65 м²·°C/Вт. Трёхкамерный стеклопакет
            (0,70) — минимальный соответствующий норме для Северного Казахстана.
          </div>
        </section>

        {/* Упражнения */}
        <section>
          <h2 className="text-2xl font-bold text-sky-300 mb-4">Упражнения</h2>

          {/* Упр. 1 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cyan-300">Упражнение 1. Где обязательно закалённое стекло?</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Закалённое стекло имеет тройную прочность и безопасный характер разрушения (крошится на мелкие
              тупые осколки). Укажите, где его применение является обязательным по нормам РК.
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Жилые комнаты (стены)" },
                { id: "b", label: "Межкомнатные двери (витражные вставки)" },
                { id: "c", label: "Панорамное остекление на высоте, детские учреждения, душевые кабины" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a1 === opt.id
                      ? "border-sky-500 bg-sky-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.id}
                    checked={a1 === opt.id}
                    onChange={() => setA1(opt.id)}
                    className="mt-1 accent-sky-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-sky-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR1(a1 === "c")}
                className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS1(!s1)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s1 ? "Скрыть" : "Показать"} решение
              </button>
              {r1 !== null && (
                <span className={`text-sm font-semibold ${r1 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r1 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s1 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-sky-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-sky-300">в) Панорамное остекление на высоте, детские учреждения, душевые кабины.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  СН РК 2.02-11: в детских учреждениях, душевых и на высоте от 0,8 м от пола обязательно
                  безопасное стекло (закалённое или ламинированное). Обычное флоат запрещено — при разрушении
                  образует острые осколки.
                </div>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cyan-300">Упражнение 2. Стоимость витража</h3>
              <span className="text-xs text-slate-500">numeric ±10 000 тг</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Холодная витражная система: площадь остекления <b>20 м²</b>, стоимость
              материал + работа <b>25 000 тг/м²</b>. Рассчитайте общую стоимость в тенге.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                placeholder="Например: 500000"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm w-48 focus:border-sky-500 outline-none"
              />
              <span className="text-slate-400 text-sm">тг</span>
              <button
                onClick={() => setR2(checkNum(a2, 500000, 0.02))}
                className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS2(!s2)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s2 ? "Скрыть" : "Показать"} решение
              </button>
              {r2 !== null && (
                <span className={`text-sm font-semibold ${r2 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r2 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s2 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-sky-900/40 text-sm text-slate-300">
                <div>20 м² &times; 25 000 тг/м² = <b className="text-sky-300">500 000 тг</b></div>
                <div className="text-xs text-slate-500 mt-1">
                  В реальной смете дополнительно учитываются: подоконники, откосы, монтажная пена,
                  нащельники — прибавьте 10–15% к стоимости остекления.
                </div>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cyan-300">Упражнение 3. Трёхкамерный стеклопакет</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Трёхкамерный стеклопакет (R = 0,70 м²·°C/Вт) стоит значительно дороже однокамерного.
              Укажите, в каком климатическом контексте его применение оправдано и нормативно обязательно.
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Жаркий климат (для защиты от солнца)" },
                { id: "b", label: "Холодный климат (Астана, Петропавловск) — снижает тепловые потери через окна" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a3 === opt.id
                      ? "border-sky-500 bg-sky-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex3"
                    value={opt.id}
                    checked={a3 === opt.id}
                    onChange={() => setA3(opt.id)}
                    className="mt-1 accent-sky-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-sky-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR3(a3 === "b")}
                className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS3(!s3)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s3 ? "Скрыть" : "Показать"} решение
              </button>
              {r3 !== null && (
                <span className={`text-sm font-semibold ${r3 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r3 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s3 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-sky-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-sky-300">б) Холодный климат — Астана, Петропавловск.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  СН РК 2.04-21: для климатической зоны с расчётной температурой −35°C и ниже требуется
                  R₀ ≥ 0,65 м²·°C/Вт. Трёхкамерный пакет (0,70) удовлетворяет норме, двухкамерный
                  (0,51) — нет. Разница в стоимости на типовом 5-эт. доме может составить 3–5 млн тг.
                </div>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cyan-300">Упражнение 4. Смарт-стекло</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Смарт-стекло с переключением прозрачности — дорогостоящий материал (80–200 тыс. тг/м²).
              Где его применение экономически и функционально обоснованно?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Везде — это дешевле обычного стекла при больших объёмах" },
                { id: "b", label: "Только снаружи зданий (фасадное остекление)" },
                { id: "c", label: "Только в России (нет поставок в РК)" },
                { id: "d", label: "Переговорные комнаты, офисы, медицинские кабинеты — управление приватностью электрическим полем. Цена 80–200 тыс. тг/м²" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a4 === opt.id
                      ? "border-sky-500 bg-sky-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.id}
                    checked={a4 === opt.id}
                    onChange={() => setA4(opt.id)}
                    className="mt-1 accent-sky-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-sky-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR4(a4 === "d")}
                className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS4(!s4)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s4 ? "Скрыть" : "Показать"} решение
              </button>
              {r4 !== null && (
                <span className={`text-sm font-semibold ${r4 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r4 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s4 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-sky-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-sky-300">г) Переговорные комнаты, офисы, медицинские кабинеты.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Технология PDLC или электрохромная — при подаче напряжения стекло мгновенно становится
                  матовым. Применяется вместо штор/жалюзи для управления приватностью без механических
                  элементов. Высокая цена (80–200 тыс. тг/м²) оправдана в коммерческой недвижимости
                  и медицине, но не в типовом жилье.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Factoid */}
        <section className="rounded-xl border border-sky-800/40 bg-gradient-to-br from-sky-950/40 to-cyan-950/30 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-lg font-semibold text-sky-200 mb-2">
                Ошибка сметчика при остеклении
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Часто в сметах смешивают <b>площадь стеклопакета</b> (без рамы) и <b>площадь проёма</b>
                (с рамой). ЭСН Сб.15 считает по площади <b>остекления</b> (стекло в свету), а не по проёму.
                Разница — 10–15% в зависимости от профиля рамы. Всегда уточняйте у производителя «площадь
                в свету» vs «площадь блока».
              </p>
            </div>
          </div>
        </section>

        {/* Footer nav */}
        <div className="pt-6 border-t border-slate-800 flex justify-between text-xs text-slate-600">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sky-700 dark:text-sky-400 hover:underline"
          >
            ← К разделам
          </Link>
          <span>
            AEVION Smeta Trainer · Модуль «Стекольные работы» · ЭСН Сб.15 · СН РК 2.04-21
          </span>
        </div>
      </main>
    </div>
  );
}
