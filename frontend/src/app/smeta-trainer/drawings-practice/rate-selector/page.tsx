"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Интерактивный задачник «Выбери правильную расценку ЭСН РК».
 * Студент читает условие → выбирает расценку → получает обоснование.
 * Источник: ЭСН РК Сборник 1 «Земляные работы».
 */

interface Task {
  id: string;
  title: string;
  scenario: string;
  hint: string;
  options: {
    code: string;
    label: string;
    correct: boolean;
    explanation: string;
  }[];
  afterText: string;
  normRef: string;
}

const TASKS: Task[] = [
  {
    id: "t1",
    title: "Котлован под фундамент школы",
    scenario: `Задание: Требуется разработать котлован под монолитный фундамент здания школы.
Условия:
• Грунт — суглинок, инженерно-геологический отчёт: категория II
• Глубина котлована: 2.5 м
• Объём: 361 м³
• Разработка экскаватором с погрузкой в самосвалы
• Ёмкость ковша экскаватора: 0.65 м³
• Без подземных вод

Какую расценку ЭСН РК Сб.1 выбрать на разработку котлована?`,
    hint: "Определите: тип работ (котлован), механизм (экскаватор, ёмкость ковша), категорию грунта.",
    options: [
      { code: "ЭСН 1-1-2", label: "§1-1-2: Котлован, экскаватор 0.65 м³, грунт I кат.", correct: false, explanation: "Неверно: грунт II категории, не I. Расценки строго по категории — при II кат. нормы дольше/дороже." },
      { code: "ЭСН 1-1-11", label: "§1-1-11: Котлован, экскаватор 0.65 м³, грунт II кат.", correct: true, explanation: "✓ Верно! §1-1-11 ЭСН РК: котлован/траншея, экскаватор 0.65 м³, грунт II кат. Суглинок относится к II категории. Ёмкость ковша 0.65 м³." },
      { code: "ЭСН 1-1-30", label: "§1-1-30: Котлован, скрепер, II кат.", correct: false, explanation: "Неверно: скрепер — для больших перемещений 50-5000 м. Задача — погрузка в самосвал, значит экскаватор." },
      { code: "ЭСН 1-2-3", label: "§1-2-3: Разработка вручную, III кат.", correct: false, explanation: "Неверно: задана механизированная разработка экскаватором. Ручная разработка — только для доработки после экскаватора." },
    ],
    afterText: "После разработки котлована всегда добавляйте: §1-2-1 (ручная доработка дна) и §1-1-xx (обратная засыпка с уплотнением). Это три отдельные позиции ЛСР.",
    normRef: "ЭСН РК Сб.1, §1-1-11; ГОСТ 25100 (суглинок II кат.)",
  },
  {
    id: "t2",
    title: "Траншея под канализационный коллектор",
    scenario: `Задание: Прокладка самотёчного канализационного коллектора из ж/б труб Ø600 мм.
Условия:
• Грунт — глина тугопластичная, категория III
• Глубина траншеи: 3.5 м
• Длина: 220 м
• Разработка одноковшовым экскаватором 1.0 м³
• Стенки без крепления (откосы m=0.25 при глине, h=3.5 м)
• Транспортировка грунта в отвал (50 м)

Какую расценку применить?`,
    hint: "Траншея ≠ котлован. Обратите внимание на категорию и ёмкость ковша.",
    options: [
      { code: "ЭСН 1-1-11", label: "§1-1-11: Траншея, экскаватор 0.65 м³, грунт II кат.", correct: false, explanation: "Неверно сразу два параметра: ёмкость ковша 1.0 м³ (не 0.65), категория грунта III (не II). Расценка не совпадает." },
      { code: "ЭСН 1-1-25", label: "§1-1-25: Траншея, экскаватор 1.0 м³, грунт III кат.", correct: true, explanation: "✓ Верно! Глина тугопластичная — III категория. Экскаватор 1.0 м³ — §1-1-25 охватывает траншеи при ёмкости 1.0 м³ и III кат. Грунт в отвал на 50 м — включено в расценку." },
      { code: "ЭСН 1-1-19", label: "§1-1-19: Котлован, экскаватор 1.0 м³, грунт II кат.", correct: false, explanation: "Неверно: это котлован, а не траншея (разные расценки). Категория тоже указана неверно (II, а не III)." },
      { code: "ЭСН 1-1-40", label: "§1-1-40: Скрепер, III кат., перемещение 200 м", correct: false, explanation: "Скрепер работает при перемещении 50-5000 м, но задача — траншея узкая под трубу Ø600. Скрепер не используют для траншей под трубопроводы." },
    ],
    afterText: "После выбора §1-1-25 нужно добавить: §1-2-x (засыпка с уплотнением), §1-3-x (песчаная подушка), и учесть коэффициент за работу в котловане глубиной >3м из ЭСН РК Общая часть.",
    normRef: "ЭСН РК Сб.1, §1-1-25; ГОСТ 25100 (глина тугопластичная — III кат.); СНиП РК 3.05.04-2002 (ширина траншеи Ø600 ж/б = 1.8 м)",
  },
  {
    id: "t3",
    title: "Разработка грунта с водоотливом",
    scenario: `Задание: Котлован под насосную станцию. Уровень грунтовых вод — на 0.8 м выше дна котлована.
Условия:
• Грунт — песок средний, категория I
• Глубина: 4.0 м
• Объём: 560 м³
• Экскаватор 0.4 м³
• Необходим водоотлив открытым способом (насос)

Как правильно учесть водоотлив?`,
    hint: "Водоотлив — ОТДЕЛЬНАЯ позиция ЛСР, не входит в расценку на разработку грунта.",
    options: [
      { code: "Включить в §1-1-3",  label: "Увеличить расценку §1-1-3 на 30% за воду", correct: false, explanation: "Неверный подход. Нельзя самостоятельно повышать расценку. Водоотлив учитывается отдельной позицией." },
      { code: "§1-1-3 + §1-6-x", label: "§1-1-3 (экскаватор 0.4 м³, I кат.) + §1-6-x (водоотлив насосом)", correct: true, explanation: "✓ Верно! Разработка грунта — §1-1-3 (без учёта воды), водоотлив насосом — ЭСН РК §1-6-x (по часам работы насоса или м³ откачанной воды). Это две разные позиции в смете." },
      { code: "§1-2-4 вручную",     label: "Разработка вручную §1-2-4 — в воде безопаснее", correct: false, explanation: "Ручная разработка под водой — крайне редкий случай. Для 560 м³ — нереально и экономически абсурдно. Применяется экскаватор + водоотлив." },
      { code: "§1-1-3 × K=1.30",   label: "§1-1-3 с коэффициентом 1.30 (вода из ОЧ)", correct: false, explanation: "В ЭСН РК Общей части нет прямого коэффициента на воду для экскаватора. Водоотлив — всегда отдельная позиция. Коэффициент на ручную разработку под водой — есть, но не для механической." },
    ],
    afterText: "Водоотлив §1-6 рассчитывается: объём откаченной воды = площадь котлована × высота водяного слоя + приток за время работ. Мощность насоса — по расчёту гидрогеолога.",
    normRef: "ЭСН РК Сб.1 §1-6; ЭСН РК Общая часть п.8 (водоотлив); СП РК 5.01-102-2013 (водопонижение)",
  },
  {
    id: "t4",
    title: "Обратная засыпка котлована с уплотнением",
    scenario: `Задание: После монтажа фундаментов необходимо выполнить обратную засыпку котлована.
Условия:
• Объём засыпки в плотном теле: 280 м³
• Грунт — суглинок (тот же, что вынули), категория II
• Уплотнение трамбовочной машиной (прицепная трамбовка)
• Слои по 200 мм

Какие позиции ЛСР нужны?`,
    hint: "Обратная засыпка — не одна позиция. Разделите: подвоз/разравнивание + уплотнение.",
    options: [
      { code: "Только §1-1-11", label: "§1-1-11 (экскаватор обратно бросает грунт) — одна позиция", correct: false, explanation: "Экскаватор не уплотняет. Засыпать и уплотнить — разные операции с разными расценками. §1-1-11 — только разработка, не засыпка." },
      { code: "§1-1-62 + §1-2-9", label: "§1-1-62 Засыпка пазух бульдозером + §1-2-9 Уплотнение трамбовочной машиной", correct: true, explanation: "✓ Верно! Засыпка с разравниванием бульдозером — §1-1-62. Уплотнение трамбовкой — §1-2-9 (прицепная трамбовочная машина). Две позиции — два ресурса." },
      { code: "§1-2-3 вручную",   label: "§1-2-3 Ручная засыпка III кат. — безопаснее для фундамента", correct: false, explanation: "280 м³ вручную — нереально. Ручная доработка — только для примыканий к конструкциям (50-100 мм слой у стен). Основной объём — механизмом." },
      { code: "§1-2-1 + §1-2-9",  label: "§1-2-1 Ручная доработка + §1-2-9 Уплотнение", correct: false, explanation: "Ручная доработка §1-2-1 — для зачистки дна котлована после экскаватора (обычно 50-100 мм). Для засыпки 280 м³ — бульдозер §1-1-62." },
    ],
    afterText: "Итого 3 позиции по земляным работам на этот котлован: разработка §1-1-11 + ручная доработка §1-2-1 + засыпка §1-1-62 + уплотнение §1-2-9. Это стандартный набор.",
    normRef: "ЭСН РК Сб.1 §1-1-62 (засыпка); §1-2-9 (уплотнение трамбовкой); СНиП РК 5.01-03-2002 п.7 (требования к уплотнению)",
  },
  {
    id: "t5",
    title: "Разработка скального грунта",
    scenario: `Задание: Котлован под фундамент в горной части РК. Геология — известняк трещиноватый.
Условия:
• Грунт — скала слаборазрушенная, категория IV
• Требуется предварительное рыхление буровзрывным способом
• Глубина 1.5 м, объём 200 м³

Какой правильный порядок расценок?`,
    hint: "Скала — сначала рыхление, потом экскаватор. Это ДВА сборника ЭСН.",
    options: [
      { code: "Только §1-1-35", label: "Только §1-1-35 (экскаватор, IV кат.) — скала как обычный грунт", correct: false, explanation: "Скала IV кат. без предварительного рыхления не поддаётся обычному экскаватору. Нужен БВР (буровзрывные работы) из ЭСН РК Сб.2." },
      { code: "ЭСН Сб.2 + §1-1-35", label: "ЭСН РК Сб.2 (буровзрывные) + §1-1-35 (экскаватор, IV кат. рыхлый)", correct: true, explanation: "✓ Верно! ЭСН РК Сб.2 «Горновскрышные работы» — бурение скважин + взрывание. После рыхления — ЭСН РК Сб.1 §1-1-35 (разработка разрыхлённой скалы экскаватором). Коэффициент разрыхления скалы Кр = 1.45-1.50." },
      { code: "§1-2-4 вручную IV кат.", label: "§1-2-4 Ручная разработка IV кат. (кирко-мотыга)", correct: false, explanation: "200 м³ известняка вручную — невозможно даже с отбойным молотком без рыхления. Ручная работа в IV кат. — только после БВР для доработки деталей." },
      { code: "§1-1-75 скрепер IV кат.", label: "§1-1-75 Скрепер IV кат. — рыхление зубьями рыхлителя", correct: false, explanation: "Рыхлитель-скрепер применяется при мягкой скале (IV кат. мягкая). Известняк трещиноватый — твёрдый, требует БВР. Уточнение по ПОС обязательно." },
    ],
    afterText: "Две сметные позиции: 1) Бурение + взрывание (ЭСН Сб.2) — в тоннах взрывчатки и метрах бурения; 2) Экскаватор (ЭСН Сб.1 §1-1-35) — в 1000 м³. Объём считается в плотном теле до взрыва.",
    normRef: "ЭСН РК Сб.1 §1-1-35; ЭСН РК Сб.2 «Горновскрышные работы»; ГОСТ 25100 (скала IV кат.); СН РК по БВР",
  },
];

export default function RateSelectorPage() {
  const [taskIdx, setTaskIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  const task = TASKS[taskIdx];
  const pickedOpt = task.options.find((o) => o.code === picked);
  const isCorrect = checked && pickedOpt?.correct === true;
  const isWrong = checked && pickedOpt?.correct === false;

  function handleCheck() {
    if (!picked) return;
    setChecked(true);
    if (pickedOpt?.correct) {
      setTimeout(() => setDone((d) => new Set([...d, task.id])), 800);
    }
  }

  function next() {
    if (taskIdx + 1 < TASKS.length) {
      setTaskIdx(taskIdx + 1);
      setPicked(null);
      setChecked(false);
    }
  }

  const allDone = done.size === TASKS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-slate-800 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-slate-400 hover:text-white">← Все разделы</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">📋 Задачник: выбери правильную расценку ЭСН РК</h1>
            <p className="text-[10px] text-slate-400">Земляные работы · {done.size}/{TASKS.length} решено</p>
          </div>
          <Link href="/smeta-trainer/drawings-practice/normatives" className="text-[10px] bg-slate-700 text-slate-200 px-2 py-1 rounded hover:bg-slate-600">
            📋 Справочник
          </Link>
        </div>
        {/* Progress */}
        <div className="h-1 bg-slate-700">
          <div className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(done.size / TASKS.length) * 100}%` }} />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Task selector */}
        <div className="flex gap-2 flex-wrap">
          {TASKS.map((t, i) => (
            <button key={t.id} onClick={() => { setTaskIdx(i); setPicked(null); setChecked(false); }}
              className={`text-[10px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
                i === taskIdx ? "bg-slate-800 text-white"
                  : done.has(t.id) ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}>
              {done.has(t.id) ? "✓ " : ""}{i + 1}. {t.title}
            </button>
          ))}
        </div>

        {allDone ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Все задачи решены!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Теперь вы умеете выбирать расценки ЭСН РК для земляных работ — с учётом категории грунта, механизма и условий производства.
            </p>
            <button onClick={() => { setTaskIdx(0); setPicked(null); setChecked(false); setDone(new Set()); }}
              className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900">
              Пройти снова
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {/* Scenario */}
            <div className="bg-slate-50 dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Задача {taskIdx + 1}/{TASKS.length}</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{task.title}</h2>
              </div>
              <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">{task.scenario}</pre>
              {!checked && (
                <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-[10px] text-amber-800 dark:text-amber-300">
                  💡 Подсказка: {task.hint}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="p-4 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
                Выберите правильный вариант:
              </div>
              {task.options.map((opt) => {
                const isSelected = picked === opt.code;
                const showCorrect = checked && opt.correct;
                const showWrong = checked && isSelected && !opt.correct;
                return (
                  <button key={opt.code} disabled={checked}
                    onClick={() => setPicked(opt.code)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors text-xs ${
                      showCorrect ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                        : showWrong ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                          : isSelected ? "border-slate-500 bg-slate-50 dark:bg-slate-800"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400"
                    } ${checked ? "cursor-default" : "cursor-pointer"}`}>
                    <div className="flex items-start gap-2">
                      <code className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${
                        showCorrect ? "bg-emerald-200 text-emerald-900"
                          : showWrong ? "bg-red-200 text-red-900"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>{opt.code}</code>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{opt.label}</div>
                        {(showCorrect || showWrong) && (
                          <div className={`mt-1 text-[11px] leading-relaxed ${
                            showCorrect ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                          }`}>
                            {opt.explanation}
                          </div>
                        )}
                      </div>
                      {showCorrect && <span className="text-emerald-600 text-lg shrink-0">✓</span>}
                      {showWrong && <span className="text-red-600 text-lg shrink-0">✗</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              {!checked ? (
                <button onClick={handleCheck} disabled={!picked}
                  className="w-full py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 disabled:opacity-40">
                  Проверить выбор
                </button>
              ) : (
                <>
                  <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                    isCorrect
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700"
                      : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700"
                  }`}>
                    <div className="font-bold mb-1 text-slate-800 dark:text-slate-200">
                      {isCorrect ? "✓ Правильно!" : "✗ Неверно — смотри верный ответ выше"}
                    </div>
                    <div className="text-slate-700 dark:text-slate-300">{task.afterText}</div>
                    <div className="mt-1.5 text-[10px] text-slate-500 italic">📖 {task.normRef}</div>
                  </div>
                  {isCorrect ? (
                    taskIdx + 1 < TASKS.length ? (
                      <button onClick={next} className="w-full py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900">
                        Следующая задача →
                      </button>
                    ) : null
                  ) : (
                    <button onClick={() => { setPicked(null); setChecked(false); }}
                      className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600">
                      Попробовать снова
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
