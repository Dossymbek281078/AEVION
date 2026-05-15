"use client";

import Link from "next/link";
import { useState } from "react";

type Tol = { val: number; tol: number };

function checkNumeric(input: string, target: Tol): "ok" | "fail" | "empty" {
  if (!input.trim()) return "empty";
  const n = Number(input.replace(",", ".").replace(/\s/g, ""));
  if (Number.isNaN(n)) return "fail";
  const diff = Math.abs(n - target.val) / target.val;
  return diff <= target.tol ? "ok" : "fail";
}

const summary: Array<{ id: string; name: string; sum: number; note: string }> = [
  { id: "1", name: "Земляные работы", sum: 1_850_000, note: "Котлован, обратная засыпка, планировка" },
  { id: "2", name: "Фундамент монолитный", sum: 4_200_000, note: "Лента 400×1500 мм, бетон B25, арматура A500C" },
  { id: "3", name: "Стены и перекрытия", sum: 6_850_000, note: "Газоблок Ytong 400 мм + перекрытия монолит" },
  { id: "4", name: "Кровля", sum: 2_100_000, note: "Битумная черепица, стропильная система, мансардные окна" },
  { id: "5", name: "Окна и двери", sum: 1_850_000, note: "ПВХ окна 2-камерные + входная + межкомнатные" },
  { id: "6", name: "Отделка внутренняя", sum: 5_200_000, note: "Стяжка, штукатурка, обои, плитка, ламинат" },
  { id: "7", name: "Инженерные сети", sum: 7_800_000, note: "Отопление, вода, канализация, электрика, СКС, ОПС" },
  { id: "8", name: "Благоустройство участка", sum: 1_500_000, note: "Дорожки, газон, забор, въездная группа" },
];

const totalSum = summary.reduce((acc, r) => acc + r.sum, 0);

const engineering: Array<{ id: string; name: string; sum: number; spec: string }> = [
  { id: "7.1", name: "Отопление двухтрубное (газовый котёл 32 кВт)", sum: 2_200_000, spec: "Vaillant ecoTEC, радиаторы Kermi, PEX-AL-PEX" },
  { id: "7.2", name: "Тёплый пол водяной (40 м²)", sum: 950_000, spec: "Коллектор + трубы PE-Xa, шаг укладки 150 мм" },
  { id: "7.3", name: "Водопровод PPR", sum: 480_000, spec: "Холодная и горячая, разводка по этажам" },
  { id: "7.4", name: "Канализация ПВХ", sum: 350_000, spec: "Внутренняя D110/D50, наружная до септика" },
  { id: "7.5", name: "Скважина с насосом", sum: 1_800_000, spec: "Бурение 60 м, гидробак 200 л, насос Grundfos" },
  { id: "7.6", name: "Электрика (щит + разводка + автоматы)", sum: 1_350_000, spec: "ВРУ 3-фазный, кабель ВВГнг-LS, УЗО 30 мА" },
  { id: "7.7", name: "СКС cat6 + Wi-Fi UniFi", sum: 250_000, spec: "Розетки RJ-45, AP UniFi U6-Lite ×3" },
  { id: "7.8", name: "Охранно-пожарная сигнализация", sum: 420_000, spec: "ИП-212, датчики движения, пульт GSM" },
];

const engTotal = engineering.reduce((acc, r) => acc + r.sum, 0);

const esnRefs: Array<{ section: string; book: string; codes: string }> = [
  { section: "Земляные работы", book: "Сборник 1 ЭСН РК", codes: "01-01-013, 01-02-061" },
  { section: "Фундамент монолитный", book: "Сборник 6 ЭСН РК", codes: "06-01-001, 06-01-026" },
  { section: "Стены газоблок", book: "Сборник 8 ЭСН РК", codes: "08-03-002" },
  { section: "Перекрытия монолит", book: "Сборник 7 ЭСН РК", codes: "07-01-003" },
  { section: "Кровля битумная черепица", book: "Сборник 12 ЭСН РК", codes: "12-01-015" },
  { section: "Окна ПВХ", book: "Сборник 10 ЭСН РК", codes: "10-01-034" },
  { section: "Штукатурка стен", book: "Сборник 15 ЭСН РК", codes: "15-02-016" },
  { section: "Отопление", book: "Сборник 18 ЭСН РК", codes: "18-03-001, 18-04-008" },
  { section: "Электромонтаж", book: "Сборник 21 ЭСН РК", codes: "21-01-005, 21-02-019" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export default function CaseCottagePage() {
  const [a1, setA1] = useState("");
  const [a1show, setA1show] = useState(false);
  const r1 = checkNumeric(a1, { val: 24.9, tol: 0.05 });

  const [a2, setA2] = useState("");
  const [a2show, setA2show] = useState(false);
  const r2 = checkNumeric(a2, { val: 130_625, tol: 0.05 });

  const [a3, setA3] = useState("");
  const [a3show, setA3show] = useState(false);
  const r3 = checkNumeric(a3, { val: 48, tol: 0.1 });

  const [a4, setA4] = useState<string | null>(null);
  const [a4show, setA4show] = useState(false);
  const a4correct = a4 === "c";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-amber-900/40 bg-slate-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-amber-400 hover:text-amber-300 text-sm">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">CAPSTONE · Полная смета · Алматы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-amber-300 mb-3">
            🏡 КЕЙС: Коттедж 240 м² — полная смета
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            Capstone-кейс: соберите локальную смету (ЛСР) на двухэтажный жилой дом с гаражом в г. Алматы.
            Проработайте все 8 разделов от земляных работ до благоустройства.
          </p>
        </section>

        <section className="bg-slate-900/60 border border-amber-900/30 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-amber-300 mb-4">Исходные данные объекта</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <ul className="space-y-2 text-slate-300">
              <li>• Этажность: <span className="text-amber-200">2 этажа</span></li>
              <li>• Площадь жилая: <span className="text-amber-200">240 м²</span></li>
              <li>• Площадь гаража: <span className="text-amber-200">60 м² (пристроенный)</span></li>
              <li>• Город: <span className="text-amber-200">Алматы</span></li>
              <li>• Площадь участка: <span className="text-amber-200">12 соток</span></li>
            </ul>
            <ul className="space-y-2 text-slate-300">
              <li>• Фундамент: <span className="text-amber-200">монолитная лента 400×1500 мм</span></li>
              <li>• Стены: <span className="text-amber-200">газоблок Ytong 400 мм + штукатурка</span></li>
              <li>• Кровля: <span className="text-amber-200">битумная черепица</span></li>
              <li>• Отопление: <span className="text-amber-200">газовый котёл + тёплый пол</span></li>
              <li>• Бюджет: <span className="text-amber-200">28–45 млн тг (диапазон рынка РК)</span></li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-amber-300 mb-4">
            1. Сводный сметный расчёт по разделам
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-amber-200">
                <tr>
                  <th className="px-3 py-2 text-left">№</th>
                  <th className="px-3 py-2 text-left">Раздел</th>
                  <th className="px-3 py-2 text-left">Описание</th>
                  <th className="px-3 py-2 text-right">Сумма, тг</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row, i) => (
                  <tr
                    key={row.id}
                    className={i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40"}
                  >
                    <td className="px-3 py-2 text-slate-500">{row.id}</td>
                    <td className="px-3 py-2 text-slate-200">{row.name}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{row.note}</td>
                    <td className="px-3 py-2 text-right text-amber-200 font-mono">{fmt(row.sum)}</td>
                  </tr>
                ))}
                <tr className="bg-amber-950/30 border-t-2 border-amber-700">
                  <td className="px-3 py-3" colSpan={3}>
                    <span className="text-amber-200 font-semibold">ИТОГО по сводной смете</span>
                  </td>
                  <td className="px-3 py-3 text-right text-amber-300 font-bold font-mono">
                    {fmt(totalSum)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Цены — текущие рыночные по г. Алматы (без учёта НДС, НР, СП и индекса пересчёта на квартал).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-amber-300 mb-4">
            2. Детализация раздела «Инженерные сети»
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-amber-200">
                <tr>
                  <th className="px-3 py-2 text-left">Шифр</th>
                  <th className="px-3 py-2 text-left">Наименование</th>
                  <th className="px-3 py-2 text-left">Спецификация</th>
                  <th className="px-3 py-2 text-right">Сумма, тг</th>
                </tr>
              </thead>
              <tbody>
                {engineering.map((row, i) => (
                  <tr
                    key={row.id}
                    className={i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40"}
                  >
                    <td className="px-3 py-2 text-slate-500 font-mono">{row.id}</td>
                    <td className="px-3 py-2 text-slate-200">{row.name}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{row.spec}</td>
                    <td className="px-3 py-2 text-right text-amber-200 font-mono">{fmt(row.sum)}</td>
                  </tr>
                ))}
                <tr className="bg-amber-950/30 border-t-2 border-amber-700">
                  <td className="px-3 py-3" colSpan={3}>
                    <span className="text-amber-200 font-semibold">ИТОГО по инженерке</span>
                  </td>
                  <td className="px-3 py-3 text-right text-amber-300 font-bold font-mono">
                    {fmt(engTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-amber-300 mb-4">
            3. Интерактивные упражнения
          </h2>
          <div className="space-y-6">

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-amber-400 font-bold">3.1</span>
                <div>
                  <p className="text-slate-200 font-medium">
                    Рассчитайте долю инженерных сетей в общей смете (в %).
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Формула: (раздел 7 / итого по сводной) × 100. Точность ±5%.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-amber-200 font-mono w-40"
                  placeholder="напр. 24.9"
                />
                <span className="text-slate-400 text-sm">%</span>
                {r1 === "ok" && <span className="text-emerald-400 text-sm">✓ Верно</span>}
                {r1 === "fail" && <span className="text-rose-400 text-sm">✗ Проверьте расчёт</span>}
                <button
                  onClick={() => setA1show(!a1show)}
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  {a1show ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {a1show && (
                <div className="mt-3 bg-slate-950/60 border border-amber-900/30 rounded p-3 text-sm text-slate-300">
                  <div className="font-mono">7 800 000 / 31 350 000 × 100% = 24.88% ≈ <span className="text-amber-300">24.9%</span></div>
                  <p className="text-xs text-slate-500 mt-1">
                    Это нормальная доля для коттеджа: инженерка обычно 20–30% от ЛСР.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-amber-400 font-bold">3.2</span>
                <div>
                  <p className="text-slate-200 font-medium">
                    Стоимость 1 м² готового жилья (тг/м²).
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Итого по смете / жилую площадь. Точность ±5%.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={a2}
                  onChange={(e) => setA2(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-amber-200 font-mono w-48"
                  placeholder="напр. 130625"
                />
                <span className="text-slate-400 text-sm">тг/м²</span>
                {r2 === "ok" && <span className="text-emerald-400 text-sm">✓ Верно</span>}
                {r2 === "fail" && <span className="text-rose-400 text-sm">✗ Проверьте расчёт</span>}
                <button
                  onClick={() => setA2show(!a2show)}
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  {a2show ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {a2show && (
                <div className="mt-3 bg-slate-950/60 border border-amber-900/30 rounded p-3 text-sm text-slate-300">
                  <div className="font-mono">31 350 000 / 240 = <span className="text-amber-300">130 625 тг/м²</span></div>
                  <p className="text-xs text-slate-500 mt-1">
                    Для Алматы 2026 — средне-низкий сегмент (рынок 130–220 тыс. тг/м² в коттеджном строительстве).
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-amber-400 font-bold">3.3</span>
                <div>
                  <p className="text-slate-200 font-medium">
                    Объём бетона на ленточный фундамент (м³).
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Ширина 0.4 м, глубина 1.5 м. Периметр 56 м + перегородки 24 м. Точность ±10%.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={a3}
                  onChange={(e) => setA3(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-amber-200 font-mono w-40"
                  placeholder="напр. 48"
                />
                <span className="text-slate-400 text-sm">м³</span>
                {r3 === "ok" && <span className="text-emerald-400 text-sm">✓ Верно</span>}
                {r3 === "fail" && <span className="text-rose-400 text-sm">✗ Проверьте расчёт</span>}
                <button
                  onClick={() => setA3show(!a3show)}
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  {a3show ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {a3show && (
                <div className="mt-3 bg-slate-950/60 border border-amber-900/30 rounded p-3 text-sm text-slate-300 space-y-1">
                  <div className="font-mono">L_общ = 56 + 24 = 80 м</div>
                  <div className="font-mono">V = 80 × 0.4 × 1.5 = <span className="text-amber-300">48 м³</span></div>
                  <p className="text-xs text-slate-500 mt-1">
                    На практике добавьте +5% на потери при заливке (≈ 50.4 м³ заказного бетона).
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-amber-400 font-bold">3.4</span>
                <div>
                  <p className="text-slate-200 font-medium">
                    Какой коэффициент применить к ЭСН для зимнего бетонирования в декабре в г. Алматы?
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Согласно НТД РК — поправка к расценкам на зимнее производство работ.
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { id: "a", label: "1.05" },
                  { id: "b", label: "1.08" },
                  { id: "c", label: "1.13" },
                  { id: "d", label: "1.20" },
                ].map((opt) => {
                  const selected = a4 === opt.id;
                  const correct = opt.id === "c";
                  let cls = "border-slate-700 bg-slate-950/40 hover:border-amber-700";
                  if (selected && correct) cls = "border-emerald-500 bg-emerald-900/20";
                  if (selected && !correct) cls = "border-rose-500 bg-rose-900/20";
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setA4(opt.id)}
                      className={`text-left px-4 py-2 border rounded transition ${cls}`}
                    >
                      <span className="text-slate-500 mr-2">{opt.id})</span>
                      <span className="text-slate-200 font-mono">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3">
                {a4 && a4correct && <span className="text-emerald-400 text-sm">✓ Верно</span>}
                {a4 && !a4correct && <span className="text-rose-400 text-sm">✗ Не тот коэффициент</span>}
                <button
                  onClick={() => setA4show(!a4show)}
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  {a4show ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {a4show && (
                <div className="mt-3 bg-slate-950/60 border border-amber-900/30 rounded p-3 text-sm text-slate-300">
                  <p>
                    Правильный ответ: <span className="text-amber-300 font-semibold">c) 1.13</span> по сборнику зимних удорожаний ЭСН РК для г. Алматы (зона V), декабрь — основной зимний период.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Коэффициенты применяются только к работам, выполняемым на открытом воздухе или в неотапливаемых помещениях.
                  </p>
                </div>
              )}
            </div>

          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-amber-300 mb-4">
            4. Что упустят начинающие сметчики
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              {
                t: "Забыть НР и СП",
                d: "Накладные расходы 75–110% от ФОТ и сметная прибыль 50–65% от ФОТ — обязательные начисления по НТД РК. Без них смета занижена на 15–25%.",
              },
              {
                t: "Не учесть лимитированные затраты",
                d: "Временные здания и сооружения (1.1–1.8% от СМР), удорожание в зимнее время — отдельные строки в ЛСР, легко пропустить.",
              },
              {
                t: "Забыть индекс пересчёта на квартал",
                d: "ЭСН в базисных ценах нужно умножить на текущий квартальный индекс Комитета по делам строительства РК. Иначе смета в ценах 2001 года.",
              },
              {
                t: "Не учесть зимнее удорожание",
                d: "Для Алматы расчётный зимний период декабрь–март, поправка к ЭСН до 1.13. На круглогодичных стройках этот пункт обязателен.",
              },
              {
                t: "Не учесть транспортные расходы материалов",
                d: "Доставка газоблока, бетона, металла на участок — отдельная позиция. Особенно если участок в пригороде Алматы (Каскелен, Есик и т. п.).",
              },
              {
                t: "Игнорировать НДС",
                d: "12% НДС начисляется на итог сметы для подрядчиков на ОУР. Заказчику нужна цена «с НДС» — иначе договор будет переподписываться.",
              },
            ].map((item) => (
              <div
                key={item.t}
                className="bg-slate-900/60 border border-rose-900/30 rounded-lg p-4"
              >
                <div className="text-rose-300 font-semibold text-sm mb-1">⚠ {item.t}</div>
                <div className="text-slate-400 text-xs leading-relaxed">{item.d}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-amber-300 mb-4">
            5. Расценки ЭСН по разделам (справочно)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-amber-200">
                <tr>
                  <th className="px-3 py-2 text-left">Раздел</th>
                  <th className="px-3 py-2 text-left">Сборник ЭСН РК</th>
                  <th className="px-3 py-2 text-left">Шифры расценок</th>
                </tr>
              </thead>
              <tbody>
                {esnRefs.map((row, i) => (
                  <tr
                    key={row.section}
                    className={i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40"}
                  >
                    <td className="px-3 py-2 text-slate-200">{row.section}</td>
                    <td className="px-3 py-2 text-slate-400">{row.book}</td>
                    <td className="px-3 py-2 text-amber-200 font-mono text-xs">{row.codes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Полный перечень — в каталоге ЭСН проекта (раздел esn-catalog).
          </p>
        </section>

        <section className="bg-amber-950/30 border border-amber-700/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div>
              <h3 className="text-amber-300 font-semibold text-lg mb-2">Факт-блок: квартальный индекс</h3>
              <p className="text-slate-200 text-sm leading-relaxed">
                На локальную сметную расчётную (ЛСР) для коттеджа в РК — у вас всего <span className="text-amber-300 font-semibold">1 учётный квартал</span> на пересчёт индексов.
                После этого смету нужно <span className="text-amber-300 font-semibold">актуализировать перед началом работ</span>: поднять текущие квартальные индексы Комитета по делам строительства,
                перепроверить рыночные цены материалов и обновить НР/СП, если менялась нормативка. Просроченная смета — частая причина конфликтов с заказчиком.
              </p>
            </div>
          </div>
        </section>

        <footer className="pt-8 pb-12 text-center text-xs text-slate-600 border-t border-slate-900">
          AEVION Smeta Trainer · Capstone-кейс · Коттедж 240 м² · г. Алматы
        </footer>
      </main>
    </div>
  );
}
