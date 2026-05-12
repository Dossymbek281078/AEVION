"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tolPct: number) {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tolPct;
}

type LineRow = {
  type: string;
  voltage: string;
  cross: string;
  current: string;
  price: string;
  use: string;
};

const LINES: LineRow[] = [
  {
    type: "ВЛ-0.4 кВ",
    voltage: "0.4 кВ",
    cross: "СИП-2 4×16 — 4×95 мм²",
    current: "75 — 245 А",
    price: "1 200 — 4 500 тг/м",
    use: "Питание частных домов, ЖК, малых ТП → потребители",
  },
  {
    type: "ВЛ-10 кВ",
    voltage: "10 кВ",
    cross: "АС-50 — АС-120 мм²",
    current: "210 — 380 А",
    price: "850 — 2 200 тг/м (без опор)",
    use: "Магистральные линии село — РП — ТП",
  },
  {
    type: "ВЛ-35 кВ",
    voltage: "35 кВ",
    cross: "АС-95 — АС-185 мм²",
    current: "330 — 510 А",
    price: "2 800 — 6 500 тг/м (без опор)",
    use: "ПС 110/35/10 — крупные ТП промзон, ЦКП",
  },
  {
    type: "КЛ-0.4 кВ (медь)",
    voltage: "0.4 кВ",
    cross: "ВВГнг-LS 4×35 — 4×240 мм²",
    current: "140 — 470 А",
    price: "3 800 — 24 000 тг/м",
    use: "Внутриквартальные сети 0.4 кВ от ТП до ВРУ",
  },
  {
    type: "КЛ-10 кВ ААБл / АПвП",
    voltage: "10 кВ",
    cross: "ААБл / АПвП 3×70 — 3×240 мм²",
    current: "165 — 395 А",
    price: "5 600 — 18 500 тг/м",
    use: "Городские кабельные сети 10 кВ между РП и ТП",
  },
  {
    type: "СИП-2 4×16 / 4×95",
    voltage: "0.4 кВ",
    cross: "4×16 / 4×35 / 4×50 / 4×70 / 4×95 мм²",
    current: "75 / 121 / 145 / 180 / 245 А",
    price: "1 200 / 1 850 / 2 400 / 3 200 / 4 500 тг/м",
    use: "Самонесущий изолированный провод — ВЛ 0.4 кВ к домам",
  },
];

type Ktp = {
  power: string;
  size: string;
  price: string;
  obj: string;
};

const KTP: Ktp[] = [
  {
    power: "100 кВА",
    size: "2.4 × 2.0 × 2.7 м",
    price: "≈ 4.0 млн тг",
    obj: "Малый коттеджный посёлок (10–15 домов), небольшая АЗС",
  },
  {
    power: "250 кВА",
    size: "3.0 × 2.4 × 2.8 м",
    price: "≈ 5.5 млн тг",
    obj: "Многоквартирный дом 30–50 квартир, школа на 200 мест",
  },
  {
    power: "400 кВА",
    size: "3.6 × 2.6 × 2.8 м",
    price: "≈ 7.5 млн тг",
    obj: "ЖК 80–100 квартир, средняя школа, поликлиника",
  },
  {
    power: "630 кВА",
    size: "4.2 × 2.8 × 2.9 м",
    price: "≈ 9.0 млн тг",
    obj: "ЖК 150–200 квартир, торговый центр до 5 000 м²",
  },
  {
    power: "1000 кВА",
    size: "5.0 × 3.0 × 3.0 м",
    price: "≈ 11.5 млн тг",
    obj: "ТРЦ до 15 000 м², бизнес-центр класса В+, гостиница 200 номеров",
  },
  {
    power: "1600 кВА",
    size: "5.8 × 3.4 × 3.2 м",
    price: "≈ 18.0 млн тг",
    obj: "Крупный ТРЦ, промышленный объект, дата-центр среднего размера",
  },
];

type McOpt = { id: string; text: string };

type ExBase = {
  id: string;
  title: string;
  q: string;
  expl: string;
  vor: string;
};

type ExMc = ExBase & {
  kind: "mc";
  options: McOpt[];
  correct: string;
};

type ExNum = ExBase & {
  kind: "num";
  label: string;
  expected: number;
  tol: number;
  unit: string;
};

type Ex = ExMc | ExNum;

const EXERCISES: Ex[] = [
  {
    id: "ex1",
    kind: "mc",
    title: "Расчёт сечения СИП по току (нагрузка 80 кВт)",
    q: "Объект — коттедж класса премиум, расчётная нагрузка 80 кВт, сеть 0.4 кВ, cosφ = 0.95, трёхфазное питание. Питание выполняется проводом СИП-2 от опоры ВЛ. Какое сечение СИП нужно выбрать?\n\nФормула: I = P / (√3 · Uл · cosφ) = 80 000 / (1.732 · 380 · 0.95)",
    options: [
      { id: "a", text: "СИП-2 4×16 (Iдоп = 75 А)" },
      { id: "b", text: "СИП-2 4×25 (Iдоп = 100 А)" },
      { id: "c", text: "СИП-2 4×35 (Iдоп = 121 А)" },
      { id: "d", text: "СИП-2 4×95 (Iдоп = 245 А) — с большим запасом" },
    ],
    correct: "c",
    expl:
      "I = 80 000 / (1.732 · 380 · 0.95) = 80 000 / 625.5 ≈ 128 А. Округляем по ряду допустимых токов. СИП-2 4×16 (75 А) и 4×25 (100 А) — недостаточно. СИП-2 4×35 (121 А) — близко к расчётному току, по ПУЭ табл.1.3.5 принимается с запасом ~5–10%, фактически 4×35 проходит при I ≤ 121 А (расчёт делают с учётом cosφ нагрузки и поправок на t°). Чаще всего проектировщик берёт 4×35. Если нагрузка в основном пиковая или летняя температура воздуха > 35°C — берут 4×50. СИП-2 4×95 — избыточный запас, удорожает проект.",
    vor: "Прокладка СИП-2 4×35 мм² по опорам ВЛ-0.4 кВ — расчётная длина (ЭСН Сб.8-1-x)",
  },
  {
    id: "ex2",
    kind: "num",
    title: "Подбор КТП для ТРЦ 800 кВт (cosφ=0.85, Кс=0.8)",
    q: "ТРЦ установленной мощностью Pу = 800 кВт. Коэффициент мощности cosφ = 0.85, коэффициент спроса Кс = 0.8. Нужно подобрать КТП. Сначала находим расчётную мощность:\n\nPр = Pу · Кс = 800 · 0.8 = 640 кВт\nSр = Pр / cosφ = 640 / 0.85 ≈ 753 кВА\n\nПо ряду стандартных КТП (100/250/400/630/1000/1600 кВА) выбираем ближайший больший типоразмер. Введите его номинальную мощность в кВА (или примерную цену в млн тг).",
    label: "Мощность КТП (кВА) или цена (млн тг)",
    expected: 1000,
    tol: 0.15,
    unit: "кВА",
    expl:
      "Sр = 800 · 0.8 / 0.85 ≈ 753 кВА. КТП-630 — мала (753 > 630, перегрузка). Берём КТП-1000 кВА. Цена закупки ≈ 11.5 млн тг (КТП в железобетонной оболочке БКТП), монтаж + ПНР ≈ 2–3 млн тг, итого «под ключ» ≈ 13–14 млн тг. Допуск ±15% — принимаются ответы 1000 ± 150 (например 850–1150) или 11.5 ± 1.7 млн тг.",
    vor: "Поставка и монтаж БКТП 1000/10/0.4 кВ — 1 шт (ЭСН Сб.31-2-x); цена комплектная ≈ 11.5 млн тг",
  },
  {
    id: "ex3",
    kind: "num",
    title: "Длина траншеи под кабель Ø95 мм² от КТП до ВРУ",
    q: "Прокладывается кабель ААБл-10кВ Ø95 мм² от КТП до ВРУ здания. Прямое расстояние по плану — 65 м, но трасса делает 2 поворота (огибает фундаменты двух колодцев). По ПУЭ и СН РК 4.04-10 необходим запас на изгибы и провисание ~5%. Какая будет фактическая длина траншеи (и кабеля) в метрах?",
    label: "Длина траншеи, м",
    expected: 68.25,
    tol: 0.05,
    unit: "м",
    expl:
      "L = L_прямая · (1 + Кзапаса) = 65 · (1 + 0.05) = 65 · 1.05 = 68.25 м. Запас 5% компенсирует повороты, провисание в кабельных лотках, заход в концевые муфты. На практике в сметах часто закладывают 7–10% если трасса сильно ломаная. Допуск ±5% (диапазон 64.8 – 71.7 м).",
    vor:
      "Земляные работы — траншея под кабель Ø95: 68.25 м (ЭСН Сб.1); прокладка КЛ ААБл 3×95: 68.25 м (ЭСН Сб.9-1-x)",
  },
  {
    id: "ex4",
    kind: "num",
    title: "Стоимость прокладки 200 м КЛ-10кВ в траншее (ЭСН Сб.8 + РК 1.16)",
    q: "По ЭСН Сб.8 расценка прокладки кабеля КЛ-10 кВ в готовой траншее = 4 500 тг/м (в ценах эталона). Объём — 200 м. Применяем региональный коэффициент РК = 1.16 (Алматы, 2025). Чему равна сметная стоимость работы (без материалов кабеля и без НР, СП — только прямые трудозатраты по расценке)?",
    label: "Стоимость работы, тг",
    expected: 1044000,
    tol: 0.1,
    unit: "тг",
    expl:
      "S = V · Расценка · РК = 200 · 4 500 · 1.16 = 1 044 000 тг. Это только работа — стоимость кабеля (≈ 12 000 тг/м × 200 = 2.4 млн тг) и НР+СП (≈ 23–25%) добавляются отдельно. Полная сметная стоимость прокладки 200 м КЛ-10 «под ключ» с НР, СП и материалами ≈ 4.5–5 млн тг. Допуск ±10%.",
    vor: "Прокладка КЛ-10 кВ ААБл 3×95 в траншее: 200 м × 4 500 тг/м × 1.16 = 1 044 000 тг (ЭСН Сб.8-2-x)",
  },
];

export default function PowerSupplyExternalPage() {
  const [xi, sxi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [mc, setMc] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const ex = EXERCISES[xi];

  const setI = (k: string, v: string) =>
    setInp((p) => ({ ...p, [k]: v }));
  const setM = (k: string, v: string) =>
    setMc((p) => ({ ...p, [k]: v }));
  const setR = (k: string, v: boolean) =>
    setRev((p) => ({ ...p, [k]: v }));

  const submit = () => {
    let ok = false;
    if (ex.kind === "num") {
      const val = inp[ex.id] ?? "";
      ok = checkNum(val, ex.expected, ex.tol);
    } else {
      ok = mc[ex.id] === ex.correct;
    }
    if (ok) setDone((s) => new Set([...s, ex.id]));
  };

  const isAnswered = (() => {
    if (ex.kind === "num") {
      const val = inp[ex.id] ?? "";
      return val ? checkNum(val, ex.expected, ex.tol) : null;
    }
    const sel = mc[ex.id];
    if (!sel) return null;
    return sel === ex.correct;
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-violet-400 hover:text-violet-300 text-sm"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">
            Модуль · Внешнее электроснабжение · РК 2025
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          ⚡ Внешнее электроснабжение — ЛЭП, КТП, ВЛ, КЛ
        </h1>
        <p className="text-slate-400 mb-8">
          Питание объекта от подстанции (ПС / ТП) до вводно-распределительного
          устройства (ВРУ) здания. Включает воздушные линии (ВЛ), кабельные
          линии (КЛ), комплектные трансформаторные подстанции (КТП), технические
          условия (ТУ) электроснабжающей организации.
        </p>

        {/* Intro */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-violet-300 mb-3">
            Что входит во «внешку» 0.4 / 10 / 35 кВ
          </h2>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>
              <span className="text-yellow-300">•</span>{" "}
              <b>ВЛ (воздушные линии)</b> — провода СИП / АС на железобетонных
              или металлических опорах, 0.4 / 10 / 35 кВ.
            </li>
            <li>
              <span className="text-yellow-300">•</span>{" "}
              <b>КЛ (кабельные линии)</b> — кабели в траншее, лотках или
              кабельных каналах: ВВГнг-LS, ААБл, АПвП.
            </li>
            <li>
              <span className="text-yellow-300">•</span>{" "}
              <b>КТП (комплектная ТП)</b> — трансформатор 6(10)/0.4 кВ с
              распределительным устройством высокой и низкой стороны (РУВН +
              РУНН).
            </li>
            <li>
              <span className="text-yellow-300">•</span>{" "}
              <b>ТУ (технические условия)</b> — выдаются ЭСО (АЖК, КЕГОК,
              «Жетысуэнерго» и др.); срок действия — 2 года.
            </li>
            <li>
              <span className="text-yellow-300">•</span> <b>ВРУ</b> —
              вводно-распределительное устройство на границе балансовой
              принадлежности здания (заканчивается «внешка», начинается
              «внутрянка»).
            </li>
          </ul>

          <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950 border border-slate-800 rounded p-3">
              <div className="text-violet-300 font-semibold mb-1">
                Нормативы РК
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>• ПУЭ (Правила устройства электроустановок), 7-е изд.</li>
                <li>
                  • <b>СН РК 4.04-10-2014</b> — электроустановки зданий и
                  сооружений
                </li>
                <li>
                  • <b>СНиП РК 4.04-04-2002</b> — наружные сети
                  электроснабжения
                </li>
                <li>
                  • <b>СН РК 2.04-01-2017</b> — естественное и искусственное
                  освещение
                </li>
                <li>• ГОСТ 14209 (трансформаторы), ГОСТ 31996 (КЛ)</li>
              </ul>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded p-3">
              <div className="text-yellow-300 font-semibold mb-1">
                Стоимость подключения 2025
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>
                  • Городские сети, малая мощность ≤ 15 кВт:{" "}
                  <b>~300 тг/кВт</b>
                </li>
                <li>
                  • Городские сети, 15–100 кВт: <b>5 000 — 25 000 тг/кВт</b>
                </li>
                <li>
                  • 100–500 кВт (новый ЦП, прокладка КЛ):{" "}
                  <b>40 000 — 120 000 тг/кВт</b>
                </li>
                <li>
                  • Крупные объекты, удалённость, новый ЦП 35 кВ: до{" "}
                  <b>500 000 тг/кВт</b>
                </li>
                <li>
                  • Тариф ЭСО Алматы 2025: <b>~17 — 22 тг/кВт·ч</b> юр. лица
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1 — типы линий */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            1. Типы линий — выбор по току и напряжению
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-violet-300">
                <tr>
                  <th className="px-3 py-2 text-left">Тип</th>
                  <th className="px-3 py-2 text-left">Напряжение</th>
                  <th className="px-3 py-2 text-left">Сечение</th>
                  <th className="px-3 py-2 text-left">Доп. ток</th>
                  <th className="px-3 py-2 text-left">Цена 2025</th>
                  <th className="px-3 py-2 text-left">Где применяется</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950 divide-y divide-slate-800">
                {LINES.map((l) => (
                  <tr key={l.type} className="hover:bg-slate-900/50">
                    <td className="px-3 py-2 font-semibold text-yellow-200">
                      {l.type}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{l.voltage}</td>
                    <td className="px-3 py-2 text-slate-300">{l.cross}</td>
                    <td className="px-3 py-2 text-slate-300">{l.current}</td>
                    <td className="px-3 py-2 text-violet-200">{l.price}</td>
                    <td className="px-3 py-2 text-slate-400">{l.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Цены без опор и без монтажа (только провод/кабель). Опоры СВ-95 ≈
            38 000 тг/шт, СВ-110 ≈ 55 000 тг/шт. Монтаж ВЛ ≈ 1 200–2 800 тг/м,
            монтаж КЛ в траншее по ЭСН Сб.8 / Сб.9.
          </p>
        </section>

        {/* Section 2 — КТП */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            2. КТП — комплектная трансформаторная подстанция
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            КТП преобразует 6(10) кВ в 0.4 кВ для конечных потребителей. Бывают{" "}
            <b className="text-yellow-200">мачтовые</b> (МТП до 250 кВА),{" "}
            <b className="text-yellow-200">киосковые</b> (КТП наружной
            установки), <b className="text-yellow-200">блочные</b> (БКТП в
            железобетонной оболочке). Подбор по расчётной мощности Sр = Pр /
            cosφ, с учётом коэффициента спроса Кс и резерва 15–20% на развитие.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-violet-300">
                <tr>
                  <th className="px-3 py-2 text-left">Мощность</th>
                  <th className="px-3 py-2 text-left">Габариты (Д×Ш×В)</th>
                  <th className="px-3 py-2 text-left">Цена 2025</th>
                  <th className="px-3 py-2 text-left">Типовой объект</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950 divide-y divide-slate-800">
                {KTP.map((k) => (
                  <tr key={k.power} className="hover:bg-slate-900/50">
                    <td className="px-3 py-2 font-semibold text-yellow-200">
                      {k.power}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{k.size}</td>
                    <td className="px-3 py-2 text-violet-200 font-semibold">
                      {k.price}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{k.obj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Цены — комплектная поставка (сухой/масляный трансформатор + РУВН +
            РУНН, без фундамента и монтажа). Монтаж + ПНР: +20–30% к стоимости
            КТП. Фундамент монолитный ≈ 250–600 тыс. тг.
          </p>
        </section>

        {/* Section 3 — exercises */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            3. Интерактивные упражнения
          </h2>

          {/* tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {EXERCISES.map((e, i) => {
              const isDone = done.has(e.id);
              const active = i === xi;
              return (
                <button
                  key={e.id}
                  onClick={() => sxi(i)}
                  className={[
                    "px-3 py-1.5 rounded text-xs font-medium border transition",
                    active
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800",
                    isDone && !active
                      ? "border-green-600 text-green-300"
                      : "",
                  ].join(" ")}
                >
                  {i + 1}. {isDone ? "✓ " : ""}
                  {e.title.split(" (")[0].slice(0, 32)}
                  {e.title.length > 32 ? "…" : ""}
                </button>
              );
            })}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-xs text-violet-300 mb-1">
              Упражнение {xi + 1} из {EXERCISES.length}
            </div>
            <h3 className="text-lg font-semibold mb-3">{ex.title}</h3>
            <p className="text-slate-300 text-sm whitespace-pre-line mb-4">
              {ex.q}
            </p>

            {ex.kind === "num" && (
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={ex.label}
                  value={inp[ex.id] ?? ""}
                  onChange={(e) => setI(ex.id, e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:border-violet-500 outline-none"
                />
                <span className="text-slate-500 self-center text-sm">
                  {ex.unit}
                </span>
                <button
                  onClick={submit}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded font-medium transition"
                >
                  Проверить
                </button>
              </div>
            )}

            {ex.kind === "mc" && (
              <div className="space-y-2 mb-3">
                {ex.options.map((o) => {
                  const sel = mc[ex.id] === o.id;
                  return (
                    <label
                      key={o.id}
                      className={[
                        "flex items-start gap-3 p-3 rounded border cursor-pointer transition",
                        sel
                          ? "bg-violet-950/40 border-violet-600"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name={ex.id}
                        checked={sel}
                        onChange={() => setM(ex.id, o.id)}
                        className="mt-1 accent-violet-500"
                      />
                      <span className="text-sm text-slate-200">
                        <span className="font-mono text-violet-300 mr-2">
                          {o.id})
                        </span>
                        {o.text}
                      </span>
                    </label>
                  );
                })}
                <button
                  onClick={submit}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded font-medium transition"
                >
                  Проверить
                </button>
              </div>
            )}

            {/* feedback */}
            {isAnswered === true && (
              <div className="mt-3 p-3 bg-green-950/40 border border-green-700 rounded text-sm text-green-200">
                ✅ Верно. Ответ принят. Можно посмотреть полный разбор ниже.
              </div>
            )}
            {isAnswered === false && (
              <div className="mt-3 p-3 bg-red-950/40 border border-red-700 rounded text-sm text-red-200">
                ❌ Не сходится. Проверьте формулу или единицы. Можно открыть
                «Показать решение».
              </div>
            )}

            <button
              onClick={() => setR(ex.id, !rev[ex.id])}
              className="mt-3 text-xs text-yellow-300 hover:text-yellow-200 underline"
            >
              {rev[ex.id] ? "Скрыть решение" : "Показать решение"}
            </button>

            {rev[ex.id] && (
              <div className="mt-3 p-4 bg-slate-950 border border-yellow-800 rounded space-y-2">
                <div className="text-yellow-300 text-xs font-semibold uppercase">
                  Подробный расчёт
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-line">
                  {ex.expl}
                </p>
                <div className="text-xs text-violet-300 font-semibold mt-2">
                  Запись в ВОР:
                </div>
                <p className="text-xs text-slate-400 italic">{ex.vor}</p>
              </div>
            )}
          </div>
        </section>

        {/* ESN */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">
            4. Расценки ЭСН РК — куда смотреть
          </h2>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-900 border border-slate-800 rounded p-4">
              <div className="text-violet-300 font-semibold mb-2">
                Сб.8 — наружные сети 0.4 кВ
              </div>
              <ul className="text-slate-400 space-y-1 text-xs">
                <li>• Прокладка КЛ-0.4 в траншее</li>
                <li>• Монтаж СИП по опорам ВЛ-0.4</li>
                <li>• Установка опор ВЛ-0.4 (СВ-95)</li>
                <li>• Концевые заделки, муфты</li>
                <li>
                  Расценка: <b className="text-yellow-200">~4 500 тг/м</b> +
                  материалы
                </li>
              </ul>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded p-4">
              <div className="text-violet-300 font-semibold mb-2">
                Сб.9 — КЛ выше 1 кВ (10 кВ)
              </div>
              <ul className="text-slate-400 space-y-1 text-xs">
                <li>• Прокладка ААБл, АПвП в траншее</li>
                <li>• Прокладка в кабельной канализации</li>
                <li>• Концевые муфты 10 кВ</li>
                <li>• Высоковольтные испытания КЛ</li>
                <li>
                  Расценка: <b className="text-yellow-200">~7 800 тг/м</b> +
                  материалы
                </li>
              </ul>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded p-4">
              <div className="text-violet-300 font-semibold mb-2">
                Сб.31 — трансформаторы и КТП
              </div>
              <ul className="text-slate-400 space-y-1 text-xs">
                <li>• Установка КТП наружной установки</li>
                <li>• Монтаж силовых трансформаторов 100–1600 кВА</li>
                <li>• РУВН-10, РУНН-0.4 (ячейки)</li>
                <li>• ПНР, наладка релейной защиты</li>
                <li>
                  Монтаж КТП-1000:{" "}
                  <b className="text-yellow-200">~1.8–2.5 млн тг</b> работа
                </li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Все расценки умножаются на региональный коэффициент РК (1.16 —
            Алматы, 1.0 — Астана, 1.08 — Шымкент, 1.22 — отдалённые регионы) и
            на индекс пересчёта в текущие цены (СНБ-2024 → 2025).
          </p>
        </section>

        {/* Factoid */}
        <section className="mb-8">
          <div className="bg-violet-950/40 border-l-4 border-violet-500 rounded p-5">
            <div className="text-violet-300 font-semibold mb-2 text-sm uppercase tracking-wide">
              Факт-блок · Технические условия (ТУ)
            </div>
            <p className="text-slate-200 text-sm leading-relaxed">
              Технические условия (ТУ) электроснабжающей организации действуют{" "}
              <b className="text-yellow-200">2 года</b> с момента выдачи
              (Закон РК «Об электроэнергетике», ст. 13-1). Если за это время
              объект не подключён — ТУ нужно{" "}
              <b className="text-yellow-200">продлевать платно</b> (10–25% от
              исходной стоимости подключения, зависит от ЭСО). При этом ЭСО
              имеет право пересмотреть точку подключения и потребовать новую
              мощность ЦП — то есть фактически пересчитать всё с нуля.
            </p>
            <p className="text-slate-400 text-xs mt-2 italic">
              Совет проектировщику: закладывайте в график ПИР+СМР 18 месяцев
              максимум от получения ТУ, чтобы успеть запитать объект и получить
              акт допуска от Энергонадзора до истечения срока ТУ.
            </p>
          </div>
        </section>

        {/* Footer nav */}
        <div className="flex justify-between items-center pt-6 border-t border-slate-800">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-violet-400 hover:text-violet-300 text-sm"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">
            Прогресс: {done.size} / {EXERCISES.length} упражнений
          </div>
        </div>
      </div>
    </div>
  );
}
