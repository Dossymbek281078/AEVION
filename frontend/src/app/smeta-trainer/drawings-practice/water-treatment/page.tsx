"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.05;
  });
}

type Step = { id: string; l: string; a: string[]; e: string };
type Ex = { id: string; title: string; q: string; ss: Step[]; vor: string };

const TYPES: { name: string; perf: string; price: string; use: string }[] = [
  { name: "Септик 3-камерный 3 м³", perf: "до 5 чел", price: "285 000 тг", use: "Дачи, гостевые домики" },
  { name: "Локальное септик-фильтр Топас 5", perf: "10 чел", price: "850 000 тг", use: "Коттеджи" },
  { name: "Септик с биофильтром Топас 10", perf: "20 чел", price: "1 850 000 тг", use: "Малые гостиницы" },
  { name: "Очистные АЭРОТАНК промышленные 50 м³/сут", perf: "150 чел", price: "8 500 000 тг", use: "Микрорайон" },
  { name: "Очистные с УФ-стерилизацией 200 м³/сут", perf: "600 чел", price: "22 000 000 тг", use: "Гостиничный комплекс" },
  { name: "Биологические очистные 500 м³/сут", perf: "1500 чел", price: "65 000 000 тг", use: "Санаторный комплекс" },
  { name: "Промышленные очистные 1000 м³/сут", perf: "+ спец. химия", price: "120 000 000 тг", use: "Заводы (нефтехим, пищпром)" },
];

const STAGES: string[] = [
  "1. Механическая (решётка → песколовка → отстойник): 60% загрязнений",
  "2. Биологическая (аэротенк с активным илом): 90-95% загрязнений",
  "3. Доочистка (биофильтр или биопруд): до 99%",
  "4. Дезинфекция (хлорирование или УФ): для повторного использования",
];

const NORMS: string[] = [
  "СНиП РК 4.01-03-2012 «Очистные сооружения»",
  "ЭК РК — экологические требования к стокам",
  "СНиП РК 4.01-02-2009 «Водоснабжение наружное»",
];

const ESN: string[] = [
  "ЭСН Сб.23-1-001 «Установка септика»",
  "ЭСН Сб.23-2-001 «Установка очистных АЭРОТАНК»",
  "ЭСН Сб.23-3-001 «Дезинфекция стоков»",
  "+ спец. оборудование по ССЦ",
];

const STEPS: Ex[] = [
  {
    id: "perf",
    title: "Производительность очистных для гостиницы",
    q:
      "Гостиница на 50 номеров, средняя загрузка 2 чел/номер. " +
      "Норма водоотведения для туристов — 200 л/чел/сут (повышенный расход). " +
      "Рассчитайте требуемую производительность очистных в м³/сут.",
    ss: [
      {
        id: "v",
        l: "Производительность, м³/сут",
        a: ["20"],
        e: "Q = 50 × 2 × 200 = 20 000 л/сут = 20 м³/сут. По таблице подходит АЭРОТАНК 50 м³/сут (с запасом).",
      },
    ],
    vor: "Очистные АЭРОТАНК 50 м³/сут (для 100 чел гостиницы): объект 1 шт (СНиП РК 4.01-03-2012)",
  },
  {
    id: "cost",
    title: "Стоимость очистных для коттеджного посёлка",
    q:
      "Коттеджный посёлок: 30 коттеджей по 5 чел = 150 человек. " +
      "Подобрать оптимальный тип очистных и определить стоимость оборудования (без СМР).",
    ss: [
      {
        id: "p",
        l: "Стоимость очистных, тг",
        a: ["8500000"],
        e: "По таблице — АЭРОТАНК 50 м³/сут (рассчитан на 150 чел) = 8 500 000 тг. Для меньшего числа — несколько Топас-10, но дороже.",
      },
    ],
    vor: "АЭРОТАНК 50 м³/сут для посёлка 150 чел: 8 500 000 тг (ССЦ, оборудование)",
  },
  {
    id: "tank",
    title: "Объём резервуара аккумуляции стоков",
    q:
      "Перед очистными ставится резервуар-усреднитель для выравнивания расхода. " +
      "При расходе 20 м³/сут и времени выравнивания 6 часов рассчитайте необходимый объём.",
    ss: [
      {
        id: "v",
        l: "Объём резервуара, м³",
        a: ["5"],
        e: "V = Q × t = 20 м³/сут × (6 ч / 24 ч) = 20 × 0.25 = 5 м³. Усреднение нужно для стабильной работы аэротенка.",
      },
    ],
    vor: "Резервуар-усреднитель аккумуляции стоков V=5 м³ перед очистными 20 м³/сут",
  },
  {
    id: "land",
    title: "Площадь земли под очистные с санитарной зоной",
    q:
      "Очистные АЭРОТАНК 50 м³/сут занимают 60 м² на участке. " +
      "По СНиП — санитарно-защитная зона радиусом 50 м от сооружения. " +
      "Рассчитайте чистую площадь санитарной зоны (без площади самого сооружения).",
    ss: [
      {
        id: "s",
        l: "Площадь санитарной зоны, м²",
        a: ["7800", "7794"],
        e:
          "S = π·R² − Sсооруж = 3.14159 × 50² − 60 = 7854 − 60 ≈ 7794 ≈ 7800 м². " +
          "Это означает, что от очистных до жилого здания должно быть ≥50 м во все стороны.",
      },
    ],
    vor: "Санитарная зона очистных 50 м³/сут: ~7800 м² (R=50 м по СНиП РК 4.01-03-2012)",
  },
];

export default function WaterTreatmentPage() {
  const [tab, setTab] = useState<"intro" | "types" | "stages" | "ex" | "esn">("intro");
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a)) {
      setTimeout(() => {
        if (si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else {
          setDone((d) => new Set([...d, ex.id]));
        }
      }, 700);
    }
  }

  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-cyan-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-cyan-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🌊 Очистные сооружения — водоотведение и водоподготовка
            </h1>
            <p className="text-[10px] text-cyan-200">
              СНиП РК 4.01-03-2012 · ЭСН Сб.23 · {done.size}/{STEPS.length} упражнений
            </p>
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/normatives#water-treatment"
            className="text-[10px] bg-cyan-900 text-cyan-200 px-2 py-1 rounded hover:bg-cyan-800"
          >
            📋 Нормативы
          </Link>
        </div>
      </header>

      {/* Табы навигации */}
      <div className="max-w-6xl mx-auto px-4 pt-3">
        <div className="flex gap-1 flex-wrap text-[11px]">
          {[
            { k: "intro", t: "🌊 Введение" },
            { k: "types", t: "📋 Типы (7)" },
            { k: "stages", t: "⚙️ Этапы очистки" },
            { k: "ex", t: `🎯 Упражнения (${done.size}/${STEPS.length})` },
            { k: "esn", t: "💰 Расценки ЭСН" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 py-1.5 rounded font-semibold ${
                tab === t.k
                  ? "bg-cyan-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-slate-700"
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
                🌊 Очистные сооружения — обязательны для:
              </h2>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed mb-3">
                <li>Локальных стоков (если нет городской канализации)</li>
                <li>Промышленных предприятий</li>
                <li>Туристических объектов в природоохранных зонах</li>
                <li>Дачных посёлков</li>
                <li>
                  Объектов на расстоянии {">"}500 м от центральной канализации
                </li>
              </ul>
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded p-2.5 text-xs text-cyan-900 dark:text-cyan-200">
                <b>💵 Стоимость:</b> 45 000–180 000 тг/чел в зависимости от типа.
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200">
              <div className="font-bold mb-1.5 text-sm">📘 Нормативная база</div>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                {NORMS.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>

            <div className="bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-300 dark:border-cyan-600 rounded-xl p-3 text-xs text-cyan-900 dark:text-cyan-200">
              <div className="font-bold mb-1">💡 Факт</div>
              <p className="leading-relaxed">
                Очистные — отдельный комплекс работ с большим участком земли (50–100 м
                санитарной зоны). При проектировании выноси очистные ДАЛЬШЕ от жилых
                зданий. Иначе — жалобы и переделка.
              </p>
            </div>
          </>
        )}

        {tab === "types" && (
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              📋 Типы очистных сооружений (цены 2025, без СМР)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-200">
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">
                      Тип
                    </th>
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">
                      Производительность
                    </th>
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-right">
                      Цена 2025
                    </th>
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">
                      Применение
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TYPES.map((t) => (
                    <tr
                      key={t.name}
                      className="text-slate-800 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-medium">
                        {t.name}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-cyan-700 dark:text-cyan-400 font-mono">
                        {t.perf}
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
          </div>
        )}

        {tab === "stages" && (
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              ⚙️ Этапы очистки сточных вод
            </h2>
            <ol className="space-y-3">
              {STAGES.map((s, i) => (
                <li
                  key={i}
                  className="flex gap-3 items-start bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded-lg p-3"
                >
                  <div className="flex-shrink-0 w-7 h-7 bg-cyan-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="text-xs text-cyan-900 dark:text-cyan-100 leading-relaxed pt-1">
                    {s.replace(/^\d+\.\s/, "")}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-[11px] text-amber-800 dark:text-amber-200">
              📖 Очистка идёт каскадом: каждая ступень добавляет процент. Полный цикл
              даёт сток качества «техническая вода» — для полива, мытья дорог.
            </div>
          </div>
        )}

        {tab === "esn" && (
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="font-bold mb-2 text-sm text-slate-800 dark:text-slate-200">
              💰 Применимые расценки ЭСН РК
            </div>
            <ul className="space-y-1.5 leading-relaxed list-disc list-inside">
              {ESN.map((e) => (
                <li key={e}>
                  <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                    {e}
                  </code>
                </li>
              ))}
            </ul>
            <div className="mt-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded p-2 text-[11px] text-cyan-800 dark:text-cyan-200">
              💡 Оборудование (септики, аэротанки, УФ-стерилизаторы) идёт через ССЦ
              как комплект, а не по позициям.
            </div>
          </div>
        )}

        {tab === "ex" && (
          <>
            {allDone ? (
              <div className="max-w-2xl mx-auto py-12 text-center px-4">
                <div className="text-5xl mb-3">🌊</div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  Очистные сооружения освоены!
                </h2>
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 text-left mb-4 text-xs space-y-1">
                  {STEPS.map((s) => (
                    <div key={s.id} className="flex gap-2">
                      <span className="text-emerald-500">✓</span>
                      <code className="text-[10px] font-mono">{s.vor}</code>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button
                    onClick={() => {
                      sxi(0);
                      ssi(0);
                      setInp({});
                      setRev({});
                      setDone(new Set());
                    }}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg"
                  >
                    Снова
                  </button>
                  <Link
                    href="/smeta-trainer/drawings-practice/hub"
                    className="px-4 py-2 bg-cyan-700 text-white text-sm font-semibold rounded-lg"
                  >
                    → К разделам
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex gap-1 flex-wrap">
                    {STEPS.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          sxi(i);
                          ssi(0);
                          setInp({});
                          setRev({});
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded font-semibold ${
                          i === xi
                            ? "bg-cyan-600 text-white"
                            : done.has(s.id)
                            ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {done.has(s.id) ? "✓" : i + 1}. {s.title.split(" ").slice(0, 3).join(" ")}…
                      </button>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                      Упражнение {xi + 1}: {ex.title}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                      {ex.q}
                    </p>

                    {!done.has(ex.id) ? (
                      <div
                        className={`border-2 rounded-lg p-3 ${
                          ok
                            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                            : err
                            ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                          {step.l}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={inp[k] ?? ""}
                            onChange={(e) =>
                              setInp((p) => ({ ...p, [k]: e.target.value }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && !rev[k] && go()
                            }
                            disabled={!!rev[k]}
                            placeholder="Число..."
                            className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                          />
                          {!rev[k] && (
                            <button
                              onClick={go}
                              disabled={!inp[k]?.trim()}
                              className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-semibold rounded hover:bg-cyan-700 disabled:opacity-40"
                            >
                              Проверить
                            </button>
                          )}
                        </div>
                        {rev[k] && (
                          <div
                            className={`mt-2 text-xs leading-relaxed ${
                              ok
                                ? "text-emerald-800 dark:text-emerald-300"
                                : "text-red-800 dark:text-red-300"
                            }`}
                          >
                            {ok ? "✓ " : "✗ "}
                            {step.e}
                          </div>
                        )}
                        {err && (
                          <button
                            onClick={() => {
                              setInp((p) => ({ ...p, [k]: "" }));
                              setRev((r) => ({ ...r, [k]: false }));
                            }}
                            className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 underline"
                          >
                            Попробовать снова
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 dark:border-cyan-700 rounded-lg p-3">
                        <div className="text-xs font-bold text-cyan-800 dark:text-cyan-300 mb-1">
                          ✓ Завершено
                        </div>
                        <code className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 block">
                          {ex.vor}
                        </code>
                      </div>
                    )}

                    {done.has(ex.id) && xi + 1 < STEPS.length && (
                      <button
                        onClick={() => {
                          sxi(xi + 1);
                          ssi(0);
                          setInp({});
                          setRev({});
                        }}
                        className="mt-3 w-full py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700"
                      >
                        Следующее упражнение →
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-300 dark:border-cyan-600 rounded-xl p-3 text-xs text-cyan-900 dark:text-cyan-200">
                    <div className="font-bold mb-1">💡 Помни</div>
                    <p className="leading-relaxed">
                      Очистные — отдельный комплекс работ с большим участком земли
                      (50–100 м санитарной зоны). При проектировании выноси очистные
                      ДАЛЬШЕ от жилых зданий. Иначе — жалобы и переделка.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      📐 Полезные формулы
                    </div>
                    <ul className="space-y-1 leading-relaxed">
                      <li>
                        <b>Расход:</b> Q = N × q (л/чел/сут)
                      </li>
                      <li>
                        <b>Усреднитель:</b> V = Q × t
                      </li>
                      <li>
                        <b>Сан. зона:</b> S = π·R² (R по СНиП)
                      </li>
                      <li>
                        <b>Норма:</b> жильё 150–180, гост. 200–250 л/чел/сут
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-700 dark:text-slate-300">
                    <div className="font-bold mb-1.5 text-xs text-slate-800 dark:text-slate-200">
                      💰 Расценки ЭСН
                    </div>
                    <ul className="space-y-1 leading-relaxed">
                      {ESN.map((e) => (
                        <li key={e}>
                          <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                            {e}
                          </code>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
