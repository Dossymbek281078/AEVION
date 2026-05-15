"use client";

import Link from "next/link";
import { useState } from "react";

// ── Сценарии ошибок ──────────────────────────────────────────────────────────

interface VorRow {
  id: string;
  num: number;
  name: string;
  unit: string;
  formula: string;
  value: string;
  isError: boolean;
  errorExplanation: string;
  /** Краткая подсказка, видна при hover */
  hint?: string;
}

interface ErrorScenario {
  id: string;
  title: string;
  context: string;
  drawing: "plan" | "section" | "facade";
  vorRows: VorRow[];
  /** Пояснение правильного расчёта */
  correctExplanation: string;
  /** Нормативная ссылка */
  normRef: string;
}

const SCENARIOS: ErrorScenario[] = [
  {
    id: "s1-openings",
    title: "Ошибка в штукатурке стен: не вычли проёмы",
    context: "ВОР на отделку класса К-201 (6.0 × 8.5 м, h=3.2 м, 2 окна 1.5×1.8 м, 1 дверь 0.9×2.1 м). Одна строка составлена неверно — найди её.",
    drawing: "plan",
    vorRows: [
      { id: "r1", num: 1, name: "Площадь пола (линолеум)", unit: "м²", formula: "8.5×6.0", value: "51.0", isError: false, errorExplanation: "", hint: "Для пола проёмы не вычитают" },
      { id: "r2", num: 2, name: "Штукатурка стен по маякам", unit: "м²", formula: "2×(8.5+6.0)×3.2", value: "92.8", isError: true, errorExplanation: "Бруто без вычета проёмов. Правильно: 92.8 − 2×(1.5×1.8) − 0.9×2.1 = 92.8 − 5.4 − 1.89 = 85.5 м²", hint: "Что нужно вычесть из площади стен?" },
      { id: "r3", num: 3, name: "Окраска потолка", unit: "м²", formula: "8.5×6.0", value: "51.0", isError: false, errorExplanation: "", hint: "Потолок — площадь в плане, проёмов нет" },
      { id: "r4", num: 4, name: "Замена дверного блока", unit: "шт", formula: "1 дверь", value: "1", isError: false, errorExplanation: "", hint: "Количество дверей — простой счёт" },
    ],
    correctExplanation: "Строка №2 (штукатурка стен) рассчитана «бруто» — без вычета площади окон и двери. Из площади стен ОБЯЗАТЕЛЬНО вычитать оконные и дверные проёмы. Это типичная ошибка начинающих: легко забыть, тем более что для ПОЛА и ПОТОЛКА проёмы НЕ вычитаются.",
    normRef: "СНиП РК 1.02-18-2004, п. 5.3 — подсчёт объёмов отделочных работ",
  },
  {
    id: "s2-axes",
    title: "Ошибка в объёме бетона: взяли ось вместо чистого размера",
    context: "ВОР на фундамент: ленточный монолитный фундамент, сечение 0.6 × 0.8 м (ш × г), длина по оси 28.0 м, угловые пересечения — 4 угла. Найди ошибочную строку.",
    drawing: "section",
    vorRows: [
      { id: "r1", num: 1, name: "Опалубка фундамента (боков. поверхность)", unit: "м²", formula: "2×0.8×28.0", value: "44.8", isError: false, errorExplanation: "", hint: "Боковые грани × высоту × длину — без пересечений угловые не дублируют" },
      { id: "r2", num: 2, name: "Бетон фундамента В20", unit: "м³", formula: "0.6×0.8×28.0", value: "13.44", isError: true, errorExplanation: "Длина 28.0 м — это периметр по оси. Не учтены угловые нахлёсты: на каждом углу секция двойного счёта. Правильно: длина по наружной грани = 28.0 + 4×0.6 = 30.4 м... нет, правильный подход — суммировать по фактическим осям без пересечений. Для L-образного плана 4 угла × 0.6×0.6×0.8 = 0.58 м³ накладки. Либо считать «вдоль и поперёк» без пересечений по средней оси.", hint: "Углы при подсчёте по оси дают двойной счёт" },
      { id: "r3", num: 3, name: "Арматура Ø12 рабочая", unit: "т", formula: "≈ 80 кг/м³ × 13.44 м³", value: "1.08", isError: false, errorExplanation: "", hint: "Расход арматуры считают от объёма бетона — 80 кг/м³ норма" },
      { id: "r4", num: 4, name: "Гидроизоляция подошвы", unit: "м²", formula: "0.6×28.0", value: "16.8", isError: false, errorExplanation: "", hint: "Ширина подошвы × длина по оси — приемлемо (погрешность мала)" },
    ],
    correctExplanation: "При подсчёте объёма ленточного фундамента по осевой длине углы считаются дважды. Правильно: суммировать оси «вдоль» + «поперёк» без пересечений, или вычесть пересечения вручную: 4 угла × ш × ш × h = 4 × 0.6 × 0.6 × 0.8 = 0.58 м³. Итого: 13.44 − 0.58 = 12.86 м³. Ошибка ≈ 4.5% — эксперт поймает.",
    normRef: "НДЦС РК 8.01-08-2022, Прил. Б — подсчёт объёмов бетонных работ",
  },
  {
    id: "s3-slope",
    title: "Ошибка в кровле: не применили коэффициент уклона",
    context: "ВОР на кровлю: скатная 2-х пролётная, каждый скат 10.0 × 32.0 м в проекции, уклон 15°. Найди ошибочную строку.",
    drawing: "facade",
    vorRows: [
      { id: "r1", num: 1, name: "Демонтаж старого кровельного ковра", unit: "м²", formula: "2×10.0×32.0×1.035", value: "662.4", isError: false, errorExplanation: "", hint: "Демонтаж уже правильно с коэффициентом уклона" },
      { id: "r2", num: 2, name: "Утеплитель кровли (PIR 120 мм)", unit: "м²", formula: "2×10.0×32.0", value: "640.0", isError: true, errorExplanation: "Утеплитель монтируется по ФАКТИЧЕСКОЙ наклонной поверхности, а не по проекции. Правильно: 2 × 10.0 × 32.0 × 1.035 = 662.4 м².", hint: "Утеплитель кладут по наклонной — нужен коэф. уклона" },
      { id: "r3", num: 3, name: "Кровельная мембрана", unit: "м²", formula: "2×10.0×32.0×1.035", value: "662.4", isError: false, errorExplanation: "", hint: "Мембрана правильно с коэффициентом" },
      { id: "r4", num: 4, name: "Конёк кровли (металлический)", unit: "м.п.", formula: "32.0", value: "32.0", isError: false, errorExplanation: "", hint: "Конёк — длина по горизонтали, коэффициент не нужен" },
    ],
    correctExplanation: "Утеплитель (строка №2) посчитан по горизонтальной проекции (640 м²), тогда как монтируется он по наклонному основанию. Для уклона 15° К=1.035. Ошибка: 640 вместо 662.4 м² — занижение на 3.5%. При стоимости PIR ~4500 ₸/м² это ≈ 100 000 ₸. Интересно, что демонтаж (строка №1) и мембрана (строка №3) правильно посчитаны с коэффициентом — сметчик применил его избирательно.",
    normRef: "СН РК 8.02-09 — коэффициенты на уклон при кровельных работах",
  },
];

// ── Мини-SVG для визуализации ошибки ────────────────────────────────────────

function ScenarioIcon({ drawing }: { drawing: "plan" | "section" | "facade" }) {
  if (drawing === "plan") return (
    <svg viewBox="0 0 80 60" className="w-full h-auto opacity-60">
      <rect x="5" y="5" width="55" height="40" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
      <rect x="10" y="10" width="10" height="6" fill="#e0f2fe" stroke="#3b82f6" strokeWidth="1" />
      <rect x="25" y="10" width="10" height="6" fill="#e0f2fe" stroke="#3b82f6" strokeWidth="1" />
      <rect x="28" y="40" width="7" height="5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
      <text x="30" y="28" textAnchor="middle" fontSize="6" fill="#475569">К-201</text>
    </svg>
  );
  if (drawing === "section") return (
    <svg viewBox="0 0 80 60" className="w-full h-auto opacity-60">
      <rect x="5" y="40" width="70" height="10" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <rect x="5" y="5" width="3" height="35" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
      <rect x="72" y="5" width="3" height="35" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
      <line x1="5" y1="5" x2="75" y2="5" stroke="#64748b" strokeWidth="1" />
    </svg>
  );
  return (
    <svg viewBox="0 0 80 60" className="w-full h-auto opacity-60">
      <rect x="5" y="5" width="70" height="50" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
      {[0,1,2,3].map(i => [0,1].map(j => (
        <rect key={`${i}-${j}`} x={10+i*16} y={10+j*22} width={10} height={14} fill="#e0f2fe" stroke="#3b82f6" strokeWidth={1} />
      )))}
    </svg>
  );
}

// ── Компонент ────────────────────────────────────────────────────────────────

export default function FindErrorPage() {
  const [scIdx, setScIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  const sc = SCENARIOS[scIdx];
  const pickedRow = sc.vorRows.find((r) => r.id === picked);
  const isCorrect = checked && pickedRow?.isError === true;
  const isWrong   = checked && pickedRow?.isError === false;

  function handleCheck() {
    if (!picked) return;
    setChecked(true);
    if (pickedRow?.isError) {
      setTimeout(() => setDone((d) => new Set([...d, sc.id])), 800);
    }
  }

  function nextScenario() {
    if (scIdx + 1 < SCENARIOS.length) {
      setScIdx(scIdx + 1);
      setPicked(null);
      setChecked(false);
    }
  }

  const allDone = done.size === SCENARIOS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-red-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice" className="text-xs text-red-200 hover:text-white">
            ← К чертежам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🔍 Найди ошибку в ВОР — Уровень 5</h1>
            <p className="text-[10px] text-red-200">
              В каждом ВОР одна строка рассчитана неверно. Найди её и объясни почему.
            </p>
          </div>
          <div className="text-xs text-red-200">{done.size}/{SCENARIOS.length}</div>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-6xl mb-4">🕵️</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Все ошибки найдены!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Три типичные ошибки сметчика: бруто без вычета проёмов, осевые размеры
            с двойным счётом угла, уклон без коэффициента. Теперь вы видите их в чужих сметах.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { setScIdx(0); setPicked(null); setChecked(false); setDone(new Set()); }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg">
              Пройти снова
            </button>
            <Link href="/smeta-trainer/level/5"
              className="px-4 py-2 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-800">
              → Уровень 5 — Экспертиза
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {/* Scenario tabs */}
          <div className="flex gap-2">
            {SCENARIOS.map((s, i) => (
              <button key={s.id} onClick={() => { setScIdx(i); setPicked(null); setChecked(false); }}
                className={`text-[10px] px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  i === scIdx ? "bg-red-700 text-white"
                    : done.has(s.id) ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}>
                {done.has(s.id) ? "✓ " : ""}Сценарий {i + 1}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Drawing preview */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Чертёж (схема)</div>
              <ScenarioIcon drawing={sc.drawing} />
              <div className="mt-2 text-[10px] text-slate-500 italic text-center">
                {sc.context.split(".")[0]}.
              </div>
            </div>

            {/* VOR table */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{sc.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">{sc.context}</p>

              <div className="text-xs font-bold text-slate-500 uppercase mb-2">
                ВОР — кликни на строку с ошибкой:
              </div>

              <div className="space-y-1.5">
                {sc.vorRows.map((row) => {
                  const isSelected = picked === row.id;
                  const showError = checked && isSelected && row.isError;
                  const showMiss  = checked && isSelected && !row.isError;
                  const showCorrect = checked && !isSelected && row.isError;

                  return (
                    <button
                      key={row.id}
                      onClick={() => !checked && setPicked(row.id)}
                      disabled={checked}
                      title={row.hint}
                      className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors text-xs ${
                        showError   ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                          : showMiss ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                            : showCorrect ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                              : isSelected ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                : "border-slate-200 dark:border-slate-700 hover:border-red-300"
                      } ${checked ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          showError ? "bg-emerald-500 text-white"
                            : showMiss ? "bg-red-500 text-white"
                              : showCorrect ? "bg-amber-500 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}>{row.num}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-mono text-emerald-700 dark:text-emerald-400">{row.formula}</span>
                            {" = "}
                            <span className={`font-mono font-bold ${
                              (showError || showCorrect) ? "text-red-600 dark:text-red-400 line-through" : "text-slate-700 dark:text-slate-300"
                            }`}>{row.value} {row.unit}</span>
                          </div>
                          {showError && (
                            <div className="mt-1 text-[10px] text-red-700 dark:text-red-300 font-semibold">
                              ⚠ Верно нашли! {row.errorExplanation}
                            </div>
                          )}
                          {showMiss && (
                            <div className="mt-1 text-[10px] text-orange-700 dark:text-orange-300">
                              Эта строка правильная. {row.hint}
                            </div>
                          )}
                          {showCorrect && (
                            <div className="mt-1 text-[10px] text-amber-800 dark:text-amber-300 font-semibold">
                              ← Вот где ошибка!
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!checked ? (
                <button onClick={handleCheck} disabled={!picked}
                  className="mt-3 w-full py-2 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 disabled:opacity-40">
                  Проверить выбор
                </button>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className={`p-3 rounded-lg border-2 text-xs leading-relaxed ${
                    isCorrect ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
                      : "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
                  }`}>
                    <div className="font-bold mb-1">
                      {isCorrect ? "✓ Правильно нашли ошибку!" : "✗ Не та строка. Смотри правильный ответ:"}
                    </div>
                    {sc.correctExplanation}
                    <div className="mt-1.5 text-[10px] italic opacity-70">📖 {sc.normRef}</div>
                  </div>

                  {isCorrect && scIdx + 1 < SCENARIOS.length && (
                    <button onClick={nextScenario}
                      className="w-full py-2 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800">
                      Следующий сценарий →
                    </button>
                  )}
                  {!isCorrect && (
                    <button onClick={() => { setPicked(null); setChecked(false); }}
                      className="w-full py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600">
                      Попробовать снова
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
