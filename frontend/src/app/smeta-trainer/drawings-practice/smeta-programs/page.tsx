"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Сметные программы РК — обзор АВС-4, Смета РК, ИСТ Эталон.
 * Учебная страница: сравнение, алгоритмы работы, упражнения.
 */

type ProgramKey = "avs4" | "smeta-rk" | "ist-etalon";

interface ComparisonRow {
  param: string;
  avs4: string;
  smetaRk: string;
  istEtalon: string;
}

const COMPARISON: ComparisonRow[] = [
  {
    param: "Производитель",
    avs4: "Стройсофт (РФ)",
    smetaRk: "НИСИЦ (РК)",
    istEtalon: "Эталон-инжиниринг (РК)",
  },
  {
    param: "Цена 2025, тг/год",
    avs4: "285 000 (одна копия)",
    smetaRk: "350 000",
    istEtalon: "850 000 (с обновлениями)",
  },
  {
    param: "Поддержка ЭСН РК",
    avs4: "Да (через импорт)",
    smetaRk: "Да (нативно)",
    istEtalon: "Да (нативно)",
  },
  {
    param: "Поддержка ССЦ РК",
    avs4: "Через импорт",
    smetaRk: "Нативно",
    istEtalon: "Нативно (автообновление)",
  },
  {
    param: "Формы Ф-1, Ф-2, Ф-3 РК",
    avs4: "Да",
    smetaRk: "Да",
    istEtalon: "Да",
  },
  {
    param: "Импорт из BIM",
    avs4: "Только через Excel",
    smetaRk: "Через Excel",
    istEtalon: "Прямой через IFC",
  },
  {
    param: "Многопользовательский",
    avs4: "Да (network license)",
    smetaRk: "Да",
    istEtalon: "Да + cloud",
  },
  {
    param: "Учебная версия",
    avs4: "Бесплатно (студентам)",
    smetaRk: "Trial 30 дней",
    istEtalon: "Trial 14 дней",
  },
];

const AVS4_STEPS: string[] = [
  "Создать новый проект → выбрать «Жилое здание» / «Общественное» / «Промышленное»",
  "Указать территориальный коэффициент (для РК: использовать настройку «Импорт ССЦ РК»)",
  "Создать локальные сметы (Ф-2): Раздел 1 «Земляные работы», Раздел 2 «Фундаменты», и т.д.",
  "Добавить позиции: Поиск «ЭСН Сб.6 §6-01-001» → выбрать → ввести количество",
  "Применить коэффициенты: Кр для земли, Кз для зимы, К индивидуальные (НР, СП по умолчанию из настроек)",
  "Создать объектную смету (Ф-3): автоматически собирается из локальных смет",
  "Применить индекс перехода: задать в настройках проекта (например 11.42 для Алматы Q3 2025)",
  "Просмотреть итоги: НР, СП, индекс, НДС применяются автоматически",
  "Проверить итоги: «Печать → Стандартный отчёт» → визуальный контроль",
  "Экспорт: Excel / PDF / SP-XML (для тендерной системы)",
];

const SMETA_RK_STEPS: string[] = [
  "«Файл → Новая смета РК» → выбрать форму (Ф-2, Ф-3, КС-2)",
  "Выбрать категорию объекта → автоматически загружаются типовые расценки",
  "Ввести позиции через поиск (с подсказками автокомплита)",
  "Применить коэффициенты в окне «Параметры расчёта»",
  "Печать с предпросмотром и экспорт",
];

const IST_ETALON_FEATURES: { title: string; body: string }[] = [
  {
    title: "Индексы перехода",
    body: "Каждый квартал обновляются автоматически — не нужно вручную скачивать приказы Комитета.",
  },
  {
    title: "ССЦ",
    body: "Обновляется ежемесячно. Цены материалов всегда актуальны для региона стройки.",
  },
  {
    title: "ЭСН РК",
    body: "Синхронизируется с официальной базой Комитета по делам строительства РК.",
  },
  {
    title: "Cloud-режим",
    body: "Команда из 5–10 сметчиков работает над одним проектом параллельно. История изменений видна.",
  },
  {
    title: "Mobile (iOS/Android)",
    body: "Премиум-опция: смотреть сметы с телефона на стройплощадке.",
  },
];

interface ChoiceOption {
  id: string;
  label: string;
}

interface ChoiceExercise {
  kind: "choice";
  id: string;
  question: string;
  options: ChoiceOption[];
  correct: string;
  explain: string;
}

interface NumberExercise {
  kind: "number";
  id: string;
  question: string;
  hint: string;
  acceptedValues: number[]; // одно из значений считается верным
  tolerancePercent: number;
  explain: string;
  unit: string;
}

type Exercise = ChoiceExercise | NumberExercise;

const EXERCISES: Exercise[] = [
  {
    kind: "choice",
    id: "ex1",
    question: "Какая программа лучше для бюджетной государственной стройки в РК?",
    options: [
      { id: "a", label: "АВС-4" },
      { id: "b", label: "Смета РК" },
      { id: "c", label: "ИСТ Эталон" },
      { id: "d", label: "Любая" },
    ],
    correct: "c",
    explain:
      "ИСТ Эталон обязательна для бюджетных объектов: согласована с гос. структурами РК, проходит экспертизу автоматически, обновления нормативов — официальные.",
  },
  {
    kind: "number",
    id: "ex2",
    question:
      "Сколько РАБОЧИХ ДНЕЙ примерно занимает составление типовой сметы 100 м² жилья в одной из сметных программ (АВС-4 / Смета РК / ИСТ Эталон)?",
    hint: "Введите значение в днях. Любое из реальных значений (АВС-4: 1–2 дн, Смета РК: 1 дн, ИСТ Эталон: 0.5 дн) считается верным. Допуск ±50%.",
    acceptedValues: [1.5, 1, 0.5],
    tolerancePercent: 50,
    unit: "дней",
    explain:
      "Для сравнения: в Excel вручную та же смета занимает 5–7 рабочих дней. Программы экономят минимум в 5 раз времени, а ИСТ Эталон с готовыми шаблонами — до 10 раз.",
  },
  {
    kind: "number",
    id: "ex3",
    question:
      "Стоимость лицензий АВС-4 для сметного отдела из 5 сметчиков на 1 год (тенге). Принимаются: индивидуальные (5 копий) ИЛИ сетевая лицензия. Допуск ±10%.",
    hint: "5 × 285 000 = 1 425 000 тг (индивидуальные) или ~850 000 тг (сетевая). Введите одно из двух.",
    acceptedValues: [1425000, 850000],
    tolerancePercent: 10,
    unit: "тг",
    explain:
      "Сетевая (network) лицензия дешевле, но требует постоянного соединения с сервером лицензий. Для большинства бюро выгоднее именно сетевая.",
  },
  {
    kind: "choice",
    id: "ex4",
    question:
      "Что нужно ОБЯЗАТЕЛЬНО проверить ВРУЧНУЮ после составления сметы в любой программе?",
    options: [
      { id: "a", label: "Геометрические объёмы" },
      { id: "b", label: "Применённые коэффициенты Кр / Кз / К" },
      { id: "c", label: "Итоги НР / СП / индекс перехода" },
      { id: "d", label: "Всё перечисленное (a + b + c)" },
    ],
    correct: "d",
    explain:
      "Программа считает математически безошибочно, НО может применить неверный коэффициент или индекс — потому что её настроил человек. Объёмы тоже надо контролировать: в чертежи закрался дубль — программа этого не увидит.",
  },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function isNumberValid(input: string, ex: NumberExercise): boolean {
  const v = Number(input.replace(/\s+/g, "").replace(",", "."));
  if (!Number.isFinite(v)) return false;
  return ex.acceptedValues.some((target) => {
    const tol = (target * ex.tolerancePercent) / 100;
    return Math.abs(v - target) <= tol;
  });
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function SmetaProgramsPage() {
  const [activeProgram, setActiveProgram] = useState<ProgramKey>("avs4");

  const programLabel = useMemo(
    () =>
      ({
        avs4: "АВС-4",
        "smeta-rk": "Смета РК",
        "ist-etalon": "ИСТ Эталон",
      })[activeProgram],
    [activeProgram],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="inline-flex items-center gap-2 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-1.5 text-sm font-medium text-sky-300 transition hover:border-sky-500 hover:bg-sky-900/40 hover:text-sky-100"
          >
            ← К разделам
          </Link>
          <span className="rounded-full border border-sky-700/40 bg-sky-950/30 px-3 py-1 text-xs uppercase tracking-wider text-sky-300">
            Сметные программы
          </span>
        </div>

        <h1 className="mb-2 text-3xl font-bold tracking-tight text-sky-200 sm:text-4xl">
          💼 Сметные программы РК — АВС-4, Смета РК, ИСТ Эталон
        </h1>
        <p className="mb-8 max-w-3xl text-base text-slate-400">
          Что выбрать сметчику в Казахстане в 2025: сравнение трёх главных программ, алгоритмы работы и
          упражнения для самопроверки.
        </p>

        {/* Intro */}
        <section className="mb-10 rounded-2xl border border-sky-800/40 bg-gradient-to-br from-sky-950/60 to-slate-900/60 p-6 shadow-lg">
          <h2 className="mb-3 text-xl font-semibold text-sky-200">Зачем сметная программа?</h2>
          <p className="mb-4 text-slate-300">
            Сметные программы — основной инструмент сметчика. В Казахстане практически используются три
            главных пакета:
          </p>
          <ul className="mb-4 space-y-2 text-slate-300">
            <li className="flex gap-2">
              <span className="text-sky-400">▸</span>
              <span>
                <strong className="text-sky-200">АВС-4</strong> — российская, поддерживается в РК для
                типовых смет.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">▸</span>
              <span>
                <strong className="text-sky-200">Смета РК</strong> — отечественная, специально под
                нормативы РК.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">▸</span>
              <span>
                <strong className="text-sky-200">ИСТ Эталон РК</strong> — обновляемая база нормативов с
                подпиской.
              </span>
            </li>
          </ul>
          <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-4 text-sm text-amber-200">
            ⚠️ Без программы реальная смета составляется в <strong>5–10 раз дольше</strong>, а риск ошибок
            на <strong>30–50% выше</strong> (забытые коэффициенты, ошибки округления, пропущенные позиции).
          </div>
        </section>

        {/* Section 1: Comparison */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold text-sky-200">
            1. Сравнение программ
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 shadow-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900">
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">Параметр</th>
                  <th className="px-4 py-3 text-left font-semibold text-sky-300">АВС-4</th>
                  <th className="px-4 py-3 text-left font-semibold text-sky-300">Смета РК</th>
                  <th className="px-4 py-3 text-left font-semibold text-sky-300">ИСТ Эталон</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, idx) => (
                  <tr
                    key={row.param}
                    className={
                      idx % 2 === 0
                        ? "border-b border-slate-800/50 bg-slate-900/30"
                        : "border-b border-slate-800/50 bg-slate-900/10"
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">{row.param}</td>
                    <td className="px-4 py-3 text-slate-300">{row.avs4}</td>
                    <td className="px-4 py-3 text-slate-300">{row.smetaRk}</td>
                    <td className="px-4 py-3 text-slate-300">{row.istEtalon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section selector */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold text-sky-200">
            2–4. Алгоритмы работы (выберите программу)
          </h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { key: "avs4", label: "АВС-4" },
                { key: "smeta-rk", label: "Смета РК" },
                { key: "ist-etalon", label: "ИСТ Эталон" },
              ] as { key: ProgramKey; label: string }[]
            ).map((p) => (
              <button
                key={p.key}
                onClick={() => setActiveProgram(p.key)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  activeProgram === p.key
                    ? "border-sky-500 bg-sky-600 text-white shadow-md"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-700 hover:text-sky-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-sky-800/40 bg-slate-900/50 p-6 shadow-lg">
            <h3 className="mb-3 text-lg font-semibold text-sky-200">
              {programLabel}: пошаговый алгоритм
            </h3>

            {activeProgram === "avs4" && (
              <ol className="space-y-3">
                {AVS4_STEPS.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-bold text-white">
                      {idx + 1}
                    </span>
                    <span className="pt-1 text-slate-300">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {activeProgram === "smeta-rk" && (
              <>
                <p className="mb-4 text-sm text-slate-400">
                  Похож на АВС-4, но с упрощённым интерфейсом и нативной поддержкой нормативов РК:
                </p>
                <ol className="space-y-3">
                  {SMETA_RK_STEPS.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="pt-1 text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {activeProgram === "ist-etalon" && (
              <>
                <p className="mb-4 text-sm text-slate-400">
                  Уникальная фишка — <strong className="text-sky-200">автообновление базы</strong>{" "}
                  нормативов:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {IST_ETALON_FEATURES.map((f) => (
                    <div
                      key={f.title}
                      className="rounded-lg border border-sky-800/30 bg-sky-950/20 p-4"
                    >
                      <div className="mb-1 font-semibold text-sky-200">{f.title}</div>
                      <div className="text-sm text-slate-300">{f.body}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-sky-700/40 bg-sky-950/30 p-4 text-sm">
                  <span className="font-semibold text-sky-200">Стоимость подписки:</span>{" "}
                  <span className="text-slate-300">850 000 тг/год для одной организации.</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Section 5: Exercises */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold text-sky-200">
            5. Упражнения для самопроверки
          </h2>
          <div className="space-y-4">
            {EXERCISES.map((ex, idx) => (
              <ExerciseCard key={ex.id} exercise={ex} index={idx + 1} />
            ))}
          </div>
        </section>

        {/* Factoid */}
        <section className="mb-10">
          <div className="rounded-2xl border-2 border-sky-600/50 bg-gradient-to-br from-sky-950/60 via-sky-900/30 to-slate-900/60 p-6 shadow-lg">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              <h3 className="text-xl font-semibold text-sky-200">Главное</h3>
            </div>
            <p className="text-slate-200">
              Программа <strong className="text-sky-300">НЕ заменяет</strong> сметчика. Она быстрее
              считает, но решает <em className="text-sky-300">ЧТО</em> считать — человек.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Опытный сметчик с Excel сделает лучше неопытного с ИСТ Эталон. Программа — это ускоритель
              для того, кто и так знает методику. Без знания нормативной базы и здравого смысла даже самая
              дорогая лицензия не спасёт от грубых ошибок в смете.
            </p>
          </div>
        </section>

        {/* footer nav */}
        <div className="mt-12 flex justify-between border-t border-slate-800 pt-6">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-sky-400 transition hover:text-sky-300"
          >
            ← К разделам
          </Link>
          <Link
            href="/smeta-trainer"
            className="text-sm text-slate-400 transition hover:text-sky-300"
          >
            На главную тренажёра →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── ExerciseCard ───────────────────────────────────────────────────────────

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const [submitted, setSubmitted] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");

  let isCorrect = false;
  if (submitted) {
    if (exercise.kind === "choice") {
      isCorrect = choice === exercise.correct;
    } else {
      isCorrect = isNumberValid(textValue, exercise);
    }
  }

  const reset = () => {
    setSubmitted(false);
    setChoice(null);
    setTextValue("");
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-md">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-bold text-white">
          {index}
        </span>
        <h3 className="pt-1 text-base font-semibold text-slate-100">{exercise.question}</h3>
      </div>

      {exercise.kind === "choice" ? (
        <div className="ml-11 space-y-2">
          {exercise.options.map((opt) => {
            const selected = choice === opt.id;
            const correctChoice = submitted && opt.id === exercise.correct;
            const wrongChoice = submitted && selected && opt.id !== exercise.correct;
            return (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                  correctChoice
                    ? "border-emerald-500 bg-emerald-950/40 text-emerald-100"
                    : wrongChoice
                      ? "border-red-500 bg-red-950/40 text-red-100"
                      : selected
                        ? "border-sky-500 bg-sky-950/40 text-sky-100"
                        : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-sky-700"
                }`}
              >
                <input
                  type="radio"
                  name={exercise.id}
                  value={opt.id}
                  checked={selected}
                  disabled={submitted}
                  onChange={() => setChoice(opt.id)}
                  className="h-4 w-4 accent-sky-500"
                />
                <span className="font-mono text-xs uppercase text-sky-400">{opt.id}.</span>
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="ml-11 space-y-2">
          <p className="text-xs text-slate-400">{exercise.hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={textValue}
              disabled={submitted}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Введите число"
              className="w-48 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none disabled:opacity-60"
            />
            <span className="text-sm text-slate-400">{exercise.unit}</span>
          </div>
        </div>
      )}

      <div className="ml-11 mt-4 flex flex-wrap items-center gap-3">
        {!submitted ? (
          <button
            onClick={() => setSubmitted(true)}
            disabled={
              exercise.kind === "choice" ? choice === null : textValue.trim().length === 0
            }
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Проверить
          </button>
        ) : (
          <button
            onClick={reset}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-sky-700 hover:text-sky-200"
          >
            Попробовать ещё раз
          </button>
        )}

        {submitted && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isCorrect
                ? "bg-emerald-900/50 text-emerald-200"
                : "bg-red-900/50 text-red-200"
            }`}
          >
            {isCorrect ? "✓ Верно" : "✗ Неверно"}
          </span>
        )}
      </div>

      {submitted && (
        <div
          className={`ml-11 mt-3 rounded-lg border p-3 text-sm ${
            isCorrect
              ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-100"
              : "border-sky-800/50 bg-sky-950/20 text-sky-100"
          }`}
        >
          <div className="mb-1 font-semibold">{isCorrect ? "Объяснение:" : "Правильный ответ:"}</div>
          <p className="text-slate-300">{exercise.explain}</p>
        </div>
      )}
    </div>
  );
}
