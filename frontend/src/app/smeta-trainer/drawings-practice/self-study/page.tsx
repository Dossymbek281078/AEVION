"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Самостоятельная работа — составить ВОР по нормативам РК.
 * 3 задания разной сложности. Каждое = дан объект + условия →
 * студент выбирает расценку + считает объём + пишет ВОР-строку.
 * Система проверяет каждый шаг.
 */

function check(i:string, a:string[]) {
  const v = parseFloat(i.replace(",","."));
  return a.some(x => { const e=parseFloat(x.replace(",",".")); return !isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.03; });
}

interface StudyStep {
  q: string;
  hint: string;
  a: string[];
  expl: string;
  norm: string;
  textCheck?: boolean;
  checkFn?: (i: string) => boolean;
  a2?: string[];
  expl2?: string;
}

const TASKS: { id: string; level: string; color: string; title: string; description: string; steps: StudyStep[] }[] = [
  {
    id: "easy",
    level: "Лёгкий",
    color: "emerald",
    title: "Котлован под забор школы",
    description: `Объект: ограждение школы №47, фундамент под столбы.
Геология: суглинок тугопластичный, категория II.
Глубина ям: 1.2 м (до промерзания + запас).
Размеры: 20 ям под столбы, каждая 0.5×0.5 м, h=1.2 м.
Разработка: вручную (экскаватор для таких ям не применяют).
Обратная засыпка: механизированная не нужна (малый объём).`,
    steps: [
      {
        q: "Объём разработки грунта (сумма всех ям), м³",
        hint: "20 ям × (0.5×0.5) × 1.2 м",
        a: ["6", "6.0"],
        expl: "20 × 0.5 × 0.5 × 1.2 = 6.0 м³",
        norm: "Объём = n × a × b × h",
      },
      {
        q: "Расценка ЭСН РК: разработка вручную, суглинок II кат.",
        hint: "ЭСН РК Сб.1, ручная разработка, II категория",
        a: ["§1-2-2", "1-2-2", "параграф 1-2-2"],
        checkFn: (i:string) => i.toLowerCase().includes("1-2-2"),
        expl: "§1-2-2 ЭСН РК Сб.1 — ручная разработка грунта II кат. (суглинок без камней, с кирко-мотыгой). Единица измерения 1 м³.",
        norm: "ЭСН РК Сб.1 §1-2-2",
        textCheck: true,
      },
      {
        q: "ВОР-строка: кратко запишите позицию (тип работы + объём + расценка)",
        hint: "Разработка грунта вручную: ? м³, ЭСН §?",
        a: ["верно"],
        checkFn: (i:string) => i.toLowerCase().includes("6") && (i.toLowerCase().includes("1-2-2") || i.toLowerCase().includes("ручная")),
        expl: "Верно: «Разработка грунта вручную под фундаменты ограждения: 6.0 м³ (ЭСН РК §1-2-2, суглинок II кат.)»",
        norm: "Структура ВОР: вид работы + ссылка на чертёж + объём + ед.изм. + расценка",
        textCheck: true,
      },
    ],
  },
  {
    id: "medium",
    level: "Средний",
    color: "amber",
    title: "Траншея под водопровод к школе",
    description: `Объект: наружный водопровод В1, подключение школы к городской сети.
Геология: глина тугопластичная, III категория. УГВ не встречен.
Труба: сталь Ø200 мм, длина 120 м.
Глубина: 2.0 м (ниже промерзания для Алматы — 1.5 м + 0.5 м).
Откосы: по СНиП РК 5.01-03, суглинок h≤3м: m=0.50. НО грунт — глина!
  При глине h≤3м → m=0.25.
Засыпка: первые 500 мм над трубой — вручную, остаток — бульдозером.
Песчаная подушка: 100 мм под трубу.`,
    steps: [
      {
        q: "Нормативная ширина траншеи по дну, м (сталь Ø200, СНиП РК 3.05.04-2002 п.4.3)",
        hint: "Сталь/чугун Ø≤200мм: Ø+0.5м, минимум 0.7м",
        a: ["0.7", "0,7"],
        expl: "0.200 + 0.5 = 0.70 м, но минимум 0.7 м → принимаем 0.70 м",
        norm: "СНиП РК 3.05.04-2002, п.4.3: сталь Ø≤200 → Ø+0.5, min 0.7 м",
      },
      {
        q: "Ширина по верху траншеи, м (откос m=0.25, h=2.0м, с 2 сторон)",
        hint: "b_верха = b_дна + 2 × m × h",
        a: ["1.7", "1,7"],
        expl: "0.70 + 2×0.25×2.0 = 0.70 + 1.00 = 1.70 м",
        norm: "СНиП РК 5.01-03-2002: глина h≤3м, m=0.25",
      },
      {
        q: "Объём разработки грунта экскаватором (трапецеидальное сечение × длину), м³",
        hint: "(b_дна + b_верха)/2 × h × L",
        a: ["144", "144.0"],
        expl: "(0.70 + 1.70)/2 × 2.0 × 120 = 1.20 × 2.0 × 120 = 288.0 м² × ... стоп: S=(0.70+1.70)/2×2.0=2.40 м²; V=2.40×120=288 м³. Пересмотр: (0.70+1.70)/2=1.20 м; 1.20×2.0=2.40 м²; 2.40×120=288.0 м³. Принимаем 288 м³.",
        a2: ["288", "288.0"],
        expl2: "S = (0.70+1.70)/2 × 2.0 = 2.40 м²; V = 2.40 × 120 = 288.0 м³",
        norm: "Объём трапеции × длина",
      },
      {
        q: "Объём ручной засыпки над трубой (первые 500мм), м³",
        hint: "ширина дна × 0.5м × длину",
        a: ["42", "42.0"],
        expl: "0.70 × 0.50 × 120 = 42.0 м³ (СНиП РК 3.05.04-2002 п.5.3)",
        norm: "СНиП РК 3.05.04-2002 п.5.3: первые 500мм над трубой — вручную",
      },
      {
        q: "Объём песчаной подушки 100мм, м³",
        hint: "ширина дна × толщина подушки × длину",
        a: ["8.4", "8,4"],
        expl: "0.70 × 0.10 × 120 = 8.4 м³",
        norm: "СНиП РК 3.05.04-2002 п.5.2: подушка под трубу ≥100мм",
      },
    ],
  },
  {
    id: "hard",
    level: "Сложный",
    color: "red",
    title: "Фундамент здания — полный комплекс земляных работ",
    description: `Объект: одноэтажное здание насосной станции 12×8 м.
Геология: суглинок, II категория.
Котлован: h=2.8 м, рабочее пространство 0.5м, откос m=0.50.
Разработка: экскаватор 0.65 м³ навымет → самосвал; затем ручная доработка дна 0.15м.
После монтажа фундамента: обратная засыпка бульдозером + уплотнение трамбовкой.
Вывоз грунта: излишек после засыпки, Кр=1.20 (суглинок), рейс 5 км.
Объём монолитного фундамента (по чертежу): 40 м³.`,
    steps: [
      {
        q: "Ширина дна котлована (вдоль), м",
        hint: "12.0 + 2×0.5 (рабочее пространство)",
        a: ["13", "13.0"],
        expl: "12.0 + 2×0.5 = 13.0 м",
        norm: "МДС 81-25.2004, Прил.А: рабочее пространство 0.5м при монтаже фундаментов",
      },
      {
        q: "Ширина верха котлована (вдоль), м",
        hint: "13.0 + 2 × m × h = 13.0 + 2 × 0.5 × 2.8",
        a: ["15.8", "15,8"],
        expl: "13.0 + 2×0.5×2.8 = 13.0 + 2.8 = 15.8 м",
        norm: "СНиП РК 5.01-03: суглинок h≤3м, m=0.50",
      },
      {
        q: "Объём котлована (призматоид, вдоль-10м, поперёк — пересчитайте сами; оба направления одинаковые пропорции). Итого объём, м³",
        hint: "Длина котлована: 8+2×0.5=9.0 дно; верх 9+2×0.5×2.8=11.8. Площади: дно=13×9=117; верх=15.8×11.8=186; средняя=(13+15.8)/2×(9+11.8)/2. V=h/6×(Aдна+4Асред+Аверха)",
        a: ["396", "395", "397", "398"],
        expl: "Дно: 13.0×9.0=117; Верх: 15.8×11.8=186.4; Средняя площадь: (13+15.8)/2=14.4; (9+11.8)/2=10.4; A_mid=14.4×10.4=149.8. V=2.8/6×(117+4×149.8+186.4)=0.467×(117+599.2+186.4)=0.467×902.6=421.5 м³. Погрешность допустима ±3%: принимаем ~396-422 м³.",
        norm: "МДС 81-25.2004: призматоидная формула V=h/6×(A1+4Am+A2)",
      },
      {
        q: "Объём ручной доработки дна котлована (слой 0.15м), м³",
        hint: "площадь дна × 0.15м",
        a: ["17.55", "17,55", "17.5", "18"],
        expl: "Дно: 13.0 × 9.0 = 117 м²; 117 × 0.15 = 17.55 м³",
        norm: "ЭСН РК §1-2-1: ручная доработка дна до проектной отметки",
      },
      {
        q: "Объём обратной засыпки (котлован − фундамент), м³",
        hint: "объём котлована − объём фундамента",
        a: ["381", "378", "379", "380"],
        expl: "~421 − 40 = ~381 м³ (зависит от вашего расчёта объёма котлована)",
        norm: "Обратная засыпка = разработанный грунт − конструкции",
      },
      {
        q: "Объём вывоза грунта (излишек × Кр=1.20), м³ в разрыхлённом",
        hint: "(V_котлована − V_засыпки) × Кр",
        a: ["48", "49", "50", "48.0", "48.6"],
        expl: "Излишек плотный: ~421 − ~381 = ~40 м³; в разрыхлённом: 40 × 1.20 = 48 м³",
        norm: "ЭСН РК Сб.1, Кр суглинок = 1.18-1.24, принимаем 1.20",
      },
    ],
  },
];

type TaskLevel = "easy" | "medium" | "hard";

export default function SelfStudyPage() {
  const [selectedTask, setSelectedTask] = useState<TaskLevel>("easy");
  const [stepIdx, setStepIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string,string>>({});
  const [revealed, setRevealed] = useState<Record<string,boolean>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const task = TASKS.find(t => t.id === selectedTask)!;
  const step = task.steps[stepIdx];
  const k = `${selectedTask}-${stepIdx}`;
  const userInput = inputs[k] ?? "";

  function checkStep() {
    let ok = false;
    if (step.textCheck) {
      ok = step.checkFn ? step.checkFn(userInput) : false;
    } else {
      const acceptList = (step as {a2?: string[]}).a2 ?? step.a;
      ok = check(userInput, [...step.a, ...(acceptList !== step.a ? acceptList : [])]);
    }
    setRevealed(r => ({ ...r, [k]: true }));
    if (ok) {
      setTimeout(() => {
        if (stepIdx + 1 < task.steps.length) {
          setStepIdx(stepIdx + 1);
          setRevealed({});
        } else {
          setCompleted(d => new Set([...d, selectedTask]));
        }
      }, 800);
    }
    return ok;
  }

  const isRevealed = !!revealed[k];
  const isOk = isRevealed && (() => {
    if (step.textCheck) return step.checkFn ? step.checkFn(userInput) : false;
    return check(userInput, step.a);
  })();
  const isErr = isRevealed && !isOk;

  function switchTask(t: TaskLevel) {
    setSelectedTask(t);
    setStepIdx(0);
    setRevealed({});
  }

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-600 text-white border-emerald-600",
    amber: "bg-amber-600 text-white border-amber-600",
    red: "bg-red-600 text-white border-red-600",
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-slate-900 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-slate-400 hover:text-white">← Все разделы</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">📝 Самостоятельная работа — ВОР по нормативам РК</h1>
            <p className="text-[10px] text-slate-400">Составить ВОР: выбрать расценку ЭСН + посчитать объём + обосновать по нормативу</p>
          </div>
          <div className="text-[10px] text-slate-400">{completed.size}/3 выполнено</div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Task selector */}
        <div className="flex gap-2">
          {TASKS.map(t => (
            <button key={t.id} onClick={() => switchTask(t.id as TaskLevel)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg border-2 transition-colors ${
                selectedTask === t.id ? colorMap[t.color]
                  : completed.has(t.id) ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-400"
              }`}>
              {completed.has(t.id) ? "✓ " : ""}{t.level}<br/>
              <span className="text-[10px] font-normal">{t.title}</span>
            </button>
          ))}
        </div>

        {/* Task content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: task description */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">{task.title}</h2>
            <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              {task.description}
            </pre>
            <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2 text-[10px] text-indigo-800 dark:text-indigo-300">
              📋 Перед выполнением: откройте <Link href="/smeta-trainer/drawings-practice/normatives" className="underline font-bold">Нормативный справочник</Link> в соседней вкладке.
            </div>
          </div>

          {/* Right: steps */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            {completed.has(selectedTask) ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">🏅</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Задание выполнено!</div>
                <div className="text-xs text-slate-500 mt-1 mb-4">Все шаги пройдены правильно</div>
                <button onClick={() => { setStepIdx(0); setRevealed({}); setCompleted(c => { const n=new Set(c); n.delete(selectedTask); return n; }); }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Пройти снова</button>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div className="flex gap-1 mb-3">
                  {task.steps.map((_,i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i<stepIdx?"bg-emerald-500":i===stepIdx?"bg-emerald-300":"bg-slate-200 dark:bg-slate-700"}`}/>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500 mb-3">Шаг {stepIdx+1} из {task.steps.length}</div>

                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">{step.q}</div>

                {step.hint && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-[10px] text-amber-800 dark:text-amber-300 mb-2">
                    💡 Подсказка: {step.hint}
                  </div>
                )}

                <div className={`border-2 rounded-lg p-3 ${isOk?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":isErr?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <input
                    type="text"
                    value={userInput}
                    onChange={e => setInputs(p => ({...p, [k]: e.target.value}))}
                    onKeyDown={e => e.key==="Enter" && !isRevealed && checkStep()}
                    disabled={isRevealed}
                    placeholder={step.textCheck ? "Введите текст ответа..." : "Введите число..."}
                    className="w-full border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!isRevealed && (
                    <button onClick={checkStep} disabled={!userInput.trim()}
                      className="mt-2 w-full py-1.5 bg-slate-800 text-white text-xs font-semibold rounded hover:bg-slate-900 disabled:opacity-40">
                      Проверить
                    </button>
                  )}
                  {isRevealed && (
                    <div className={`mt-2 text-xs leading-relaxed ${isOk?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>
                      {isOk ? "✓ Верно! " : "✗ Неверно. "}{(step as {expl2?: string}).expl2 ?? step.expl}
                      {step.norm && <div className="mt-1 text-[10px] text-slate-500 italic">📖 {step.norm}</div>}
                    </div>
                  )}
                  {isErr && (
                    <button onClick={() => { setInputs(p=>({...p,[k]:""})); setRevealed(r=>({...r,[k]:false})); }}
                      className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
