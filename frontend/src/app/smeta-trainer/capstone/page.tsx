"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const PASS_KEY = "aevion-smeta-capstone-pass-v1";
const PASS_THRESHOLD = 7; // из 10

interface Question {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

const QUESTIONS: Question[] = [
  {
    q: "Объект: капитальный ремонт коридора в действующей школе. Какой коэффициент к ФОТ обязателен?",
    options: [
      "Ничего, школа — обычный объект",
      "К стеснённости 1.15 (действующее здание)",
      "Только К высоты при работах выше 3 м",
      "Зимний коэф. 1.13",
    ],
    correct: 1,
    explanation: "Действующее здание (учебный процесс не остановлен) — К стеснённости 1.15 к ФОТ по Прил. Б НДЦС РК 8.01-08-2022.",
  },
  {
    q: "В смете применили индекс Q1 2026, а сдача в августе 2026. Что делает эксперт?",
    options: [
      "Принимает — индекс есть, неважно какой квартал",
      "Возвращает на пересчёт по индексу актуального квартала",
      "Принимает с замечанием, оплата по старому",
      "Не принимает смету вовсе",
    ],
    correct: 1,
    explanation: "Индекс берётся на дату утверждения / передачи на экспертизу. Старый индекс занижает стоимость — эксперт обязан вернуть на пересчёт.",
  },
  {
    q: "Дефектная ведомость зафиксировала 4 класса с трещинами в перекрытиях. Это:",
    options: [
      "Должно быть в основной ЛСР, добавляется как раздел",
      "Включается в смету только после капремонта (исключение)",
      "Основа для допсметы и допсоглашения после вскрытия",
      "Не учитывается — мелочь",
    ],
    correct: 2,
    explanation: "Скрытые дефекты, обнаруженные при вскрытии — оформляются дефектным актом, далее допсмета → допсоглашение → выполнение → КС-2 по доп.",
  },
  {
    q: "ВОР для позиции «штукатурка стен класса 5×6×3 м с 1 окном 2×1.5 м». Правильный объём:",
    options: [
      "(5+6)×2 × 3 = 66 м²",
      "(5+6)×2 × 3 − 3 = 63 м²",
      "5 × 6 × 3 = 90 м²",
      "5 × 6 = 30 м²",
    ],
    correct: 1,
    explanation: "Стены = периметр × высота − проёмы. (5+6)×2 × 3 = 66 м²; вычитаем окно 2×1.5 = 3 м². Итого 63 м². Дверь не считаем (она в коридор, площадь стен меньше).",
  },
  {
    q: "НР для категории «отделочные» начислены по ставке 120%. Это:",
    options: [
      "Правильно — стандарт для строительных работ",
      "Неправильно — для отделки норматив ~95%",
      "Правильно, если сложные условия",
      "Неважно — главное СП",
    ],
    correct: 1,
    explanation: "СН РК 8.02-07-2014: общестрой ~120%, отделка ~95%, демонтаж ~85% и т.д. Категория работ определяет норматив.",
  },
  {
    q: "В Главе 9 ССР (Прочие работы) для объекта в Алматы с наружными работами в декабре что должно быть?",
    options: [
      "0 ₸ — Алматы тёплый регион",
      "Зимнее удорожание по СН РК 8.02-09",
      "Только норматив 3% от СМР",
      "Только аренда бытовок",
    ],
    correct: 1,
    explanation: "Наружные работы при отрицательных температурах = зимнее удорожание по СН РК 8.02-09 (для Алматы декабрь–февраль). Альтернатива — зимний коэф. в позициях.",
  },
  {
    q: "КС-2 за июль 2026 содержит позиции, которых нет в основной ЛСР. Что это?",
    options: [
      "Ошибка ПТО — нельзя",
      "Допработы по дефектному акту — нужна допсмета и допсоглашение",
      "Можно, если сумма меньше 10% договора",
      "Нормально — на стройке всегда так",
    ],
    correct: 1,
    explanation: "Любые работы вне основной ЛСР — только через допсмету + допсоглашение. Без этого технадзор не подпишет, оплаты не будет.",
  },
  {
    q: "Объектная смета (Форма 3) — это:",
    options: [
      "Главный документ ПСД, утверждаемый заказчиком",
      "Свод нескольких ЛСР по одному объекту с показателем тенге/м²",
      "Аналог КС-2 для месячных актов",
      "Документ для бухгалтерии после оплаты",
    ],
    correct: 1,
    explanation: "Форма 3 НДЦС РК 8.01-08-2022 — агрегирует ЛСР, относящиеся к одному «объекту» (корпус, секция). Колонки: СМР / Оборудование / Прочие / Всего + удельная стоимость на м².",
  },
  {
    q: "Базисный уровень цен 2001 г. + индекс пересчёта Q3 2026 = 5.78. Базисная стоимость позиции 12 000 ₸. Текущая:",
    options: [
      "12 000 + 5.78 = 12 005.78 ₸",
      "12 000 × 5.78 = 69 360 ₸",
      "12 000 / 5.78 ≈ 2 076 ₸",
      "12 000 × (1 + 5.78%) = 12 694 ₸",
    ],
    correct: 1,
    explanation: "Текущая стоимость = базисная × индекс. 12 000 × 5.78 = 69 360 ₸. Индекс — это множитель, а не процент.",
  },
  {
    q: "Эксперт ГЭ нашёл в смете двойной учёт (демонтаж стяжки в двух местах). Что это значит?",
    options: [
      "Мелкая ошибка, замечание",
      "Замечание + пересчёт; возможен возврат сметы на доработку",
      "Уголовное дело о мошенничестве",
      "Ничего — пересчитают на КС-2",
    ],
    correct: 1,
    explanation: "Двойной учёт — стандартное замечание экспертизы. Пересчёт обязателен; в зависимости от объёма правок — возврат сметы на доработку. Это не уголовка, но репутация сметчика страдает.",
  },
];

export default function CapstonePage() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [previouslyPassed, setPreviouslyPassed] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== "undefined") {
      try {
        setPreviouslyPassed(localStorage.getItem(PASS_KEY) === "true");
      } catch {}
    }
  }, []);

  const correctCount = QUESTIONS.reduce(
    (s, q, i) => s + (answers[i] === q.correct ? 1 : 0),
    0,
  );
  const passed = submitted && correctCount >= PASS_THRESHOLD;

  function handleSubmit() {
    setSubmitted(true);
    if (correctCount >= PASS_THRESHOLD) {
      try {
        localStorage.setItem(PASS_KEY, "true");
        window.dispatchEvent(new CustomEvent("aevion-smeta-progress-update"));
      } catch {}
    }
  }

  function handleReset() {
    setAnswers({});
    setSubmitted(false);
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-400 hover:text-white">
            ← К курсу
          </Link>
          <div className="flex-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
              Капстоун-экзамен · Между уровнями 4 и 5
            </div>
            <h1 className="text-lg font-bold mt-0.5">Сводный тест по полному циклу сметы</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {QUESTIONS.length} вопросов · зачёт ≥ {PASS_THRESHOLD} правильных
            </p>
          </div>
          {previouslyPassed && (
            <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-1 rounded font-semibold">
              ✓ ранее зачтён
            </span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-4 space-y-4">
        {!submitted && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Этот экзамен интегрирует материал всех 4 предыдущих уровней:</strong> подсчёт
            объёмов, коэффициенты, индексы, НР/СП, ВОР, дефектные акты, КС-2/КС-3, объектные
            сметы. Зачёт = вы готовы к роли эксперта (Уровень 5).
          </div>
        )}

        {submitted && (
          <div className={`rounded-xl p-5 border-2 text-center ${
            passed ? "bg-emerald-50 border-emerald-400" : "bg-red-50 border-red-300"
          }`}>
            <div className="text-3xl mb-2">{passed ? "🎉" : "📚"}</div>
            <div className="text-2xl font-bold">{correctCount}/{QUESTIONS.length}</div>
            <div className={`mt-1 font-semibold ${passed ? "text-emerald-700" : "text-red-700"}`}>
              {passed ? "✓ Зачёт получен — переходите на Уровень 5" : `Не хватает ${PASS_THRESHOLD - correctCount} ответов до зачёта`}
            </div>
            {!passed && (
              <button
                onClick={handleReset}
                className="mt-3 px-4 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded hover:bg-amber-600"
              >
                Повторить попытку
              </button>
            )}
            {passed && (
              <Link
                href="/smeta-trainer/level/5"
                className="mt-3 inline-block px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                → На Уровень 5 (Эксперт)
              </Link>
            )}
          </div>
        )}

        {QUESTIONS.map((q, i) => {
          const userPick = answers[i];
          const isCorrect = submitted && userPick === q.correct;
          const isWrong = submitted && userPick != null && userPick !== q.correct;
          const noAnswer = submitted && userPick == null;
          return (
            <div
              key={i}
              className={`bg-white border-2 rounded-lg p-4 ${
                isCorrect ? "border-emerald-300" : isWrong || noAnswer ? "border-red-300" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="text-sm font-semibold text-slate-900 flex-1">{q.q}</div>
              </div>
              <div className="space-y-1">
                {q.options.map((opt, oi) => {
                  const selected = userPick === oi;
                  const isOptCorrect = submitted && oi === q.correct;
                  const isOptWrongPick = submitted && selected && oi !== q.correct;
                  return (
                    <label
                      key={oi}
                      className={`flex items-start gap-2 p-2 rounded cursor-pointer text-xs leading-snug border ${
                        isOptCorrect
                          ? "border-emerald-400 bg-emerald-50"
                          : isOptWrongPick
                            ? "border-red-400 bg-red-50"
                            : selected
                              ? "border-emerald-400 bg-white"
                              : "border-slate-200 bg-white hover:border-slate-300"
                      } ${submitted ? "cursor-default" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`q-${i}`}
                        checked={selected}
                        onChange={() => !submitted && setAnswers((p) => ({ ...p, [i]: oi }))}
                        disabled={submitted}
                        className="mt-0.5"
                      />
                      <span className="flex-1">{opt}</span>
                      {isOptCorrect && <span className="text-emerald-600">✓</span>}
                      {isOptWrongPick && <span className="text-red-600">✗</span>}
                    </label>
                  );
                })}
              </div>
              {submitted && (
                <div className="text-[11px] mt-2 italic text-slate-700 bg-slate-50 border border-slate-100 rounded p-2 leading-relaxed">
                  💡 {q.explanation}
                </div>
              )}
            </div>
          );
        })}

        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < QUESTIONS.length}
            className="w-full py-3 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {Object.keys(answers).length < QUESTIONS.length
              ? `Ответьте на все вопросы (${Object.keys(answers).length}/${QUESTIONS.length})`
              : "Сдать капстоун"}
          </button>
        )}
      </div>
    </div>
  );
}
