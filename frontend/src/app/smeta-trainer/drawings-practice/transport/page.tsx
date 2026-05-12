"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Транспортные расходы — учебная страница тренажёра по сметному делу РК.
 * Тарифы — учебная выборка из ССЦ РК 8.04 (среднеотраслевые).
 * Цены ориентировочные на III квартал 2025 г. в г. Алматы.
 * Не для коммерческих расчётов!
 */

// ─────────────────────────────────────────────────────────────────────────────
// Утилита: проверка ответа с допуском
// ─────────────────────────────────────────────────────────────────────────────
function checkAnswer(input: string, expected: number[], tolerance = 0.02): boolean {
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value)) return false;
  return expected.some((exp) => {
    if (exp === 0) return value === 0;
    return Math.abs((value - exp) / exp) <= tolerance;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Данные: группы материалов
// ─────────────────────────────────────────────────────────────────────────────
interface MaterialGroup {
  code: string;
  name: string;
  materials: string;
  vehicle: string;
  feature: string;
}

const MATERIAL_GROUPS: MaterialGroup[] = [
  { code: "I",    name: "сыпучие",            materials: "Песок, щебень, грунт, ПГС",                       vehicle: "Самосвал",                  feature: "Без укрытия, навалом" },
  { code: "II",   name: "растворы и смеси",   materials: "Бетон товарный, раствор, ц-п смеси",              vehicle: "Автобетоносмеситель",       feature: "Время в пути ≤ 2 часов!" },
  { code: "III",  name: "штучные тяжёлые",    materials: "Кирпич, ЖБИ, плиты, металлопрокат",               vehicle: "Бортовой ≥ 10 т",           feature: "На паллетах" },
  { code: "IV",   name: "длинномерные",       materials: "Арматура, трубы Ø > 100 мм, балки",               vehicle: "Длинномер",                 feature: "+ сопровождение если > 24 м" },
  { code: "V",    name: "хрупкие",            materials: "Стекло, керамогранит, окна ПВХ, сан. техника",   vehicle: "Тент с обвязкой",           feature: "Аккуратная погрузка" },
  { code: "VI",   name: "опасные",            materials: "Газовые баллоны, лак, краска (ЛВЖ), химия",       vehicle: "Спецтранспорт",             feature: "Лицензия ADR" },
  { code: "VII",  name: "объёмные лёгкие",    materials: "Минвата, ППС, ПГП, гипсокартон, пиломатериалы",   vehicle: "Тент или фургон",           feature: "По объёму, не по массе" },
  { code: "VIII", name: "жидкости",           materials: "Битум, мазут, антифриз, ГСМ",                     vehicle: "Цистерна",                  feature: "+ насос для разгрузки" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Данные: тарифы на транспорт
// ─────────────────────────────────────────────────────────────────────────────
interface VehicleTariff {
  type: string;
  capacity: string;
  shift8: string;
  hour: string;
  km: string;
}

const VEHICLE_TARIFFS: VehicleTariff[] = [
  { type: "Газель Next",                              capacity: "1.5 т / 8 м³",     shift8: "18 000",  hour: "2 800",   km: "80" },
  { type: "ЗИЛ-130 бортовой",                         capacity: "5 т / 12 м³",      shift8: "28 000",  hour: "3 800",   km: "120" },
  { type: "КАМАЗ-65117 бортовой",                     capacity: "11 т / 21 м³",     shift8: "38 000",  hour: "4 800",   km: "160" },
  { type: "КАМАЗ-65115 самосвал",                     capacity: "11 т / 8 м³",      shift8: "35 000",  hour: "4 600",   km: "150" },
  { type: "МАЗ-6501 самосвал",                        capacity: "20 т / 16 м³",     shift8: "52 000",  hour: "6 800",   km: "220" },
  { type: "Автобетоносмеситель Schwing 6 м³",         capacity: "6 м³ бетона",      shift8: "65 000",  hour: "8 800",   km: "250 + слив" },
  { type: "Автобетоносмеситель 9 м³",                 capacity: "9 м³ бетона",      shift8: "85 000",  hour: "11 200",  km: "280 + слив" },
  { type: "Длинномер (платформа 13.5 м)",             capacity: "25 т",             shift8: "75 000",  hour: "9 800",   km: "280" },
  { type: "Тягач + полуприцеп 16 т",                  capacity: "16 т",             shift8: "65 000",  hour: "8 500",   km: "240" },
  { type: "Эвакуатор техники до 8 т",                 capacity: "—",                shift8: "45 000",  hour: "—",       km: "180" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Данные: тарифы на доставку конкретных материалов
// ─────────────────────────────────────────────────────────────────────────────
interface DeliveryTariff {
  material: string;
  origin: string;
  distance: string;
  tariff: string;
}

const DELIVERY_TARIFFS: DeliveryTariff[] = [
  { material: "Песок речной (м³)",                   origin: "Талгарский",            distance: "25",    tariff: "1 800 (с погрузкой и доставкой)" },
  { material: "Щебень фракции 5-20 (м³)",            origin: "Капчагай",              distance: "75",    tariff: "4 500" },
  { material: "Бетон М300 (м³)",                     origin: "Завод Алмагро",         distance: "15",    tariff: "4 200 (с насосной разгрузкой)" },
  { material: "Кирпич М150 (1000 шт)",               origin: "Алматинский кирпичный", distance: "18",    tariff: "12 800 + кран 5 800/час" },
  { material: "ЖБИ плита перекрытия (шт, до 5 т)",   origin: "Завод ЖБИ-1",           distance: "20",    tariff: "8 500 + кран" },
  { material: "Арматура А500С (т)",                  origin: "Магнитогорск (импорт)", distance: "1500+", tariff: "28 000 (включая ж/д)" },
  { material: "Профнастил (т)",                      origin: "Алматинский метал.",    distance: "12",    tariff: "6 500" },
  { material: "Минвата URSA (м³)",                   origin: "Шымкент (склад)",       distance: "700",   tariff: "4 800 (фурой)" },
  { material: "Окна ПВХ (м²)",                       origin: "Местный завод",         distance: "25",    tariff: "1 200 (за бортом стоит на собранных каркасах)" },
  { material: "Гипсокартон (1000 м²)",               origin: "Knauf Капчагай",        distance: "75",    tariff: "65 000 (за фуру)" },
  { material: "Линолеум (рулон 25 м)",               origin: "Tarkett (склад Алматы)", distance: "18",   tariff: "4 800" },
  { material: "Растительный грунт (м³)",             origin: "Карьер",                distance: "35",    tariff: "2 800 (с погрузкой)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Компонент: интерактивное упражнение
// ─────────────────────────────────────────────────────────────────────────────
interface ExerciseProps {
  number: number;
  title: string;
  description: React.ReactNode;
  expected: number[];
  tolerance?: number;
  unit: string;
  explanation: React.ReactNode;
}

function Exercise({ number, title, description, expected, tolerance = 0.02, unit, explanation }: ExerciseProps) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const isCorrect = submitted && checkAnswer(input, expected, tolerance);
  const isWrong = submitted && input.trim() !== "" && !isCorrect;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="rounded bg-amber-500 px-2 py-0.5 text-sm font-bold text-white">№ {number}</span>
        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">{title}</h3>
      </div>
      <div className="mb-4 space-y-2 text-sm text-slate-800 dark:text-slate-200">{description}</div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setSubmitted(false);
          }}
          placeholder="Ваш ответ"
          className="w-48 rounded border border-amber-400 bg-white px-3 py-2 text-base focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:border-amber-600 dark:bg-slate-800 dark:text-white"
        />
        <span className="text-sm text-slate-600 dark:text-slate-400">{unit}</span>
        <button
          onClick={() => setSubmitted(true)}
          className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 active:bg-amber-800"
        >
          Проверить
        </button>
        <button
          onClick={() => setShowExplanation((s) => !s)}
          className="rounded border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40"
        >
          {showExplanation ? "Скрыть пояснение" : "Показать пояснение"}
        </button>
      </div>
      {isCorrect && (
        <div className="mt-3 rounded bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          ✓ Верно! Допуск ±{(tolerance * 100).toFixed(0)}%.
        </div>
      )}
      {isWrong && (
        <div className="mt-3 rounded bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
          ✗ Не сходится. Перепроверьте формулу или единицы измерения.
        </div>
      )}
      {showExplanation && (
        <div className="mt-3 rounded border border-amber-300 bg-white p-3 text-sm text-slate-800 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-200">
          {explanation}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Главная страница
// ─────────────────────────────────────────────────────────────────────────────
export default function TransportPage() {
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [deliverySearch, setDeliverySearch] = useState("");

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return VEHICLE_TARIFFS;
    return VEHICLE_TARIFFS.filter(
      (v) =>
        v.type.toLowerCase().includes(q) ||
        v.capacity.toLowerCase().includes(q),
    );
  }, [vehicleSearch]);

  const filteredDeliveries = useMemo(() => {
    const q = deliverySearch.trim().toLowerCase();
    if (!q) return DELIVERY_TARIFFS;
    return DELIVERY_TARIFFS.filter(
      (d) =>
        d.material.toLowerCase().includes(q) ||
        d.origin.toLowerCase().includes(q),
    );
  }, [deliverySearch]);

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-amber-300 bg-amber-100/95 backdrop-blur dark:border-amber-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm font-semibold text-amber-800 transition hover:text-amber-600 dark:text-amber-200 dark:hover:text-amber-100"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Тренажёр сметного дела РК · модуль «Транспортные расходы»
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold text-amber-900 dark:text-amber-100">
          🚛 Транспортные расходы — доставка материалов и техники
        </h1>
        <p className="mb-8 text-base text-slate-700 dark:text-slate-300">
          Учимся считать стоимость доставки сыпучих, штучных, длинномерных и спецгрузов на стройплощадку.
        </p>

        {/* Нормативный блок */}
        <section className="mb-8 rounded-lg border-l-4 border-amber-500 bg-amber-100/70 p-5 dark:border-amber-400 dark:bg-amber-950/40">
          <h2 className="mb-3 text-lg font-bold text-amber-900 dark:text-amber-100">📜 Нормативная база</h2>
          <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
            <li>
              <strong className="text-amber-800 dark:text-amber-200">МДС 81-15.2002</strong> — Методика
              определения транспортных расходов в смете.
            </li>
            <li>
              <strong className="text-amber-800 dark:text-amber-200">ССЦ РК 8.04</strong> — Тарифы на
              транспорт (среднеотраслевые).
            </li>
            <li>
              <strong className="text-amber-800 dark:text-amber-200">СНиП РК 1.04-22-2007</strong> —
              Доставка материалов в строительстве.
            </li>
          </ul>
          <div className="mt-4 rounded bg-white/70 p-3 text-sm text-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
            <strong>Формула:</strong> Транспортные расходы = провозная плата × объём (т, м³, шт) с учётом
            дальности.
          </div>
        </section>

        {/* Раздел 1: группы материалов */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">
            1. Группы материалов по транспортным условиям
          </h2>
          <div className="overflow-x-auto rounded-lg border border-amber-300 dark:border-amber-700">
            <table className="w-full text-sm">
              <thead className="bg-amber-200 text-left text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Группа</th>
                  <th className="px-3 py-2 font-semibold">Материалы</th>
                  <th className="px-3 py-2 font-semibold">Тип ТС</th>
                  <th className="px-3 py-2 font-semibold">Особенность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 bg-white dark:divide-amber-900 dark:bg-slate-900">
                {MATERIAL_GROUPS.map((g) => (
                  <tr key={g.code} className="text-slate-800 hover:bg-amber-50 dark:text-slate-200 dark:hover:bg-amber-950/30">
                    <td className="px-3 py-2 font-bold text-amber-800 dark:text-amber-200">
                      {g.code} ({g.name})
                    </td>
                    <td className="px-3 py-2">{g.materials}</td>
                    <td className="px-3 py-2 italic">{g.vehicle}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{g.feature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: тарифы на транспорт */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">
            2. Тарифы на транспорт (Алматы, III кв. 2025)
          </h2>
          <input
            type="text"
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            placeholder="🔍 Поиск по типу ТС или грузоподъёмности…"
            className="mb-3 w-full max-w-md rounded border border-amber-400 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:border-amber-600 dark:bg-slate-800 dark:text-white"
          />
          <div className="overflow-x-auto rounded-lg border border-amber-300 dark:border-amber-700">
            <table className="w-full text-sm">
              <thead className="bg-amber-200 text-left text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Тип ТС</th>
                  <th className="px-3 py-2 font-semibold">Грузоподъёмность</th>
                  <th className="px-3 py-2 text-right font-semibold">Смена 8 ч, тг</th>
                  <th className="px-3 py-2 text-right font-semibold">Час, тг</th>
                  <th className="px-3 py-2 text-right font-semibold">Км пробега, тг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 bg-white dark:divide-amber-900 dark:bg-slate-900">
                {filteredVehicles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                      Ничего не найдено.
                    </td>
                  </tr>
                )}
                {filteredVehicles.map((v) => (
                  <tr key={v.type} className="text-slate-800 hover:bg-amber-50 dark:text-slate-200 dark:hover:bg-amber-950/30">
                    <td className="px-3 py-2 font-medium">{v.type}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{v.capacity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.shift8}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.hour}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.km}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3: тарифы на доставку конкретных материалов */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">
            3. Тарифы на доставку конкретных материалов в Алматы
          </h2>
          <input
            type="text"
            value={deliverySearch}
            onChange={(e) => setDeliverySearch(e.target.value)}
            placeholder="🔍 Поиск по материалу или пункту отправки…"
            className="mb-3 w-full max-w-md rounded border border-amber-400 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:border-amber-600 dark:bg-slate-800 dark:text-white"
          />
          <div className="overflow-x-auto rounded-lg border border-amber-300 dark:border-amber-700">
            <table className="w-full text-sm">
              <thead className="bg-amber-200 text-left text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Материал</th>
                  <th className="px-3 py-2 font-semibold">Откуда</th>
                  <th className="px-3 py-2 text-right font-semibold">Расстояние, км</th>
                  <th className="px-3 py-2 font-semibold">Тариф, тг/ед.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 bg-white dark:divide-amber-900 dark:bg-slate-900">
                {filteredDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                      Ничего не найдено.
                    </td>
                  </tr>
                )}
                {filteredDeliveries.map((d) => (
                  <tr key={d.material} className="text-slate-800 hover:bg-amber-50 dark:text-slate-200 dark:hover:bg-amber-950/30">
                    <td className="px-3 py-2 font-medium">{d.material}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{d.origin}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.distance}</td>
                    <td className="px-3 py-2">{d.tariff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4: упражнения */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">
            4. Интерактивные упражнения
          </h2>
          <div className="space-y-5">
            <Exercise
              number={1}
              title="Стоимость доставки песка с Талгара"
              description={
                <>
                  <p>На объект нужно завезти <strong>50 м³ речного песка</strong> с Талгарского карьера.</p>
                  <p>
                    Тариф (включая погрузку и доставку до 30 км):{" "}
                    <strong>1 800 тг/м³</strong>.
                  </p>
                  <p>Рассчитайте полную стоимость доставки в тенге.</p>
                </>
              }
              expected={[90000]}
              tolerance={0.02}
              unit="тг"
              explanation={
                <>
                  <p className="mb-1">Стоимость доставки = объём × тариф.</p>
                  <p className="mb-1">50 м³ × 1 800 тг/м³ = <strong>90 000 тг</strong>.</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Допуск ±2%. Тариф уже включает работу самосвала на ходку и погрузку экскаватором в
                    карьере.
                  </p>
                </>
              }
            />

            <Exercise
              number={2}
              title="Количество рейсов и стоимость работы самосвала"
              description={
                <>
                  <p>
                    С котлована нужно вывезти <strong>360 м³ грунта</strong>. Работает самосвал
                    КАМАЗ-65115 объёмом кузова <strong>8 м³</strong>.
                  </p>
                  <p>За смену самосвал успевает делать <strong>8 рейсов</strong>. Стоимость смены —{" "}
                    <strong>35 000 тг</strong>.
                  </p>
                  <p>
                    Введите либо <strong>количество рейсов</strong>, либо <strong>итоговую стоимость
                    работы самосвала</strong> в тенге.
                  </p>
                </>
              }
              expected={[45, 210000]}
              tolerance={0.05}
              unit="рейсов или тг"
              explanation={
                <>
                  <p className="mb-1">Кол-во рейсов = 360 ÷ 8 = <strong>45 рейсов</strong>.</p>
                  <p className="mb-1">Кол-во смен = 45 ÷ 8 = 5.6 → округляем вверх до <strong>6 смен</strong>.</p>
                  <p className="mb-1">Стоимость = 6 смен × 35 000 = <strong>210 000 тг</strong>.</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Допуск ±5%. Округление смен вверх обязательно — самосвал нельзя нанять «на 5.6 смены».
                  </p>
                </>
              }
            />

            <Exercise
              number={3}
              title="Доставка товарного бетона М300"
              description={
                <>
                  <p>
                    На фундамент необходимо <strong>100 м³ бетона М300</strong> с завода Алмагро (15 км
                    от объекта).
                  </p>
                  <p>
                    Тариф автобетоносмесителя с насосной разгрузкой —{" "}
                    <strong>4 200 тг/м³</strong> (только доставка, без стоимости самого бетона).
                  </p>
                  <p>Рассчитайте стоимость транспортных услуг.</p>
                </>
              }
              expected={[420000]}
              tolerance={0.02}
              unit="тг"
              explanation={
                <>
                  <p className="mb-1">Стоимость доставки = 100 м³ × 4 200 тг/м³ = <strong>420 000 тг</strong>.</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Допуск ±2%. Помните: стоимость самого материала идёт отдельной строкой
                    (~41 800 тг/м³ × 100 = ~4.18 млн тг). Транспорт — отдельная позиция в смете.
                  </p>
                </>
              }
            />

            <Exercise
              number={4}
              title="Длинномер: импорт арматуры из Магнитогорска"
              description={
                <>
                  <p>
                    Нужно привезти партию арматуры А500С на длинномере. Расстояние Магнитогорск →
                    Алматы — <strong>~1500 км</strong> в одну сторону.
                  </p>
                  <p>Тариф длинномера: <strong>280 тг/км</strong>. Загрузка/разгрузка: <strong>65 000 тг</strong>.</p>
                  <p>Рассчитайте полные транспортные затраты (пробег + ПРР).</p>
                </>
              }
              expected={[485000]}
              tolerance={0.05}
              unit="тг"
              explanation={
                <>
                  <p className="mb-1">Пробег: 1500 × 280 = <strong>420 000 тг</strong>.</p>
                  <p className="mb-1">+ Погрузка/разгрузка: <strong>65 000 тг</strong>.</p>
                  <p className="mb-1">Итого транспорт: <strong>485 000 тг</strong>.</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Допуск ±5%. На практике добавляются пограничное оформление и ж/д перевалка
                    (если груз идёт по железной дороге). В импортных контрактах транспорт обычно
                    выделяется отдельной строкой.
                  </p>
                </>
              }
            />
          </div>
        </section>

        {/* Раздел 5: лимит транспортных расходов */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">
            5. Лимит транспортных расходов в смете
          </h2>
          <div className="rounded-lg border border-amber-400 bg-amber-100/60 p-5 dark:border-amber-700 dark:bg-amber-950/40">
            <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
              <li>
                Для <strong className="text-amber-800 dark:text-amber-200">бюджетных</strong> объектов:
                транспорт включается отдельной строкой по ССЦ.
              </li>
              <li>
                Для <strong className="text-amber-800 dark:text-amber-200">коммерческих</strong>: можно %
                от стоимости материалов (5-12%).
              </li>
              <li>
                Для <strong className="text-amber-800 dark:text-amber-200">бетона</strong>: всегда
                отдельной строкой по м³ + надбавка за дальность &gt; 30 км.
              </li>
              <li>
                Для <strong className="text-amber-800 dark:text-amber-200">специфических материалов</strong>{" "}
                (импорт, габаритные): по фактическим затратам.
              </li>
              <li>
                <strong>Транспорт включает:</strong> погрузка + перевозка + разгрузка (без хранения!).
              </li>
              <li>
                <strong>Хранение материалов на стройке:</strong> входит в накладные расходы подрядчика.
              </li>
            </ul>
          </div>
        </section>

        {/* Фактоид */}
        <section className="mb-10">
          <div className="rounded-lg border-l-4 border-amber-500 bg-gradient-to-r from-amber-100 to-amber-50 p-5 dark:border-amber-400 dark:from-amber-950/60 dark:to-slate-900">
            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <span className="text-lg">💡</span>{" "}
              <strong className="text-amber-800 dark:text-amber-200">Полезный факт:</strong> Доставка
              может составлять <strong>8-15 % от стоимости материала</strong>. Для тяжёлых длинномерных
              и негабаритных грузов — до <strong>25 %</strong>. Не забывай про возврат тары и пустого
              транспорта (часто оплачивается заказчиком).
            </p>
          </div>
        </section>

        <footer className="mt-12 border-t border-amber-200 pt-4 text-center text-xs text-amber-700 dark:border-amber-800 dark:text-amber-300">
          AEVION Smeta Trainer · модуль «Транспорт» · учебная выборка из ССЦ РК 8.04
        </footer>
      </main>
    </div>
  );
}
