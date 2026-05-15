"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tol = 0.15): boolean {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v) || expected === 0) return false;
  return Math.abs((v - expected) / expected) <= tol;
}

type Installation = {
  name: string;
  purpose: string;
  perf: string;
  price: string;
  norm: string;
};

const INSTALLATIONS: Installation[] = [
  {
    name: "Механический фильтр (картриджный) 100-20 мкм",
    purpose: "Удаление песка, ржавчины, окалины",
    perf: "до 3 м³/час",
    price: "25 000 - 65 000 тг",
    norm: "СТ РК 1004",
  },
  {
    name: "Ионообменное умягчение (CABINET 1054 / 1252)",
    purpose: "Удаление солей жёсткости (Ca²⁺, Mg²⁺)",
    perf: "1.0 - 2.5 м³/час",
    price: "180 000 - 380 000 тг",
    norm: "СанПиН РК «Питьевая вода»",
  },
  {
    name: "Обезжелезиватель (аэрация + каталит. загрузка)",
    purpose: "Удаление Fe²⁺/Fe³⁺, Mn, H₂S",
    perf: "1.5 - 3.0 м³/час",
    price: "220 000 - 480 000 тг",
    norm: "СанПиН РК «Питьевая вода»",
  },
  {
    name: "Угольный фильтр (активир. уголь)",
    purpose: "Удаление хлора, запахов, привкусов, органики",
    perf: "1.5 - 3.0 м³/час",
    price: "85 000 - 185 000 тг",
    norm: "СТ РК 1004",
  },
  {
    name: "УФ-стерилизатор (бактерицидная лампа)",
    purpose: "Обеззараживание (E.coli, цисты, лямблии)",
    perf: "до 4 м³/час",
    price: "55 000 - 145 000 тг",
    norm: "СанПиН РК «Питьевая вода»",
  },
  {
    name: "Обратный осмос с накопит. баком (5-7 ступеней)",
    purpose: "Удаление 95-99% всех солей, нитратов, тяжёл. металлов",
    perf: "8-15 л/час (бытовой)",
    price: "65 000 - 280 000 тг",
    norm: "СанПиН РК «Питьевая вода»",
  },
];

type Problem = {
  param: string;
  limit: string;
  symptom: string;
  solution: string;
};

const PROBLEMS: Problem[] = [
  {
    param: "Жёсткость общая",
    limit: "> 7 мг-экв/л (норма ≤ 7)",
    symptom: "Накипь в чайнике, налёт на сантехнике, зуд кожи",
    solution: "Ионообменное умягчение (CABINET 1054/1252) с регенерацией NaCl",
  },
  {
    param: "Железо общее",
    limit: "> 0.3 мг/л (норма ≤ 0.3)",
    symptom: "Ржавые разводы, металлич. привкус, рыжая вода после простоя",
    solution: "Аэрационная колонна + каталитич. фильтр (Birm, MGS, Pyrolox)",
  },
  {
    param: "Нитраты (NO₃⁻)",
    limit: "> 45 мг/л (норма ≤ 45)",
    symptom: "Опасны для младенцев (метгемоглобинемия), без вкуса/запаха",
    solution: "Обратный осмос — единственный надёжный способ для бытовых условий",
  },
  {
    param: "Марганец (Mn²⁺)",
    limit: "> 0.1 мг/л",
    symptom: "Чёрные разводы, горький привкус",
    solution: "Аэрация + каталитич. загрузка (та же установка, что и Fe)",
  },
  {
    param: "Сероводород (H₂S)",
    limit: "> 0.003 мг/л",
    symptom: "Запах тухлых яиц",
    solution: "Аэрация + угольный фильтр + при необходимости окисление",
  },
];

const NORMS: string[] = [
  "СанПиН РК «Питьевая вода» — гигиенич. требования к качеству воды",
  "СТ РК 1004 — вода питьевая, методы анализа",
  "СНиП РК 4.01-02-2009 «Водоснабжение наружные сети и сооружения»",
  "СНиП РК 4.01-41-2006 «Внутренний водопровод и канализация зданий»",
  "ГОСТ Р 51232-98 — вода питьевая, общие требования к организации контроля качества",
];

const ESN: string[] = [
  "ЭСН Сб.18 «Водоподготовка и очистка воды» — установка фильтров, монтаж колонн",
  "ЭСН Сб.16 «Внутренние санитарно-технические работы» — обвязка трубопроводами PPR/PEX",
  "ЭСН Сб.18-1-001 «Установка фильтра механической очистки»",
  "ЭСН Сб.18-2-001 «Монтаж установки умягчения с управляющим клапаном»",
  "ЭСН Сб.18-3-001 «Монтаж обезжелезивателя с компрессором аэрации»",
  "ЭСН Сб.18-4-001 «Монтаж УФ-стерилизатора»",
  "ЭСН Сб.18-5-001 «Монтаж установки обратного осмоса бытовой»",
];

type Exercise = {
  id: string;
  title: string;
  q: string;
  type: "mc" | "num";
  options?: { key: string; text: string }[];
  correctKey?: string;
  expected?: number;
  unit?: string;
  solution: string;
  vor: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Подбор установки по химанализу",
    q:
      "Анализ воды из скважины: жёсткость 14 мг-экв/л (норма ≤ 7), железо общее 2.5 мг/л " +
      "(норма ≤ 0.3), нитраты 12 мг/л, бактериология чистая. Коттедж 6 чел, расход 2 м³/час. " +
      "Что необходимо смонтировать?",
    type: "mc",
    options: [
      { key: "a", text: "Только умягчитель CABINET 1054 — этого достаточно" },
      { key: "b", text: "Только обратный осмос на всю воду в дом" },
      { key: "c", text: "Обезжелезиватель (аэрация + Birm) + умягчитель CABINET 1054 + угольный + УФ" },
      { key: "d", text: "Только механический фильтр 20 мкм" },
    ],
    correctKey: "c",
    solution:
      "Жёсткость и железо превышены — нужны обе колонны. Сначала ставится обезжелезиватель " +
      "(чтобы Fe не отравлял ионообменную смолу умягчителя), затем умягчитель CABINET 1054 " +
      "(производит. 1.5 м³/час подходит для 6 чел). Угольный — для устранения остаточных привкусов, " +
      "УФ — обеззараживание скважинной воды. Нитраты 12 мг/л в норме (< 45), осмос на весь дом не нужен. " +
      "Вариант (a) не решает проблему железа, (b) экономически нецелесообразен (производит. ~10 л/час), " +
      "(d) не задерживает растворённые соли.",
    vor:
      "Обезжелезиватель аэрационный 1054: 1 шт; Умягчитель CABINET 1054: 1 шт; " +
      "Угольный фильтр 1054: 1 шт; УФ-стерилизатор 2 м³/час: 1 шт (ЭСН Сб.18, СанПиН РК)",
  },
  {
    id: "ex2",
    title: "Производительность фильтра CABINET 1252",
    q:
      "Коттедж 8 чел, норма потребления 250 л/чел/сутки. Какова суточная нагрузка (м³/сут)? " +
      "Подойдёт ли умягчитель CABINET 1252 с производительностью 1.5 м³/час, если пиковый расход " +
      "распределён в течение 6 часов в сутки? Введите суточную нагрузку, м³/сут.",
    type: "num",
    expected: 2.0,
    unit: "м³/сут",
    solution:
      "Q сут = 8 × 250 = 2000 л/сут = 2.0 м³/сут. Проверка пика: 2.0 м³ / 6 ч = 0.33 м³/час — " +
      "значительно меньше производительности 1.5 м³/час. Запас по производительности: " +
      "1.5 / 0.33 ≈ 4.5×. CABINET 1252 подходит с большим запасом.",
    vor: "Умягчитель CABINET 1252: 1 шт (объём смолы 35 л, расход соли на регенерацию 3.5 кг)",
  },
  {
    id: "ex3",
    title: "Расход соли для регенерации умягчителя",
    q:
      "Умягчитель CABINET 1054, объём ионообменной смолы — 25 литров. Норма расхода соли " +
      "на регенерацию — 100 г NaCl на 1 литр смолы. Сколько соли (кг) требуется на одну регенерацию? " +
      "Введите массу, кг.",
    type: "num",
    expected: 2.5,
    unit: "кг",
    solution:
      "M соли = V смолы × норма = 25 л × 100 г/л = 2500 г = 2.5 кг таблетированной соли (NaCl). " +
      "При жёсткости 14 мг-экв/л регенерация требуется примерно каждые 5-7 дней при расходе 2 м³/сут. " +
      "Годовой расход соли: ~2.5 кг × 60 регенераций = 150 кг (мешок 25 кг = 6 шт/год).",
    vor: "Соль таблетированная NaCl для регенерации: 2.5 кг/цикл × 60 циклов/год = 150 кг/год",
  },
  {
    id: "ex4",
    title: "Стоимость комплексной системы водоподготовки",
    q:
      "Подобрать комплексную систему для коттеджа 6 чел: механический фильтр + умягчитель CABINET 1054 " +
      "+ обезжелезиватель + угольный + УФ-стерилизатор. Определить полную стоимость с монтажом, тг. " +
      "(оборудование среднего ценового сегмента + СМР)",
    type: "num",
    expected: 850000,
    unit: "тг",
    solution:
      "Расчёт по таблице (среднее значение): мех. фильтр 45 000 + умягчитель CABINET 1054 " +
      "200 000 + обезжелезиватель 280 000 + угольный 110 000 + УФ-стерилизатор 85 000 = 720 000 тг " +
      "(оборудование). Монтаж и обвязка PPR (ЭСН Сб.18 + Сб.16) ≈ 130 000 тг. " +
      "Итого ≈ 850 000 тг. Диапазон в реальности: 700 000 - 1 100 000 тг в зависимости " +
      "от бренда (Ecosoft / Atoll / Aquaphor / Гейзер).",
    vor:
      "Комплекс водоподготовки коттеджа 6 чел: оборудование 720 000 тг + СМР 130 000 тг = " +
      "850 000 тг (ЭСН Сб.18 + Сб.16, СанПиН РК «Питьевая вода»)",
  },
];

export default function WaterTreatmentDetailedPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, "ok" | "bad" | null>>({});

  const handleCheck = (ex: Exercise) => {
    const a = answers[ex.id] ?? "";
    let ok = false;
    if (ex.type === "mc") {
      ok = a.toLowerCase() === (ex.correctKey ?? "");
    } else if (ex.type === "num" && ex.expected !== undefined) {
      ok = checkNum(a, ex.expected, 0.15);
    }
    setResults((r) => ({ ...r, [ex.id]: ok ? "ok" : "bad" }));
  };

  const toggleSolution = (id: string) => {
    setShown((s) => ({ ...s, [id]: !s[id] }));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-teal-400 hover:text-teal-300 text-sm"
          >
            ← К разделам
          </Link>
          <h1 className="text-3xl font-bold mt-3 text-teal-300">
            🧪 Водоподготовка — умягчение, обезжелезивание, осмос
          </h1>
          <p className="text-slate-400 mt-2">
            Доочистка городской и скважинной воды для коттеджей и малых объектов РК
          </p>
        </header>

        <section className="mb-8 rounded-xl border border-teal-900/50 bg-teal-950/30 p-5">
          <h2 className="text-xl font-semibold text-teal-200 mb-3">Что такое водоподготовка</h2>
          <p className="text-slate-300 leading-relaxed">
            Водоподготовка — это комплекс установок для приведения воды (городской из крана или
            из скважины) к нормам СанПиН РК «Питьевая вода». В Казахстане большинство скважин
            (особенно Алматы, Тараз, Шымкент) имеют повышенную жёсткость и/или железо;
            городская вода часто требует доочистки от хлора и привкусов.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            {NORMS.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-teal-300">
            Стоимость для коттеджа: <strong>350 000 — 8 000 000 тг</strong> в зависимости
            от исходного состава воды (городская vs скважина с Fe/Mn/H₂S/нитратами).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-teal-200 mb-4">
            1. Типы установок водоподготовки
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-teal-300">
                <tr>
                  <th className="text-left p-3">Установка</th>
                  <th className="text-left p-3">Назначение</th>
                  <th className="text-left p-3">Производительность</th>
                  <th className="text-left p-3">Цена (РК)</th>
                  <th className="text-left p-3">Норматив</th>
                </tr>
              </thead>
              <tbody>
                {INSTALLATIONS.map((it, i) => (
                  <tr
                    key={it.name}
                    className={i % 2 ? "bg-slate-900/50" : "bg-slate-900/20"}
                  >
                    <td className="p-3 text-slate-100 font-medium">{it.name}</td>
                    <td className="p-3 text-slate-300">{it.purpose}</td>
                    <td className="p-3 text-slate-300">{it.perf}</td>
                    <td className="p-3 text-emerald-300">{it.price}</td>
                    <td className="p-3 text-slate-400 text-xs">{it.norm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-teal-200 mb-4">
            2. Распространённые проблемы и решения
          </h2>
          <div className="space-y-3">
            {PROBLEMS.map((p) => (
              <div
                key={p.param}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <div className="flex flex-wrap items-baseline gap-2 mb-2">
                  <span className="text-emerald-300 font-semibold">{p.param}</span>
                  <span className="text-xs text-amber-400">{p.limit}</span>
                </div>
                <p className="text-sm text-slate-400 mb-2">
                  <span className="text-slate-500">Признаки:</span> {p.symptom}
                </p>
                <p className="text-sm text-teal-200">
                  <span className="text-slate-500">Решение:</span> {p.solution}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-teal-200 mb-4">
            3. Интерактивные упражнения
          </h2>
          <div className="space-y-5">
            {EXERCISES.map((ex) => {
              const result = results[ex.id];
              const isShown = shown[ex.id];
              return (
                <div
                  key={ex.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-5"
                >
                  <h3 className="text-lg font-semibold text-emerald-300 mb-2">
                    {ex.title}
                  </h3>
                  <p className="text-slate-300 mb-4 text-sm leading-relaxed">{ex.q}</p>

                  {ex.type === "mc" && ex.options && (
                    <div className="space-y-2 mb-4">
                      {ex.options.map((o) => (
                        <label
                          key={o.key}
                          className={`flex items-start gap-2 p-2 rounded cursor-pointer transition ${
                            answers[ex.id] === o.key
                              ? "bg-teal-900/40 border border-teal-700"
                              : "bg-slate-900/60 border border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name={ex.id}
                            value={o.key}
                            checked={answers[ex.id] === o.key}
                            onChange={(e) =>
                              setAnswers((a) => ({ ...a, [ex.id]: e.target.value }))
                            }
                            className="mt-1"
                          />
                          <span className="text-sm text-slate-200">
                            <span className="text-teal-400 font-mono mr-2">
                              {o.key})
                            </span>
                            {o.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {ex.type === "num" && (
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <input
                        type="text"
                        value={answers[ex.id] ?? ""}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [ex.id]: e.target.value }))
                        }
                        placeholder="Введите ответ"
                        className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 w-44 focus:border-teal-500 outline-none"
                      />
                      <span className="text-sm text-slate-400">{ex.unit}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      onClick={() => handleCheck(ex)}
                      className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded text-sm font-medium transition"
                    >
                      Проверить
                    </button>
                    <button
                      onClick={() => toggleSolution(ex.id)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-sm font-medium transition"
                    >
                      {isShown ? "Скрыть решение" : "Показать решение"}
                    </button>
                  </div>

                  {result === "ok" && (
                    <div className="rounded bg-emerald-900/40 border border-emerald-700 p-3 mb-2">
                      <p className="text-emerald-300 text-sm font-medium">
                        ✓ Верно! Ответ принят (допуск ±15%).
                      </p>
                    </div>
                  )}
                  {result === "bad" && (
                    <div className="rounded bg-rose-900/30 border border-rose-800 p-3 mb-2">
                      <p className="text-rose-300 text-sm">
                        ✗ Неверно. Попробуйте ещё раз или посмотрите решение.
                      </p>
                    </div>
                  )}

                  {isShown && (
                    <div className="rounded bg-slate-950 border border-teal-900/50 p-4 mt-2">
                      <p className="text-sm text-slate-200 leading-relaxed mb-3">
                        <span className="text-teal-400 font-semibold">Решение: </span>
                        {ex.solution}
                      </p>
                      <p className="text-xs text-emerald-300 leading-relaxed">
                        <span className="text-slate-500">Запись в ВОР: </span>
                        {ex.vor}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-teal-200 mb-4">
            Применяемые расценки ЭСН РК
          </h2>
          <ul className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
            {ESN.map((e) => (
              <li key={e} className="text-sm text-slate-300">
                <span className="text-teal-400 mr-2">▸</span>
                {e}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8 rounded-xl border-2 border-teal-700 bg-teal-950/40 p-5">
          <div className="flex items-start gap-3">
            <span className="text-3xl">💡</span>
            <div>
              <h3 className="text-teal-200 font-semibold mb-2">
                Факт: лицензирование водоподготовки в РК
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed">
                Для бытового обратного осмоса и любой домашней водоподготовки в Казахстане
                <strong className="text-teal-300"> лицензия НЕ требуется</strong> — частное лицо
                может ставить себе любое оборудование. Однако для{" "}
                <strong className="text-emerald-300">
                  коммерческой розливной воды
                </strong>{" "}
                (бутилированная, кулерная, для HoReCa) обязательна сертификация по СТ РК,
                регистрация в реестре пищевой продукции ЕАЭС и санитарно-эпидемиологическое
                заключение от Комитета санэпидконтроля МЗ РК. Игнорирование = штраф 200-500 МРП
                + конфискация партии.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-10 pt-6 border-t border-slate-800 text-center">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-teal-400 hover:text-teal-300 text-sm"
          >
            ← Вернуться ко всем разделам
          </Link>
        </footer>
      </div>
    </main>
  );
}
