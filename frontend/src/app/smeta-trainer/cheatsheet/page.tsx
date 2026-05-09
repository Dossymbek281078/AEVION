"use client";

import Link from "next/link";

/**
 * Шпаргалка сметчика РК — A4 portrait, печатная.
 * Содержит все формулы, нормативы НР/СП, коэффициенты, структуру ССР и
 * лимитированных затрат. Источники указаны в подвале.
 */
export default function CheatsheetPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      {/* Toolbar (скрыт при печати) */}
      <div className="max-w-3xl mx-auto mb-3 flex items-center justify-between print:hidden">
        <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
          ← К курсу
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700"
        >
          🖨 Печать / PDF (A4)
        </button>
      </div>

      {/* Сама шпаргалка */}
      <div className="max-w-3xl mx-auto bg-white border border-slate-300 rounded-lg shadow-sm print:shadow-none print:border-0 p-6 text-[11px] leading-snug text-slate-800">
        {/* Заголовок */}
        <div className="text-center mb-4 pb-3 border-b-2 border-emerald-600">
          <div className="text-base font-bold text-slate-900">ШПАРГАЛКА СМЕТЧИКА РК</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            НДЦС РК 8.01-08-2022 · СН РК 8.02-07/-09 · ССЦ РК 8.04-08-2025
          </div>
        </div>

        {/* 1. ФОРМУЛЫ */}
        <section className="mb-4">
          <div className="text-xs font-bold text-emerald-700 uppercase mb-1.5">1. Базовые формулы</div>
          <div className="bg-emerald-50/40 border border-emerald-200 rounded p-2 space-y-1 font-mono text-[11px]">
            <div><span className="text-slate-500">Прямые затраты позиции:</span> <strong>ПЗ = ФОТ + ЭМ + Материалы</strong></div>
            <div><span className="text-slate-500">Стоимость позиции:</span> <strong>S<sub>поз</sub> = (ПЗ × К<sub>усл</sub>) × Индекс × V<sub>объём</sub></strong></div>
            <div><span className="text-slate-500">Накладные расходы:</span> <strong>НР = ФОТ × %НР<sub>категории</sub></strong></div>
            <div><span className="text-slate-500">Сметная прибыль:</span> <strong>СП = ФОТ × %СП<sub>категории</sub></strong></div>
            <div><span className="text-slate-500">Итог раздела:</span> <strong>Σ = ПЗ + НР + СП</strong></div>
            <div><span className="text-slate-500">Итог ЛСР с НДС:</span> <strong>ЛСР<sub>с НДС</sub> = Σ × 1.12</strong></div>
          </div>
        </section>

        {/* 2. НР/СП ПО КАТЕГОРИЯМ */}
        <section className="mb-4">
          <div className="text-xs font-bold text-emerald-700 uppercase mb-1.5">2. НР и СП по категориям работ</div>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-2 py-1 text-left">Категория работ</th>
                <th className="border border-slate-300 px-2 py-1 text-right">НР, % от ФОТ</th>
                <th className="border border-slate-300 px-2 py-1 text-right">СП, % от ФОТ</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Общестроительные", "120", "65"],
                ["Ремонтно-строительные", "95", "50"],
                ["Отделочные", "95", "50"],
                ["Земляные", "115", "60"],
                ["Кровельные", "110", "55"],
                ["Демонтажные", "85", "45"],
                ["Сантехнические (внутр.)", "100", "55"],
                ["Электромонтажные (внутр.)", "100", "55"],
                ["Монтаж оборудования", "85", "55"],
              ].map(([name, nr, sp]) => (
                <tr key={name} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1">{name}</td>
                  <td className="border border-slate-200 px-2 py-1 text-right font-mono">{nr}%</td>
                  <td className="border border-slate-200 px-2 py-1 text-right font-mono">{sp}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] text-slate-500 italic mt-1">
            Точные значения смотрите в СН РК 8.02-07-2014 (НР) и 8.02-09-2018 (СП). В учебном
            корпусе тренажёра проценты могут быть округлены.
          </div>
        </section>

        {/* 3. КОЭФФИЦИЕНТЫ */}
        <section className="mb-4">
          <div className="text-xs font-bold text-emerald-700 uppercase mb-1.5">3. Коэффициенты условий производства работ</div>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-2 py-1 text-left">Условие</th>
                <th className="border border-slate-300 px-2 py-1 text-center">К к ФОТ</th>
                <th className="border border-slate-300 px-2 py-1 text-center">К к ЭМ</th>
                <th className="border border-slate-300 px-2 py-1 text-left">Когда применять</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Действующее здание (школа, больница)", "1.15", "1.25", "Капремонт без остановки эксплуатации"],
                ["Стеснённые помещения < 50 м²", "1.10", "1.20", "Узкие классы, санузлы, серверные"],
                ["Работы вблизи действ. коммуникаций", "1.05", "1.05", "Вскрытие полов рядом с трубами"],
                ["Работы на высоте 3-5 м", "1.10", "—", "Без штатных лесов, на стремянке"],
                ["Работы на высоте > 5 м", "1.20", "—", "С лесами, страховкой"],
                ["Зимний период (откр. возд.)", "1.07-1.13", "—", "По СН РК 8.02-09, регион Алматы"],
                ["В охранной зоне ЛЭП", "1.20", "1.50", "Все работы вблизи действующей ЛЭП"],
              ].map(([cond, kfot, kem, when]) => (
                <tr key={cond} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1">{cond}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-mono font-semibold">{kfot}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-mono">{kem}</td>
                  <td className="border border-slate-200 px-2 py-1 text-slate-500 text-[9px]">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] text-slate-500 italic mt-1">
            Коэффициенты НЕ перемножаются на одну позицию свыше К=1.50 — в этом случае требуется
            индивидуальное обоснование для экспертизы.
          </div>
        </section>

        {/* 4. СТРУКТУРА ССР */}
        <section className="mb-4">
          <div className="text-xs font-bold text-emerald-700 uppercase mb-1.5">4. 12 глав ССР (Форма 1)</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            {[
              ["1", "Подготовка территории строительства"],
              ["2", "Основные объекты строительства"],
              ["3", "Объекты подсобного и обслуживающего назначения"],
              ["4", "Объекты энергетического хозяйства"],
              ["5", "Объекты транспортного хозяйства и связи"],
              ["6", "Наружные сети и сооружения ВК и теплоснабжения"],
              ["7", "Благоустройство и озеленение территории"],
              ["8", "Временные здания и сооружения (1.5% от гл.1-7)"],
              ["9", "Прочие работы и затраты (зимние, вахта, 3%)"],
              ["10", "Содержание дирекции"],
              ["11", "Подготовка эксплуатационных кадров"],
              ["12", "Проектные работы и авторский надзор (~2.5%)"],
            ].map(([num, name]) => (
              <div key={num} className="flex gap-1.5 leading-tight">
                <span className="font-mono text-slate-400 shrink-0 w-4 text-right">{num}.</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. ПОТОК ДАННЫХ */}
        <section className="mb-4">
          <div className="text-xs font-bold text-emerald-700 uppercase mb-1.5">5. Поток данных в ПСД</div>
          <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px]">
            <div className="flex items-center justify-between gap-1 flex-wrap font-mono">
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">Дефектная ведомость</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">ВОР</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">ЛСР</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">Объектная (Форма 3)</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-emerald-100 border border-emerald-400 px-2 py-1 rounded font-bold">ССР (Форма 1)</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-1 flex-wrap font-mono">
              <span className="bg-emerald-100 border border-emerald-400 px-2 py-1 rounded font-bold">ССР</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">Госэкспертиза</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">Договор</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">КС-2</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">КС-3</span>
              <span className="text-emerald-600">→</span>
              <span className="bg-white border border-slate-300 px-2 py-1 rounded">Оплата</span>
            </div>
          </div>
        </section>

        {/* 6. ИНДЕКСЫ + ССЦ */}
        <section className="mb-4">
          <div className="text-xs font-bold text-emerald-700 uppercase mb-1.5">6. Базис → Текущий уровень</div>
          <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px] space-y-1">
            <div>
              <strong>Базис:</strong> цены 2001 г. (ССЦ РК 8.04-08-2025 — материалы; СЦЗТ — труд; СЦЭМ — машины)
            </div>
            <div>
              <strong>Индексы:</strong> публикуются КУСО (МНЭ РК) поквартально по регионам и видам работ
            </div>
            <div>
              <strong>Применение:</strong> S<sub>текущ</sub> = S<sub>базис</sub> × Индекс<sub>квартала</sub>
            </div>
            <div className="text-amber-700 mt-1">
              <strong>⚠️ Двойной учёт:</strong> если применили коэффициент в позиции — НЕ применяйте тот же
              коэффициент к итогу раздела. Один коэффициент = одно место.
            </div>
          </div>
        </section>

        {/* 7. КАК ПРОВЕРИТЬ СМЕТУ */}
        <section className="mb-2">
          <div className="text-xs font-bold text-emerald-700 uppercase mb-1.5">7. Чек-лист самопроверки ЛСР</div>
          <ol className="list-decimal pl-5 text-[10px] space-y-0.5">
            <li>Все объёмы из ВОР с формулой и ссылкой на чертёж?</li>
            <li>Из площади полов вычтены проёмы (двери, технические)?</li>
            <li>Применён К стеснённости для действующего здания (К=1.15)?</li>
            <li>НР и СП посчитаны от ФОТ (а не от ПЗ)?</li>
            <li>Индекс соответствует кварталу из шапки ЛСР?</li>
            <li>Один коэф. применён только в одном месте (нет двойного учёта)?</li>
            <li>Зимние работы — учтены в гл. 9 ССР или в зимнем коэф. (не оба)?</li>
            <li>НДС 12% начислен только в итоге, не на каждой позиции?</li>
          </ol>
        </section>

        {/* Подвал */}
        <div className="mt-3 pt-2 border-t border-slate-300 flex justify-between items-end text-[9px] text-slate-500">
          <div>
            <strong>AEVION · Сметный тренажёр РК</strong>
            <div className="text-slate-400">aevion.kz / smeta-trainer</div>
          </div>
          <div className="text-right text-slate-400 italic">
            Шпаргалка для учебных целей. Реальная экспертиза — ИСТ Эталон + ГЭ.
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
