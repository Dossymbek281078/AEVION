// Расчётный движок ЛСР. Чистые функции, без сайд-эффектов.
//
// Принцип учебного расчёта:
//   ПЗ_позиции = объём × baseCostPerUnit (в базисе)
//     ↓ применяем суммарный коэффициент условий производства работ
//   ПЗ_позиции_с_коэф = ПЗ × Π(coefficients)
//     ↓ разносим по компонентам (ФОТ / ЭМ / материалы) пропорционально базисной структуре
//     ↓ применяем индексы пересчёта по компонентам
//   ПЗ_текущие = ФОТ_тек + ЭМ_тек + Материалы_тек
//
//   НР = ФОТ_тек × overheadPct%
//   СП = ФОТ_тек × profitPct%   (для категорий с base = "ФОТ")
//   Итого_раздела = Σ ПЗ_текущие + НР + СП
//
// НДС применяется один раз на итог сметы.

import type {
  Rate,
  SmetaPosition,
  SmetaSection,
  Lsr,
  IndexSet,
  OverheadRules,
  PositionCalc,
  SectionCalc,
  LsrCalc,
} from "./types";
import { findRate, findOverhead, findIndex } from "./corpus";

const VAT_RATE = 0.12;

/** Сумма произведения коэффициентов условий производства работ. */
export function appliedCoefMultiplier(position: SmetaPosition): number {
  return position.coefficients.reduce((acc, c) => acc * c.value, 1);
}

/** Базисная структура расценки: разнесение baseCostPerUnit по компонентам. */
export function rateBaseStructure(rate: Rate): { fot: number; em: number; emMachinistWage: number; materials: number } {
  let fot = 0;
  let em = 0;
  let emMachinistWage = 0;
  let materials = 0;

  for (const r of rate.resources) {
    const cost = r.qtyPerUnit * r.basePrice;
    if (r.kind === "труд") {
      fot += cost;
    } else if (r.kind === "машины") {
      em += cost;
      // ЗП машинистов идёт в ФОТ, но числится внутри ЭМ.
      // Считаем отдельно для корректного применения индексов.
      const wage = (r.machinistWageRate ?? 0) * r.qtyPerUnit;
      emMachinistWage += wage;
    } else if (r.kind === "материал") {
      materials += cost;
    }
  }

  return { fot, em, emMachinistWage, materials };
}

/** Расчёт одной позиции. */
export function calcPosition(
  position: SmetaPosition,
  index: IndexSet | undefined
): PositionCalc | null {
  const rate = findRate(position.rateCode);
  if (!rate) return null;

  const struct = rateBaseStructure(rate);
  const baseDirect = struct.fot + struct.em + struct.materials;
  const coefMul = appliedCoefMultiplier(position);

  // Базисные суммы по позиции = структура × объём × коэффициент
  const baseFotPos = struct.fot * position.volume * coefMul;
  const baseEmPos = struct.em * position.volume * coefMul;
  const baseMatPos = struct.materials * position.volume * coefMul;
  const baseEmMachWagePos = struct.emMachinistWage * position.volume * coefMul;

  // Применение индексов:
  //  - индекс к ФОТ применяется к ФОТ + ЗП машинистов (по СН РК 8.02-07 учебно)
  //  - индекс к ЭМ применяется к стоимости ЭМ за вычетом ЗП машинистов
  //  - индекс к материалам — к материалам
  const idxFOT = index?.toFOT ?? 1;
  const idxEM = index?.toEM ?? 1;
  const idxMat = index?.toMaterials ?? 1;

  const curFot = (baseFotPos + baseEmMachWagePos) * idxFOT;
  const curEm = (baseEmPos - baseEmMachWagePos) * idxEM;
  const curMat = baseMatPos * idxMat;
  const curDirect = curFot + curEm + curMat;

  return {
    position,
    rate,
    base: {
      fot: baseFotPos,
      em: baseEmPos,
      emMachinistWage: baseEmMachWagePos,
      materials: baseMatPos,
      direct: baseFotPos + baseEmPos + baseMatPos,
    },
    appliedCoefMultiplier: coefMul,
    current: {
      fot: curFot,
      em: curEm,
      materials: curMat,
      direct: curDirect,
    },
  };
}

/** Расчёт раздела. */
export function calcSection(section: SmetaSection, index: IndexSet | undefined): SectionCalc {
  const positions: PositionCalc[] = [];
  for (const p of section.positions) {
    const calc = calcPosition(p, index);
    if (calc) positions.push(calc);
  }

  const direct = positions.reduce((s, p) => s + p.current.direct, 0);
  const fot = positions.reduce((s, p) => s + p.current.fot, 0);

  // НР и СП — по правилам категории раздела (учебно: одна категория на раздел)
  const overheadRule = findOverhead(section.category);
  const overheadPct = overheadRule?.overheadPct ?? 0;
  const profitPct = overheadRule?.profitPct ?? 0;

  // Если база "ФОТ" — берём ФОТ; если "ПЗ" — берём direct (учебно).
  const overheadBase = overheadRule?.base === "ПЗ" ? direct : fot;
  const overhead = (overheadBase * overheadPct) / 100;
  const profit = (overheadBase * profitPct) / 100;

  return {
    section,
    positions,
    direct,
    fot,
    overhead,
    profit,
    total: direct + overhead + profit,
  };
}

/** Расчёт всей ЛСР. */
export function calcLsr(lsr: Lsr): LsrCalc {
  const index = findIndex(lsr.indexRegion, lsr.indexQuarter);

  const sections = lsr.sections.map((s) => calcSection(s, index));
  const totalBeforeVat = sections.reduce((s, sec) => s + sec.total, 0);
  const vat = totalBeforeVat * VAT_RATE;

  return {
    lsr,
    sections,
    totalBeforeVat,
    vat,
    totalWithVat: totalBeforeVat + vat,
  };
}

/** Форматирование тенге для UI: разделители тысяч + 0 копеек. */
export function formatKzt(value: number): string {
  const n = Math.round(value);
  return n.toLocaleString("ru-RU") + " ₸";
}

/** Форматирование тенге с копейками. */
export function formatKztPrecise(value: number): string {
  return value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₸";
}
