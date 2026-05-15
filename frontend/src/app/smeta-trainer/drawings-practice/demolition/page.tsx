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

interface Step {
  id: string;
  l: string;
  a: string[];
  e: string;
}
interface Exercise {
  id: string;
  title: string;
  q: string;
  ss: Step[];
  vor: string;
  theory: string;
}

const ESN_ROWS: { code: string; what: string; unit: string; note: string }[] = [
  { code: "ЭСН 46-1-001", what: "Кирпичная кладка наружных стен", unit: "м³", note: "Учитывается заполнение проёмов" },
  { code: "ЭСН 46-1-005", what: "Ж/б фундаментные блоки", unit: "м³", note: "Тяжёлая техника обязательна" },
  { code: "ЭСН 46-2-001", what: "Деревянные перегородки", unit: "м²", note: "Без сноса остекления" },
  { code: "ЭСН 46-2-005", what: "Ж/б плиты перекрытий", unit: "шт или м²", note: "Опасные работы (3-я категория)" },
  { code: "ЭСН 46-3-001", what: "Деревянные стропила и обрешётка", unit: "м²", note: "Кровельный материал отдельно" },
  { code: "ЭСН 46-3-005", what: "Кровля рулонная", unit: "м²", note: "Старый рубероид → ТКО" },
  { code: "ЭСН 46-4-001", what: "Снятие штукатурки со стен", unit: "м²", note: "С учётом удаления раствора" },
  { code: "ЭСН 46-5-001", what: "Демонтаж сан/тех приборов", unit: "шт", note: "По типу прибора" },
  { code: "ЭСН 46-5-010", what: "Демонтаж радиаторов", unit: "шт", note: "Без слива системы (отдельно)" },
  { code: "ЭСН 46-6-001", what: "Демонтаж эл/проводки скрытой", unit: "м.п.", note: "+ штукатурка восстановление" },
  { code: "ЭСН 46-7-001", what: "Демонтаж окон ПВХ", unit: "шт", note: "По размеру: до 2 м² / свыше" },
  { code: "ЭСН 46-7-010", what: "Демонтаж дверных блоков", unit: "шт", note: "Внутр./наружн. отдельно" },
];

const COEF_ROWS: { k: string; use: string; src: string }[] = [
  { k: "К=0.5", use: "Для расценок на новое строительство, применяемых для аналогичных работ при демонтаже", src: "МДС 81-25 п. 2.21" },
  { k: "К=0.8", use: "При работах в стеснённых условиях", src: "МДС 81-35 п. 4.7" },
  { k: "К=1.15", use: "При работе на действующем предприятии", src: "МДС 81-35 п. 4.4" },
  { k: "К=1.20", use: "При работе в зоне с радиоактивным заражением", src: "МДС 81-35 п. 4.6" },
];

const STEPS: Exercise[] = [
  {
    id: "ex1-brick",
    title: "Упражнение 1: Объём кирпичного боя от демонтажа стены",
    q: `Демонтируется кирпичная стена.
Размеры: длина 12.0 м × высота 3.0 м × толщина 0.38 м.
Коэффициент разрыхления Кр = 1.25 (среднее значение для кирпичной кладки).

Рассчитайте объём кирпичного боя после демонтажа (в м³).`,
    ss: [
      {
        id: "boy",
        l: "Объём кирпичного боя, м³",
        a: ["17.1", "17,1", "17.10"],
        e: "Объём кладки = 12.0 · 3.0 · 0.38 = 13.68 м³. Объём боя = 13.68 · 1.25 = 17.10 м³. Коэффициент разрыхления 1.25 — среднее значение. Для аккуратной разборки применяют 1.15.",
      },
    ],
    vor: "Кирпичный бой от демонтажа стены 12.0×3.0×0.38: 13.68 · 1.25 = 17.10 м³ (ЭСН РК Сб.46 §46-1-001)",
    theory:
      "Коэффициент разрыхления Кр учитывает увеличение объёма материала после разрушения структуры. Для кирпичной кладки Кр = 1.15 (аккуратная разборка) — 1.30 (с боем).",
  },
  {
    id: "ex2-windows",
    title: "Упражнение 2: Количество демонтируемых окон в школе",
    q: `Школа: 3 этажа.
На каждом этаже:
  • 12 классов × 2 окна
  • 4 окна в коридоре
  • 2 окна в туалете

Рассчитайте общее количество окон ПВХ к демонтажу.`,
    ss: [
      {
        id: "win",
        l: "Количество окон, шт",
        a: ["90"],
        e: "На этаж: 12·2 + 4 + 2 = 30 окон. Всего: 3 · 30 = 90 окон ПВХ. Позиция ЭСН Сб.46 §46-7-001. Стеклопакеты не пригодны к повторному использованию (повреждаются при демонтаже).",
      },
    ],
    vor: "Демонтаж окон ПВХ в школе (3 эт.): 90 шт (ЭСН РК Сб.46 §46-7-001)",
    theory:
      "При демонтаже окон ПВХ стеклопакеты практически всегда повреждаются. Если стеклопакеты планируется сохранить — применяется отдельная расценка с пониженной нормой выработки.",
  },
  {
    id: "ex3-conc",
    title: "Упражнение 3: Стоимость утилизации боя бетона",
    q: `Демонтируется 100 м³ бетонных конструкций.
Коэффициент разрыхления для бетона Кр = 1.30.
Тариф полигона по утилизации боя бетона = 4000 тг/м³ (среднее).

Рассчитайте стоимость утилизации боя на полигоне (в тг).`,
    ss: [
      {
        id: "cost",
        l: "Стоимость утилизации, тг",
        a: ["520000", "520 000", "520000.0"],
        e: "Объём боя = 100 · 1.30 = 130 м³. Стоимость = 130 · 4000 = 520 000 тг. Статья «Утилизация отходов производства» отдельная в смете. Часто заказчик берёт на свой баланс.",
      },
    ],
    vor: "Утилизация боя бетона (100 м³ конструкций · Кр=1.30 · 4000 тг/м³): 520 000 тг",
    theory:
      "Утилизация — отдельная позиция ЛСР. Подрядчик предъявляет талоны полигона как доказательство легального вывоза. При продаже как вторсырья — соответствующее уменьшение стоимости.",
  },
];

const CHECKLIST: string[] = [
  "Согласование графика с жильцами / соседями (если жилой объект)",
  "Уведомление АО «КазТрансГаз» при отключении газа",
  "Демонтаж окон/дверей до начала пыльных работ (сохранение)",
  "Защита прилегающих зданий полиэтиленом / щитами",
  "Пылеподавление водой при дроблении (по СНиП Охрана воздуха)",
  "Раздельный сбор отходов (металл / бетон / древесина / ТБО)",
  "Транспортировка только лицензированным перевозчиком отходов",
  "Получение талонов о сдаче на полигон (для экологической отчётности)",
];

export default function DemolitionPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a)) {
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

  function toggleCheck(i: number) {
    setChecks((c) => {
      const n = new Set(c);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-stone-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-stone-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🔨 Демонтаж — разборка конструкций, утилизация, вторсырьё
            </h1>
            <p className="text-[10px] text-stone-300">
              ЭСН РК Сб.46 · СНиП РК 3.04-32-2008 · ГОСТ Р 52108-2003 · ПП РК № 595
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Нормативный блок */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-stone-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <li>
              <b className="text-stone-700 dark:text-stone-300">ЭСН РК Сборник 46</b> «Работы при
              реконструкции зданий и сооружений»
            </li>
            <li>
              <b className="text-stone-700 dark:text-stone-300">СНиП РК 3.04-32-2008</b>{" "}
              «Реконструкция жилых зданий»
            </li>
            <li>
              <b className="text-stone-700 dark:text-stone-300">ГОСТ Р 52108-2003</b>{" "}
              Ресурсосбережение. Обращение с отходами
            </li>
            <li>
              <b className="text-stone-700 dark:text-stone-300">
                Постановление Правительства РК № 595 от 31.07.2022
              </b>{" "}
              «Правила обращения с отходами»
            </li>
          </ul>
        </section>

        {/* Раздел 1: Расценки ЭСН */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-3">
            Раздел 1. Расценки ЭСН на демонтаж (Сборник 46)
          </h2>
          <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 italic">
            Основные позиции на демонтаж
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100 dark:bg-stone-900/40">
                  <th className="border border-stone-300 dark:border-slate-700 px-2 py-1.5 text-left text-stone-800 dark:text-stone-200">
                    Расценка
                  </th>
                  <th className="border border-stone-300 dark:border-slate-700 px-2 py-1.5 text-left text-stone-800 dark:text-stone-200">
                    Что демонтируется
                  </th>
                  <th className="border border-stone-300 dark:border-slate-700 px-2 py-1.5 text-left text-stone-800 dark:text-stone-200">
                    Ед. изм.
                  </th>
                  <th className="border border-stone-300 dark:border-slate-700 px-2 py-1.5 text-left text-stone-800 dark:text-stone-200">
                    Особенность
                  </th>
                </tr>
              </thead>
              <tbody>
                {ESN_ROWS.map((r) => (
                  <tr key={r.code} className="hover:bg-stone-50 dark:hover:bg-slate-800/50">
                    <td className="border border-stone-300 dark:border-slate-700 px-2 py-1 font-mono text-[11px] text-stone-700 dark:text-stone-300 whitespace-nowrap">
                      {r.code}
                    </td>
                    <td className="border border-stone-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.what}
                    </td>
                    <td className="border border-stone-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.unit}
                    </td>
                    <td className="border border-stone-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {r.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Коэффициенты */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-3">
            Раздел 2. Коэффициенты для расценок при демонтаже
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100 dark:bg-stone-900/40">
                  <th className="border border-stone-300 dark:border-slate-700 px-2 py-1.5 text-left text-stone-800 dark:text-stone-200">
                    Коэффициент
                  </th>
                  <th className="border border-stone-300 dark:border-slate-700 px-2 py-1.5 text-left text-stone-800 dark:text-stone-200">
                    Применение
                  </th>
                  <th className="border border-stone-300 dark:border-slate-700 px-2 py-1.5 text-left text-stone-800 dark:text-stone-200">
                    Источник
                  </th>
                </tr>
              </thead>
              <tbody>
                {COEF_ROWS.map((r) => (
                  <tr key={r.k} className="hover:bg-stone-50 dark:hover:bg-slate-800/50">
                    <td className="border border-stone-300 dark:border-slate-700 px-2 py-1 font-mono font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                      {r.k}
                    </td>
                    <td className="border border-stone-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.use}
                    </td>
                    <td className="border border-stone-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.src}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3: Утилизация и вторсырьё */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-stone-800 dark:text-stone-200">
            Раздел 3. Утилизация и вторсырьё
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-stone-100 dark:bg-stone-900/30 border border-stone-300 dark:border-stone-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
                🧱 Кирпичный бой
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>1 м³ кирпичной кладки → ~0.7 м³ боя (Кр=1.20-1.30)</li>
                <li>Применение: подсыпка под полы, бетон М100 для подготовок, заполнение пустот</li>
                <li>Стоимость утилизации (вывоз на полигон): 2500-3500 тг/м³</li>
                <li>Стоимость продажи как вторсырья: 800-1500 тг/м³</li>
              </ul>
            </div>

            <div className="bg-stone-100 dark:bg-stone-900/30 border border-stone-300 dark:border-stone-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
                🪨 Бетон демонтированный
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>1 м³ бетона → ~0.65 м³ боя</li>
                <li>Применение: после дробления — заполнитель для нового бетона (М100-М150)</li>
                <li>Стоимость дробления на месте: 4500-7000 тг/м³</li>
                <li>Утилизация на полигон: 3500-4500 тг/м³</li>
              </ul>
            </div>

            <div className="bg-stone-100 dark:bg-stone-900/30 border border-stone-300 dark:border-stone-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
                ⚙️ Металлолом (арматура, профиль)
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>1 т сдачи в чёрный лом: 90 000-120 000 тг (на 2025 г.)</li>
                <li>Цветные металлы (медь, алюминий) — отдельный учёт</li>
                <li>Расценка ЭСН Сб.46 §46-9-x на разделку лома</li>
              </ul>
            </div>

            <div className="bg-stone-100 dark:bg-stone-900/30 border border-stone-300 dark:border-stone-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
                🪵 Древесина
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>Только без гнили и краски — на повторное использование</li>
                <li>Загрязнённая — на полигон ТБО</li>
              </ul>
            </div>

            <div className="bg-stone-100 dark:bg-stone-900/30 border border-stone-300 dark:border-stone-700 rounded-lg p-3 md:col-span-2">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
                ⚡ Старая электропроводка
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>Алюминий: ~30-50 тыс. тг/т сдача</li>
                <li>Медь: ~800-1200 тыс. тг/т сдача</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Раздел 4: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-3">
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
                  setInp({});
                  setRev({});
                }}
                className={`text-[10px] px-2 py-1 rounded font-semibold ${
                  i === xi
                    ? "bg-stone-600 text-white"
                    : done.has(s.id)
                    ? "bg-stone-200 dark:bg-stone-900/40 text-stone-800 dark:text-stone-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {done.has(s.id) ? "✓ " : ""}
                Упр. {i + 1}
              </button>
            ))}
          </div>

          <div className="border-l-4 border-stone-400 pl-3">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-1">
              {ex.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3 whitespace-pre-line">
              {ex.q}
            </p>

            {ex.ss.length > 1 && (
              <div className="flex gap-1 mb-3">
                {ex.ss.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < si
                        ? "bg-stone-500"
                        : i === si
                        ? "bg-stone-300"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            )}

            {!done.has(ex.id) ? (
              <div
                className={`border-2 rounded-lg p-3 ${
                  ok
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    : err
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : "border-stone-200 dark:border-slate-700"
                }`}
              >
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Шаг {si + 1}/{ex.ss.length}: {step.l}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inp[k] ?? ""}
                    onChange={(e) =>
                      setInp((p) => ({ ...p, [k]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && !rev[k] && go()}
                    disabled={!!rev[k]}
                    placeholder="Число..."
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-stone-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!rev[k] && (
                    <button
                      onClick={go}
                      disabled={!inp[k]?.trim()}
                      className="px-3 py-1.5 bg-stone-600 text-white text-xs font-semibold rounded hover:bg-stone-700 disabled:opacity-40"
                    >
                      Проверить
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
                    className="mt-1 text-[10px] text-amber-700 underline"
                  >
                    Попробовать снова
                  </button>
                )}
              </div>
            ) : (
              <div className="border-2 border-stone-400 bg-stone-100 dark:bg-stone-900/30 rounded-lg p-3">
                <div className="text-xs font-bold text-stone-800 dark:text-stone-300 mb-1">
                  ✓ Завершено
                </div>
                <code className="text-[10px] font-mono text-stone-700 dark:text-stone-300 block">
                  {ex.vor}
                </code>
              </div>
            )}

            <div className="mt-2 bg-stone-50 dark:bg-stone-900/20 border border-stone-200 dark:border-stone-700 rounded p-2 text-[11px] text-stone-700 dark:text-stone-300">
              📖 {ex.theory}
            </div>

            {done.has(ex.id) && xi + 1 < STEPS.length && (
              <button
                onClick={() => {
                  sxi(xi + 1);
                  ssi(0);
                  setInp({});
                  setRev({});
                }}
                className="mt-3 w-full py-2 bg-stone-600 text-white text-sm font-semibold rounded-lg hover:bg-stone-700"
              >
                Следующее упражнение →
              </button>
            )}
          </div>
        </section>

        {/* Раздел 5: Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-3">
            Раздел 5. Что НЕ забыть при демонтаже
          </h2>
          <ul className="space-y-1.5">
            {CHECKLIST.map((item, i) => (
              <li key={i}>
                <button
                  onClick={() => toggleCheck(i)}
                  className="flex items-start gap-2 text-left w-full hover:bg-stone-50 dark:hover:bg-slate-800/40 rounded px-1.5 py-1"
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 mt-0.5 border-2 rounded text-[10px] font-bold flex items-center justify-center ${
                      checks.has(i)
                        ? "bg-stone-600 border-stone-600 text-white"
                        : "border-stone-400 dark:border-stone-500"
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
        <section className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">
            🌱 ЭКОЛОГИЯ
          </h2>
          <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
            По <b>Постановлению № 595 (2022 г.)</b> подрядчик обязан сдавать строительные отходы
            только на лицензированные полигоны. За нелегальный выброс — штраф{" "}
            <b>до 1500 МРП (≈ 6 млн тг)</b>.
          </p>
        </section>
      </div>
    </div>
  );
}
