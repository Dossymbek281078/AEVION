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

const LOD_ROWS: { lod: string; descr: string; smetchik: string }[] = [
  { lod: "LOD 100", descr: "Концептуальный (массивы, общие объёмы)", smetchik: "Прикидка укрупнённых смет (стадия П предложения)" },
  { lod: "LOD 200", descr: "Схематический (типовые элементы)", smetchik: "Объектная смета (форма Ф-3) с укрупнёнными расценками" },
  { lod: "LOD 300", descr: "Детализированный (точные размеры, материалы)", smetchik: "Сметы по форме Ф-2/ЛСР с расценками ЭСН" },
  { lod: "LOD 350", descr: "LOD 300 + связи между элементами", smetchik: "Учёт стыков, узлов, примыканий" },
  { lod: "LOD 400", descr: "Готовый к производству (с допусками, креплениями)", smetchik: "КС-2 формирование «на лету»" },
  { lod: "LOD 500", descr: "Исполнительный (как построено)", smetchik: "Сравнение план/факт, Final ВОР" },
];

const D_LEVELS: { d: string; title: string; descr: string }[] = [
  { d: "3D", title: "Геометрия", descr: "X / Y / Z — основа всего" },
  { d: "4D", title: "+ Время", descr: "Графики, последовательности — для ППР" },
  { d: "5D", title: "+ Стоимость", descr: "Расценки, материалы — для сметчика" },
  { d: "6D", title: "+ Эксплуатация", descr: "Срок службы, обслуживание" },
  { d: "7D", title: "+ Утилизация", descr: "Материалы вторичные, экология" },
];

const SOFT_ROWS: { name: string; vendor: string; use: string; lic: string }[] = [
  { name: "Revit", vendor: "Autodesk", use: "Архитектура, конструкции, инж.", lic: "Подписка ~$2400/год" },
  { name: "ArchiCAD", vendor: "Graphisoft", use: "Архитектура, BIM-документация", lic: "$2500/год" },
  { name: "Tekla Structures", vendor: "Trimble", use: "Стальные и бетонные конструкции", lic: "$9000/год" },
  { name: "Allplan", vendor: "Nemetschek", use: "Архитектура + конструкции", lic: "$3500/год" },
  { name: "Bentley AECOsim", vendor: "Bentley", use: "Инфраструктура, мосты", lic: "$5000/год" },
  { name: "Renga", vendor: "Аскон (РФ/РК)", use: "Архитектура + BIM", lic: "$1800/год" },
  { name: "nanoCAD BIM", vendor: "nanoCAD", use: "Бюджетный аналог Revit", lic: "$400/год" },
];

const PROS_CONS: { pro: string; con: string }[] = [
  { pro: "Автоматический подсчёт объёмов (без ошибок ручного счёта)", con: "Стоимость лицензий ($2-9k/год)" },
  { pro: "Скорость работы (×3-5 быстрее)", con: "Долгое внедрение (6-12 мес обучения)" },
  { pro: "Изменения в проекте — автоматический пересчёт", con: "Требует BIM-проект (не у всех есть)" },
  { pro: "Видимость конфликтов (труба сквозь несущую балку)", con: "Кадровый дефицит BIM-сметчиков" },
  { pro: "4D графики работ автоматически", con: "Высокие требования к ПК (16-32 ГБ RAM)" },
  { pro: "Стандартизация по ISO 19650", con: "Не вся ССЦ РК встроена в BIM-системы" },
  { pro: "Снижение конфликтов между разделами", con: "Ошибки в модели → ошибки в смете" },
];

const EXERCISES: Exercise[] = [
  {
    kind: "choice",
    id: "ex1-lod",
    title: "Упражнение 1: Какой LOD нужен для составления Ф-3 (объектной сметы)?",
    q: "Объектная смета Ф-3 — укрупнённая смета по главам (12 разделов МДС 81-25). Какой минимальный LOD требуется?",
    options: ["LOD 100", "LOD 200", "LOD 300", "LOD 400"],
    correctIdx: 1,
    e: "Ф-3 — укрупнённая смета по главам, детализация LOD 200 (схематические типовые элементы) достаточна. LOD 100 — слишком грубо, LOD 300/400 — избыточно.",
  },
  {
    kind: "num",
    id: "ex2-volume",
    title: "Упражнение 2: Считай объём бетона из BIM (упрощённо)",
    q: `Колонна Revit: H = 3.0 м, сечение 0.4 × 0.4 м.
Количество колонн: 16 шт.

Рассчитайте суммарный объём бетона колонн (м³).`,
    label: "Объём бетона, м³",
    a: ["7.68", "7,68", "7.7"],
    tol: 0.01,
    e: "V = 16 · 0.4 · 0.4 · 3.0 = 7.68 м³. В Revit это значение получаем мгновенно через Schedule по категории «Колонны» с полем «Объём».",
  },
  {
    kind: "choice",
    id: "ex3-format",
    title: "Упражнение 3: Какой формат экспорта BIM-данных универсальный?",
    q: "Какой формат поддерживается всеми BIM-системами и специализированными сметами как открытый ISO-стандарт?",
    options: ["DWG", "IFC", "XLSX", "PDF"],
    correctIdx: 1,
    e: "IFC (Industry Foundation Classes) — открытый ISO-формат (ISO 16739), поддерживается всеми BIM-системами и специализированными сметами (NormCalc, ИСТ Эталон). DWG — формат AutoCAD, XLSX/PDF — не передают свойства BIM.",
  },
  {
    kind: "num",
    id: "ex4-cost",
    title: "Упражнение 4: Стоимость владения Revit для сметного отдела из 5 чел.",
    q: `Подписка Revit: $2400/год на одного пользователя.
Сметный отдел: 5 чел.
Курс: ~520 тг/$.

Рассчитайте годовую стоимость лицензий в тенге.`,
    label: "Годовая стоимость, тг",
    a: ["6240000", "6 240 000", "6240000.0"],
    tol: 0.05,
    e: "$2400 · 5 чел = $12 000/год. В тенге: 12 000 · 520 = 6 240 000 тг/год. Это «нижняя граница» — без учёта обучения и тех. поддержки.",
  },
];

const CHECKLIST: string[] = [
  "Базовое понимание 3D (умение крутить модель)",
  "Чтение спецификаций Revit/ArchiCAD",
  "Создание собственных параметров (Shared Parameters)",
  "Экспорт в Excel и далее в смету",
  "Знание формата IFC",
  "Согласование с архитектором/конструктором что включить в свойства",
  "Основы координации моделей (Navisworks)",
  "Управление версиями BIM-проекта (как сметы привязаны)",
];

export default function BimIntroPage() {
  const [xi, sxi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());

  const ex = EXERCISES[xi];

  const numKey = ex.kind === "num" ? ex.id : "";
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

  function toggleCheck(i: number) {
    setChecks((c) => {
      const n = new Set(c);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  return (
    <div className="min-h-screen bg-violet-50/40 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-violet-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-violet-100 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🏗 BIM для сметчика — что нужно знать
            </h1>
            <p className="text-[10px] text-violet-200">
              СН РК 1.04-29-2018 · СП РК 1.04-100-2018 · ISO 19650 · ПП РК № 1018
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Введение */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-violet-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-2">
            📐 BIM — Building Information Modeling
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            Это <b>не «3D-модель»</b>, а единая база данных проекта, где каждый элемент имеет:
          </p>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside mb-2">
            <li><b>Геометрию</b> (объём, площадь)</li>
            <li><b>Свойства</b> (материал, марка, цена)</li>
            <li><b>Связи</b> (примыкания, зависимости)</li>
            <li><b>Стоимость</b> (5D)</li>
          </ul>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Сметчик работает с <b>5D-аспектом BIM</b> — извлекает объёмы и цены.
          </p>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-slate-100 dark:bg-slate-800/60 rounded p-2 text-[11px] text-slate-700 dark:text-slate-300">
              <b className="text-slate-800 dark:text-slate-200">Без BIM:</b> ручной подсчёт по чертежам (≈ 80% времени смета).
            </div>
            <div className="bg-violet-100 dark:bg-violet-900/30 rounded p-2 text-[11px] text-violet-900 dark:text-violet-200">
              <b className="text-violet-800 dark:text-violet-200">С BIM:</b> автоматический экспорт ВОР (≈ 20% времени смета).
            </div>
          </div>
        </section>

        {/* Нормативный блок */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-violet-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <li>
              <b className="text-violet-700 dark:text-violet-300">СН РК 1.04-29-2018</b>{" "}
              «Информационное моделирование (BIM) в строительстве РК»
            </li>
            <li>
              <b className="text-violet-700 dark:text-violet-300">СП РК 1.04-100-2018</b>{" "}
              «Применение BIM в строительстве»
            </li>
            <li>
              <b className="text-violet-700 dark:text-violet-300">ISO 19650</b>{" "}
              — международный стандарт BIM (управление информацией о здании)
            </li>
            <li>
              <b className="text-violet-700 dark:text-violet-300">
                Постановление Правительства РК № 1018 (2017)
              </b>{" "}
              — поэтапный переход к BIM в РК
            </li>
          </ul>
        </section>

        {/* Раздел 1: LOD */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-3">
            Раздел 1. Уровни LOD (Level of Development)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-violet-100 dark:bg-violet-900/40">
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-violet-800 dark:text-violet-200">
                    LOD
                  </th>
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-violet-800 dark:text-violet-200">
                    Описание
                  </th>
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-violet-800 dark:text-violet-200">
                    Что делает сметчик
                  </th>
                </tr>
              </thead>
              <tbody>
                {LOD_ROWS.map((r) => (
                  <tr key={r.lod} className="hover:bg-violet-50 dark:hover:bg-slate-800/50">
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 font-mono font-bold text-violet-700 dark:text-violet-300 whitespace-nowrap">
                      {r.lod}
                    </td>
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.descr}
                    </td>
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {r.smetchik}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: nD */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300">
            Раздел 2. От 3D к 7D — измерения BIM
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {D_LEVELS.map((d) => (
              <div
                key={d.d}
                className={`rounded-lg border p-3 ${
                  d.d === "5D"
                    ? "bg-violet-100 dark:bg-violet-900/40 border-violet-400 dark:border-violet-600"
                    : "bg-white dark:bg-slate-900 border-violet-200 dark:border-slate-700"
                }`}
              >
                <div className="text-2xl font-bold text-violet-700 dark:text-violet-300 mb-1">
                  {d.d}
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  {d.title}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  {d.descr}
                </div>
                {d.d === "5D" && (
                  <div className="mt-1.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                    ← это сметчик
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 3: Программы */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-3">
            Раздел 3. Популярные BIM-программы
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-violet-100 dark:bg-violet-900/40">
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-violet-800 dark:text-violet-200">
                    Программа
                  </th>
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-violet-800 dark:text-violet-200">
                    Производитель
                  </th>
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-violet-800 dark:text-violet-200">
                    Применение
                  </th>
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-violet-800 dark:text-violet-200">
                    Лицензия
                  </th>
                </tr>
              </thead>
              <tbody>
                {SOFT_ROWS.map((r) => (
                  <tr key={r.name} className="hover:bg-violet-50 dark:hover:bg-slate-800/50">
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 font-bold text-violet-700 dark:text-violet-300 whitespace-nowrap">
                      {r.name}
                    </td>
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.vendor}
                    </td>
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.use}
                    </td>
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.lic}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4: Экспорт */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300">
            Раздел 4. Экспорт смет из BIM
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-slate-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-2">
                🅰 Из Revit
              </h3>
              <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-decimal list-inside">
                <li>
                  Создать спецификацию (Schedule) с нужными свойствами:
                  <ul className="ml-5 mt-1 list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                    <li>Категория элемента (Стены, Перекрытия, Двери)</li>
                    <li>Тип, Объём (м³), Площадь (м²)</li>
                    <li>Материал, Марка</li>
                  </ul>
                </li>
                <li>
                  Экспорт в Excel: <b>File → Export → Reports → Schedule</b>
                </li>
                <li>
                  Открыть Excel → импортировать в смету (<b>Смета РК / АВС-4</b>)
                </li>
              </ol>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-slate-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-2">
                🅑 Из ArchiCAD
              </h3>
              <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-decimal list-inside">
                <li>Перечень элементов (<b>Element Schedule</b>)</li>
                <li>
                  Экспорт в <b>IFC</b> (международный формат BIM)
                </li>
                <li>
                  Импорт IFC в специализированную смету (<b>NormCalc, ИСТ Эталон</b>)
                </li>
              </ol>
            </div>

            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-300 dark:border-violet-800 rounded-lg p-3 md:col-span-2">
              <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-2">
                ⭐ Лучшие практики
              </h3>
              <ul className="text-xs text-violet-900 dark:text-violet-200 space-y-1 list-disc list-inside">
                <li>
                  Согласовать <b>типы свойств</b> в проекте между всеми разделами
                </li>
                <li>
                  Использовать <b>общие параметры</b> (Shared Parameters) для смет
                </li>
                <li>
                  Обновлять модель и смету <b>синхронно</b> (изменили проект → обновили смету)
                </li>
                <li>
                  Для крупных объектов — выделять отдельного <b>BIM-координатора</b>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Раздел 5: Преимущества vs Ограничения */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-3">
            Раздел 5. Преимущества и ограничения BIM-смет
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-violet-100 dark:bg-violet-900/40">
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-emerald-800 dark:text-emerald-300">
                    ✓ Преимущества
                  </th>
                  <th className="border border-violet-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-300">
                    ✗ Ограничения
                  </th>
                </tr>
              </thead>
              <tbody>
                {PROS_CONS.map((r, i) => (
                  <tr key={i} className="hover:bg-violet-50 dark:hover:bg-slate-800/50">
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.pro}
                    </td>
                    <td className="border border-violet-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.con}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 6: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-3">
            Раздел 6. Интерактивные упражнения ({done.size}/{EXERCISES.length})
          </h2>

          {/* Tabs */}
          <div className="flex gap-1 flex-wrap mb-3">
            {EXERCISES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => sxi(i)}
                className={`text-[10px] px-2 py-1 rounded font-semibold ${
                  i === xi
                    ? "bg-violet-600 text-white"
                    : done.has(s.id)
                    ? "bg-violet-200 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {done.has(s.id) ? "✓ " : ""}
                Упр. {i + 1}
              </button>
            ))}
          </div>

          <div className="border-l-4 border-violet-400 pl-3">
            <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-1">
              {ex.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3 whitespace-pre-line">
              {ex.q}
            </p>

            {!done.has(ex.id) ? (
              <>
                {ex.kind === "num" && (
                  <div
                    className={`border-2 rounded-lg p-3 ${
                      numOk
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                        : numErr
                        ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                        : "border-violet-200 dark:border-slate-700"
                    }`}
                  >
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      {ex.label}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inp[numKey] ?? ""}
                        onChange={(e) =>
                          setInp((p) => ({ ...p, [ex.id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && !rev[ex.id] && goNum()}
                        disabled={!!rev[ex.id]}
                        placeholder="Число..."
                        className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                      />
                      {!rev[ex.id] && (
                        <button
                          onClick={goNum}
                          disabled={!inp[ex.id]?.trim()}
                          className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded hover:bg-violet-700 disabled:opacity-40"
                        >
                          Проверить
                        </button>
                      )}
                    </div>
                    {rev[ex.id] && (
                      <div
                        className={`mt-2 text-xs leading-relaxed ${
                          numOk
                            ? "text-emerald-800 dark:text-emerald-300"
                            : "text-red-800 dark:text-red-300"
                        }`}
                      >
                        {numOk ? "✓ " : "✗ "}
                        {ex.e}
                      </div>
                    )}
                    {numErr && (
                      <button
                        onClick={retry}
                        className="mt-1 text-[10px] text-amber-700 underline"
                      >
                        Попробовать снова
                      </button>
                    )}
                  </div>
                )}

                {ex.kind === "choice" && (
                  <div
                    className={`border-2 rounded-lg p-3 ${
                      choiceOk
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                        : choiceErr
                        ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                        : "border-violet-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ex.options.map((opt, i) => {
                        const isPicked = picked[ex.id] === i;
                        const isCorrectOpt = i === ex.correctIdx;
                        const showCorrect = rev[ex.id] && isCorrectOpt;
                        const showWrong = rev[ex.id] && isPicked && !isCorrectOpt;
                        return (
                          <button
                            key={i}
                            onClick={() => goChoice(i)}
                            disabled={!!rev[ex.id]}
                            className={`text-left text-xs px-3 py-2 rounded-lg border-2 transition-colors ${
                              showCorrect
                                ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 font-semibold"
                                : showWrong
                                ? "border-red-500 bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200"
                                : isPicked
                                ? "border-violet-500 bg-violet-100 dark:bg-violet-900/30 text-violet-900 dark:text-violet-200"
                                : "border-violet-200 dark:border-slate-700 hover:border-violet-400 text-slate-700 dark:text-slate-300 dark:bg-slate-800/40"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                    {rev[ex.id] && (
                      <div
                        className={`mt-3 text-xs leading-relaxed ${
                          choiceOk
                            ? "text-emerald-800 dark:text-emerald-300"
                            : "text-red-800 dark:text-red-300"
                        }`}
                      >
                        {choiceOk ? "✓ " : "✗ "}
                        {ex.e}
                      </div>
                    )}
                    {choiceErr && (
                      <button
                        onClick={retry}
                        className="mt-1 text-[10px] text-amber-700 underline"
                      >
                        Попробовать снова
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="border-2 border-violet-400 bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                <div className="text-xs font-bold text-violet-800 dark:text-violet-300 mb-1">
                  ✓ Завершено
                </div>
                <p className="text-[11px] text-violet-900 dark:text-violet-200 leading-relaxed">
                  {ex.e}
                </p>
              </div>
            )}

            {done.has(ex.id) && xi + 1 < EXERCISES.length && (
              <button
                onClick={() => sxi(xi + 1)}
                className="mt-3 w-full py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700"
              >
                Следующее упражнение →
              </button>
            )}
          </div>
        </section>

        {/* Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-3">
            Чек-лист «Что знать сметчику для работы в BIM» ({checks.size}/{CHECKLIST.length})
          </h2>
          <ul className="space-y-1.5">
            {CHECKLIST.map((item, i) => (
              <li key={i}>
                <button
                  onClick={() => toggleCheck(i)}
                  className="flex items-start gap-2 text-left w-full hover:bg-violet-50 dark:hover:bg-slate-800/40 rounded px-1.5 py-1"
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 mt-0.5 border-2 rounded text-[10px] font-bold flex items-center justify-center ${
                      checks.has(i)
                        ? "bg-violet-600 border-violet-600 text-white"
                        : "border-violet-400 dark:border-violet-500"
                    }`}
                  >
                    {checks.has(i) ? "✓" : ""}
                  </span>
                  <span
                    className={`text-xs leading-relaxed ${
                      checks.has(i)
                        ? "text-slate-400 dark:text-slate-500 line-through"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Фактоид */}
        <section className="bg-violet-50 dark:bg-violet-900/20 border-l-4 border-violet-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-2">
            💡 ФАКТОИД
          </h2>
          <p className="text-xs text-violet-900 dark:text-violet-200 leading-relaxed">
            BIM в РК пока в стадии внедрения (по <b>ПП РК № 1018</b> — обязательно для бюджетных
            объектов <b>{">"} 1 млрд тг с 2025 г.</b>). Мелкие подрядчики работают по-старому.
            Но владение BIM — это <b>+20-40% к зарплате сметчика</b>.
          </p>
        </section>
      </div>
    </div>
  );
}
