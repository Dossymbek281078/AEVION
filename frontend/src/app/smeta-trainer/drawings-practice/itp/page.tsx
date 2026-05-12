"use client";
import Link from "next/link";
import { useState } from "react";

function check(input: string, answers: number[], tolPct = 0.15) {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  return answers.some(a => Math.abs((v - a) / a) <= tolPct);
}

const equipment = [
  { name: "Теплообменник пластинчатый GEA NT100 (200 кВт)", purpose: "Разделение контуров теплосеть/здание", price: 850_000 },
  { name: "Циркуляционный насос Grundfos UPS 80-12", purpose: "Принудительная циркуляция", price: 285_000 },
  { name: "Регулятор температуры Danfoss ECL 310", purpose: "Автоматика по графику", price: 145_000 },
  { name: "Расширительный бак Reflex 100 л", purpose: "Компенсация теплового расширения", price: 65_000 },
  { name: "Узел учёта тепла (расходомер + контроллер)", purpose: "Коммерческий учёт", price: 850_000 },
  { name: "Грязевик фланцевый Ø80", purpose: "Защита оборудования", price: 35_000 },
  { name: "Шаровые краны фланцевые Ду80 (10 шт)", purpose: "Перекрытие участков", price: 185_000 },
  { name: "Манометры технические (8 шт)", purpose: "КИП", price: 25_000 },
  { name: "Термометры (6 шт)", purpose: "КИП", price: 18_000 },
  { name: "Шкаф автоматики (с УЗО, контроллер, реле)", purpose: "Управление", price: 380_000 },
];

const fmt = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

export default function ItpPage() {
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [a3, setA3] = useState("");
  const [a4, setA4] = useState<string | null>(null);
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);
  const [show4, setShow4] = useState(false);

  const eqTotal = equipment.reduce((s, e) => s + e.price, 0);

  const ok1 = check(a1, [4_500_000], 0.15);
  const ok2 = check(a2, [75], 0.10);
  const ok3 = check(a3, [21], 0.20);
  const ok4 = a4 === "b";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Link
          href="/smeta-trainer/drawings-practice/hub"
          className="inline-block text-orange-400 hover:text-orange-300 mb-4 text-sm"
        >
          ← К разделам
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-orange-300">
          ♨️ ИТП — индивидуальный тепловой пункт
        </h1>

        {/* Intro */}
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-zinc-300 leading-relaxed">
            <span className="text-orange-300 font-semibold">ИТП</span> — индивидуальный тепловой пункт.
            Узел в подвале здания, который принимает тепло из городской теплосети
            (наружные сети — см.{" "}
            <Link
              href="/smeta-trainer/drawings-practice/heating"
              className="text-orange-400 hover:text-orange-300 underline"
            >
              /heating
            </Link>
            ) и распределяет на нужды здания: <span className="text-zinc-100">отопление, ГВС, вентиляция</span>.
          </p>
          <p className="mt-3 text-zinc-400 text-sm">
            Стоимость для жилого 9-эт дома:{" "}
            <span className="text-orange-300 font-semibold">8–15 млн тг</span>.
          </p>
        </section>

        {/* Norms */}
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-2">Нормативы</h2>
          <ul className="text-zinc-300 text-sm space-y-1">
            <li>• <span className="text-orange-300">СП РК 4.02-42-2006</span> — тепловые пункты</li>
            <li>• <span className="text-orange-300">СНиП РК 4.02-05</span> — отопление, вентиляция, кондиционирование</li>
            <li>• <span className="text-orange-300">СН РК 4.02-101</span> — нормы проектирования тепловых сетей</li>
          </ul>
        </section>

        {/* Section 1: Состав ИТП */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-orange-300 mb-4">
            1. Состав ИТП
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Оборудование</th>
                  <th className="px-3 py-2 text-left">Назначение</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Цена 2025, тг</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e, i) => (
                  <tr
                    key={i}
                    className={i % 2 ? "bg-zinc-900/40" : "bg-zinc-950/40"}
                  >
                    <td className="px-3 py-2 text-zinc-200">{e.name}</td>
                    <td className="px-3 py-2 text-zinc-400">{e.purpose}</td>
                    <td className="px-3 py-2 text-right text-orange-300 font-mono whitespace-nowrap">
                      {fmt(e.price)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-orange-950/30 border-t border-orange-900/50 font-semibold">
                  <td className="px-3 py-2 text-orange-200" colSpan={2}>
                    Итого по оборудованию
                  </td>
                  <td className="px-3 py-2 text-right text-orange-300 font-mono whitespace-nowrap">
                    {fmt(eqTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Упражнения */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-orange-300 mb-4">
            2. Упражнения
          </h2>

          {/* Ex1 */}
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="font-semibold text-zinc-100 mb-2">
              Упражнение 1. Стоимость ИТП для 9-эт дома (250 кВт мощности)
            </h3>
            <p className="text-zinc-400 text-sm mb-3">
              Рассчитайте полную стоимость ИТП с учётом монтажа, пусконаладки и трубопроводов.
              Ответ в тенге (целое число).
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={a1}
                onChange={(e) => setA1(e.target.value)}
                placeholder="например, 4500000"
                className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 focus:border-orange-400 outline-none w-56"
              />
              <button
                onClick={() => setShow1(true)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-medium"
              >
                Проверить
              </button>
              {show1 && (
                <span className={ok1 ? "text-emerald-400" : "text-red-400"}>
                  {ok1 ? "✓ Верно (±15%)" : "✗ Проверьте расчёт"}
                </span>
              )}
            </div>
            {show1 && (
              <div className="mt-3 text-xs text-zinc-400 bg-zinc-950/60 rounded p-3 border border-zinc-800">
                <div>• Сумма по таблице оборудования: ~2 838 000 тг</div>
                <div>• + Монтаж 25%: 710 000 тг</div>
                <div>• + Пусконаладка 5%: 142 000 тг</div>
                <div>• + Трубопроводы и фасонина: 850 000 тг</div>
                <div className="text-orange-300 font-semibold mt-1">
                  ИТОГО: ~4,5 млн тг для типового ИТП (допуск ±15%)
                </div>
              </div>
            )}
          </div>

          {/* Ex2 */}
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="font-semibold text-zinc-100 mb-2">
              Упражнение 2. Площадь помещения ИТП
            </h3>
            <p className="text-zinc-400 text-sm mb-3">
              Для жилых зданий норма — <span className="text-orange-300">0,3 м² на 1 кВт</span> мощности.
              Какая площадь нужна для ИТП мощностью 250 кВт? Ответ в м².
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                placeholder="например, 75"
                className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 focus:border-orange-400 outline-none w-56"
              />
              <button
                onClick={() => setShow2(true)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-medium"
              >
                Проверить
              </button>
              {show2 && (
                <span className={ok2 ? "text-emerald-400" : "text-red-400"}>
                  {ok2 ? "✓ Верно (±10%)" : "✗ Проверьте расчёт"}
                </span>
              )}
            </div>
            {show2 && (
              <div className="mt-3 text-xs text-zinc-400 bg-zinc-950/60 rounded p-3 border border-zinc-800">
                <div>• 250 кВт × 0,3 м²/кВт = 75 м²</div>
                <div className="text-orange-300 font-semibold mt-1">
                  Принять 70–80 м² (допуск ±10%)
                </div>
              </div>
            )}
          </div>

          {/* Ex3 */}
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="font-semibold text-zinc-100 mb-2">
              Упражнение 3. Срок монтажа ИТП
            </h3>
            <p className="text-zinc-400 text-sm mb-3">
              Сколько календарных дней необходимо на полный цикл монтажа и пусконаладки ИТП?
              Ответ в днях.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={a3}
                onChange={(e) => setA3(e.target.value)}
                placeholder="например, 21"
                className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 focus:border-orange-400 outline-none w-56"
              />
              <button
                onClick={() => setShow3(true)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-medium"
              >
                Проверить
              </button>
              {show3 && (
                <span className={ok3 ? "text-emerald-400" : "text-red-400"}>
                  {ok3 ? "✓ Верно (±20%)" : "✗ Проверьте расчёт"}
                </span>
              )}
            </div>
            {show3 && (
              <div className="mt-3 text-xs text-zinc-400 bg-zinc-950/60 rounded p-3 border border-zinc-800">
                <div>• Монтаж оборудования: 2 недели</div>
                <div>• Пусконаладка: 1 неделя</div>
                <div className="text-orange-300 font-semibold mt-1">
                  ИТОГО: 3 недели = 21 день (допуск ±20%)
                </div>
              </div>
            )}
          </div>

          {/* Ex4 */}
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="font-semibold text-zinc-100 mb-2">
              Упражнение 4. Какой график регулирования применяется в ИТП?
            </h3>
            <div className="space-y-2 mb-3">
              {[
                { key: "a", text: "Постоянный — температура подачи фиксированная" },
                { key: "b", text: "По температуре наружного воздуха — компенсационный график" },
                { key: "c", text: "По расходу воды" },
                { key: "d", text: "По графику недели (день/ночь)" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={`flex gap-2 items-start px-3 py-2 rounded border cursor-pointer transition ${
                    a4 === opt.key
                      ? "border-orange-400 bg-orange-950/30"
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.key}
                    checked={a4 === opt.key}
                    onChange={() => setA4(opt.key)}
                    className="mt-1 accent-orange-500"
                  />
                  <span className="text-zinc-200 text-sm">
                    <span className="text-orange-300 font-mono mr-2">{opt.key})</span>
                    {opt.text}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setShow4(true)}
                disabled={!a4}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded font-medium"
              >
                Проверить
              </button>
              {show4 && (
                <span className={ok4 ? "text-emerald-400" : "text-red-400"}>
                  {ok4
                    ? "✓ Верно — компенсационный график по температуре наружного воздуха"
                    : "✗ Неверно. Правильный ответ — b)"}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
          <h2 className="text-xl font-bold text-orange-300 mb-3">
            3. Расценки ЭСН
          </h2>
          <ul className="text-zinc-300 text-sm space-y-1">
            <li>• <span className="text-orange-300 font-mono">Сб. 18</span> — теплоснабжение и водопровод. Наружные сети</li>
            <li>• <span className="text-orange-300 font-mono">Сб. 36</span> — оборудование объектов теплоснабжения</li>
            <li>• <span className="text-orange-300 font-mono">Сб. 41</span> — пусконаладочные работы автоматизированных систем</li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="mb-10 rounded-xl border-2 border-orange-500/60 bg-gradient-to-br from-orange-950/40 to-orange-900/20 p-5">
          <div className="flex gap-3 items-start">
            <div className="text-3xl">💡</div>
            <div>
              <div className="uppercase text-xs tracking-wider text-orange-400 font-bold mb-1">
                Фактоид
              </div>
              <p className="text-zinc-100 leading-relaxed">
                Без ИТП в современных зданиях не достичь класса
                энергоэффективности <span className="text-orange-300 font-bold">А</span> и выше.
                ИТП экономит{" "}
                <span className="text-orange-300 font-bold">15–25% тепла</span>{" "}
                за счёт грамотного регулирования по компенсационному графику.
              </p>
            </div>
          </div>
        </section>

        <Link
          href="/smeta-trainer/drawings-practice/hub"
          className="inline-block text-orange-400 hover:text-orange-300 text-sm"
        >
          ← К разделам
        </Link>
      </div>
    </div>
  );
}
