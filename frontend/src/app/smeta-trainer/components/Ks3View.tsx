"use client";

import { useMemo, useState } from "react";
import type { LsrCalc } from "../lib/types";
import { formatKzt } from "../lib/calc";

interface Props {
  calc: LsrCalc;
  /** Список периодов из КС-2 (берём из родителя). */
  ks2Periods?: Array<{ id: string; name: string; volumes: Record<string, number> }>;
}

/**
 * КС-3 — Справка о стоимости выполненных работ и затрат.
 * Накопительная справка: разбивка стоимости по разделам, с тремя итогами:
 *   • за отчётный период
 *   • с начала года
 *   • с начала строительства
 *
 * В учебном виде упрощено — берём периоды из КС-2 (если КС-2 заполнена)
 * и считаем стоимость каждого периода = Σ(объём периода × текущая ц. ед.).
 * Для НДС применяется единая ставка 12% на итог.
 */
export function Ks3View({ calc, ks2Periods = [] }: Props) {
  const [activePeriodId, setActivePeriodId] = useState<string | null>(
    ks2Periods.at(-1)?.id ?? null,
  );
  const [yearStart, setYearStart] = useState<string | null>(
    ks2Periods[0]?.id ?? null,
  );

  const VAT = 0.12;

  // Map positionId → unitPrice (текущая цена единицы) и section
  const unitPriceByPos = useMemo(() => {
    const m = new Map<string, { unitPrice: number; sectionTitle: string; sectionCategory: string; sectionId: string }>();
    for (const sc of calc.sections) {
      for (const p of sc.positions) {
        m.set(p.position.id, {
          unitPrice: p.unitPrice,
          sectionTitle: sc.section.title,
          sectionCategory: sc.section.category,
          sectionId: sc.section.id,
        });
      }
    }
    return m;
  }, [calc]);

  // Сумма за отдельный период (без НР/СП множителя, упрощённо)
  function periodCost(period: { volumes: Record<string, number> }): number {
    let total = 0;
    for (const [posId, vol] of Object.entries(period.volumes)) {
      const meta = unitPriceByPos.get(posId);
      if (!meta) continue;
      total += meta.unitPrice * vol;
    }
    return total;
  }

  // Накопительные суммы
  const totalsByPeriod = useMemo(() => {
    return ks2Periods.map((p) => ({ id: p.id, name: p.name, cost: periodCost(p) }));
  }, [ks2Periods, unitPriceByPos]);

  const cumByPeriodId = useMemo(() => {
    const m = new Map<string, number>();
    let acc = 0;
    for (const t of totalsByPeriod) {
      acc += t.cost;
      m.set(t.id, acc);
    }
    return m;
  }, [totalsByPeriod]);

  if (ks2Periods.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        КС-3 формируется на основе данных КС-2. Сначала откройте таб «КС-2»
        и заведите хотя бы один отчётный период с фактическими объёмами.
      </div>
    );
  }

  const activePeriod = ks2Periods.find((p) => p.id === activePeriodId);
  const activeIdx = ks2Periods.findIndex((p) => p.id === activePeriodId);
  const yearStartIdx = yearStart ? ks2Periods.findIndex((p) => p.id === yearStart) : 0;

  // Сумма за отчётный период
  const periodTotal = activePeriod ? periodCost(activePeriod) : 0;
  // С начала года: сумма периодов от yearStart до active включительно
  const yearTotal = ks2Periods
    .slice(Math.max(0, yearStartIdx), Math.max(0, activeIdx) + 1)
    .reduce((s, p) => s + periodCost(p), 0);
  // С начала строительства: сумма всех периодов от первого до активного включительно
  const allTimeTotal = activePeriod ? (cumByPeriodId.get(activePeriod.id) ?? 0) : 0;

  // По разделам — за отчётный период
  const bySection = useMemo(() => {
    const m = new Map<string, { title: string; category: string; cost: number; cumYear: number; cumAll: number }>();
    for (const sc of calc.sections) {
      m.set(sc.section.id, {
        title: sc.section.title,
        category: sc.section.category,
        cost: 0,
        cumYear: 0,
        cumAll: 0,
      });
    }
    if (!activePeriod) return m;
    // отчётный период
    for (const [posId, vol] of Object.entries(activePeriod.volumes)) {
      const meta = unitPriceByPos.get(posId);
      if (!meta) continue;
      const e = m.get(meta.sectionId);
      if (!e) continue;
      e.cost += meta.unitPrice * vol;
    }
    // с начала года
    for (let i = Math.max(0, yearStartIdx); i <= Math.max(0, activeIdx); i++) {
      const p = ks2Periods[i];
      if (!p) continue;
      for (const [posId, vol] of Object.entries(p.volumes)) {
        const meta = unitPriceByPos.get(posId);
        if (!meta) continue;
        const e = m.get(meta.sectionId);
        if (!e) continue;
        e.cumYear += meta.unitPrice * vol;
      }
    }
    // с начала строительства
    for (let i = 0; i <= Math.max(0, activeIdx); i++) {
      const p = ks2Periods[i];
      for (const [posId, vol] of Object.entries(p.volumes)) {
        const meta = unitPriceByPos.get(posId);
        if (!meta) continue;
        const e = m.get(meta.sectionId);
        if (!e) continue;
        e.cumAll += meta.unitPrice * vol;
      }
    }
    return m;
  }, [activePeriod, ks2Periods, activeIdx, yearStartIdx, unitPriceByPos, calc]);

  return (
    <div className="p-4 space-y-4">
      {/* Шапка КС-3 */}
      <div className="bg-white border-2 border-slate-300 rounded-lg p-4">
        <div className="text-center mb-4">
          <div className="text-xs text-slate-500">Унифицированная форма</div>
          <h2 className="text-lg font-bold text-slate-900">
            СПРАВКА О СТОИМОСТИ ВЫПОЛНЕННЫХ РАБОТ И ЗАТРАТ
          </h2>
          <div className="text-xs font-bold text-slate-700 mt-1">Форма КС-3 (учебная)</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500">Стройка:</span>{" "}
            <span className="font-semibold">{calc.lsr.title}</span>
          </div>
          <div>
            <span className="text-slate-500">Метод:</span>{" "}
            <span className="font-semibold">{calc.lsr.method}</span>
          </div>
          <div>
            <span className="text-slate-500">Регион индексов:</span>{" "}
            <span className="font-semibold">{calc.lsr.indexRegion}</span>
          </div>
          <div>
            <span className="text-slate-500">Квартал индексов:</span>{" "}
            <span className="font-semibold">{calc.lsr.indexQuarter}</span>
          </div>
        </div>
      </div>

      {/* Выбор периода + начала года */}
      <div className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-4">
        <div>
          <label className="text-[10px] text-slate-500 uppercase block mb-0.5">
            Отчётный период
          </label>
          <select
            value={activePeriodId ?? ""}
            onChange={(e) => setActivePeriodId(e.target.value || null)}
            className="border rounded px-2 py-1 text-sm"
          >
            {ks2Periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase block mb-0.5">
            С начала года (от периода)
          </label>
          <select
            value={yearStart ?? ""}
            onChange={(e) => setYearStart(e.target.value || null)}
            className="border rounded px-2 py-1 text-sm"
          >
            {ks2Periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Таблица КС-3 */}
      <div className="bg-white border-2 border-slate-300 rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr className="text-left text-slate-700">
              <th className="px-2 py-2 border-b border-slate-300 w-8 text-center">№</th>
              <th className="px-2 py-2 border-b border-slate-300">
                Наименование работ и затрат
              </th>
              <th className="px-2 py-2 border-b border-slate-300 w-24 text-right">
                Сметная стоимость
              </th>
              <th className="px-2 py-2 border-b border-slate-300 w-32 text-right">
                За отчётный период
              </th>
              <th className="px-2 py-2 border-b border-slate-300 w-32 text-right">
                С начала года
              </th>
              <th className="px-2 py-2 border-b border-slate-300 w-32 text-right">
                С начала строительства
              </th>
            </tr>
          </thead>
          <tbody>
            {calc.sections.map((sc, i) => {
              const e = bySection.get(sc.section.id);
              if (!e) return null;
              return (
                <tr key={sc.section.id} className="border-b hover:bg-slate-50">
                  <td className="px-2 py-1.5 text-center text-slate-500">{i + 1}</td>
                  <td className="px-2 py-1.5 text-slate-800">
                    {sc.section.title}
                    <span className="text-[10px] text-slate-400 ml-2">
                      ({sc.section.category})
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">
                    {formatKzt(sc.total)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-emerald-700 tabular-nums font-semibold">
                    {formatKzt(e.cost)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">
                    {formatKzt(e.cumYear)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">
                    {formatKzt(e.cumAll)}
                  </td>
                </tr>
              );
            })}
            {/* Строка ИТОГО */}
            <tr className="font-bold bg-slate-50 border-t-2 border-slate-400">
              <td colSpan={2} className="px-2 py-2 text-right">ИТОГО:</td>
              <td className="px-2 py-2 text-right text-slate-700 tabular-nums">
                {formatKzt(calc.totalBeforeVat)}
              </td>
              <td className="px-2 py-2 text-right text-emerald-700 tabular-nums">
                {formatKzt(periodTotal)}
              </td>
              <td className="px-2 py-2 text-right text-slate-700 tabular-nums">
                {formatKzt(yearTotal)}
              </td>
              <td className="px-2 py-2 text-right text-slate-700 tabular-nums">
                {formatKzt(allTimeTotal)}
              </td>
            </tr>
            {/* НДС */}
            <tr className="bg-slate-50 border-b">
              <td colSpan={2} className="px-2 py-1.5 text-right text-slate-600">
                НДС {(VAT * 100).toFixed(0)}%:
              </td>
              <td className="px-2 py-1.5 text-right text-slate-500 tabular-nums">
                {formatKzt(calc.vat)}
              </td>
              <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">
                {formatKzt(periodTotal * VAT)}
              </td>
              <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">
                {formatKzt(yearTotal * VAT)}
              </td>
              <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">
                {formatKzt(allTimeTotal * VAT)}
              </td>
            </tr>
            {/* Всего к оплате */}
            <tr className="font-bold bg-emerald-50 border-t border-slate-400">
              <td colSpan={2} className="px-2 py-2 text-right">ВСЕГО к оплате:</td>
              <td className="px-2 py-2 text-right text-slate-700 tabular-nums">
                {formatKzt(calc.totalWithVat)}
              </td>
              <td className="px-2 py-2 text-right text-emerald-700 tabular-nums">
                {formatKzt(periodTotal * (1 + VAT))}
              </td>
              <td className="px-2 py-2 text-right text-slate-700 tabular-nums">
                {formatKzt(yearTotal * (1 + VAT))}
              </td>
              <td className="px-2 py-2 text-right text-slate-700 tabular-nums">
                {formatKzt(allTimeTotal * (1 + VAT))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Подписи */}
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 gap-6 text-xs">
        <div>
          <div className="text-slate-500 mb-1">Заказчик (генподрядчик):</div>
          <div className="border-b border-slate-300 h-6"></div>
          <div className="text-[10px] text-slate-400 mt-1 text-center">
            должность, подпись, расшифровка
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-1">Подрядчик (субподрядчик):</div>
          <div className="border-b border-slate-300 h-6"></div>
          <div className="text-[10px] text-slate-400 mt-1 text-center">
            должность, подпись, расшифровка
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 px-2">
        Учебная справка КС-3 (упрощённая). В реальности форма утверждена
        Постановлением Госкомстата РФ № 100 от 11.11.1999 (применяется по аналогии в РК).
        Стоимость рассчитана по текущим ценам с применением индексов «{calc.lsr.indexRegion} ·{" "}
        {calc.lsr.indexQuarter}».
      </div>
    </div>
  );
}
