"use client";
import Link from "next/link";
import { useState } from "react";

// ── Хелпер числового ответа с допуском ────────────────────────────────────────
function checkNum(input: string, expected: number, tol = 0.05): boolean {
  const v = parseFloat(input.replace(",", ".").replace(/\s/g, ""));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tol;
}

// ── Раздел 1: Виды камня ──────────────────────────────────────────────────────
type StoneRow = {
  type: string;
  mohs: string;
  use: string;
  price: string;
  care: string;
};

const STONE_TABLE: StoneRow[] = [
  { type: "Гранит", mohs: "6–7", use: "Полы с высокой нагрузкой, фасады, лестницы, столешницы", price: "8–20", care: "Простой уход, влагостойкий, не боится морозов" },
  { type: "Мрамор", mohs: "3–4", use: "Стены, столешницы, ванные, представительские интерьеры", price: "15–60", care: "Боится кислот, нужна полировка раз в 2–3 года" },
  { type: "Травертин", mohs: "3–4", use: "Стены, полы (нескользкий), спа, террасы", price: "6–15", care: "Нужна пропитка гидрофобизатором ежегодно" },
  { type: "Оникс", mohs: "3", use: "Декоративные панно, барные стойки, декоративные поверхности (не для пола)", price: "40–150", care: "Очень хрупкий, только вертикальные поверхности" },
  { type: "Сланец (сланцевая плитка)", mohs: "2–4", use: "Фасады, ландшафт, кровля (гонт), деревенский стиль", price: "4–12", care: "Минимальный уход, натуральный вид; расслаивается со временем" },
  { type: "Искусственный камень (кварцагломерат)", mohs: "7", use: "Столешницы, полы, фасады — прочнее натурального мрамора и дешевле", price: "10–25", care: "Без ухода, царапиноустойчив, не боится кислот" },
];

// ── Раздел 2: Способы укладки ─────────────────────────────────────────────────
type MethodRow = {
  method: string;
  esn: string;
  desc: string;
  use: string;
  price: string;
};

const METHOD_TABLE: MethodRow[] = [
  { method: "На цементный раствор (классика)", esn: "ЭСН Сб.11-1", desc: "М150 раствор, слой 20–30 мм. Традиционный способ — надёжный, но тяжёлый", use: "Полы, тяжёлые плиты ≥30 мм", price: "1 500–2 500 тг/м² работы" },
  { method: "На клей специальный (каменный)", esn: "ЭСН Сб.11-2", desc: "Высокопрочный двухкомпонентный клей (эпоксидный или цементно-полимерный). Слой 5–10 мм", use: "Стены, тонкие плиты 10–20 мм, мрамор, гранит", price: "2 000–4 000 тг/м² работы" },
  { method: "Навесная система (вентилируемый фасад)", esn: "ЭСН Сб.11-4", desc: "Плита крепится на скрытые анкеры без клея. Вентилируемый зазор 20–40 мм между плитой и стеной", use: "Высотные фасады, большие плоскости ≥500 м²", price: "4 000–8 000 тг/м² работы" },
  { method: "Сухая раскладка (мощение)", esn: "ЭСН Сб.11-5", desc: "Плиты укладываются на песчано-гравийную подушку без фиксации клеем. Допускает сезонные движения грунта", use: "Открытые площадки, дорожки, патио", price: "800–1 500 тг/м² работы" },
];

// ── Раздел 3: Бенчмарки стоимости ────────────────────────────────────────────
type BenchmarkRow = {
  material: string;
  matPrice: string;
  workPrice: string;
  total: string;
  comment: string;
};

const BENCHMARK_TABLE: BenchmarkRow[] = [
  { material: "Гранит (пол)", matPrice: "8–20 тыс. тг/м²", workPrice: "2 000–3 500 тг/м²", total: "10–23 тыс. тг/м²", comment: "Долговечность 50+ лет, окупаем для общ. пространств" },
  { material: "Мрамор (пол)", matPrice: "15–60 тыс. тг/м²", workPrice: "3 000–6 000 тг/м²", total: "18–66 тыс. тг/м²", comment: "Требует ухода; используется в представительских зонах" },
  { material: "Керамогранит (пол)", matPrice: "3–8 тыс. тг/м²", workPrice: "1 500–2 500 тг/м²", total: "4,5–10 тыс. тг/м²", comment: "Самый массовый выбор в РК, имитирует камень" },
  { material: "Ламинат (для сравнения)", matPrice: "1–4 тыс. тг/м²", workPrice: "700–1 200 тг/м²", total: "1,7–5 тыс. тг/м²", comment: "Срок службы 10–15 лет; не для мокрых зон" },
];

// ── Страница ──────────────────────────────────────────────────────────────────
export default function NaturalStonePage() {
  // Упр. 1 — multiple choice: гранит для нагруженных полов
  const [a1, setA1] = useState<string | null>(null);
  const [r1, setR1] = useState<boolean | null>(null);
  const [s1, setS1] = useState(false);

  // Упр. 2 — числовое: 50 м² мрамора, полный бюджет
  const [a2, setA2] = useState("");
  const [r2, setR2] = useState<boolean | null>(null);
  const [s2, setS2] = useState(false);

  // Упр. 3 — multiple choice: имитация натурального камня
  const [a3, setA3] = useState<string | null>(null);
  const [r3, setR3] = useState<boolean | null>(null);
  const [s3, setS3] = useState(false);

  // Упр. 4 — multiple choice: навесная система
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
            className="text-sm text-stone-400 hover:text-stone-300"
          >
            &larr; К разделам
          </Link>
          <span className="text-xs text-slate-500">AEVION Smeta Trainer · Облицовка натуральным камнем</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-10">
        {/* Title */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-stone-300 via-amber-200 to-stone-400 bg-clip-text text-transparent">
            💎 Облицовка натуральным камнем
          </h1>
          <p className="mt-3 text-slate-400 max-w-3xl">
            Виды природного и искусственного камня, способы укладки, нормы ЭСН Сб.11 (облицовка).
            Бенчмарки стоимости пола для сравнения материалов. Цены 2026 — учебные.
          </p>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Нормативы ЭСН</div>
              <div className="text-sm text-slate-200 mt-1">Сборник 11 — облицовочные работы</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">СТ РК ГОСТ</div>
              <div className="text-sm text-slate-200 mt-1">9479 — облицовочные блоки и плиты</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Шкала Мооса</div>
              <div className="text-sm text-slate-200 mt-1">1 (тальк) → 10 (алмаз). Гранит: 6–7</div>
            </div>
          </div>
        </section>

        {/* Раздел 1: Виды камня */}
        <section>
          <h2 className="text-2xl font-bold text-stone-300 mb-4">
            Раздел 1. Виды камня — характеристики и применение
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Вид камня</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Твёрдость (Моос)</th>
                  <th className="text-left px-3 py-2 font-semibold">Применение</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Цена, тыс. тг/м²</th>
                  <th className="text-left px-3 py-2 font-semibold">Уход</th>
                </tr>
              </thead>
              <tbody>
                {STONE_TABLE.map((row, i) => (
                  <tr
                    key={row.type}
                    className={`border-t border-slate-800 hover:bg-slate-900/40 ${
                      row.type === "Оникс" ? "bg-amber-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-100 font-medium">{row.type}</td>
                    <td className="px-3 py-2 text-amber-300 font-mono text-center">{row.mohs}</td>
                    <td className="px-3 py-2 text-slate-400">{row.use}</td>
                    <td className="px-3 py-2 text-stone-300 font-mono whitespace-nowrap">{row.price}</td>
                    <td className="px-3 py-2 text-slate-500">{row.care}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 italic">
            * Кварцагломерат (Silestone, Cosentino, Caesarstone) — 93% кварца + 7% смол и пигментов.
            Прочнее натурального мрамора, не требует пропиток, доступнее по цене.
          </p>
        </section>

        {/* Раздел 2: Способы укладки */}
        <section>
          <h2 className="text-2xl font-bold text-stone-300 mb-4">
            Раздел 2. Способы укладки — ЭСН Сб.11
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {METHOD_TABLE.map((m) => (
              <div
                key={m.method}
                className="rounded-xl border border-stone-800/50 bg-gradient-to-br from-stone-950/40 to-slate-900/40 p-4"
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-base font-bold text-stone-200">{m.method}</h3>
                  <span className="text-xs font-mono text-amber-400 whitespace-nowrap ml-2">{m.esn}</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed mb-2">{m.desc}</p>
                <div className="text-xs text-slate-500 mb-1">
                  <b className="text-slate-300">Применение:</b> {m.use}
                </div>
                <div className="text-sm font-mono font-bold text-stone-300">{m.price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 3: Бенчмарки */}
        <section>
          <h2 className="text-2xl font-bold text-stone-300 mb-4">
            Раздел 3. Бенчмарки стоимости пола (материал + работа)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Материал</th>
                  <th className="text-left px-3 py-2 font-semibold">Материал, тг/м²</th>
                  <th className="text-left px-3 py-2 font-semibold">Работа, тг/м²</th>
                  <th className="text-left px-3 py-2 font-semibold">Итого</th>
                  <th className="text-left px-3 py-2 font-semibold">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {BENCHMARK_TABLE.map((b, i) => (
                  <tr
                    key={b.material}
                    className={`border-t border-slate-800 hover:bg-slate-900/40 ${
                      b.material.includes("Гранит") ? "bg-stone-950/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-100 font-medium">{b.material}</td>
                    <td className="px-3 py-2 text-stone-300 font-mono">{b.matPrice}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{b.workPrice}</td>
                    <td className="px-3 py-2 text-amber-300 font-mono font-bold">{b.total}</td>
                    <td className="px-3 py-2 text-slate-500">{b.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Упражнения */}
        <section>
          <h2 className="text-2xl font-bold text-stone-300 mb-4">Упражнения</h2>

          {/* Упр. 1 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-amber-300">Упражнение 1. Гранит — нагруженные полы</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Твёрдость гранита по шкале Мооса — 6–7 из 10. Он водостойкий и выдерживает высокие нагрузки.
              Укажите наиболее подходящее применение гранита.
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Только для стен (слишком тяжёлый для пола)" },
                { id: "b", label: "Только для наружных фасадов (нельзя внутри)" },
                { id: "c", label: "Полы с высокой нагрузкой — прочность 7/10 по Моосу, не боится воды и износа" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a1 === opt.id
                      ? "border-amber-500 bg-amber-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1-stone"
                    value={opt.id}
                    checked={a1 === opt.id}
                    onChange={() => setA1(opt.id)}
                    className="mt-1 accent-amber-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-amber-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR1(a1 === "c")}
                className="px-3 py-2 rounded bg-stone-600 hover:bg-stone-500 text-white text-sm font-medium"
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
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-stone-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-amber-300">в) Полы с высокой нагрузкой.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Гранит универсален: полы, стены, фасады, лестницы. Высокая твёрдость (6–7) — не царапается
                  ключами/каблуками. Водопоглощение &lt;0,5% — идеален для мокрых зон. Срок службы 80–100 лет
                  без существенного ухода.
                </div>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-amber-300">Упражнение 2. Полный бюджет укладки мрамора</h3>
              <span className="text-xs text-slate-500">numeric ±50 000 тг</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Площадь укладки: <b>50 м²</b>. Мрамор: <b>45 000 тг/м²</b> (материал).
              Работа укладки на специальный клей: <b>15 000 тг/м²</b>. Рассчитайте полный бюджет в тенге.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                placeholder="Например: 3000000"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm w-48 focus:border-amber-500 outline-none"
              />
              <span className="text-slate-400 text-sm">тг</span>
              <button
                onClick={() => setR2(checkNum(a2, 3000000, 0.017))}
                className="px-3 py-2 rounded bg-stone-600 hover:bg-stone-500 text-white text-sm font-medium"
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
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-stone-900/40 text-sm text-slate-300">
                <div>
                  Материал: 50 м² &times; 45 000 тг/м² = 2 250 000 тг
                </div>
                <div>
                  Работа: 50 м² &times; 15 000 тг/м² = 750 000 тг
                </div>
                <div className="mt-1">
                  Итого: 2 250 000 + 750 000 = <b className="text-amber-300">3 000 000 тг</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  50 × (45 000 + 15 000) = 50 × 60 000 = 3 000 000 тг. Допуск ±50 000 тг.
                  Дополнительно: затирка швов и заделка полиролью — +5–8% к стоимости работ.
                </div>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-amber-300">Упражнение 3. Имитация натурального камня</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Клиент хочет эффект натурального камня, но ограничен бюджетом. Какой материал является
              наиболее доступной и практичной альтернативой, при этом превосходящей натуральный мрамор
              по ряду характеристик?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Оникс — красивый и доступный" },
                { id: "b", label: "Мрамор — просто купить подешевле" },
                { id: "c", label: "Кварцагломерат (искусственный камень Silestone/Cosentino) — прочнее натурального мрамора и дешевле" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a3 === opt.id
                      ? "border-amber-500 bg-amber-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex3-stone"
                    value={opt.id}
                    checked={a3 === opt.id}
                    onChange={() => setA3(opt.id)}
                    className="mt-1 accent-amber-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-amber-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR3(a3 === "c")}
                className="px-3 py-2 rounded bg-stone-600 hover:bg-stone-500 text-white text-sm font-medium"
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
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-stone-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-amber-300">в) Кварцагломерат.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Оникс — ещё дороже мрамора и очень хрупкий. Кварцагломерат (93% кварца): твёрдость 7 по
                  Моосу vs 3–4 у мрамора. Не боится кислот (кофе, лимон). Цена 10–25 тыс. тг/м² vs
                  15–60 тыс. тг/м² у мрамора. Применяется в коммерческих кухнях и офисах.
                </div>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-amber-300">Упражнение 4. Навесная система облицовки</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Заказчик хочет облицевать гранитом фасад 14-этажного офисного здания площадью 800 м².
              Укажите правильный способ крепления и его ключевые особенности.
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Самый дешёвый метод — просто на цементный раствор" },
                { id: "b", label: "Только для небольших интерьерных поверхностей" },
                { id: "c", label: "Только для внутренних работ" },
                { id: "d", label: "Навесная система (вентфасад) — плита крепится на скрытые анкеры, вентзазор 20–40 мм, применяется для высотных фасадов и больших плоскостей" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a4 === opt.id
                      ? "border-amber-500 bg-amber-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4-stone"
                    value={opt.id}
                    checked={a4 === opt.id}
                    onChange={() => setA4(opt.id)}
                    className="mt-1 accent-amber-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-amber-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR4(a4 === "d")}
                className="px-3 py-2 rounded bg-stone-600 hover:bg-stone-500 text-white text-sm font-medium"
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
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-stone-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-amber-300">г) Навесная система (вентилируемый фасад).</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Крепление на клей на высоте — критически опасно (падение плит при ветровой нагрузке).
                  Навесная система: анкеры из нержавеющей стали, вентзазор 20–40 мм (исключает конденсат),
                  плита не соприкасается со стеной. Стоимость работ 4 000–8 000 тг/м² — дороже клея, но
                  безопасно, долговечно, ремонтопригодно.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Factoid */}
        <section className="rounded-xl border border-stone-800/40 bg-gradient-to-br from-stone-950/40 to-amber-950/20 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-lg font-semibold text-stone-200 mb-2">
                Типичная ошибка сметчика при облицовке камнем
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Нельзя взять одну расценку «плитка» для гранита 30 мм на полу и мрамора 12 мм на стене —
                это разные ЭСН-позиции (Сб.11-1 и Сб.11-2) с разным расходом клея, разной трудоёмкостью
                и разными транспортными расходами на тяжёлые плиты. Всегда указывайте вид камня, толщину
                плиты и способ крепления.
              </p>
            </div>
          </div>
        </section>

        {/* Footer nav */}
        <div className="pt-6 border-t border-slate-800 flex justify-between text-xs text-slate-600">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-stone-400 hover:underline"
          >
            ← К разделам
          </Link>
          <span>
            AEVION Smeta Trainer · Модуль «Облицовка натуральным камнем» · ЭСН Сб.11 · СТ РК ГОСТ 9479
          </span>
        </div>
      </main>
    </div>
  );
}
