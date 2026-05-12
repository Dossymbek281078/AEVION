"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.01) {
  const v = parseFloat(i.replace(",", ".").replace(/\s/g, ""));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", ".").replace(/\s/g, ""));
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
  vor: string;
  theory: string;
}

const TERMS: { term: string; def: string }[] = [
  { term: "НОВОЕ СТРОИТЕЛЬСТВО", def: "возведение объекта на новом месте" },
  { term: "РЕКОНСТРУКЦИЯ", def: "изменение параметров существующего объекта (площадь, высота, этажность, объём)" },
  { term: "КАПРЕМОНТ", def: "замена / восстановление конструкций БЕЗ изменения параметров" },
  { term: "РЕСТАВРАЦИЯ", def: "восстановление объектов культ. наследия с сохранением подлинности" },
  { term: "МОДЕРНИЗАЦИЯ", def: "улучшение технико-экономических показателей (например, замена окон на энергоэффективные)" },
];

const NORMS: { code: string; title: string }[] = [
  { code: "СН РК 1.04-26-2011", title: "«Реконструкция, капитальный и текущий ремонт жилых и общественных зданий»" },
  { code: "СНиП РК 3.04-32-2008", title: "«Реконструкция жилых зданий»" },
  { code: "СН РК 1.04-21-2003", title: "«Реставрация и восстановление памятников архитектуры»" },
  { code: "МДС 81-35.2004", title: "п. 4.4–4.7 — Коэффициенты для реконструкции" },
  { code: "МДС 81-25.2004", title: "Прил. №2 — Лимит затрат на ПИР для реконструкции" },
];

const COEFS: { k: string; use: string; cond: string }[] = [
  { k: "К=1.15", use: "Все строительно-монтажные работы", cond: "Работа на действующем объекте (существующее производство, действующая школа)" },
  { k: "К=1.25", use: "Транспортировка материалов", cond: "Если подъезд затруднён, узкие проходы" },
  { k: "К=0.85", use: "Временные здания и сооружения", cond: "Сокращение в 1.5 раза против нового стр-ва" },
  { k: "К=1.50", use: "Дополнительные затраты на отопление", cond: "При работах в зимний период в неотапл. помещении" },
  { k: "К=0.5", use: "Расценки нового стр-ва, применяемые на демонтаж", cond: "Если в Сб.46 нет конкретной позиции" },
  { k: "К=1.30", use: "Снос временных перегородок и др. ограничивающих", cond: "Если необходимо обеспечение проезда техники" },
];

const ADD_ITEMS: string[] = [
  "Демонтаж существующих конструкций — ЭСН РК Сб.46",
  "Усиление существующих конструкций — индивидуальные расчёты по проекту",
  "Защита прилегающих конструкций — пластиковые покрытия, временные ограждения",
  "Освидетельствование — инструментальное обследование (затраты ПИР)",
  "Утилизация отходов — обязательно по ПП РК № 595",
  "Временные подключения — энергия, вода, канализация на период работ",
  "Восстановление существующих покрытий после ремонта",
  "Сохранение функционирования — например, если школа работает, то работы только во 2-ю смену",
];

const NOT_APPLIED: string[] = [
  "Подготовка площадки (она уже есть)",
  "Магистральные сети ввод (уже подключены)",
  "Геологические изыскания (могут не требоваться, если есть старые)",
];

const COMPARE: { aspect: string; new_: string; rest: string }[] = [
  { aspect: "Материалы", new_: "Современные по ГОСТ", rest: "Аутентичные (старый кирпич, известь)" },
  { aspect: "Технологии", new_: "Машинные", rest: "Часто ручные (по ПИР)" },
  { aspect: "Согласование", new_: "Местные органы", rest: "КГА «Памятники» + Министерство культуры" },
  { aspect: "Стоимость на 1 м²", new_: "80–150 тыс. тг", rest: "350–1 500 тыс. тг" },
  { aspect: "Сроки", new_: "По проекту", rest: "В 3–5 раз дольше" },
  { aspect: "Документация", new_: "Обычная исполнительная", rest: "+ детальные обмеры и фотофиксация ДО / ПОСЛЕ" },
  { aspect: "Норматив", new_: "СНиП РК", rest: "СН РК 1.04-21-2003 + ICOMOS" },
];

const STEPS: Exercise[] = [
  {
    id: "ex1-k115",
    title: "Упражнение 1: Расчёт стоимости работ при реконструкции с К=1.15",
    q: `Реконструкция действующей школы №47.
Базовая стоимость СМР по ЭСН РК (без коэффициента) = 25 000 000 тг.
Применяем К=1.15 (работа на действующем объекте по МДС 81-35 п. 4.4).

Рассчитайте либо общую стоимость с коэффициентом, либо удорожание (разницу).`,
    ss: [
      {
        id: "k115",
        l: "Стоимость с К=1.15 (тг) ИЛИ удорожание (тг)",
        a: ["28750000", "28 750 000", "3750000", "3 750 000"],
        e: "Стоимость с коэффициентом: 25 000 000 · 1.15 = 28 750 000 тг. Удорожание: 28 750 000 − 25 000 000 = 3 750 000 тг. Принимаются оба варианта ответа. К=1.15 — обязательный коэффициент при работе на действующем объекте по МДС 81-35.2004 п. 4.4.",
      },
    ],
    vor: "СМР реконструкции действующей школы: 25 000 000 · 1.15 = 28 750 000 тг (МДС 81-35.2004 п. 4.4)",
    theory:
      "Коэффициент К=1.15 применяется ко ВСЕМ строительно-монтажным работам, выполняемым на действующем объекте. Учитывает помехи: ограниченный фронт работ, перерывы, особые меры безопасности.",
  },
  {
    id: "ex2-demol",
    title: "Упражнение 2: Дополнительный демонтаж в смете капремонта",
    q: `Капремонт офисного здания: разбираем 8 старых кирпичных перегородок.
Размеры одной перегородки: длина 2.4 м · высота 3.0 м · толщина 0.12 м.
Расценка ЭСН РК Сб.46-1-001, тариф = 8 500 тг/м³ за разборку.

Рассчитайте стоимость демонтажа всех 8 перегородок (в тг).`,
    ss: [
      {
        id: "demol",
        l: "Стоимость демонтажа, тг",
        a: ["58740", "58 740"],
        tol: 0.02,
        e: "Объём одной: 2.4 · 3.0 · 0.12 = 0.864 м³. Всего: 0.864 · 8 = 6.91 м³. Стоимость: 6.91 · 8 500 = 58 740 тг. К этой стоимости отдельно добавляется утилизация боя: 6.91 · 1.25 (Кр) · 4 000 тг/м³ ≈ 34 564 тг.",
      },
    ],
    vor: "Демонтаж 8 кирп. перегородок: 6.91 м³ · 8 500 = 58 740 тг (ЭСН РК Сб.46-1-001)",
    theory:
      "Сб.46 ЭСН РК — стандартный сборник на демонтаж. Если позиции нет в Сб.46, применяется расценка нового стр-ва с понижающим К=0.5 (МДС 81-25 п. 2.21).",
  },
  {
    id: "ex3-rest",
    title: "Упражнение 3: Площадь восстанавливаемой штукатурки в реставрационном объекте",
    q: `Реставрационный объект (памятник архитектуры).
Помещение 6.0 × 8.0 × 3.5 м. Повреждено 35% штукатурки.
Окна: 2 шт по 1.5 × 2.0 м. Двери: 1 шт 0.9 × 2.1 м.

Рассчитайте площадь восстанавливаемой штукатурки (м²).`,
    ss: [
      {
        id: "rest",
        l: "Площадь восстанавливаемой штукатурки, м²",
        a: ["31.5", "31,5"],
        tol: 0.02,
        e: "Брутто стен: 2·(6+8)·3.5 = 98 м². Проёмы: 2·1.5·2.0 + 1·0.9·2.1 = 6 + 1.89 = 7.89 м². Нетто: 98 − 7.89 = 90.11 м². Восстанавливается: 90.11 · 0.35 ≈ 31.5 м². При реставрации применяется ручная штукатурка по особому составу (известково-песчаная). Расценка ЭСН РК Сб.15 + К=1.30 (реставрационные работы).",
      },
    ],
    vor: "Реставрация штукатурки 35% помещ. 6×8×3.5: 31.5 м² (ЭСН РК Сб.15 + К=1.30)",
    theory:
      "При реставрации памятников архитектуры применяются аутентичные материалы (известково-песчаный раствор вместо цементно-песчаного) и ручные технологии. Расценки ЭСН РК для нового стр-ва корректируются повышающим К=1.30.",
  },
  {
    id: "ex4-pir",
    title: "Упражнение 4: Лимит затрат на проектные работы для реконструкции",
    q: `Сметная стоимость СМР реконструкции общественного здания = 50 000 000 тг.
Лимит ПИР по МДС 81-25.2004 Прил. №2 для реконструкции общественных зданий = 8.5%.

Рассчитайте стоимость ПИР (в тг).`,
    ss: [
      {
        id: "pir",
        l: "Стоимость ПИР, тг",
        a: ["4250000", "4 250 000"],
        e: "ПИР = 50 000 000 · 0.085 = 4 250 000 тг. Для нового строительства лимит ПИР составляет 5–7%, для реконструкции выше (8.5%) из-за сложности обмеров, инструментального обследования и индивидуального проектирования усилений.",
      },
    ],
    vor: "ПИР реконструкции (8.5% от СМР): 50 000 000 · 0.085 = 4 250 000 тг (МДС 81-25.2004 Прил. №2)",
    theory:
      "Лимит ПИР для реконструкции выше, чем для нового строительства — 8–10% против 5–7%. Это связано с необходимостью детальных обмеров, инструментального обследования существующих конструкций и расчётов усилений.",
  },
];

const CHECKLIST: string[] = [
  "Получить акт натурного обследования объекта",
  "Согласовать график работ с владельцем (если общественное здание)",
  "Получить разрешение на снос/демонтаж (если требуется)",
  "Защитить прилегающие конструкции",
  "Установить временные ограждения и навесы",
  "Подключить временные сети (электричество, вода)",
  "Уведомить службу газового хозяйства / Энергонадзор",
  "Согласовать вывоз строительных отходов с лицензированным перевозчиком",
];

export default function ReconstructionPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [chk, setChk] = useState<Set<number>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a, step.tol ?? 0.01);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a, step.tol ?? 0.01)) {
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

  function toggleChk(i: number) {
    setChk((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-purple-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-purple-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🔄 Реконструкция и реставрация — отличия от нового строительства
            </h1>
            <p className="text-[10px] text-purple-200">
              СН РК 1.04-26-2011 · МДС 81-35.2004 · {done.size}/{STEPS.length} упражнений
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-5">
        {/* Терминологическая карточка */}
        <section className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400 rounded-r-lg p-4">
          <h2 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-3">
            📖 ОТЛИЧАЕМ ТЕРМИНЫ (по СН РК 1.04-26-2011)
          </h2>
          <ul className="space-y-2">
            {TERMS.map((t) => (
              <li
                key={t.term}
                className="text-xs text-purple-900 dark:text-purple-100 leading-relaxed"
              >
                <span className="font-bold">• {t.term}</span>{" "}
                <span className="text-purple-800 dark:text-purple-200">— {t.def}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Нормативный блок */}
        <section className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-3">
            📋 Нормативная база
          </h2>
          <ul className="space-y-1.5">
            {NORMS.map((n) => (
              <li key={n.code} className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-bold font-mono text-purple-700 dark:text-purple-300">
                  {n.code}
                </span>{" "}
                {n.title}
              </li>
            ))}
          </ul>
        </section>

        {/* Раздел 1: Коэффициенты */}
        <section className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-3">
            Раздел 1. Коэффициенты для реконструкции (МДС 81-35.2004)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100">
                  <th className="px-2 py-1.5 text-left border border-purple-200 dark:border-purple-700">
                    Коэффициент
                  </th>
                  <th className="px-2 py-1.5 text-left border border-purple-200 dark:border-purple-700">
                    Применение
                  </th>
                  <th className="px-2 py-1.5 text-left border border-purple-200 dark:border-purple-700">
                    Условие
                  </th>
                </tr>
              </thead>
              <tbody>
                {COEFS.map((c) => (
                  <tr
                    key={c.k}
                    className="text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/10"
                  >
                    <td className="px-2 py-1.5 border border-purple-200 dark:border-purple-700 font-mono font-bold text-purple-700 dark:text-purple-300 whitespace-nowrap">
                      {c.k}
                    </td>
                    <td className="px-2 py-1.5 border border-purple-200 dark:border-purple-700">
                      {c.use}
                    </td>
                    <td className="px-2 py-1.5 border border-purple-200 dark:border-purple-700 text-slate-600 dark:text-slate-400">
                      {c.cond}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Что добавляется / не применяется */}
        <section className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-3">
            Раздел 2. Что добавляется к смете при реконструкции (отличия от нового стр-ва)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
                Дополнительные позиции:
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {ADD_ITEMS.map((it) => (
                  <li key={it} className="leading-relaxed">
                    {it}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
                Что НЕ применяется (по сравнению с новым стр-вом):
              </h3>
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {NOT_APPLIED.map((it) => (
                  <li key={it} className="leading-relaxed">
                    <span className="text-red-500 font-bold">−</span> {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Раздел 3: Особенности реставрации */}
        <section className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-3">
            Раздел 3. Особенности реставрации памятников архитектуры
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100">
                  <th className="px-2 py-1.5 text-left border border-purple-200 dark:border-purple-700">
                    Аспект
                  </th>
                  <th className="px-2 py-1.5 text-left border border-purple-200 dark:border-purple-700">
                    Новое стр-во
                  </th>
                  <th className="px-2 py-1.5 text-left border border-purple-200 dark:border-purple-700">
                    Реставрация
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((c) => (
                  <tr
                    key={c.aspect}
                    className="text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/10"
                  >
                    <td className="px-2 py-1.5 border border-purple-200 dark:border-purple-700 font-semibold text-purple-700 dark:text-purple-300">
                      {c.aspect}
                    </td>
                    <td className="px-2 py-1.5 border border-purple-200 dark:border-purple-700">
                      {c.new_}
                    </td>
                    <td className="px-2 py-1.5 border border-purple-200 dark:border-purple-700 text-slate-600 dark:text-slate-400">
                      {c.rest}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-3">
            Раздел 4. Интерактивные упражнения ({done.size}/{STEPS.length})
          </h2>

          {/* Tabs */}
          <div className="flex gap-1 flex-wrap mb-3">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  sxi(i);
                  ssi(0);
                  setRev({});
                }}
                className={`text-[10px] px-2.5 py-1 rounded font-semibold transition ${
                  i === xi
                    ? "bg-purple-600 text-white"
                    : done.has(s.id)
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {done.has(s.id) ? "✓ " : ""}
                {i + 1}
              </button>
            ))}
          </div>

          {/* Exercise card */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              {ex.title}
            </h3>
            <pre className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3 whitespace-pre-wrap font-sans">
              {ex.q}
            </pre>

            {!done.has(ex.id) ? (
              <div
                className={`border-2 rounded-lg p-3 ${
                  ok
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    : err
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : "border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-900"
                }`}
              >
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  {step.l}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inp[k] ?? ""}
                    onChange={(e) => setInp((p) => ({ ...p, [k]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && !rev[k] && go()}
                    disabled={!!rev[k]}
                    placeholder="Число..."
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!rev[k] && (
                    <button
                      onClick={go}
                      disabled={!inp[k]?.trim()}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded hover:bg-purple-700 disabled:opacity-40"
                    >
                      Проверить ✓
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
              <div className="border-2 border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <div className="text-xs font-bold text-purple-800 dark:text-purple-200 mb-1">
                  ✓ Завершено
                </div>
                <code className="text-[10px] font-mono text-purple-700 dark:text-purple-300 block">
                  {ex.vor}
                </code>
              </div>
            )}

            {ex.theory && (
              <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded p-2 text-[11px] text-purple-800 dark:text-purple-200 leading-relaxed">
                📖 {ex.theory}
              </div>
            )}

            {done.has(ex.id) && xi + 1 < STEPS.length && (
              <button
                onClick={() => {
                  sxi(xi + 1);
                  ssi(0);
                  setRev({});
                }}
                className="mt-3 w-full py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700"
              >
                Следующее упражнение →
              </button>
            )}
          </div>
        </section>

        {/* Раздел 5: Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-3">
            Раздел 5. Чек-лист подготовки к реконструкции
          </h2>
          <ul className="space-y-2">
            {CHECKLIST.map((it, i) => (
              <li key={i} className="flex items-start gap-2">
                <button
                  onClick={() => toggleChk(i)}
                  className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center text-[10px] transition ${
                    chk.has(i)
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "border-purple-300 dark:border-purple-600 bg-white dark:bg-slate-900"
                  }`}
                  aria-label={chk.has(i) ? "Снять отметку" : "Отметить"}
                >
                  {chk.has(i) ? "✓" : ""}
                </button>
                <span
                  className={`text-xs leading-relaxed ${
                    chk.has(i)
                      ? "text-slate-400 dark:text-slate-500 line-through"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {it}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-[10px] text-purple-700 dark:text-purple-400">
            Отмечено: {chk.size}/{CHECKLIST.length}
          </div>
        </section>

        {/* Фактоид */}
        <section className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400 rounded-r-lg p-4">
          <p className="text-xs text-purple-900 dark:text-purple-100 leading-relaxed">
            <span className="font-bold">💡 ВАЖНО:</span> При реконструкции жилого фонда часто
            применяется «принцип одной квартиры» — работы ведутся посекционно, чтобы жильцы могли
            продолжать использовать своё жилище. Это увеличивает срок строительства, но снижает
            социальные риски.
          </p>
        </section>
      </div>
    </div>
  );
}
