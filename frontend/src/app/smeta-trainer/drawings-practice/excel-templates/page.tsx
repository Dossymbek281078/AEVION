'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';

// ============== CSV templates ==============

const TEMPLATES: Record<string, { title: string; description: string; fields: string; csv: string }> = {
  f2: {
    title: 'Ф-2 «Локальный сметный расчёт»',
    description: 'Базовая форма ЛСР с расчётом по позициям',
    fields: '№, Шифр, Наименование, Ед, Кол-во, Цена 2001, Сумма 2001, Индекс, Сумма тек.',
    csv: `Локальный сметный расчёт № __
Объект: ____
Подрядчик: ____
Заказчик: ____
Дата: ____

№,Шифр,Наименование,Ед,Кол-во,Цена 2001,Сумма 2001,Индекс,Сумма тек.
1,ЭСН Сб.6 §6-01-001,Бетонирование М300,м³,75.6,1280.50,96807,11.42,1105498
2,ЭСН Сб.8 §8-2-008,Кладка газобетон,м³,446.2,1654.80,738502,11.42,8433691
,,,,,,,Итого:,9539189
,,,,,,,НР 95% от ФОТ,_____
,,,,,,,СП 65% от ФОТ,_____
,,,,,,,НДС 12%,_____
,,,,,,,К ОПЛАТЕ:,_____
`,
  },
  f3: {
    title: 'Ф-3 «Сводный сметный расчёт»',
    description: '12 глав МДС 81-25, итоги',
    fields: 'Глава, Наименование, Стоимость СМР, Стоимость оборудования, Прочее',
    csv: `Сводный сметный расчёт
Объект: Школа №47

Глава,Наименование,Стоимость СМР тг,Стоимость оборуд. тг,Прочее
1,Подготовка территории,500000,0,0
2,Основные объекты,180000000,15000000,0
3,Подсобные объекты,5000000,0,0
4,Энергетика,3000000,2000000,0
5,Транспорт,2000000,0,0
6,Наружные сети,15000000,0,0
7,Благоустройство,8000000,0,0
8,Временные здания,5000000,0,0
9,Прочие работы,3000000,0,0
10,Содержание дирекции,2000000,0,0
11,ПИР,11500000,0,0
12,Подготовка кадров,500000,0,0
,Итого:,235500000,17000000,0
,Резерв 2%:,5050000,,
,НДС 12%:,_,_,_
,ВСЕГО:,_,_,_
`,
  },
  ks2: {
    title: 'КС-2 «Акт приёмки выполненных работ»',
    description: 'Помесячный акт с детализацией',
    fields: '№, Наименование работ, Ед, Кол-во по смете, Выполнено, Цена, Сумма',
    csv: `Акт о приёмке выполненных работ № ___
Форма КС-2
Объект: ____
Заказчик: ____
Подрядчик: ____
Договор № ____ от ____
Отчётный период: с ____ по ____

№,Наименование работ,Ед,По смете кол-во,Выполнено кол-во,Цена за ед.,Сумма тг
1,Бетонирование фундамента М300,м³,75.6,75.6,14622,1105423
2,Кладка стен из газобетона,м³,446.2,200.0,18900,3780000
3,Армирование (вязка каркасов),т,12.5,5.2,285000,1482000
,,,,,Итого:,6367423
,,,,,НДС 12%:,764091
,,,,,ВСЕГО:,7131514

Сдал: подрядчик ________ /________/
Принял: заказчик ________ /________/
`,
  },
  ks3: {
    title: 'КС-3 «Справка о стоимости работ»',
    description: 'Сводка для оплаты по КС-2',
    fields: 'Объект, Период, Стоимость с начала, За отчётный месяц',
    csv: `Справка о стоимости выполненных работ и затрат
Форма КС-3
Объект: ____
Заказчик: ____
Подрядчик: ____
Договор № ____

№,Наименование объекта/этапа,Стоимость с начала года тг,В т.ч. за отчётный месяц тг,Стоимость с начала строительства тг
1,Фундаменты,1105423,1105423,1105423
2,Стены и перегородки,3780000,3780000,3780000
3,Армирование,1482000,1482000,1482000
,Итого без НДС:,6367423,6367423,6367423
,НДС 12%:,764091,764091,764091
,ВСЕГО к оплате:,7131514,7131514,7131514

Подрядчик: ____ /____/
Заказчик: ____ /____/
`,
  },
  vor: {
    title: 'ВОР «Ведомость объёмов работ»',
    description: 'Объёмы без цен по разделам',
    fields: '№, Раздел, Наименование работ, Ед, Кол-во, Примечание',
    csv: `Ведомость объёмов работ
Объект: ____
Стадия: РД
Шифр: ____

№,Раздел,Наименование работ,Ед,Количество,Примечание
1,Земляные,Разработка грунта 2 группы экскаватором,м³,520,
2,Земляные,Обратная засыпка с трамбовкой,м³,180,
3,Бетонные,Устройство монолитного фундамента М300,м³,75.6,арматура отд.
4,Бетонные,Армирование А500С Ø12-20,т,12.5,
5,Каменные,Кладка стен из газобетона D500 b=400,м³,446.2,
6,Каменные,Перемычки сборные ж/б,шт,48,
7,Кровельные,Устройство стропильной системы,м²,320,
8,Кровельные,Покрытие металлочерепицей,м²,340,
9,Отделочные,Штукатурка стен по маякам,м²,1850,
10,Отделочные,Шпатлёвка + покраска ВД,м²,1850,
,,,,,
,,Итого позиций:,,10,
`,
  },
  materials: {
    title: 'Калькулятор материалов',
    description: 'Расход + цены ССЦ + итог',
    fields: 'Материал, Ед, Норма расхода, Объём работ, Расход, Цена ССЦ, Сумма',
    csv: `Калькулятор материалов
Объект: ____
Раздел: ____

№,Материал,Ед,Норма расхода,Объём работ ед,Всего расход,Цена тг/ед ССЦ,Сумма тг
1,Цемент М400,т,0.32 на м³ бетона,75.6,24.19,42500,1028075
2,Песок строительный,м³,0.45 на м³ бетона,75.6,34.02,2800,95256
3,Щебень фр.5-20,м³,0.85 на м³ бетона,75.6,64.26,4200,269892
4,Арматура А500С Ø12,т,1.0,5.5,5.5,285000,1567500
5,Арматура А500С Ø16,т,1.0,4.2,4.2,285000,1197000
6,Газобетон D500 b=400,м³,1.02,446.2,455.12,28500,12970920
7,Клей для газобетона,кг,1.5 на м³,446.2,669.3,180,120474
,,,,,,Итого материалы:,17249117
,,,,,,Транспорт 5%:,862456
,,,,,,ВСЕГО:,18111573
`,
  },
  labor: {
    title: 'Калькулятор стоимости труда',
    description: 'ФОТ по разрядам с НР/СП',
    fields: 'Разряд, Тариф тг/час, Кол-во чел, Часов/день, Дней, ФОТ, НР, СП, Итого',
    csv: `Калькулятор стоимости труда (ФОТ)
Объект: ____
Бригада: ____

Разряд,Тариф тг/час,Чел.,Часов/день,Дней,ФОТ тг,НР 47.5%,СП 32.5%,Итого тг
6 (бригадир),3317,1,8,22,583792,277301,189732,1050825
4 (каменщики),2472,4,8,22,1741056,827002,565843,3133901
2 (подсобники),2008,3,8,22,1060224,503606,344573,1908403
,,,,Итого:,3385072,1607909,1100148,6093129

Тарифы 2025 (РК):
1 разряд - 1648
2 разряд - 2008
3 разряд - 2245
4 разряд - 2472
5 разряд - 2820
6 разряд - 3317

НР = 95% от ФОТ × 0.5 = 47.5% (учётный коэф.)
СП = 65% от ФОТ × 0.5 = 32.5%
`,
  },
  cashflow: {
    title: 'Cash flow прогноз 12 мес',
    description: 'Поступления + расходы по месяцам',
    fields: 'Месяц, Поступления, Расходы (зарплата, материалы, налоги), Сальдо',
    csv: `Cash Flow прогноз на 12 месяцев
Объект: ____
Контракт: ____ тг

Месяц,Поступления тг,ФОТ тг,Материалы тг,Субподряд тг,Налоги тг,Прочее тг,Итого расход,Сальдо месяц,Накопит. сальдо
Янв,15000000,3000000,5000000,2000000,800000,500000,11300000,3700000,3700000
Фев,18000000,3500000,6500000,2500000,950000,600000,14050000,3950000,7650000
Мар,22000000,4200000,7800000,3000000,1100000,700000,16800000,5200000,12850000
Апр,20000000,4000000,7000000,2800000,1050000,650000,15500000,4500000,17350000
Май,25000000,4500000,9000000,3500000,1200000,750000,18950000,6050000,23400000
Июн,28000000,5000000,10000000,4000000,1350000,800000,21150000,6850000,30250000
Июл,30000000,5200000,11000000,4200000,1450000,850000,22700000,7300000,37550000
Авг,28000000,5000000,10500000,4000000,1400000,800000,21700000,6300000,43850000
Сен,25000000,4500000,9500000,3500000,1250000,750000,19500000,5500000,49350000
Окт,20000000,4000000,7500000,2800000,1100000,700000,16100000,3900000,53250000
Ноя,15000000,3500000,5500000,2200000,950000,600000,12750000,2250000,55500000
Дек,10000000,3000000,3500000,1500000,750000,500000,9250000,750000,56250000
ИТОГО,256000000,49400000,92800000,36000000,13350000,8200000,199750000,56250000,
`,
  },
};

// ============== Helpers ==============

function downloadCSV(filename: string, csv: string) {
  // BOM for Excel UTF-8 detection
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ============== Page ==============

export default function ExcelTemplatesPage() {
  // Labor calculator state
  const [r6, setR6] = useState(1);
  const [r4, setR4] = useState(4);
  const [r2, setR2] = useState(3);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [days, setDays] = useState(22);

  const calc = useMemo(() => {
    const t6 = 3317;
    const t4 = 2472;
    const t2 = 2008;
    const hours = hoursPerDay * days;
    const fot6 = r6 * t6 * hours;
    const fot4 = r4 * t4 * hours;
    const fot2 = r2 * t2 * hours;
    const fot = fot6 + fot4 + fot2;
    const nr = fot * 0.475;
    const sp = fot * 0.325;
    const total = fot + nr + sp;
    return { fot6, fot4, fot2, fot, nr, sp, total, hours };
  }, [r6, r4, r2, hoursPerDay, days]);

  const fmt = (n: number) =>
    Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');

  function downloadLaborCSV() {
    const csv = `Калькулятор стоимости труда (ФОТ)
Объект: ____
Дата расчёта: ${new Date().toLocaleDateString('ru-RU')}

Параметры:
Часов в день,${hoursPerDay}
Дней работы,${days}
Всего часов,${calc.hours}

Разряд,Тариф тг/час,Чел.,ФОТ тг
6 (бригадир),3317,${r6},${Math.round(calc.fot6)}
4 (каменщики),2472,${r4},${Math.round(calc.fot4)}
2 (подсобники),2008,${r2},${Math.round(calc.fot2)}

Итог:
ФОТ всего тг,${Math.round(calc.fot)}
НР 47.5%,${Math.round(calc.nr)}
СП 32.5%,${Math.round(calc.sp)}
ВСЕГО ТРУД,${Math.round(calc.total)}
`;
    downloadCSV('FOT_calculation.csv', csv);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-emerald-950/20 to-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition mb-4"
          >
            <span>←</span>
            <span>К разделам</span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-emerald-300">
            📋 Excel-шаблоны типовых смет — готовые к работе
          </h1>
        </div>

        {/* Intro */}
        <section className="mb-8 bg-zinc-900/60 border border-emerald-800/40 rounded-2xl p-6">
          <p className="text-zinc-200 mb-4 leading-relaxed">
            Готовые Excel-шаблоны типовых смет для быстрого старта работы. Можно скачать,
            открыть в Excel/Google Sheets и адаптировать под свой объект.
          </p>
          <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4">
            <p className="text-amber-200 text-sm">
              <strong className="text-amber-300">⚠️ ВАЖНО:</strong> Это{' '}
              <strong>УЧЕБНЫЕ шаблоны</strong> — для реальных смет используй
              сертифицированные программы (АВС-4, Смета РК, ИСТ Эталон).
            </p>
          </div>
        </section>

        {/* Section 1: Templates list */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-emerald-300 mb-4">
            1. Список шаблонов
          </h2>
          <div className="overflow-x-auto bg-zinc-900/60 border border-emerald-800/40 rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-emerald-900/40 text-emerald-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Шаблон</th>
                  <th className="text-left px-4 py-3 font-semibold">Описание</th>
                  <th className="text-left px-4 py-3 font-semibold">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {[
                  ['Ф-2 «Локальный сметный расчёт»', 'Базовая форма ЛСР с расчётом по позициям', 'Для одного раздела работ'],
                  ['Ф-3 «Сводный сметный расчёт»', '12 глав МДС 81-25, итоги', 'Для всего объекта'],
                  ['КС-2 «Акт приёмки выполненных работ»', 'Помесячный акт с детализацией', 'Промежуточные оплаты'],
                  ['КС-3 «Справка о стоимости работ»', 'Сводка для оплаты по КС-2', 'На каждый КС-2'],
                  ['ВОР «Ведомость объёмов работ»', 'Объёмы без цен по разделам', 'Для тендера'],
                  ['Калькулятор материалов', 'Расход + цены ССЦ + итог', 'Закупка'],
                  ['Калькулятор стоимости труда', 'ФОТ по разрядам с НР/СП', 'Бюджет'],
                  ['Cash flow прогноз 12 мес', 'Поступления + расходы по месяцам', 'Финансы'],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-emerald-900/20 transition">
                    <td className="px-4 py-3 font-semibold text-emerald-200">{row[0]}</td>
                    <td className="px-4 py-3 text-zinc-300">{row[1]}</td>
                    <td className="px-4 py-3 text-zinc-400">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Templates preview */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-emerald-300 mb-4">
            2. Превью шаблонов и скачивание
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(TEMPLATES).map(([key, tpl]) => (
              <div
                key={key}
                className="bg-zinc-900/60 border border-emerald-800/40 rounded-2xl p-5 flex flex-col"
              >
                <h3 className="text-lg font-bold text-emerald-300 mb-2">{tpl.title}</h3>
                <p className="text-sm text-zinc-300 mb-2">{tpl.description}</p>
                <p className="text-xs text-zinc-500 mb-3">
                  <strong className="text-zinc-400">Поля:</strong> {tpl.fields}
                </p>
                <details className="mb-4 group">
                  <summary className="cursor-pointer text-sm text-emerald-400 hover:text-emerald-300 select-none">
                    Превью CSV ▼
                  </summary>
                  <pre className="mt-2 bg-zinc-950/60 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto max-h-48">
                    {tpl.csv.split('\n').slice(0, 10).join('\n')}
                    {tpl.csv.split('\n').length > 10 && '\n...'}
                  </pre>
                </details>
                <button
                  onClick={() => downloadCSV(`${key}_template.csv`, tpl.csv)}
                  className="mt-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  ⬇ Скачать .csv
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Instructions card */}
        <section className="mb-10">
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-emerald-300 mb-4">
              📖 Как использовать шаблоны
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-zinc-200">
              <li>
                Скачай нужный шаблон (.csv или открой в Excel).
              </li>
              <li>
                Заполни шапку (<strong>Объект, Заказчик, Подрядчик, Дата</strong>).
              </li>
              <li>
                Введи свои позиции работ (можно добавлять строки).
              </li>
              <li>
                Формулы итогов нужно проверить — Excel должен автоматически пересчитать
                (если нет — вручную в ячейке: <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-emerald-300">=SUM(...)</code>).
              </li>
              <li>
                Сохрани как <strong>.xlsx</strong> и пришли заказчику или в комиссию.
              </li>
            </ol>
            <div className="mt-4 text-sm text-zinc-400 bg-zinc-950/40 rounded-lg p-3">
              <strong className="text-emerald-300">💡 Совет:</strong> CSV открывается в Excel,
              Google Sheets, LibreOffice. После доработки сохрани как .xlsx — там работают
              формулы и форматирование.
            </div>
          </div>
        </section>

        {/* Section 3: Labor calculator */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-emerald-300 mb-4">
            3. Калькулятор стоимости труда (интерактивный)
          </h2>
          <div className="bg-zinc-900/60 border border-emerald-800/40 rounded-2xl p-6">
            <p className="text-sm text-zinc-400 mb-4">
              Тарифы 2025 (РК): 6 разряд — 3317 тг/час, 4 разряд — 2472 тг/час, 2 разряд — 2008 тг/час.
              НР = 47.5% от ФОТ, СП = 32.5% от ФОТ.
            </p>

            <div className="grid md:grid-cols-5 gap-4 mb-6">
              <label className="block">
                <span className="text-xs text-zinc-400 block mb-1">Бригадир (6 разряд)</span>
                <input
                  type="number"
                  min={0}
                  value={r6}
                  onChange={(e) => setR6(Math.max(0, +e.target.value || 0))}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-zinc-100"
                />
                <span className="text-xs text-zinc-500">чел.</span>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400 block mb-1">Каменщики (4 разряд)</span>
                <input
                  type="number"
                  min={0}
                  value={r4}
                  onChange={(e) => setR4(Math.max(0, +e.target.value || 0))}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-zinc-100"
                />
                <span className="text-xs text-zinc-500">чел.</span>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400 block mb-1">Подсобники (2 разряд)</span>
                <input
                  type="number"
                  min={0}
                  value={r2}
                  onChange={(e) => setR2(Math.max(0, +e.target.value || 0))}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-zinc-100"
                />
                <span className="text-xs text-zinc-500">чел.</span>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400 block mb-1">Часов в день</span>
                <input
                  type="number"
                  min={1}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(Math.max(1, +e.target.value || 1))}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-zinc-100"
                />
                <span className="text-xs text-zinc-500">час</span>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400 block mb-1">Дней работы</span>
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, +e.target.value || 1))}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-zinc-100"
                />
                <span className="text-xs text-zinc-500">дн.</span>
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4">
                <h4 className="text-emerald-300 font-semibold mb-3">Расчёт по разрядам</h4>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-800">
                    <tr>
                      <td className="py-2 text-zinc-400">6 разряд (×{r6})</td>
                      <td className="py-2 text-right text-zinc-200 font-mono">{fmt(calc.fot6)} тг</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-zinc-400">4 разряд (×{r4})</td>
                      <td className="py-2 text-right text-zinc-200 font-mono">{fmt(calc.fot4)} тг</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-zinc-400">2 разряд (×{r2})</td>
                      <td className="py-2 text-right text-zinc-200 font-mono">{fmt(calc.fot2)} тг</td>
                    </tr>
                    <tr className="border-t-2 border-emerald-800/60">
                      <td className="py-2 text-emerald-300 font-semibold">ФОТ всего</td>
                      <td className="py-2 text-right text-emerald-300 font-mono font-bold">{fmt(calc.fot)} тг</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-4">
                <h4 className="text-emerald-200 font-semibold mb-3">Накладные и прибыль</h4>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-emerald-900/50">
                    <tr>
                      <td className="py-2 text-zinc-300">ФОТ</td>
                      <td className="py-2 text-right text-zinc-100 font-mono">{fmt(calc.fot)} тг</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-zinc-300">НР (47.5%)</td>
                      <td className="py-2 text-right text-zinc-100 font-mono">{fmt(calc.nr)} тг</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-zinc-300">СП (32.5%)</td>
                      <td className="py-2 text-right text-zinc-100 font-mono">{fmt(calc.sp)} тг</td>
                    </tr>
                    <tr className="border-t-2 border-emerald-600/60">
                      <td className="py-2 text-emerald-200 font-bold">ИТОГО</td>
                      <td className="py-2 text-right text-emerald-200 font-mono font-bold text-base">
                        {fmt(calc.total)} тг
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-zinc-400 mt-3">
                  Всего часов: {calc.hours} ({hoursPerDay} ч × {days} дн.)
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={downloadLaborCSV}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-5 rounded-lg transition"
              >
                ⬇ Скачать расчёт ФОТ как CSV
              </button>
            </div>
          </div>
        </section>

        {/* Factoid */}
        <section className="mb-8">
          <div className="bg-emerald-900/40 border-l-4 border-emerald-400 rounded-r-2xl p-5">
            <h3 className="text-emerald-300 font-bold mb-2">💡 Факт</h3>
            <p className="text-zinc-200 leading-relaxed">
              Excel-шаблоны хороши для <strong>учёбы и небольших проектов</strong>.
              Для крупных и государственных — обязательно специализированные программы
              (АВС-4, Смета РК, ИСТ Эталон). Excel удобен для <strong>прогноза cash flow,
              графиков работ, отчётов прорабу</strong>.
            </p>
          </div>
        </section>

        {/* Footer nav */}
        <div className="border-t border-zinc-800 pt-6">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition"
          >
            <span>←</span>
            <span>Вернуться к разделам</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
