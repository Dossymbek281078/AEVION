"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, expected: number, tolPct: number) {
  const v = parseFloat(i.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tolPct;
}

type Ex = {
  id: string;
  title: string;
  q: string;
  label: string;
  // accepted answer values (any of them is OK)
  answers: { value: number; tol: number }[];
  expl: string;
  vor: string;
};

const EXERCISES: Ex[] = [
  {
    id: "ex1",
    title: "Длина кабеля СКС для школы (60 классов)",
    q:
      "В школе 60 учебных классов. По нормативу СКС: 1 розетка на класс (для рабочего места учителя). Среднее расстояние от стояка/коммутаторной до розетки = 25 м (с резервом). Используем кабель Cat.6 UTP по цене 185 тг/м. Рассчитайте либо общую длину кабеля в метрах, либо стоимость кабеля в тенге.",
    label: "Длина (м) или стоимость (тг)",
    answers: [
      { value: 1500, tol: 0.05 },
      { value: 277500, tol: 0.05 },
    ],
    expl:
      "60 классов × 1 розетка = 60 розеток. Длина = 60 · 25 = 1 500 м кабеля Cat.6. Стоимость кабеля = 1 500 · 185 = 277 500 тг. Принимаются оба варианта (метры или тенге) с допуском ±5%.",
    vor:
      "Прокладка кабеля СКС Cat.6 UTP в кабель-канале — 1 500 м (ЭСН РК Сб.34-1-x)",
  },
  {
    id: "ex2",
    title: "Количество камер видеонаблюдения для школы 600 м²",
    q:
      "Школа площадью 600 м². По нормативу: внутри — 1 камера на 100 м² (коридоры, рекреации), плюс 4 камеры на входах в здание, плюс 4 камеры на периметре участка. Сколько всего камер нужно?",
    label: "Количество камер, шт",
    answers: [{ value: 14, tol: 0.15 }],
    expl:
      "Внутри: 600 / 100 = 6 камер коридоров. + 4 камеры на входах + 4 камеры периметра = 14 камер. Допуск ±15% (можно учитывать особенности планировки).",
    vor:
      "Монтаж IP-камер видеонаблюдения 2-4 МП — 14 шт (ЭСН РК Сб.34-3-x)",
  },
  {
    id: "ex3",
    title: "Полная стоимость системы видеонаблюдения школы",
    q:
      "Считаем полную стоимость системы видеонаблюдения для школы: 14 камер по средней цене 65 000 тг + регистратор NVR 16-канальный (250 000 тг) + жёсткий диск 4 ТБ HDD (35 000 тг) + кабели и работы 30% от оборудования. Сколько всего тенге?",
    label: "Стоимость системы, тг",
    answers: [{ value: 1555000, tol: 0.1 }],
    expl:
      "Камеры: 14 · 65 000 = 910 000 тг. NVR 16-кан = 250 000 тг. HDD 4 ТБ = 35 000 тг. Оборудование = 1 195 000 тг. Кабели + работы 30%: ~360 000 тг. Итого ≈ 1 555 000 тг. Допуск ±10%.",
    vor:
      "Система IP-видеонаблюдения «под ключ» — 14 камер, NVR, HDD, монтаж: ≈1 555 000 тг",
  },
  {
    id: "ex4",
    title: "Стоимость СКУД для школы (биометрия + турникет на входе)",
    q:
      "СКУД для школы: 1 биометрический контроллер ZKTeco IFace 800 (285 000 тг), 2 турникета двусторонних на главном входе и выходе (по 1 250 000 тг = 2 500 000 тг), карты-пропуска EM-Marine для 500 учеников + 50 учителей = 550 шт по 250 тг = 137 500 тг, электромагнитные замки YLI на 12 учебных кабинетов (по 18 500 тг = 222 000 тг). Сколько всего?",
    label: "Стоимость СКУД, тг",
    answers: [{ value: 3145000, tol: 0.1 }],
    expl:
      "Биометрия: 285 000 тг. Турникеты: 2 · 1 250 000 = 2 500 000 тг. Карты: 550 · 250 = 137 500 тг. Замки: 12 · 18 500 = 222 000 тг. Итого: 285 000 + 2 500 000 + 137 500 + 222 000 = 3 144 500 ≈ 3 145 000 тг. Допуск ±10%.",
    vor:
      "СКУД школы: биометрия + 2 турникета + 550 карт + 12 замков ≈ 3 145 000 тг (ЭСН РК Сб.34-4-x)",
  },
];

export default function LowVoltagePage() {
  const [xi, sxi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = EXERCISES[xi];
  const k = ex.id;

  const isOkNow = (val: string) =>
    ex.answers.some((a) => check(val, a.value, a.tol));
  const isOk = rev[k] && isOkNow(inp[k] ?? "");
  const isErr = rev[k] && !isOk;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (isOkNow(inp[k] ?? "")) {
      setTimeout(() => {
        setDone((d) => new Set([...d, ex.id]));
      }, 700);
    }
  }

  const allDone = done.size === EXERCISES.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-violet-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-indigo-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              📡 Слаботочные сети — СКС, видеонаблюдение, СКУД, сигнализация
            </h1>
            <p className="text-[10px] text-indigo-200">
              ЭСН РК Сб.34 · СН РК 4.04-15 · ГОСТ Р 53246-2008 · {done.size}/
              {EXERCISES.length} пройдено
            </p>
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/normatives"
            className="text-[10px] bg-indigo-900 text-indigo-200 px-2 py-1 rounded hover:bg-indigo-800"
          >
            📋 Нормативы
          </Link>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">📡</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Слаботочные сети освоены!
          </h2>
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 text-left mb-4 text-xs space-y-1">
            {EXERCISES.map((s) => (
              <div key={s.id} className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <code className="text-[10px] font-mono">{s.vor}</code>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => {
                sxi(0);
                setInp({});
                setRev({});
                setDone(new Set());
              }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg"
            >
              Снова
            </button>
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="px-4 py-2 bg-indigo-700 text-white text-sm font-semibold rounded-lg"
            >
              → К разделам
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Левая колонка: теория, таблицы, нормативы */}
          <div className="lg:col-span-2 space-y-3">
            {/* Intro */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                {`📡 Слаботочные сети (низковольтные, до 60 В) — обязательны для всех современных объектов. Включают:
- СКС (структурированные кабельные сети) для интернета и телефона
- IP-видеонаблюдение
- СКУД (контроль доступа: турникеты, домофоны)
- Охранно-пожарная сигнализация (см. модуль ПБ)
- АСКУЭ (учёт энергоресурсов)
- Системы оповещения, конференц-залы, ТВ`}
              </p>
              <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 mt-2 font-semibold">
                Стоимость: 800-3 500 тг/м² (типовое здание), 5 000-15 000 тг/м²
                (премиум).
              </p>
            </div>

            {/* Нормативная база */}
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-4">
              <div className="text-xs font-bold text-violet-900 dark:text-violet-200 mb-2">
                📘 Нормативная база — слаботочные сети
              </div>
              <ul className="text-[11px] text-violet-900 dark:text-violet-200 space-y-1 leading-relaxed">
                <li>
                  • <strong>ЭСН РК Сб.34</strong> «Слаботочные системы»
                </li>
                <li>
                  • <strong>СН РК 4.04-15</strong> «Электротехнические
                  устройства» (раздел низковольтные)
                </li>
                <li>
                  • <strong>ГОСТ Р 53246-2008</strong> СКС — структурированные
                  кабельные системы
                </li>
                <li>
                  • <strong>СНиП РК 4.04-08-2007</strong> «Системы
                  охранно-пожарной сигнализации»
                </li>
              </ul>
            </div>

            {/* Section 1: СКС */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                🔌 Раздел 1. СКС — структурированные кабельные сети
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200">
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Категория
                      </th>
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Скорость
                      </th>
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Применение
                      </th>
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Цена кабеля 2025
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Cat. 5e
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        до 100 Мбит/с
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Базовый офис, телефония
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        95 тг/м UTP
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Cat. 6 (FTP/UTP)
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        до 1 Гбит/с
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Стандарт офисных зданий
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        185 тг/м UTP
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Cat. 6a (защ.)
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        до 10 Гбит/с
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Современные офисы, серверные
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        350 тг/м STP
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Cat. 7
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        до 10 Гбит/с (более стабильно)
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Дата-центры, медучреждения
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        580 тг/м
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Оптика OM3
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        до 10 Гбит/с
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Магистрали
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        285 тг/м одноволокон.
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Оптика OS2 (одномодовая)
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        10+ Гбит/с
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Длинные расстояния (&gt;500 м)
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        380 тг/м
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2 text-[11px] text-indigo-900 dark:text-indigo-200">
                <div className="font-bold mb-1">
                  📐 Расчёт количества розеток СКС:
                </div>
                <ul className="space-y-0.5 leading-relaxed">
                  <li>
                    • <strong>Офис:</strong> 2 розетки на рабочее место (1 ПК + 1
                    IP-телефон)
                  </li>
                  <li>
                    • <strong>Школьный класс:</strong> 1 розетка на учителя + 1
                    точка Wi-Fi
                  </li>
                  <li>
                    • <strong>Конференц-зал:</strong> 4-6 розеток + 1 точка Wi-Fi
                  </li>
                  <li>
                    • <strong>Кабинет в больнице:</strong> 1 розетка + 1 точка
                    Wi-Fi
                  </li>
                </ul>
              </div>
            </div>

            {/* Section 2: видеонаблюдение */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                📹 Раздел 2. IP-видеонаблюдение
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200">
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Тип камеры
                      </th>
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Цена 2025
                      </th>
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Применение
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        IP-камера 2 МП Hikvision
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        35 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Внутренний обзор, типовое
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        IP-камера 4 МП с IR ночное
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        65 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Внешний обзор
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Поворотная PTZ 4 МП
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        185 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Парковки, периметр
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Тепловизионная камера
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        850 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Особо охраняемые объекты
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Купольная антивандальная
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        95 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Подъезды, лифтовые холлы
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2 text-[11px] text-indigo-900 dark:text-indigo-200">
                <div className="font-bold mb-1">
                  📐 Расчёт камер и оборудования:
                </div>
                <ul className="space-y-0.5 leading-relaxed">
                  <li>
                    • <strong>Норматив:</strong> 1 камера на 50-100 м² внутри, на
                    каждом подъезде/входе
                  </li>
                  <li>
                    • <strong>Регистратор:</strong> NVR на 16 каналов = 250 000
                    тг, на 32 канала = 480 000 тг
                  </li>
                  <li>
                    • <strong>Хранилище:</strong> 4 ТБ HDD = 35 000 тг (хватает
                    на 30 дней архива 8 камер)
                  </li>
                </ul>
              </div>
            </div>

            {/* Section 3: СКУД */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                🚪 Раздел 3. СКУД — система контроля доступа
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200">
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Элемент
                      </th>
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Цена 2025
                      </th>
                      <th className="text-left p-1.5 border border-indigo-200 dark:border-indigo-800">
                        Применение
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Контроллер ZKTeco IFace 800
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        285 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Биометрия + RFID на здание
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Турникет двусторонний
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        1 250 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Главные входы офисов, школ
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Электромагнитный замок YLI
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        18 500 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Двери в коридорах
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Карта-пропуск EM-Marine
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        250 тг/шт
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Сотрудники, посетители
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Калитка одностворчатая
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        950 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Контроль доступа во дворы
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="p-1.5 border dark:border-slate-700 font-semibold">
                        Видеодомофон Hikvision
                      </td>
                      <td className="p-1.5 border dark:border-slate-700 font-mono">
                        65 000 тг
                      </td>
                      <td className="p-1.5 border dark:border-slate-700">
                        Многоэтажные жилые
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Расценки ЭСН */}
            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                💼 Применимые расценки ЭСН РК
              </div>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed font-mono">
                <li>
                  • <strong>ЭСН Сб.34-1-x</strong> — Прокладка слаботочных
                  кабелей
                </li>
                <li>
                  • <strong>ЭСН Сб.34-2-x</strong> — Установка розеток и
                  патч-панелей СКС
                </li>
                <li>
                  • <strong>ЭСН Сб.34-3-x</strong> — Монтаж IP-камер и
                  регистратора
                </li>
                <li>
                  • <strong>ЭСН Сб.34-4-x</strong> — СКУД монтаж и пусконаладка
                </li>
              </ul>
            </div>

            {/* Factoid */}
            <div className="bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-500 rounded p-3">
              <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                💡 Факт по сметному делу
              </div>
              <p className="text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed">
                Слаботочка часто заказывается{" "}
                <strong>СПЕЦИАЛИЗИРОВАННОЙ</strong> организацией, не
                общестроительным подрядчиком. В смете — отдельная позиция с
                подрядчиком «Слаботочка-Сервис» или подобным.
              </p>
            </div>
          </div>

          {/* Правая колонка: упражнения */}
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {EXERCISES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    sxi(i);
                    setInp({});
                    setRev({});
                  }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    i === xi
                      ? "bg-indigo-600 text-white"
                      : done.has(s.id)
                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {done.has(s.id) ? "✓" : i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Упражнение {xi + 1}: {ex.title}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                {ex.q}
              </p>

              {!done.has(ex.id) ? (
                <div
                  className={`border-2 rounded-lg p-3 ${
                    isOk
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                      : isErr
                      ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    {ex.label}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inp[k] ?? ""}
                      onChange={(e) =>
                        setInp((p) => ({ ...p, [k]: e.target.value }))
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" && !rev[k] && go()
                      }
                      disabled={!!rev[k]}
                      placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-40"
                      >
                        Проверить
                      </button>
                    )}
                  </div>
                  {rev[k] && (
                    <div
                      className={`mt-2 text-xs leading-relaxed ${
                        isOk
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-red-800 dark:text-red-300"
                      }`}
                    >
                      {isOk ? "✓ " : "✗ "}
                      {ex.expl}
                    </div>
                  )}
                  {isErr && (
                    <button
                      onClick={() => {
                        setInp((p) => ({ ...p, [k]: "" }));
                        setRev((r) => ({ ...r, [k]: false }));
                      }}
                      className="mt-1 text-[10px] text-indigo-700 dark:text-indigo-400 underline"
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">
                    ✓ Завершено
                  </div>
                  <code className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 block">
                    {ex.vor}
                  </code>
                </div>
              )}
            </div>

            {done.has(ex.id) && xi + 1 < EXERCISES.length && (
              <button
                onClick={() => {
                  sxi(xi + 1);
                  setInp({});
                  setRev({});
                }}
                className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
              >
                Следующее упражнение →
              </button>
            )}

            {/* Боковая шпаргалка норм */}
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-3">
              <div className="text-[11px] font-bold text-violet-900 dark:text-violet-200 mb-1">
                ⚡ Что важно знать
              </div>
              <ul className="text-[10px] text-violet-900 dark:text-violet-200 space-y-1 leading-relaxed">
                <li>• Слаботочка ≤ 60 В — не путать с электрикой 220/380 В</li>
                <li>
                  • Cat.6 — стандарт офисов 2025; Cat.5e уже устарел для нового
                  строительства
                </li>
                <li>
                  • IP-камеры PoE — питание по тому же кабелю Cat.6, без
                  отдельного БП
                </li>
                <li>
                  • Турникет требует тамбур безопасности — закладывайте
                  фальшпол/перегородки
                </li>
                <li>
                  • Пусконаладка СКУД ~15-20% от стоимости оборудования
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
