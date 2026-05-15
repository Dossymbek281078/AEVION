"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.01) {
  const v = parseFloat(i.replace(",", "."));
  return a.some(x => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

// ── Упражнения ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "vol-mass",
    title: "Объём и масса верхнего слоя АБС",
    q: "Участок дороги: длина 200 м, ширина 7 м, толщина верхнего слоя 50 мм. Рассчитайте объём и массу АБС (плотность принять 2.35 т/м³).",
    ss: [
      { id: "v", l: "Объём АБС, м³", a: ["70", "70.0"], e: "V = 200 · 7 · 0.05 = 70 м³" },
      { id: "m", l: "Масса АБС, т", a: ["164.5", "164,5"], e: "M = 70 · 2.35 = 164.5 т" },
    ],
    tol: 0.02,
    vor: "Верхний слой АБС: 200×7×0.05 = 70 м³ → 164.5 т (ЭСН РК Сб.27-1-001)",
    theory: "Плотность плотного асфальтобетона типов А и Б = 2.30–2.40 т/м³. Для оценочных расчётов принимают среднее 2.35. Точная плотность даётся в паспорте партии АБС от завода-изготовителя.",
  },
  {
    id: "cost",
    title: "Стоимость АБС типа А (крупнозернистый)",
    q: "Та же масса АБС 164.5 т. Цена АБС типа А (крупнозернистый) — 48 000 тг/т с доставкой. Рассчитайте полную стоимость.",
    ss: [
      { id: "c", l: "Стоимость АБС, тг", a: ["7896000", "7 896 000"], e: "C = 164.5 · 48 000 = 7 896 000 тг" },
    ],
    tol: 0.02,
    vor: "АБС тип А (крупнозерн.) 164.5 т × 48 000 = 7 896 000 тг (ЭСН РК Сб.27-1-001)",
    theory: "Цена АБС включает доставку с асфальтобетонного завода (обычно радиус до 30 км). При большем плече доставки добавляется коэффициент за транспорт.",
  },
  {
    id: "bitumen",
    title: "Расход битума в смеси",
    q: "В АБС типа А процент битума 6% от массы. Рассчитайте требуемое количество битума для нашей партии 164.5 т.",
    ss: [
      { id: "b", l: "Битум, т", a: ["9.87", "9,87"], e: "B = 164.5 · 0.06 = 9.87 т" },
    ],
    tol: 0.05,
    vor: "Битум БНД 70/100 (6% от массы): 164.5 · 0.06 = 9.87 т (отдельная статья сметы)",
    theory: "Битум — отдельная статья сметы! Доля битума в стоимости АБС 25-35%. При БНД 70/100 цена ~285 000 тг/т (2025). 9.87 т битума = ~2.81 млн тг — это ~36% от стоимости АБС.",
  },
  {
    id: "shma-vs-std",
    title: "Сравнение АБС vs ЩМА для аэродрома",
    q: "Аэродромная полоса 1000 м² × 60 мм. Плотность 2.4 т/м³. Сравните стандартный АБС тип А (52 000 тг/т) и ЩМА (78 000 тг/т). Найдите разницу в стоимости.",
    ss: [
      { id: "diff", l: "Разница в стоимости, тг", a: ["3744000", "3 744 000"], e: "V = 1000 · 0.06 = 60 м³ × 2.4 = 144 т. Стандарт: 144·52000 = 7 488 000 тг. ЩМА: 144·78000 = 11 232 000 тг. Разница = 3 744 000 тг (+50%)." },
    ],
    tol: 0.02,
    vor: "ЩМА vs АБС А для 144 т: разница +3 744 000 тг (+50%, но долговечнее в 2-3 раза)",
    theory: "ЩМА (щебнисто-мастичный асфальтобетон) — премиум-материал для I категории, аэродромов и магистралей с высокой нагрузкой. Стоит на 50% дороже стандартного АБС, но служит в 2-3 раза дольше — TCO (total cost of ownership) в 1.5-2 раза ниже.",
  },
];

// Типы АБС для таблицы
const ABS_TYPES = [
  { type: "А (мелкозерн.)", desc: "Щебень >60%, прочн. по Маршаллу >12 кН", use: "Верх покрытия I-II категория", bit: "5.5-6.5%", price: "52 000" },
  { type: "А (крупнозерн.)", desc: "Щебень >60%, фракция 20-40 мм", use: "Нижние слои магистралей", bit: "5.0-6.0%", price: "48 000" },
  { type: "Б (песч.-щеб.)", desc: "Щебень 30-60%, песок", use: "Стандарт городские", bit: "5.5-6.5%", price: "45 000" },
  { type: "Б (песчаный)", desc: "Щебень <30%, преим. песок", use: "Тротуары, велодорожки", bit: "6.0-7.5%", price: "42 000" },
  { type: "В (пористый)", desc: "Большая пустотность", use: "Основания, нижние слои", bit: "4.0-5.5%", price: "39 000" },
  { type: "Г (литой)", desc: "Горячая укладка с прогревом", use: "Тоннели, мосты", bit: "6.0-7.0%", price: "65 000" },
  { type: "ЩМА", desc: "Щебнисто-мастичный, премиум", use: "I категория, аэродромы", bit: "5.5-6.0%", price: "78 000" },
  { type: "Холодный АБС", desc: "Без прогрева", use: "Ямочный ремонт зимой", bit: "5.0-6.0%", price: "55 000" },
];

export default function AsphaltDetailedPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a, ex.tol);
  const err = rev[k] && !ok;

  function go() {
    setRev(r => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a, ex.tol)) {
      setTimeout(() => {
        if (si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else {
          setDone(d => new Set([...d, ex.id]));
        }
      }, 700);
    }
  }

  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-slate-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-slate-200 hover:text-white">← К разделам</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🛣 Асфальтобетон детально — типы А/Б/В, расход, цены</h1>
            <p className="text-[10px] text-slate-300">ГОСТ 9128-2013 · СНиП РК 3.03-09-2006 · {done.size}/{STEPS.length} пройдено</p>
          </div>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🛣</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">АБС детально освоен!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">
            {STEPS.map(s => (
              <div key={s.id} className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <code className="text-[10px] font-mono">{s.vor}</code>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => { sxi(0); ssi(0); setInp({}); setRev({}); setDone(new Set()); }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg"
            >
              Снова
            </button>
            <Link href="/smeta-trainer/drawings-practice/hub" className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg">
              → К разделам
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {/* Intro */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="font-bold text-slate-900 dark:text-slate-100 mb-2 text-sm">🛣 Асфальтобетонные смеси (АБС)</div>
              <p className="mb-2">Самый дорогой материал дорожной одежды. <b>ГОСТ 9128-2013</b> классифицирует по составу:</p>
              <ul className="space-y-0.5 mb-2 ml-3">
                <li>• <b>Тип А</b> (плотные щебёночные) — верхние слои магистралей</li>
                <li>• <b>Тип Б</b> (плотные с песчаным составом) — нижние слои</li>
                <li>• <b>Тип В</b> (пористые) — основания</li>
                <li>• <b>Тип Г</b> (горячие литые) — спец. участки</li>
              </ul>
              <p>Стоимость: <b>38 000–58 000 тг/тонна</b> (с учётом доставки).</p>
            </div>

            {/* Нормативный блок */}
            <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-800 dark:text-slate-300 space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 mb-1">📐 Нормативная база (РК)</div>
              <div>• <b>ГОСТ 9128-2013</b> «Смеси асфальтобетонные»</div>
              <div>• <b>СНиП РК 3.03-09-2006</b> «Автомобильные дороги»</div>
              <div>• <b>СН РК 3.03-19-2006</b> «Технология строительства автомобильных дорог»</div>
            </div>

            {/* Section 1: Типы АБС */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">📊 Типы асфальтобетонных смесей (ГОСТ 9128-2013)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Тип</th>
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Расшифровка</th>
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Применение</th>
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Расход битума</th>
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-right">Цена 2025, тг/т</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {ABS_TYPES.map((t, i) => (
                      <tr key={t.type} className={i % 2 === 1 ? "bg-slate-50 dark:bg-slate-800/30" : ""}>
                        <td className="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold">{t.type}</td>
                        <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">{t.desc}</td>
                        <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">{t.use}</td>
                        <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">{t.bit}</td>
                        <td className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-right font-mono">{t.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Расчёт расхода АБС */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">🧮 Расчёт расхода АБС</div>
              <div className="bg-slate-100 dark:bg-slate-800/60 rounded p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
{`Объём АБС = Длина · Ширина · Толщина
Масса = Объём × Плотность (2.3–2.4 т/м³ для плотных АБС)

Битум в смеси = Масса × % битума (5–7%)

Пример: участок 100 м × 7 м × 0.05 м (верхний слой):
V = 100 · 7 · 0.05 = 35 м³
Масса = 35 · 2.35 = 82.25 т
Битум 6%: 82.25 · 0.06 = 4.94 т
Стоимость АБС типа А: 82.25 · 52 000 = 4 277 000 тг
Стоимость битума: 4.94 · 285 000 = 1 407 900 тг (отдельно)`}
              </div>
            </div>

            {/* Расценки ЭСН */}
            <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-800 dark:text-slate-300 space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 mb-1">💼 Применяемые расценки ЭСН РК</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-1-001</code> — Покрытие из а/б тип А</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-1-002</code> — Покрытие из а/б тип Б</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-1-005</code> — Основание из а/б тип В</div>
            </div>

            {/* Фактоид */}
            <div className="bg-slate-200 dark:bg-slate-800/60 border border-slate-400 dark:border-slate-600 rounded-xl p-3 text-[11px] text-slate-900 dark:text-slate-200">
              💡 <b>Битум — отдельная статья сметы.</b> Доля битума в стоимости АБС <b>25–35%</b>. При резком росте цены нефти стоимость АБС может вырасти на <b>15–25%</b> в течение месяца. Долгосрочные контракты — фиксируй цену.
            </div>
          </div>

          {/* Правая колонка — упражнения */}
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { sxi(i); ssi(0); setInp({}); setRev({}); }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    i === xi
                      ? "bg-slate-700 text-white"
                      : done.has(s.id)
                      ? "bg-slate-200 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {done.has(s.id) ? "✓" : i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>

              {ex.ss.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {ex.ss.map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${
                      i < si ? "bg-slate-600" : i === si ? "bg-slate-400" : "bg-slate-200 dark:bg-slate-700"
                    }`} />
                  ))}
                </div>
              )}

              {!done.has(ex.id) ? (
                <div className={`border-2 rounded-lg p-3 ${
                  ok ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                  : err ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                  : "border-slate-200 dark:border-slate-700"
                }`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Шаг {si + 1}/{ex.ss.length}: {step.l}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inp[k] ?? ""}
                      onChange={e => setInp(p => ({ ...p, [k]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && !rev[k] && go()}
                      disabled={!!rev[k]}
                      placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded hover:bg-slate-800 disabled:opacity-40"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  {rev[k] && (
                    <div className={`mt-2 text-xs leading-relaxed ${
                      ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                    }`}>
                      {ok ? "✓ " : "✗ "}{step.e}
                    </div>
                  )}
                  {err && (
                    <button
                      onClick={() => { setInp(p => ({ ...p, [k]: "" })); setRev(r => ({ ...r, [k]: false })); }}
                      className="mt-1 text-[10px] text-amber-700 underline"
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-slate-400 bg-slate-100 dark:bg-slate-800/40 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-slate-700 dark:text-slate-300 block">{ex.vor}</code>
                </div>
              )}

              {ex.theory && (
                <div className="mt-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700 rounded p-2 text-[10px] text-slate-800 dark:text-slate-300">
                  📖 {ex.theory}
                </div>
              )}
            </div>

            {done.has(ex.id) && xi + 1 < STEPS.length && (
              <button
                onClick={() => { sxi(xi + 1); ssi(0); setInp({}); setRev({}); }}
                className="w-full py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
              >
                Следующее →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
