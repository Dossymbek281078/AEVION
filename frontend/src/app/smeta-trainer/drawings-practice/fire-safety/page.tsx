"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.02) {
  const v = parseFloat(i.replace(/\s/g, "").replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(/\s/g, "").replace(",", "."));
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
  tol?: number;
}

const CATEGORIES: { cat: string; desc: string; ex: string; req: string }[] = [
  {
    cat: "А",
    desc: "Взрывопожарные (горючие газы, пары)",
    ex: "Хим. лаборатории, склады ЛВЖ",
    req: "СОУЭ + АУПТ обязательно",
  },
  {
    cat: "Б",
    desc: "Пожароопасные (горючие пыли)",
    ex: "Деревообрабатывающие, мукомольные",
    req: "СОУЭ + АУПТ",
  },
  {
    cat: "В1-В4",
    desc: "Пожароопасные (твёрдые горючие)",
    ex: "Жилые, склады",
    req: "СОУЭ; АУПТ при V > 3000 м³",
  },
  {
    cat: "Г",
    desc: "Негорючие в горячем состоянии",
    ex: "Котельные",
    req: "АПС + ручные средства",
  },
  {
    cat: "Д",
    desc: "Негорючие в холодном состоянии",
    ex: "Бетонные склады",
    req: "АПС опционально",
  },
];

const WATER_ROWS: { type: string; use: string; flow: string; cost: string }[] = [
  {
    type: "Внутренний пожарный водопровод (ВПВ)",
    use: "Каждый этаж, краны через 35-40 м",
    flow: "2.5 л/с на 1 струю",
    cost: "8 000-12 000 тг/м.п.",
  },
  {
    type: "Наружный противопожарный водопровод",
    use: "Гидранты вокруг здания",
    flow: "По расчёту, обычно 15 л/с",
    cost: "По СНиП 2.04-01",
  },
  {
    type: "АУПТ водяная (спринклеры)",
    use: "Объекты В категории V>3000 м³",
    flow: "0.08-0.16 л/с/м²",
    cost: "4 500-7 500 тг/м²",
  },
  {
    type: "Дренчерные установки",
    use: "Сцены театров, открытые площадки",
    flow: "По расчёту",
    cost: "По проекту",
  },
  {
    type: "Газовое пожаротушение (CO₂, FM-200)",
    use: "Серверные, библиотеки, музеи",
    flow: "По объёму помещения",
    cost: "12 000-25 000 тг/м³",
  },
  {
    type: "Порошковое пожаротушение",
    use: "Электрощитовые, гаражи",
    flow: "По объёму",
    cost: "6 500-12 000 тг/м³",
  },
  {
    type: "Аэрозольное пожаротушение",
    use: "Малые помещения с электроникой",
    flow: "По объёму",
    cost: "4 500-9 500 тг/м³",
  },
];

const SIGNS: { sign: string; use: string; size: string; price: string }[] = [
  {
    sign: "«Выход» (зелёный с пиктограммой)",
    use: "На всех эвакуационных дверях",
    size: "200×100 мм",
    price: "850-2 800 тг",
  },
  {
    sign: "«Эвакуационный путь» (стрелка)",
    use: "На стенах коридоров",
    size: "150×100 мм",
    price: "450-1 200 тг",
  },
  {
    sign: "«Огнетушитель»",
    use: "Над местами размещения",
    size: "100×100 мм",
    price: "380-850 тг",
  },
  {
    sign: "«Пожарный кран»",
    use: "На дверцах ВПВ-шкафов",
    size: "150×100 мм",
    price: "480-1 200 тг",
  },
  {
    sign: "План эвакуации (формат А3)",
    use: "На каждом этаже",
    size: "297×420 мм",
    price: "4 500-12 000 тг",
  },
  {
    sign: "Аварийное освещение",
    use: "На путях эвакуации",
    size: "По расчёту",
    price: "12 000-25 000 тг/светильник",
  },
];

const STEPS: Exercise[] = [
  {
    id: "ex1-detect",
    title: "Упражнение 1: Количество дымовых извещателей для школы",
    q: `Школа площадью 600 м².
Норма: 1 дымовой извещатель на 90 м² (среднее значение из диапазона 70-110 м² по СП РК).
Дополнительно ручные извещатели по периметру эвакуационных путей: 4 шт.

Рассчитайте общее количество извещателей (дымовых + ручных).`,
    ss: [
      {
        id: "smoke",
        l: "Общее количество извещателей, шт",
        a: ["11", "7"],
        e: "Дымовых: 600 / 90 = 6.67 → округляем вверх = 7 шт. Ручных: 4 шт. Итого: 11 шт. Допустимы оба ответа: 7 (только дым) или 11 (с ручными). Категория ППКП — Сб.34 ЭСН.",
      },
    ],
    vor: "АПС школа 600 м²: 7 дымовых + 4 ручных = 11 извещателей (ЭСН РК Сб.34 §34-x, СП РК)",
    theory:
      "Норма по СП РК: дымовой — 1 шт на 70-110 м², тепловой — 1 шт на 25-30 м² (горячие помещения). Ручные — на путях эвакуации каждые 50 м.",
    tol: 0.1,
  },
  {
    id: "ex2-cost",
    title: "Упражнение 2: Стоимость АПС для школы 600 м²",
    q: `Школа площадью 600 м².
Тариф монтажа АПС «под ключ»: 3 500 тг/м² (среднее значение из диапазона 2 500-4 500 тг/м²).
В стоимость включены: ППК, извещатели, кабель ВВГнг-FRLS, монтаж, пуско-наладка.

Рассчитайте сметную стоимость АПС.`,
    ss: [
      {
        id: "cost",
        l: "Стоимость АПС, тг",
        a: ["2100000", "2 100 000", "2100000.0"],
        e: "Стоимость = 600 · 3500 = 2 100 000 тг. Допуск ±15% (диапазон 1.78-2.42 млн). Расценка — ЭСН РК Сб.34 «Слаботочные системы». Кабель учитывается отдельно по ССЦ.",
      },
    ],
    vor: "АПС школа 600 м² × 3 500 тг/м²: 2 100 000 тг (ЭСН РК Сб.34 §34-x)",
    theory:
      "В стоимость АПС входят: приёмно-контрольный прибор (ППК), извещатели, огнестойкий кабель ВВГнг-FRLS, монтаж и пуско-наладка с актом ввода. Кабель — отдельная позиция по ССЦ.",
    tol: 0.15,
  },
  {
    id: "ex3-water",
    title: "Упражнение 3: Расход воды на пожаротушение",
    q: `Общественное здание. По нормам — 2 пожарных крана работают одновременно.
Расход воды через 1 кран: 2.5 л/с.
Расчётное время тушения: 1 час (3600 с).

Рассчитайте объём запаса воды для пожаротушения (в м³).`,
    ss: [
      {
        id: "vol",
        l: "Объём воды, м³",
        a: ["18", "18.0"],
        e: "Общий расход = 2 · 2.5 = 5 л/с. За 1 час: 5 · 3600 = 18 000 л = 18 м³. Запас воды 18 м³ для пожаротушения должен быть гарантирован — обычно в виде пожарного резервуара или гидранта.",
      },
    ],
    vor: "Запас воды для пожаротушения общ. здания (2 крана · 2.5 л/с · 1 ч): 18 м³ (СП РК 5.01-101)",
    theory:
      "По СП РК 5.01-101-2002 расход воды зависит от категории здания и количества одновременно работающих кранов. Для общественных зданий нормируется минимум 2 струи по 2.5 л/с в течение 1 часа.",
    tol: 0.05,
  },
  {
    id: "ex4-fireproof",
    title: "Упражнение 4: Огнезащита металлоконструкций краской",
    q: `Площадь окрашиваемой поверхности металлоконструкций (колонны + балки): 200 м².
Огнезащитная краска «Терма» для предела огнестойкости R45: расход 1.0 кг/м².
Цена работы с краской «под ключ»: 3 200 тг/м².

Рассчитайте стоимость работ (тг) ИЛИ массу краски (кг). Принимается любое из двух чисел.`,
    ss: [
      {
        id: "cost",
        l: "Стоимость, тг ИЛИ расход краски, кг",
        a: ["640000", "640 000", "200", "200.0"],
        e: "Стоимость = 200 · 3200 = 640 000 тг. Расход краски = 200 · 1.0 = 200 кг. Принимаются оба ответа. Расценка — ЭСН РК Сб.13-1-x «Огнезащитные покрытия».",
      },
    ],
    vor: "Огнезащита МК краской «Терма» R45 (200 м² · 1.0 кг/м² · 3 200 тг/м²): 200 кг / 640 000 тг (ЭСН РК Сб.13-1-x)",
    theory:
      "Огнезащитные вспучивающиеся краски («Терма», «Файтерм», «Унитерм») создают пенный слой при нагреве. Огнестойкость до R45. При R45+ требуются плиты или штукатурки.",
    tol: 0.02,
  },
];

const CHECKLIST: string[] = [
  "Проект ПБ согласован с КГГП ЧС",
  "АПС смонтирована и протестирована (акт ввода)",
  "СОУЭ работает (тест на эвакуацию)",
  "Внутренний пожарный водопровод запущен",
  "Огнетушители — 1 шт на 200 м² минимум",
  "Эвакуационные знаки развешены",
  "План эвакуации на каждом этаже",
  "Аварийное освещение работает (тест 90 минут)",
  "Огнезащита конструкций нанесена с актом",
  "Журнал учёта ПБ ведётся",
];

export default function FireSafetyPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a, ex.tol ?? 0.02);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a, ex.tol ?? 0.02)) {
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
    <div className="min-h-screen bg-red-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-red-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-red-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🔥 Пожарная безопасность — системы, оборудование, эвакуация
            </h1>
            <p className="text-[10px] text-red-200">
              СНиП РК 2.02-05-2002 · ТР ЕАЭС 043/2017 · СП РК 5.01-101 · {done.size}/
              {STEPS.length} упражнений
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Введение */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
            📌 Зачем нужен раздел ПБ
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            <b>ПБ</b> — обязательный раздел проекта и сметы для всех общественных и
            многоквартирных объектов. Без согласования с{" "}
            <b className="text-red-700 dark:text-red-300">КГГП ЧС</b> объект{" "}
            <b>НЕ ПРИНИМАЮТ</b> в эксплуатацию.
          </p>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            В смету закладываются:
          </p>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5 list-disc list-inside">
            <li>Системы автоматической пожарной сигнализации (АПС)</li>
            <li>Системы оповещения и управления эвакуацией (СОУЭ)</li>
            <li>Внутренний и наружный противопожарный водопровод</li>
            <li>Автоматические системы пожаротушения (АУПТ)</li>
            <li>Огнетушители и противопожарные шкафы</li>
            <li>Огнезащита конструкций (краски, пропитки)</li>
            <li>Эвакуационные знаки и подсветка</li>
            <li>Противопожарные двери, перегородки, клапаны</li>
          </ul>
        </section>

        {/* Нормативный блок */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <li>
              <b className="text-red-700 dark:text-red-300">СНиП РК 2.02-05-2002</b>{" "}
              «Пожарная безопасность зданий и сооружений»
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">СН РК 2.02-15-2003</b>{" "}
              «Системы оповещения и управления эвакуацией»
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">ТР ЕАЭС 043/2017</b>{" "}
              Технический регламент о требованиях пожарной безопасности
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">СП РК 5.01-101-2002</b>{" "}
              «Расход воды на наружное и внутреннее пожаротушение»
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">ГОСТ 12.4.026-2015</b> Знаки
              безопасности
            </li>
          </ul>
        </section>

        {/* Раздел 1: Категории */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-red-800 dark:text-red-300 mb-3">
            Раздел 1. Категории зданий по пожарной опасности
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-red-100 dark:bg-red-900/30">
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Категория
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Описание
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Примеры
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Требования к ПБ
                  </th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((r) => (
                  <tr
                    key={r.cat}
                    className="hover:bg-red-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 font-mono font-bold text-red-700 dark:text-red-300 whitespace-nowrap">
                      {r.cat}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.desc}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {r.ex}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {r.req}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Системы пожарной автоматики */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-red-800 dark:text-red-300 mb-3">
            Раздел 2. Системы пожарной автоматики
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
                🚨 АПС — автоматическая пожарная сигнализация
              </h3>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>Извещатели дымовые: 1 шт на 70-110 м² (по СП РК)</li>
                <li>Извещатели тепловые: 1 шт на 25-30 м² (горячие пом.)</li>
                <li>Ручные извещатели (кнопки) на путях эвакуации каждые 50 м</li>
                <li>Прибор приёмно-контрольный (ППК) — главный пульт</li>
                <li>Кабельные трассы — огнестойкий кабель ВВГнг-FRLS</li>
              </ul>
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                <p className="text-[11px] text-red-800 dark:text-red-200">
                  <b>Стоимость АПС в смете (общ. здание):</b>{" "}
                  <span className="font-mono">≈ 2 500 - 4 500 тг/м²</span>
                  <br />
                  Пример: школа 600 м² → <b>1.5 - 2.7 млн тг</b>
                </p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3">
              <h3 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
                📢 СОУЭ — оповещение и управление эвакуацией
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1.5 italic">
                Тип системы по этажности (СН РК 2.02-15):
              </p>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>
                  <b>1 тип</b> (звуковой) — до 2 этажей
                </li>
                <li>
                  <b>2 тип</b> (звуковой + световой) — 3-9 этажей
                </li>
                <li>
                  <b>3 тип</b> (речевое оповещение) — 10+ этажей или общественные
                </li>
                <li>
                  <b>4 тип</b> (с обратной связью) — больницы, аэропорты
                </li>
                <li>
                  <b>5 тип</b> (с управлением эвакуацией) — высотные здания
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Раздел 3: Противопожарный водопровод */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-red-800 dark:text-red-300 mb-3">
            Раздел 3. Противопожарный водопровод и АУПТ
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-red-100 dark:bg-red-900/30">
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Тип
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Применение
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Расход воды
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Стоимость в смете
                  </th>
                </tr>
              </thead>
              <tbody>
                {WATER_ROWS.map((r) => (
                  <tr
                    key={r.type}
                    className="hover:bg-red-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 font-semibold text-red-700 dark:text-red-300">
                      {r.type}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.use}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.flow}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4: Огнезащита */}
        <section className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-red-800 dark:text-red-300 mb-3">
            🛡 Раздел 4. Огнезащита конструкций
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
            <b>Огнезащита</b> — увеличение огнестойкости конструкций (несущие колонны,
            балки, перекрытия, кабели).
          </p>

          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
            <h3 className="text-xs font-bold text-red-800 dark:text-red-300 mb-1.5">
              Классы огнестойкости (СНиП РК 2.02-05)
            </h3>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5 list-disc list-inside">
              <li>
                <b>I категория</b> здания → R150 (несущие), REI120 (перекрытия)
              </li>
              <li>
                <b>II категория</b> → R120, REI60
              </li>
              <li>
                <b>III категория</b> → R45, REI45
              </li>
              <li>
                <b>IV категория</b> → R15 (можно без огнезащиты)
              </li>
            </ul>
          </div>

          <h3 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
            Методы огнезащиты
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded p-3">
              <h4 className="text-xs font-bold text-red-700 dark:text-red-300 mb-1.5">
                1. Конструктивные
              </h4>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>Бетонная защита МК — слой 30-100 мм</li>
                <li>Огнезащ. плиты (минвата + штукатурка) — 25-50 мм</li>
                <li>Гипсокартон ГКЛО — 2 слоя на металле</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded p-3">
              <h4 className="text-xs font-bold text-red-700 dark:text-red-300 mb-1.5">
                2. Лакокрасочные
              </h4>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>Вспучивающиеся: «Терма», «Файтерм», «Унитерм»</li>
                <li>Расход: 0.6-1.5 кг/м²</li>
                <li>Стоимость: 1 800-4 500 тг/м² с работой</li>
                <li>Огнестойкость: до R45</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded p-3">
              <h4 className="text-xs font-bold text-red-700 dark:text-red-300 mb-1.5">
                3. Пропитки
              </h4>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>Для дерева: огнебиозащитные 1-3 группы</li>
                <li>Расход: 0.4-0.8 л/м²</li>
                <li>Стоимость: 250-650 тг/м²</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Раздел 5: Эвакуационные знаки */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-red-800 dark:text-red-300 mb-3">
            Раздел 5. Эвакуационные знаки и подсветка
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-red-100 dark:bg-red-900/30">
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Знак
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Применение
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Размер
                  </th>
                  <th className="border border-red-300 dark:border-slate-700 px-2 py-1.5 text-left text-red-800 dark:text-red-200">
                    Цена
                  </th>
                </tr>
              </thead>
              <tbody>
                {SIGNS.map((r) => (
                  <tr
                    key={r.sign}
                    className="hover:bg-red-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 font-semibold text-red-700 dark:text-red-300">
                      {r.sign}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.use}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.size}
                    </td>
                    <td className="border border-red-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                      {r.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 6: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-red-800 dark:text-red-300 mb-3">
            Раздел 6. Интерактивные упражнения ({done.size}/{STEPS.length})
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
                    ? "bg-red-600 text-white"
                    : done.has(s.id)
                    ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {done.has(s.id) ? "✓ " : ""}
                Упр. {i + 1}
              </button>
            ))}
          </div>

          <div className="border-l-4 border-red-400 pl-3">
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">
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
                        ? "bg-red-500"
                        : i === si
                        ? "bg-red-300"
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
                    ? "border-red-400 bg-red-100 dark:bg-red-900/30"
                    : "border-red-200 dark:border-slate-700"
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
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!rev[k] && (
                    <button
                      onClick={go}
                      disabled={!inp[k]?.trim()}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-40"
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
              <div className="border-2 border-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg p-3">
                <div className="text-xs font-bold text-red-800 dark:text-red-300 mb-1">
                  ✓ Завершено
                </div>
                <code className="text-[10px] font-mono text-red-700 dark:text-red-300 block">
                  {ex.vor}
                </code>
              </div>
            )}

            <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 text-[11px] text-red-800 dark:text-red-300">
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
                className="mt-3 w-full py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700"
              >
                Следующее упражнение →
              </button>
            )}
          </div>
        </section>

        {/* Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-red-800 dark:text-red-300 mb-3">
            ✅ Чек-лист «ПБ на объекте — что проверить»
          </h2>
          <ul className="space-y-1.5">
            {CHECKLIST.map((item, i) => (
              <li key={i}>
                <button
                  onClick={() => toggleCheck(i)}
                  className="flex items-start gap-2 text-left w-full hover:bg-red-50 dark:hover:bg-slate-800/40 rounded px-1.5 py-1"
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 mt-0.5 border-2 rounded text-[10px] font-bold flex items-center justify-center ${
                      checks.has(i)
                        ? "bg-red-600 border-red-600 text-white"
                        : "border-red-400 dark:border-red-600"
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

        {/* Расценки ЭСН */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
            🧾 Расценки ЭСН (по разделам ПБ)
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <li>
              <b className="text-red-700 dark:text-red-300">АПС/СОУЭ:</b> ЭСН Сб.34
              «Слаботочные системы» §34-x
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">ВПВ:</b> ЭСН Сб.16
              «Внутренние водопроводные сети» §16-x
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">АУПТ:</b> Сб.34 +
              спецоборудование по ССЦ
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">Огнезащита краской:</b> ЭСН
              Сб.13-1-x
            </li>
            <li>
              <b className="text-red-700 dark:text-red-300">Знаки и подсветка:</b> ССЦ
              + работы Сб.46
            </li>
          </ul>
        </section>

        {/* Фактоид */}
        <section className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-600 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-200 mb-2">
            ⚠ ВАЖНО — ответственность за ПБ
          </h2>
          <p className="text-xs text-red-900 dark:text-red-200 leading-relaxed">
            Без раздела ПБ и заключения <b>КГГП ЧС</b> объект{" "}
            <b>НЕ ВВОДИТСЯ</b> в эксплуатацию. По{" "}
            <b>ст. 410 КоАП РК</b> — штраф <b>до 2000 МРП</b> за нарушения ПБ. При
            гибели людей — уголовная ответственность по{" "}
            <b>ст. 304 УК РК</b>.
          </p>
        </section>
      </div>
    </div>
  );
}
