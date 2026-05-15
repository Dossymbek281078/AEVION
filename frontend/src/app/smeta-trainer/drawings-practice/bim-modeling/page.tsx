"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.02) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < tol;
  });
}

interface NumExercise {
  kind: "num";
  id: string;
  title: string;
  q: string;
  label: string;
  a: string[];
  tol?: number;
  e: string;
}
interface ChoiceExercise {
  kind: "choice";
  id: string;
  title: string;
  q: string;
  options: string[];
  correctIdx: number;
  e: string;
}
type Exercise = NumExercise | ChoiceExercise;

const LOD_ROWS: { lod: string; descr: string; smetchik: string; color: string }[] = [
  {
    lod: "LOD 100",
    descr: "Концептуальный уровень — массивы, общие объёмы, нет точной геометрии",
    smetchik: "Прикидка укрупнённых объёмов работ для ТЭО, инвестиционная смета",
    color: "bg-slate-700/40",
  },
  {
    lod: "LOD 200",
    descr: "Эскизный — типовые элементы с приблизительными размерами и материалами",
    smetchik: "Укрупнённые ВОР по форме Ф-3, объектные сметы на стадии «П»",
    color: "bg-indigo-700/40",
  },
  {
    lod: "LOD 300",
    descr: "Рабочий проект — точная геометрия, конкретные материалы, узлы примыканий",
    smetchik: "Локальные сметы Ф-2 / ЛСР с расценками ЭСН РК, базовый уровень для подсчёта прямых затрат",
    color: "bg-cyan-700/40",
  },
  {
    lod: "LOD 400",
    descr: "Монтажный — допуски, крепёж, последовательность сборки, спецификации заказа",
    smetchik: "Спецификации заказа материалов, КС-2 «на лету», логистика поставок",
    color: "bg-cyan-600/40",
  },
  {
    lod: "LOD 500",
    descr: "Эксплуатационный — фактически построено, привязка к оборудованию и паспортам",
    smetchik: "Сравнение план/факт, итоговая стоимость объекта, передача в эксплуатацию",
    color: "bg-emerald-700/40",
  },
];

const SOFT_ROWS: { name: string; vendor: string; descr: string; lic: string }[] = [
  {
    name: "Autodesk Revit",
    vendor: "Autodesk (США)",
    descr: "Мировой стандарт BIM, поддержка архитектуры/конструкций/инженерии в одном файле",
    lic: "~1 200 000 тг/год за рабочее место (2025)",
  },
  {
    name: "ArchiCAD",
    vendor: "Graphisoft (Венгрия)",
    descr: "Удобный для архитекторов, классическая BIM-методология «виртуальное здание»",
    lic: "~1 100 000 тг/год",
  },
  {
    name: "Allplan",
    vendor: "Nemetschek (Германия)",
    descr: "Силён для конструкций — железобетон, армирование, опалубка, расчётные модели",
    lic: "~1 500 000 тг/год",
  },
  {
    name: "Tekla Structures",
    vendor: "Trimble (Финляндия)",
    descr: "Лидер по металлоконструкциям и сборному железобетону, ультра-детализация",
    lic: "~3 800 000 тг/год",
  },
  {
    name: "Renga",
    vendor: "Аскон (РФ/РК)",
    descr: "Российская альтернатива, поддержка СНБ РК через плагин Renga.Smeta",
    lic: "~600 000 тг/год",
  },
];

const STAGES: { step: string; title: string; descr: string }[] = [
  {
    step: "1",
    title: "Получение модели от проектировщика",
    descr: "Архитектор/конструктор передаёт IFC или RVT-файл с указанием уровня LOD и BIM-стандарта проекта (BEP — BIM Execution Plan).",
  },
  {
    step: "2",
    title: "Выгрузка ВОР (Schedule / Спецификации)",
    descr: "Сметчик формирует таблицы по категориям: стены, перекрытия, колонны, окна. Получает объёмы в м³, площади в м², количество в шт.",
  },
  {
    step: "3",
    title: "Проверка LOD и достоверности",
    descr: "Сверка с заданием: достаточно ли LOD для текущей стадии? Нет ли «проёмов забыли вычесть»? Контроль геометрии в Navisworks.",
  },
  {
    step: "4",
    title: "Расчёт по ЭСН РК",
    descr: "Загрузка ВОР в АВС-4 / Сана / Renga.Smeta. Привязка позиций ВОР к шифрам ЭСН РК, применение текущих индексов, формирование ЛСР.",
  },
  {
    step: "5",
    title: "Согласование и пересчёт",
    descr: "При изменении модели — автоматический пересчёт спецификаций. Сметчик отслеживает delta и обновляет ЛСР/КС-2 синхронно с проектом.",
  },
];

const EXERCISES: Exercise[] = [
  {
    kind: "choice",
    id: "ex1-lod-esn",
    title: "Упражнение 1: Какой LOD нужен для подсчёта прямых затрат по ЭСН РК?",
    q: "Сметчику требуется составить ЛСР по форме Ф-2 с применением расценок ЭСН РК (точные объёмы работ, конкретные материалы, узлы). Какой минимальный уровень детализации модели нужен?",
    options: ["LOD 100", "LOD 200", "LOD 300", "LOD 400"],
    correctIdx: 2,
    e: "LOD 300 — рабочий проект с точной геометрией, конкретными материалами и узлами. Это минимум для расценок ЭСН (нужны точные объёмы, марки бетона, диаметр арматуры). LOD 100/200 — слишком общо для прямых затрат, LOD 400 — избыточно (используется на стадии монтажа).",
  },
  {
    kind: "num",
    id: "ex2-speed",
    title: "Упражнение 2: Во сколько раз BIM ускоряет составление сметы для коттеджа 240 м²?",
    q: `Дано:
• Площадь объекта — 240 м² (двухэтажный коттедж)
• Время составления сметы вручную (по чертежам, обмер, табл. Excel) — 16-24 часа
• Время составления сметы по готовой BIM-модели LOD 300 (выгрузка ВОР, привязка к ЭСН) — около 4 часов

Во сколько раз быстрее работа со сметой по BIM-модели по сравнению с ручным обмером? (используйте среднее ручное время 20 ч)`,
    label: "Ускорение, раз (×)",
    a: ["5", "5.0", "4", "4.5", "6"],
    tol: 0.25,
    e: "Среднее ручное время = (16 + 24) / 2 = 20 ч. Ускорение = 20 / 4 = 5×. Реальный диапазон 4-6×, потому что часть работ (привязка к ЭСН, проверка коэффициентов) всё равно ручная. Главный выигрыш — автоматический подсчёт объёмов без ошибок.",
  },
  {
    kind: "num",
    id: "ex3-license",
    title: "Упражнение 3: Стоимость лицензии Autodesk Revit на год (2025, РК)",
    q: `Сметный отдел планирует закупить лицензию Autodesk Revit на 1 рабочее место для работы с BIM-моделями.

Какова ориентировочная стоимость подписки на 1 год для одного рабочего места в тенге (по ценам 2025 года, через официального реселлера в РК)?`,
    label: "Стоимость, тг/год",
    a: ["1200000", "1 200 000", "1200000.0", "1100000", "1300000"],
    tol: 0.15,
    e: "Подписка Autodesk Revit на 1 рабочее место в РК (2025) — около 1 200 000 тг/год (примерно $2 400 + НДС + наценка реселлера). Возможны скидки для образовательных организаций и multi-seat. Для отдела из 5 чел — около 6 млн тг/год без обучения.",
  },
  {
    kind: "choice",
    id: "ex4-plugin",
    title: "Упражнение 4: Какой плагин в BIM-системе считает смету по ЭСН РК?",
    q: "Сметчик хочет автоматизировать связку BIM-модели с ЭСН РК (СНБ РК). Какое решение поддерживает нормативную базу Республики Казахстан напрямую?",
    options: [
      "Quantity Takeoff (Autodesk) — только подсчёт объёмов",
      "Cost+ (международный модуль смет)",
      "Renga.Smeta (Аскон) — поддержка СНБ РК",
      "BIMcollab (координация и issue-tracking)",
    ],
    correctIdx: 2,
    e: "Renga.Smeta (от компании Аскон) — единственное BIM-сметное решение в обзоре, которое напрямую поддерживает СНБ РК (ЭСН, ЭСНм, индексы РК). Также используется AVS-сметная система через IFC-импорт. Quantity Takeoff делает только обмер, Cost+ работает по западным базам, BIMcollab — для координации (не считает смету).",
  },
];

export default function BimModelingPage() {
  const [xi, sxi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = EXERCISES[xi];

  const numOk =
    ex.kind === "num" && rev[ex.id] && check(inp[ex.id] ?? "", ex.a, ex.tol ?? 0.02);
  const numErr = ex.kind === "num" && rev[ex.id] && !numOk;

  const choiceOk =
    ex.kind === "choice" && rev[ex.id] && picked[ex.id] === ex.correctIdx;
  const choiceErr =
    ex.kind === "choice" && rev[ex.id] && picked[ex.id] !== ex.correctIdx;

  function goNum() {
    if (ex.kind !== "num") return;
    setRev((r) => ({ ...r, [ex.id]: true }));
    if (check(inp[ex.id] ?? "", ex.a, ex.tol ?? 0.02)) {
      setTimeout(() => {
        setDone((d) => new Set([...d, ex.id]));
      }, 700);
    }
  }

  function goChoice(idx: number) {
    if (ex.kind !== "choice") return;
    if (rev[ex.id]) return;
    setPicked((p) => ({ ...p, [ex.id]: idx }));
    setRev((r) => ({ ...r, [ex.id]: true }));
    if (idx === ex.correctIdx) {
      setTimeout(() => {
        setDone((d) => new Set([...d, ex.id]));
      }, 700);
    }
  }

  function retry() {
    setRev((r) => ({ ...r, [ex.id]: false }));
    if (ex.kind === "num") setInp((p) => ({ ...p, [ex.id]: "" }));
    if (ex.kind === "choice") setPicked((p) => ({ ...p, [ex.id]: -1 }));
  }

  function showSolution() {
    setRev((r) => ({ ...r, [ex.id]: true }));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">
            Прогресс: {done.size} / {EXERCISES.length}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Заголовок */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-indigo-300">
            🏗️ BIM-моделирование — Revit/ArchiCAD для сметчика
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Building Information Modeling (BIM) — единая 3D-модель здания с привязкой
            всех данных: геометрии, материалов, графика работ и смет. Для сметчика BIM —
            это прямой источник ВОР: объёмы бетона, площади перегородок, количество
            окон выгружаются за минуты, а не часы.
          </p>
        </section>

        {/* Нормативы */}
        <section className="bg-slate-900/50 border border-indigo-800/40 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-indigo-300 mb-3">
            📜 Нормативная база BIM
          </h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="text-cyan-400 font-mono">ГОСТ Р 57311-2016</span> —
              Информационное моделирование в строительстве. Требования к эксплуатационной
              документации объектов. Базовый стандарт для BIM-проектов.
            </li>
            <li>
              <span className="text-cyan-400 font-mono">СП РК 1.04-101-2012</span> —
              Правила выполнения проектной документации с применением BIM-технологий
              (адаптация для РК).
            </li>
            <li>
              <span className="text-cyan-400 font-mono">ISO 19650-1/2:2018</span> —
              международный стандарт по управлению информацией на жизненном цикле
              объекта (CDE, BEP, MIDP).
            </li>
            <li>
              <span className="text-cyan-400 font-mono">Приказ МИИР РК №242 (2023)</span>{" "}
              — поэтапное внедрение BIM для бюджетных объектов в Республике Казахстан.
            </li>
          </ul>
        </section>

        {/* Section 1: LOD */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            1. Уровни детализации модели (LOD)
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            LOD (Level of Development) — степень проработки элемента модели. Определяет,
            какие сметы можно строить на основе модели на каждой стадии проекта.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 w-24">LOD</th>
                  <th className="text-left px-3 py-2">Что в модели</th>
                  <th className="text-left px-3 py-2">Что из неё может сметчик</th>
                </tr>
              </thead>
              <tbody>
                {LOD_ROWS.map((r) => (
                  <tr
                    key={r.lod}
                    className={`border-t border-slate-800 ${r.color}`}
                  >
                    <td className="px-3 py-2 font-mono text-cyan-300 align-top">
                      {r.lod}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-200">{r.descr}</td>
                    <td className="px-3 py-2 align-top text-slate-300">
                      {r.smetchik}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Software */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            2. Программное обеспечение
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Сметчику РК достаточно уметь читать модель в одном из этих ПО и выгружать
            из неё ВОР. Глубокое моделирование — задача архитектора/конструктора.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">ПО</th>
                  <th className="text-left px-3 py-2">Производитель</th>
                  <th className="text-left px-3 py-2">Описание</th>
                  <th className="text-left px-3 py-2">Лицензия (РК, 2025)</th>
                </tr>
              </thead>
              <tbody>
                {SOFT_ROWS.map((r) => (
                  <tr
                    key={r.name}
                    className="border-t border-slate-800 hover:bg-slate-900/50"
                  >
                    <td className="px-3 py-2 font-semibold text-indigo-300 align-top">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-slate-400 align-top">{r.vendor}</td>
                    <td className="px-3 py-2 text-slate-300 align-top">{r.descr}</td>
                    <td className="px-3 py-2 text-cyan-300 font-mono align-top text-xs">
                      {r.lic}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Exercises */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            3. Интерактивные упражнения
          </h2>

          <div className="flex gap-2 mb-5 flex-wrap">
            {EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => sxi(i)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  i === xi
                    ? "bg-indigo-600 text-white"
                    : done.has(e.id)
                    ? "bg-emerald-800/60 text-emerald-200 hover:bg-emerald-700/60"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {done.has(e.id) ? "✓ " : ""}
                Упр. {i + 1}
              </button>
            ))}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-indigo-300">{ex.title}</h3>
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
              {ex.q}
            </pre>

            {ex.kind === "num" && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-slate-400 mb-1">
                      {ex.label}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inp[ex.id] ?? ""}
                      onChange={(e) =>
                        setInp((p) => ({ ...p, [ex.id]: e.target.value }))
                      }
                      disabled={rev[ex.id]}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-cyan-300 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                      placeholder="Введите число..."
                    />
                  </div>
                  <div className="flex gap-2">
                    {!rev[ex.id] && (
                      <button
                        onClick={goNum}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium"
                      >
                        Проверить
                      </button>
                    )}
                    {!rev[ex.id] && (
                      <button
                        onClick={showSolution}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded text-sm"
                      >
                        Показать решение
                      </button>
                    )}
                    {rev[ex.id] && (
                      <button
                        onClick={retry}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded text-sm"
                      >
                        Ещё раз
                      </button>
                    )}
                  </div>
                </div>
                {numOk && (
                  <div className="bg-emerald-900/40 border border-emerald-700/50 rounded p-3 text-sm text-emerald-200">
                    ✅ Верно! {ex.e}
                  </div>
                )}
                {numErr && (
                  <div className="bg-rose-900/40 border border-rose-700/50 rounded p-3 text-sm text-rose-200">
                    ❌ Неточно. Правильный ответ: {ex.a[0]}. {ex.e}
                  </div>
                )}
              </div>
            )}

            {ex.kind === "choice" && (
              <div className="space-y-2">
                {ex.options.map((opt, idx) => {
                  const isPicked = picked[ex.id] === idx;
                  const isCorrect = idx === ex.correctIdx;
                  let cls =
                    "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200";
                  if (rev[ex.id]) {
                    if (isCorrect) {
                      cls =
                        "bg-emerald-900/50 border-emerald-600 text-emerald-100";
                    } else if (isPicked) {
                      cls = "bg-rose-900/50 border-rose-600 text-rose-100";
                    } else {
                      cls = "bg-slate-900 border-slate-800 text-slate-500";
                    }
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => goChoice(idx)}
                      disabled={rev[ex.id]}
                      className={`w-full text-left px-4 py-2.5 rounded border text-sm transition ${cls}`}
                    >
                      <span className="font-mono mr-2 text-xs opacity-60">
                        {String.fromCharCode(97 + idx)})
                      </span>
                      {opt}
                    </button>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  {!rev[ex.id] && (
                    <button
                      onClick={showSolution}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded text-sm"
                    >
                      Показать решение
                    </button>
                  )}
                  {rev[ex.id] && (
                    <button
                      onClick={retry}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded text-sm"
                    >
                      Ещё раз
                    </button>
                  )}
                </div>
                {choiceOk && (
                  <div className="bg-emerald-900/40 border border-emerald-700/50 rounded p-3 text-sm text-emerald-200 mt-2">
                    ✅ Верно! {ex.e}
                  </div>
                )}
                {choiceErr && (
                  <div className="bg-rose-900/40 border border-rose-700/50 rounded p-3 text-sm text-rose-200 mt-2">
                    ❌ Не совсем. Правильный вариант:{" "}
                    {String.fromCharCode(97 + ex.correctIdx)}). {ex.e}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Stages */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            4. Этапы работы сметчика с BIM-моделью
          </h2>
          <div className="space-y-3">
            {STAGES.map((s) => (
              <div
                key={s.step}
                className="flex gap-4 bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-indigo-700/50 transition"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                  {s.step}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-indigo-300 mb-1">{s.title}</div>
                  <div className="text-sm text-slate-300 leading-relaxed">
                    {s.descr}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Расценки */}
        <section className="bg-slate-900/50 border border-cyan-800/40 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-cyan-300 mb-3">
            💰 Бюджет на BIM-сметную единицу (РК, 2025)
          </h2>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-950/60 rounded p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Лицензия Revit/ArchiCAD</div>
              <div className="text-lg font-mono text-cyan-300">~1 200 000 тг/год</div>
            </div>
            <div className="bg-slate-950/60 rounded p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">
                Лицензия сметной программы (АВС / Сана)
              </div>
              <div className="text-lg font-mono text-cyan-300">~250 000 тг/год</div>
            </div>
            <div className="bg-slate-950/60 rounded p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Обучение BIM-сметчика</div>
              <div className="text-lg font-mono text-cyan-300">300-600 тыс. тг</div>
            </div>
            <div className="bg-slate-950/60 rounded p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">
                Рабочая станция (CPU 8+ ядер, 32 ГБ RAM, GPU)
              </div>
              <div className="text-lg font-mono text-cyan-300">~900 000 тг</div>
            </div>
            <div className="bg-slate-950/60 rounded p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">
                ЗП BIM-сметчика (Алматы/Астана)
              </div>
              <div className="text-lg font-mono text-cyan-300">450-800 тыс. тг/мес</div>
            </div>
            <div className="bg-slate-950/60 rounded p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">
                ROI на одном объекте 5000 м²
              </div>
              <div className="text-lg font-mono text-emerald-300">3-5 месяцев</div>
            </div>
          </div>
        </section>

        {/* Indigo factoid */}
        <section className="bg-gradient-to-br from-indigo-900/40 to-cyan-900/30 border border-indigo-700/50 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-indigo-200 mb-2">
            📌 Факт по РК: BIM обязателен с 2025
          </h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            С 1 января 2025 года в Республике Казахстан BIM-моделирование стало
            обязательным для всех бюджетных объектов капитального строительства
            стоимостью свыше 1 млрд тенге (Приказ МИИР РК №242 от 2023, поэтапное
            внедрение). Это означает, что сметчик, работающий на госзаказе, обязан
            уметь читать BIM-модель и выгружать ВОР минимум на уровне LOD 300. Без
            этого навыка участие в крупных тендерах закрывается уже в ближайший год.
          </p>
          <p className="text-sm text-cyan-200 mt-3 font-medium">
            🎯 Совет студенту: выучите Revit на уровне «выгрузка спецификаций» (это
            2-3 недели) — это даст +20-40% к рыночной стоимости специалиста.
          </p>
        </section>

        {/* Footer nav */}
        <div className="flex justify-between pt-6 border-t border-slate-800">
          <Link
            href="/smeta-trainer/drawings-practice/bim-intro"
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            ← BIM: введение
          </Link>
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Все разделы →
          </Link>
        </div>
      </main>
    </div>
  );
}
