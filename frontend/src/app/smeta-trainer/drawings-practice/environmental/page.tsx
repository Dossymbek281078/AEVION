"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.05) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < tol;
  });
}

interface Step {
  id: string;
  l: string;
  a: string[];
  e: string;
  tol?: number;
}
interface Exercise {
  id: string;
  title: string;
  q: string;
  ss: Step[];
  theory: string;
}

const FEES_ROWS: { fee: string; desc: string; rate: string }[] = [
  { fee: "За выбросы в атмосферу", desc: "Пыль, сварочные аэрозоли, выхлоп техники", rate: "67–450 тг/т CO₂-эквивалент" },
  { fee: "За сбросы в водные объекты", desc: "Сточные воды стройплощадки", rate: "4 500–12 000 тг/м³" },
  { fee: "За размещение производственных отходов", desc: "Утилизация на полигоне", rate: "4 000–7 500 тг/м³" },
  { fee: "За размещение бытовых отходов", desc: "ТБО рабочих", rate: "850–1 500 тг/т" },
  { fee: "За размещение опасных отходов (II кл.)", desc: "Использованные масла, аккумуляторы", rate: "65 000–150 000 тг/т" },
];

const WASTE_ROWS: { cls: string; danger: string; ex: string; util: string }[] = [
  { cls: "I класс", danger: "Чрезвычайно опасные", ex: "Ртутные лампы, ртутные термометры", util: "Лицензированная утилизация" },
  { cls: "II класс", danger: "Высокоопасные", ex: "Свинцовые аккумуляторы, отработанные масла", util: "Спец. утилизация" },
  { cls: "III класс", danger: "Умеренно опасные", ex: "Бетонный бой с радиоактивностью, краски, лаки", util: "Нейтрализация перед утилизацией" },
  { cls: "IV класс", danger: "Малоопасные", ex: "Кирпичный бой, бетонный бой обычный, асфальт", util: "Полигон или вторсырьё" },
  { cls: "V класс", danger: "Безопасные", ex: "Грунт чистый, песок, гравий, дерево не загрязнённое", util: "Полигон или повторное использование" },
];

const EXERCISES: Exercise[] = [
  {
    id: "ex1-concrete",
    title: "Упражнение 1: Стоимость утилизации бетонного боя",
    q: `На стройплощадке демонтируются бетонные конструкции.
Объём бетона к сносу: 80 м³.
Коэффициент разрыхления Кр для бетона = 1.30.
Тариф полигона: 4 500 тг/м³ (среднее).

Рассчитайте стоимость утилизации бетонного боя (в тенге).`,
    ss: [
      {
        id: "concrete-cost",
        l: "Стоимость утилизации, тг",
        a: ["468000", "468 000", "468000.00"],
        e: "Бой = 80 · 1.30 = 104 м³. Стоимость = 104 · 4 500 = 468 000 тг. Допуск ±5% (от 444 600 до 491 400 тг). Учитывай — тариф меняется по регионам и типу полигона.",
        tol: 0.05,
      },
    ],
    theory:
      "Бетонный бой — IV класс отходов (малоопасные). Можно сдать на полигон ИЛИ переработать во вторсырьё (подсыпка, бетон М100). При переработке часто возможна экономия 50–200 тыс тг на 100 м³.",
  },
  {
    id: "ex2-emission",
    title: "Упражнение 2: Платёж за выброс пыли (типовая стройка)",
    q: `Расчётный выброс пыли за весь период строительства: 0.5 т CO₂-эквивалент.
Тариф ПЗЗ: 250 тг/т.

Рассчитайте платёж за выбросы (в тенге).`,
    ss: [
      {
        id: "emission-cost",
        l: "Платёж за выбросы, тг",
        a: ["125", "125.00"],
        e: "Платёж = 0.5 · 250 = 125 тг (символический). Допуск ±20%. ВАЖНО: для типовой стройки эко-платежи незначительны, но для промышленных объектов выбросы могут быть 5–50 т → 1 250–12 500 тг и составлять 1–3% сметы.",
        tol: 0.20,
      },
    ],
    theory:
      "ПЗЗ (платежи за загрязнение) рассчитываются по фактическим эмиссиям. Для жилищного и социального строительства они обычно символические (сотни/тысячи тенге), для промышленных и горнорудных объектов могут составлять миллионы тенге.",
  },
  {
    id: "ex3-class",
    title: "Упражнение 3: Класс отходов от демонтажа кирпичной кладки",
    q: `Сносится кирпичное здание.
Стены — кладка из обычного силикатного и красного кирпича.
Краски на стенах НЕ свинцовые (история эксплуатации проверена).

К какому классу отходов отнести бой кирпичной кладки?
(Введите римскую цифру: I, II, III, IV или V)`,
    ss: [
      {
        id: "class",
        l: "Класс отходов",
        a: ["5", "V", "v"],
        e: "Чистый кирпичный бой → V класс (безопасный). Можно сдать на обычный полигон или использовать как вторсырьё (подсыпка, подготовка под бетон М100). Если бы стены были покрашены свинцовыми красками — III класс (умеренно опасный) с нейтрализацией.",
        tol: 0.5,
      },
    ],
    theory:
      "ВСЕГДА проверяй историю эксплуатации перед демонтажем! Старые здания (1950–1980-е) могут содержать: свинцовые краски, асбест в кровле и трубах, ртуть в лампах. Это превращает IV/V класс в II/III класс с резким ростом стоимости утилизации.",
  },
  {
    id: "ex4-fine",
    title: "Упражнение 4: Штраф за нелегальный выброс отходов",
    q: `Подрядчик выбросил строительный мусор на необорудованную площадку.
По ПП РК № 595: максимальный штраф — 1500 МРП.
1 МРП в 2025 году = 4 250 тг.

Рассчитайте максимальный штраф (в тенге).`,
    ss: [
      {
        id: "fine",
        l: "Максимальный штраф, тг",
        a: ["6375000", "6 375 000", "6375000.00"],
        e: "Штраф = 1500 · 4 250 = 6 375 000 тг. Допуск ±2%. ВАЖНО: + обязательство по рекультивации территории за свой счёт. Может быть в 5–10 раз дороже самого штрафа (30–60 млн тг для крупного нарушения).",
        tol: 0.02,
      },
    ],
    theory:
      "1 МРП (месячный расчётный показатель) ежегодно индексируется. На 2025 год = 4 250 тг. Штрафы по эко-нарушениям РК — одни из самых жёстких в СНГ. Закладывай 1–2% от СМР на эко-мероприятия — это в 5–10 раз дешевле штрафов.",
  },
];

const CHECKLIST = [
  "Экологический раздел в проекте утверждён",
  "Контейнеры для раздельного сбора отходов",
  "Договор с лицензированным перевозчиком отходов",
  "Талоны о сдаче на полигон (хранятся в ИД)",
  "Защитные сетки на лесах (для фасадов > 5 эт.)",
  "Полив территории в сухую погоду",
  "Мойка колёс при выезде с площадки",
  "Очистные сооружения (если стоки > 10 м³/сутки)",
  "Эко-платежи внесены ежеквартально",
  "Экологический отчёт по форме №2-ОС подаётся",
];

export default function EnvironmentalPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, "ok" | "fail" | undefined>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [openEx, setOpenEx] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggleEx = (id: string) => setOpenEx((p) => ({ ...p, [id]: !p[id] }));

  const verify = (exId: string, stepId: string, ans: string[], tol = 0.05) => {
    const key = `${exId}-${stepId}`;
    const v = answers[key] ?? "";
    const ok = check(v, ans, tol);
    setResults((p) => ({ ...p, [key]: ok ? "ok" : "fail" }));
    if (!ok) setShowHint((p) => ({ ...p, [key]: true }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="border-b border-green-200 dark:border-green-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-green-700 dark:text-green-400 hover:underline"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            AEVION Smeta Trainer · Экология
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Title */}
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-green-800 dark:text-green-300">
            🌍 Экология строительства — сборы, отходы, лимиты
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Эко-сборы и эко-смета. С 2022 г. (ПП РК № 595) обязательны для всех стройплощадок РК.
          </p>
        </header>

        {/* Введение */}
        <section className="rounded-lg border-l-4 border-green-500 bg-green-50 dark:bg-green-950/40 p-4">
          <h2 className="font-semibold text-green-800 dark:text-green-300 mb-3">
            📌 Экологические требования к стройке РК (с 2022 г.)
          </h2>
          <ul className="text-sm space-y-1 text-green-900 dark:text-green-200 mb-3 list-disc pl-5">
            <li>Эмиссии в окружающую среду (выбросы пыли, шум, вибрация)</li>
            <li>Управление строительными отходами</li>
            <li>Платежи за загрязнение (ПЗЗ)</li>
            <li>Согласование экологического раздела проекта</li>
          </ul>
          <p className="text-sm text-green-900 dark:text-green-200 mb-2">
            <span className="font-semibold">Стоимость в смете:</span> 0.5–2.5% от СМР (для типовых до
            1%, для крупных и в природоохранных зонах до 5%).
          </p>
          <p className="text-sm text-red-700 dark:text-red-400 font-semibold">
            ⚠️ Без эко-раздела в проекте и оплаченных эко-сборов: объект НЕ ВВОДИТСЯ в эксплуатацию
            (ст. 332 ЭК РК).
          </p>
        </section>

        {/* Нормативный блок */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
            📚 Нормативная база
          </h2>
          <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
            <li>
              <span className="font-mono text-xs text-green-700 dark:text-green-400">
                Эко. кодекс
              </span>{" "}
              <span className="font-semibold">Экологический кодекс РК № 400-VI</span> (2021)
            </li>
            <li>
              <span className="font-mono text-xs text-green-700 dark:text-green-400">ПП РК</span>{" "}
              <span className="font-semibold">№ 595 от 31.07.2022</span> «Правила обращения с
              отходами»
            </li>
            <li>
              <span className="font-mono text-xs text-green-700 dark:text-green-400">ПП РК</span>{" "}
              <span className="font-semibold">№ 786</span> «Тарифы за эмиссии в окружающую среду»
              (2024)
            </li>
            <li>
              <span className="font-mono text-xs text-green-700 dark:text-green-400">ГОСТ</span>{" "}
              <span className="font-semibold">ГОСТ Р 52108-2003</span> Ресурсосбережение. Обращение с
              отходами
            </li>
          </ul>
        </section>

        {/* Раздел 1: Виды эко-сборов */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
            Раздел 1. Виды эко-сборов
          </h2>
          <div className="overflow-x-auto rounded-lg border border-green-200 dark:border-green-900">
            <table className="w-full text-sm">
              <thead className="bg-green-100 dark:bg-green-950/50 text-green-900 dark:text-green-200">
                <tr>
                  <th className="px-3 py-2 text-left">Сбор</th>
                  <th className="px-3 py-2 text-left">Описание</th>
                  <th className="px-3 py-2 text-left">Тариф</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900">
                {FEES_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-200 dark:border-slate-800 hover:bg-green-50 dark:hover:bg-green-950/20"
                  >
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                      {r.fee}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{r.desc}</td>
                    <td className="px-3 py-2 font-mono text-xs text-green-700 dark:text-green-400">
                      {r.rate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Классификация отходов */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
            Раздел 2. Классификация отходов строительства
          </h2>
          <div className="overflow-x-auto rounded-lg border border-green-200 dark:border-green-900">
            <table className="w-full text-sm">
              <thead className="bg-green-100 dark:bg-green-950/50 text-green-900 dark:text-green-200">
                <tr>
                  <th className="px-3 py-2 text-left">Класс</th>
                  <th className="px-3 py-2 text-left">Опасность</th>
                  <th className="px-3 py-2 text-left">Примеры</th>
                  <th className="px-3 py-2 text-left">Способ утилизации</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900">
                {WASTE_ROWS.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-200 dark:border-slate-800 hover:bg-green-50 dark:hover:bg-green-950/20"
                  >
                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                      {r.cls}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.danger}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs">{r.ex}</td>
                    <td className="px-3 py-2 text-green-700 dark:text-green-400 text-xs">
                      {r.util}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3: Снижение эко-нагрузки */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
            Раздел 3. Снижение эко-нагрузки (хорошие практики)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-green-200 dark:border-green-900 bg-white dark:bg-slate-900 p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                🌫 Выбросы пыли
              </h3>
              <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300 list-disc pl-5">
                <li>Полив территории водой 2–3 раза/день (особенно при сухой погоде)</li>
                <li>Защитные сетки на лесах (для фасадов многоэтажек)</li>
                <li>Закрытые контейнеры для перевозки сыпучих материалов</li>
                <li>Мойка колёс на выезде с площадки</li>
              </ul>
              <div className="mt-3 text-xs text-green-700 dark:text-green-400 font-mono">
                Стоимость: 0.1–0.3% от СМР
              </div>
            </div>

            <div className="rounded-lg border border-green-200 dark:border-green-900 bg-white dark:bg-slate-900 p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">🔇 Шум</h3>
              <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300 list-disc pl-5">
                <li>Работы только в дневное время (07:00–22:00 по СНиП РК 4.04-21)</li>
                <li>Ограждение площадки 2 м (поглощает шум на 10–15 дБ)</li>
                <li>Замена отбойного молотка на бесшумную технику (где возможно)</li>
              </ul>
              <div className="mt-3 text-xs text-green-700 dark:text-green-400 font-mono">
                Стоимость: входит в стоимость ограждения
              </div>
            </div>

            <div className="rounded-lg border border-green-200 dark:border-green-900 bg-white dark:bg-slate-900 p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">♻️ Отходы</h3>
              <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300 list-disc pl-5">
                <li>Раздельный сбор (бетон / металл / древесина / ТБО) на площадке</li>
                <li>Лицензированный перевозчик отходов (ПП РК № 595)</li>
                <li>Талоны о сдаче на полигон (для отчётности)</li>
                <li>
                  Использование вторсырья: бетонный бой → подсыпка, кирпич → подготовка под бетон
                  М100
                </li>
              </ul>
              <div className="mt-3 text-xs text-green-700 dark:text-green-400 font-mono">
                Экономия: 50–200 тыс тг на 100 м³ боя при переработке
              </div>
            </div>

            <div className="rounded-lg border border-green-200 dark:border-green-900 bg-white dark:bg-slate-900 p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                💧 Водопотребление
              </h3>
              <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300 list-disc pl-5">
                <li>Учёт по счётчику на стройплощадке</li>
                <li>Накопительные ёмкости для технической воды</li>
                <li>Очистные сооружения для сточных (если объёмы &gt; 10 м³/сутки)</li>
              </ul>
              <div className="mt-3 text-xs text-green-700 dark:text-green-400 font-mono">
                ПЗЗ за стоки: 4 500–12 000 тг/м³
              </div>
            </div>
          </div>
        </section>

        {/* Раздел 4: Эко-смета */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
            Раздел 4. Эко-смета — структура и шаблон
          </h2>
          <div className="rounded-lg border border-green-200 dark:border-green-900 bg-white dark:bg-slate-900 p-4">
            <div className="text-sm font-semibold text-green-800 dark:text-green-300 mb-3 text-center border-b border-green-200 dark:border-green-900 pb-2">
              РАЗДЕЛ «ОХРАНА ОКРУЖАЮЩЕЙ СРЕДЫ» В СМЕТЕ
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  1. МЕРОПРИЯТИЯ ПО СНИЖЕНИЮ ВОЗДЕЙСТВИЙ:
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 pl-4">
                  <li className="flex justify-between">
                    <span>Ограждение стройплощадки с защитными сетками</span>
                    <span className="font-mono text-green-700 dark:text-green-400">145 000 тг</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Полив грунта от пыли (на 6 мес)</span>
                    <span className="font-mono text-green-700 dark:text-green-400">85 000 тг</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Мойка колёс при выезде</span>
                    <span className="font-mono text-green-700 dark:text-green-400">65 000 тг</span>
                  </li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  2. УПРАВЛЕНИЕ ОТХОДАМИ:
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 pl-4">
                  <li className="flex justify-between">
                    <span>Контейнеры для раздельного сбора</span>
                    <span className="font-mono text-green-700 dark:text-green-400">25 000 тг</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Утилизация бетонного боя 100 м³ × 4500 тг/м³</span>
                    <span className="font-mono text-green-700 dark:text-green-400">450 000 тг</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Утилизация деревянных отходов</span>
                    <span className="font-mono text-green-700 dark:text-green-400">25 000 тг</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Утилизация ТБО на полигон</span>
                    <span className="font-mono text-green-700 dark:text-green-400">65 000 тг</span>
                  </li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  3. ЭКОЛОГИЧЕСКИЕ ПЛАТЕЖИ:
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 pl-4">
                  <li className="flex justify-between">
                    <span>Платежи за выбросы (ПЗЗ)</span>
                    <span className="font-mono text-green-700 dark:text-green-400">35 000 тг</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Платежи за размещение отходов</span>
                    <span className="font-mono text-green-700 dark:text-green-400">145 000 тг</span>
                  </li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  4. ОТЧЁТНОСТЬ:
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 pl-4">
                  <li className="flex justify-between">
                    <span>Экологический раздел проекта (одноразово)</span>
                    <span className="font-mono text-green-700 dark:text-green-400">350 000 тг</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Ежеквартальный экологический отчёт (4 × 35 000)</span>
                    <span className="font-mono text-green-700 dark:text-green-400">140 000 тг</span>
                  </li>
                </ul>
              </div>

              <div className="border-t-2 border-green-300 dark:border-green-800 pt-3 mt-3">
                <div className="flex justify-between text-base font-bold text-green-800 dark:text-green-300">
                  <span>ИТОГО (для типовой стройки 600 м²):</span>
                  <span className="font-mono">~1.5 млн тг</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right italic">
                  Это ≈ 1–2% от стоимости объекта 100–150 млн тг.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Раздел 5: Упражнения */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
            Раздел 5. Интерактивные упражнения
          </h2>
          <div className="space-y-4">
            {EXERCISES.map((ex) => {
              const isOpen = openEx[ex.id] ?? true;
              return (
                <div
                  key={ex.id}
                  className="rounded-lg border border-green-300 dark:border-green-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <button
                    onClick={() => toggleEx(ex.id)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-950/60 transition"
                  >
                    <span className="font-semibold text-green-800 dark:text-green-300 text-left">
                      {ex.title}
                    </span>
                    <span className="text-green-700 dark:text-green-400 text-xl">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="p-4 space-y-3">
                      <pre className="text-sm whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded p-3 border border-slate-200 dark:border-slate-800">
                        {ex.q}
                      </pre>

                      {ex.ss.map((s) => {
                        const key = `${ex.id}-${s.id}`;
                        const r = results[key];
                        return (
                          <div key={s.id} className="space-y-2">
                            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                              {s.l}
                            </label>
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={answers[key] ?? ""}
                                onChange={(e) =>
                                  setAnswers((p) => ({ ...p, [key]: e.target.value }))
                                }
                                className={`flex-1 px-3 py-2 rounded border text-sm bg-white dark:bg-slate-800 ${
                                  r === "ok"
                                    ? "border-green-500 dark:border-green-600"
                                    : r === "fail"
                                    ? "border-red-500 dark:border-red-600"
                                    : "border-slate-300 dark:border-slate-700"
                                } text-slate-900 dark:text-slate-100`}
                                placeholder="Введите ответ"
                              />
                              <button
                                onClick={() => verify(ex.id, s.id, s.a, s.tol ?? 0.05)}
                                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                              >
                                Проверить
                              </button>
                            </div>
                            {r === "ok" && (
                              <div className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 rounded p-2 border border-green-200 dark:border-green-900">
                                ✅ Верно! {s.e}
                              </div>
                            )}
                            {r === "fail" && showHint[key] && (
                              <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded p-2 border border-red-200 dark:border-red-900">
                                ❌ Не верно. {s.e}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="text-xs text-slate-600 dark:text-slate-400 italic border-l-2 border-green-400 pl-3 py-1">
                        💡 {ex.theory}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Чек-лист */}
        <section className="rounded-lg border border-green-300 dark:border-green-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="font-bold text-green-800 dark:text-green-300 mb-3">
            ✅ Чек-лист «Эко-требования на стройке» (10 пунктов)
          </h2>
          <ul className="space-y-2">
            {CHECKLIST.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={(e) => setChecked((p) => ({ ...p, [i]: e.target.checked }))}
                  className="mt-1 accent-green-600"
                />
                <span
                  className={
                    checked[i]
                      ? "line-through text-slate-400 dark:text-slate-500"
                      : "text-slate-700 dark:text-slate-300"
                  }
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Выполнено: {Object.values(checked).filter(Boolean).length} / {CHECKLIST.length}
          </div>
        </section>

        {/* Фактоид */}
        <section className="rounded-lg border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/40 p-4">
          <div className="text-sm text-green-900 dark:text-green-200">
            <span className="font-bold text-green-800 dark:text-green-300">
              🌱 ЭКОЛОГИЯ — НЕ ОПЦИЯ.
            </span>{" "}
            С 2022 г. за нарушения штрафы до 6.4 млн тг + рекультивация. Закладывай 1–2% от СМР на
            эко-мероприятия — это в 5–10 раз дешевле, чем последующие штрафы и переделки.
          </div>
        </section>

        <div className="h-12" />
      </main>
    </div>
  );
}
